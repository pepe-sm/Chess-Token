// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ChessToken.sol";

/**
 * @title ChessEscrow
 * @notice Multi-faceted game escrow contract supporting:
 *  - 1v1 head-to-head wagers with 5% platform rake and timeout refund safeguards
 *  - Permanent 1 CHESS token fee gate for Global Ranked matchmaking
 *  - Multi-player tournament knockout pools with configurable prize splits
 */
contract ChessEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    ChessToken public immutable chessToken;

    // Platform rake: 5% = 500 basis points (10,000 basis points = 100%)
    uint256 public constant RAKE_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Ranked matchmaking unlock fee: exactly 1 CHESS token (1e18 wei)
    uint256 public constant RANKED_UNLOCK_FEE = 1 * 10**18;

    // Default timeout before a creator or player can cancel an abandoned/unmatched wager
    uint256 public constant TIMEOUT_DURATION = 15 minutes;

    address public feeTreasury;
    uint256 public accumulatedRake;

    // --- Ranked Access State ---
    mapping(address => bool) public hasRankedAccess;

    // --- 1v1 Wager Escrow State ---
    enum WagerStatus { Uninitialized, Created, Active, Settled, Cancelled }

    struct Wager {
        bytes32 matchId;
        address player1;
        address player2;
        uint256 stakeAmount; // Amount each player stakes
        uint256 createdAt;
        uint256 startedAt;
        WagerStatus status;
    }

    mapping(bytes32 => Wager) public wagers;

    // --- Tournament Pool State ---
    enum TournamentStatus { Open, InProgress, Completed, Cancelled }
    enum PrizeStructure { WinnerTakeAll, TopTwo7030, TopThree503020 }

    struct Tournament {
        bytes32 tourneyId;
        uint256 entryFee;
        uint8 maxPlayers;
        PrizeStructure prizeStructure;
        TournamentStatus status;
        address[] players;
    }

    mapping(bytes32 => Tournament) public tournaments;
    mapping(bytes32 => mapping(address => bool)) public hasEnteredTournament;

    // Events
    event RankedAccessUnlocked(address indexed player);
    event WagerCreated(bytes32 indexed matchId, address indexed player1, uint256 stakeAmount);
    event WagerJoined(bytes32 indexed matchId, address indexed player2);
    event WagerSettled(bytes32 indexed matchId, address indexed winner, uint256 payout, uint256 rake);
    event WagerDrawn(bytes32 indexed matchId, uint256 refundAmount);
    event WagerCancelled(bytes32 indexed matchId, address indexed canceller, string reason);

    event TournamentCreated(bytes32 indexed tourneyId, uint256 entryFee, uint8 maxPlayers, PrizeStructure structure);
    event TournamentRegistered(bytes32 indexed tourneyId, address indexed player);
    event TournamentPrizesDistributed(bytes32 indexed tourneyId, address[] winners, uint256 totalPayout, uint256 rake);
    event TournamentCancelled(bytes32 indexed tourneyId);
    event RakeWithdrawn(address indexed treasury, uint256 amount);

    // Errors
    error InvalidParameters();
    error AlreadyUnlocked();
    error WagerExists();
    error WagerNotFound();
    error WagerNotOpen();
    error WagerNotActive();
    error UnauthorizedCaller();
    error MatchNotTimedOut(uint256 elapsed, uint256 timeoutRequired);
    error TournamentFull();
    error TournamentNotOpen();
    error TournamentAlreadyEntered();
    error InvalidWinnersCount();

    constructor(address _chessToken, address _treasury, address initialOwner) Ownable(initialOwner) {
        chessToken = ChessToken(_chessToken);
        feeTreasury = _treasury != address(0) ? _treasury : initialOwner;
    }

    // ==========================================
    // 1. GLOBAL RANKED ACCESS GATE
    // ==========================================

    /**
     * @notice Unlocks global ranked matchmaking permanently by burning/transferring 1 CHESS token.
     */
    function unlockRankedAccess() external nonReentrant {
        if (hasRankedAccess[msg.sender]) revert AlreadyUnlocked();

        // Transfer 1 CHESS from player to escrow/treasury or burn
        IERC20(address(chessToken)).safeTransferFrom(msg.sender, address(this), RANKED_UNLOCK_FEE);
        accumulatedRake += RANKED_UNLOCK_FEE;
        hasRankedAccess[msg.sender] = true;

        emit RankedAccessUnlocked(msg.sender);
    }

    function isRankedUnlocked(address player) external view returns (bool) {
        return hasRankedAccess[player];
    }

    // ==========================================
    // 2. 1v1 HEAD-TO-HEAD WAGER ESCROW
    // ==========================================

    /**
     * @notice Creates a new 1v1 staked wager match. Player 1 deposits stakeAmount of CHESS.
     */
    function createWager(bytes32 matchId, uint256 stakeAmount) external nonReentrant {
        if (stakeAmount == 0) revert InvalidParameters();
        if (wagers[matchId].status != WagerStatus.Uninitialized) revert WagerExists();

        IERC20(address(chessToken)).safeTransferFrom(msg.sender, address(this), stakeAmount);

        wagers[matchId] = Wager({
            matchId: matchId,
            player1: msg.sender,
            player2: address(0),
            stakeAmount: stakeAmount,
            createdAt: block.timestamp,
            startedAt: 0,
            status: WagerStatus.Created
        });

        emit WagerCreated(matchId, msg.sender, stakeAmount);
    }

    /**
     * @notice Opponent (Player 2) joins the wager by matching the exact stakeAmount.
     */
    function joinWager(bytes32 matchId) external nonReentrant {
        Wager storage wager = wagers[matchId];
        if (wager.status != WagerStatus.Created) revert WagerNotOpen();
        if (msg.sender == wager.player1) revert InvalidParameters();

        IERC20(address(chessToken)).safeTransferFrom(msg.sender, address(this), wager.stakeAmount);

        wager.player2 = msg.sender;
        wager.startedAt = block.timestamp;
        wager.status = WagerStatus.Active;

        emit WagerJoined(matchId, msg.sender);
    }

    /**
     * @notice Settles the wager upon game completion. Winner receives 95% of pot, 5% rake is deducted.
     * Can be called by the game referee/contract owner or both players by signature/oracle.
     */
    function settleWager(bytes32 matchId, address winner) external nonReentrant {
        Wager storage wager = wagers[matchId];
        if (wager.status != WagerStatus.Active) revert WagerNotActive();
        if (winner != wager.player1 && winner != wager.player2) revert InvalidParameters();
        if (msg.sender != owner() && msg.sender != wager.player1 && msg.sender != wager.player2) {
            revert UnauthorizedCaller();
        }

        wager.status = WagerStatus.Settled;
        uint256 totalPot = wager.stakeAmount * 2;
        uint256 rake = (totalPot * RAKE_BPS) / BPS_DENOMINATOR; // 5% rake
        uint256 payout = totalPot - rake;

        accumulatedRake += rake;
        IERC20(address(chessToken)).safeTransfer(winner, payout);

        emit WagerSettled(matchId, winner, payout, rake);
    }

    /**
     * @notice In case of a draw, both players receive a 100% refund of their stake (0% rake).
     */
    function settleDraw(bytes32 matchId) external nonReentrant {
        Wager storage wager = wagers[matchId];
        if (wager.status != WagerStatus.Active) revert WagerNotActive();
        if (msg.sender != owner() && msg.sender != wager.player1 && msg.sender != wager.player2) {
            revert UnauthorizedCaller();
        }

        wager.status = WagerStatus.Settled;
        uint256 refund = wager.stakeAmount;

        IERC20(address(chessToken)).safeTransfer(wager.player1, refund);
        IERC20(address(chessToken)).safeTransfer(wager.player2, refund);

        emit WagerDrawn(matchId, refund);
    }

    /**
     * @notice Timeout Safeguard:
     * - If match was created but never joined after TIMEOUT_DURATION, player1 can cancel and get 100% refund.
     * - If match was joined and active, but an opponent abandons or disconnects past TIMEOUT_DURATION,
     *   active player or owner can cancel or settle.
     */
    function cancelWager(bytes32 matchId) external nonReentrant {
        Wager storage wager = wagers[matchId];
        if (wager.status == WagerStatus.Created) {
            if (msg.sender != wager.player1 && msg.sender != owner()) revert UnauthorizedCaller();
            if (block.timestamp < wager.createdAt + TIMEOUT_DURATION && msg.sender != owner()) {
                revert MatchNotTimedOut(block.timestamp - wager.createdAt, TIMEOUT_DURATION);
            }

            wager.status = WagerStatus.Cancelled;
            IERC20(address(chessToken)).safeTransfer(wager.player1, wager.stakeAmount);
            emit WagerCancelled(matchId, msg.sender, "Unmatched wager expired");
        } else if (wager.status == WagerStatus.Active) {
            // Either owner referee can cancel, or after timeout
            if (msg.sender != owner() && msg.sender != wager.player1 && msg.sender != wager.player2) {
                revert UnauthorizedCaller();
            }
            if (msg.sender != owner() && block.timestamp < wager.startedAt + TIMEOUT_DURATION) {
                revert MatchNotTimedOut(block.timestamp - wager.startedAt, TIMEOUT_DURATION);
            }

            wager.status = WagerStatus.Cancelled;
            IERC20(address(chessToken)).safeTransfer(wager.player1, wager.stakeAmount);
            IERC20(address(chessToken)).safeTransfer(wager.player2, wager.stakeAmount);
            emit WagerCancelled(matchId, msg.sender, "Active wager refunded due to abandonment");
        } else {
            revert WagerNotFound();
        }
    }

    // ==========================================
    // 3. TOURNAMENT KNOCKOUT ESCROW POOLS
    // ==========================================

    /**
     * @notice Creates a multi-player tournament prize pool.
     */
    function createTournament(
        bytes32 tourneyId,
        uint256 entryFee,
        uint8 maxPlayers,
        PrizeStructure structure
    ) external onlyOwner {
        if (tournaments[tourneyId].tourneyId != bytes32(0)) revert InvalidParameters();
        if (maxPlayers < 2) revert InvalidParameters();

        tournaments[tourneyId] = Tournament({
            tourneyId: tourneyId,
            entryFee: entryFee,
            maxPlayers: maxPlayers,
            prizeStructure: structure,
            status: TournamentStatus.Open,
            players: new address[](0)
        });

        emit TournamentCreated(tourneyId, entryFee, maxPlayers, structure);
    }

    /**
     * @notice Players enter the tournament pool by staking the required entry fee.
     */
    function registerTournament(bytes32 tourneyId) external nonReentrant {
        Tournament storage t = tournaments[tourneyId];
        if (t.status != TournamentStatus.Open) revert TournamentNotOpen();
        if (t.players.length >= t.maxPlayers) revert TournamentFull();
        if (hasEnteredTournament[tourneyId][msg.sender]) revert TournamentAlreadyEntered();

        hasEnteredTournament[tourneyId][msg.sender] = true;
        t.players.push(msg.sender);

        IERC20(address(chessToken)).safeTransferFrom(msg.sender, address(this), t.entryFee);

        emit TournamentRegistered(tourneyId, msg.sender);

        if (t.players.length == t.maxPlayers) {
            t.status = TournamentStatus.InProgress;
        }
    }

    /**
     * @notice Distributes tournament prize pool minus 5% platform rake among top placement winners.
     */
    function distributeTournamentPrizes(bytes32 tourneyId, address[] calldata winners) external onlyOwner nonReentrant {
        Tournament storage t = tournaments[tourneyId];
        if (t.status != TournamentStatus.InProgress && t.status != TournamentStatus.Open) revert TournamentNotOpen();

        uint256 totalPool = t.entryFee * t.players.length;
        uint256 rake = (totalPool * RAKE_BPS) / BPS_DENOMINATOR; // 5% rake
        uint256 netPool = totalPool - rake;
        accumulatedRake += rake;

        t.status = TournamentStatus.Completed;

        if (t.prizeStructure == PrizeStructure.WinnerTakeAll) {
            if (winners.length != 1) revert InvalidWinnersCount();
            IERC20(address(chessToken)).safeTransfer(winners[0], netPool);
        } else if (t.prizeStructure == PrizeStructure.TopTwo7030) {
            if (winners.length != 2) revert InvalidWinnersCount();
            uint256 first = (netPool * 70) / 100;
            uint256 second = netPool - first;
            IERC20(address(chessToken)).safeTransfer(winners[0], first);
            IERC20(address(chessToken)).safeTransfer(winners[1], second);
        } else if (t.prizeStructure == PrizeStructure.TopThree503020) {
            if (winners.length != 3) revert InvalidWinnersCount();
            uint256 first = (netPool * 50) / 100;
            uint256 second = (netPool * 30) / 100;
            uint256 third = netPool - first - second;
            IERC20(address(chessToken)).safeTransfer(winners[0], first);
            IERC20(address(chessToken)).safeTransfer(winners[1], second);
            IERC20(address(chessToken)).safeTransfer(winners[2], third);
        }

        emit TournamentPrizesDistributed(tourneyId, winners, netPool, rake);
    }

    /**
     * @notice Cancels tournament and refunds all registered entrants in full.
     */
    function cancelTournament(bytes32 tourneyId) external onlyOwner nonReentrant {
        Tournament storage t = tournaments[tourneyId];
        if (t.status == TournamentStatus.Completed || t.status == TournamentStatus.Cancelled) revert InvalidParameters();

        t.status = TournamentStatus.Cancelled;
        uint256 fee = t.entryFee;
        for (uint256 i = 0; i < t.players.length; i++) {
            IERC20(address(chessToken)).safeTransfer(t.players[i], fee);
        }

        emit TournamentCancelled(tourneyId);
    }

    // ==========================================
    // 4. TREASURY WITHDRAWAL
    // ==========================================

    function setFeeTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert InvalidParameters();
        feeTreasury = _treasury;
    }

    function withdrawAccumulatedRake() external onlyOwner nonReentrant {
        uint256 amount = accumulatedRake;
        accumulatedRake = 0;
        IERC20(address(chessToken)).safeTransfer(feeTreasury, amount);
        emit RakeWithdrawn(feeTreasury, amount);
    }
}
