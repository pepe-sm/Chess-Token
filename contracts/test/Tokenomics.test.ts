import { expect } from "chai";
import { ethers } from "hardhat";
import { ChessToken, ChessBondingCurve, ChessEscrow } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Chess Ecosystem Tokenomics & Escrow", function () {
  let owner: HardhatEthersSigner;
  let player1: HardhatEthersSigner;
  let player2: HardhatEthersSigner;
  let player3: HardhatEthersSigner;
  let player4: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;

  let token: ChessToken;
  let bondingCurve: ChessBondingCurve;
  let escrow: ChessEscrow;

  const MAX_SUPPLY = ethers.parseEther("10000000"); // 10M tokens
  const CURVE_CAP = ethers.parseEther("6000000"); // 6M tokens

  beforeEach(async function () {
    [owner, player1, player2, player3, player4, treasury] = await ethers.getSigners();

    // 1. Deploy ChessToken
    const ChessTokenFactory = await ethers.getContractFactory("ChessToken");
    token = await ChessTokenFactory.deploy(owner.address);
    await token.waitForDeployment();

    // 2. Deploy ChessBondingCurve
    const BondingCurveFactory = await ethers.getContractFactory("ChessBondingCurve");
    bondingCurve = await BondingCurveFactory.deploy(await token.getAddress(), owner.address);
    await bondingCurve.waitForDeployment();

    // 3. Deploy ChessEscrow
    const ChessEscrowFactory = await ethers.getContractFactory("ChessEscrow");
    escrow = await ChessEscrowFactory.deploy(
      await token.getAddress(),
      treasury.address,
      owner.address
    );
    await escrow.waitForDeployment();

    // Configure token authorizations
    await token.setBondingCurve(await bondingCurve.getAddress());
    await token.setEscrow(await escrow.getAddress());
  });

  describe("1. ChessToken Hard Cap & Permissions", function () {
    it("should allow owner to mint tokens within MAX_SUPPLY", async function () {
      const mintAmount = ethers.parseEther("1000");
      await token.mint(player1.address, mintAmount);
      expect(await token.balanceOf(player1.address)).to.equal(mintAmount);
      expect(await token.totalSupply()).to.equal(mintAmount);
    });

    it("should revert if minting exceeds the 10,000,000 CHESS hard cap", async function () {
      const overMax = MAX_SUPPLY + 1n;
      await expect(token.mint(player1.address, overMax)).to.be.revertedWithCustomError(
        token,
        "ExceedsMaxSupply"
      );
    });

    it("should revert if unauthorized address attempts to mint", async function () {
      const amount = ethers.parseEther("100");
      await expect(token.connect(player1).mint(player1.address, amount)).to.be.revertedWithCustomError(
        token,
        "UnauthorizedMinter"
      );
    });
  });

  describe("2. ChessBondingCurve AMM (60% Supply Cap)", function () {
    it("should allow users to buy tokens along the bonding curve", async function () {
      const buyAmount = ethers.parseEther("1000"); // 1,000 CHESS
      const cost = await bondingCurve.calculatePurchaseCost(0, buyAmount);

      await bondingCurve.connect(player1).buyExactTokens(buyAmount, { value: cost });

      expect(await token.balanceOf(player1.address)).to.equal(buyAmount);
      expect(await bondingCurve.curveSupplyMinted()).to.equal(buyAmount);
      expect(await bondingCurve.reserveBalance()).to.equal(cost);
    });

    it("should show increasing price as tokens are purchased", async function () {
      const priceBefore = await bondingCurve.getCurrentPrice();

      const buyAmount = ethers.parseEther("100000");
      const cost = await bondingCurve.calculatePurchaseCost(0, buyAmount);
      await bondingCurve.connect(player1).buyExactTokens(buyAmount, { value: cost });

      const priceAfter = await bondingCurve.getCurrentPrice();
      expect(priceAfter).to.be.gt(priceBefore);
    });

    it("should allow users to sell tokens back to the curve for reserve funds", async function () {
      const buyAmount = ethers.parseEther("500");
      const cost = await bondingCurve.calculatePurchaseCost(0, buyAmount);
      await bondingCurve.connect(player1).buyExactTokens(buyAmount, { value: cost });

      // Sell back 250 tokens
      const sellAmount = ethers.parseEther("250");
      await bondingCurve.connect(player1).sellTokens(sellAmount);

      expect(await token.balanceOf(player1.address)).to.equal(ethers.parseEther("250"));
      expect(await bondingCurve.curveSupplyMinted()).to.equal(ethers.parseEther("250"));
    });

    it("should strictly halt curve minting once 6,000,000 CHESS cap is reached", async function () {
      // Attempting to buy over 6,000,000 tokens should revert
      const overCap = CURVE_CAP + ethers.parseEther("1");
      await expect(
        bondingCurve.connect(player1).buyExactTokens(overCap, { value: ethers.parseEther("1000") })
      ).to.be.revertedWithCustomError(bondingCurve, "CurveCapExceeded");
    });
  });

  describe("3. ChessEscrow 1v1 Wagers (5% Platform Rake)", function () {
    const stake = ethers.parseEther("100"); // 100 CHESS stake
    const matchId = ethers.keccak256(ethers.toUtf8Bytes("match_1v1_test_001"));

    beforeEach(async function () {
      // Fund player1 and player2
      await token.mint(player1.address, stake);
      await token.mint(player2.address, stake);

      await token.connect(player1).approve(await escrow.getAddress(), stake);
      await token.connect(player2).approve(await escrow.getAddress(), stake);
    });

    it("should create and join a 1v1 wager correctly", async function () {
      await escrow.connect(player1).createWager(matchId, stake);
      let wager = await escrow.wagers(matchId);
      expect(wager.player1).to.equal(player1.address);
      expect(wager.stakeAmount).to.equal(stake);

      await escrow.connect(player2).joinWager(matchId);
      wager = await escrow.wagers(matchId);
      expect(wager.player2).to.equal(player2.address);
      expect(wager.status).to.equal(2); // Active
    });

    it("should settle wager with 5% rake deducted for the winner", async function () {
      await escrow.connect(player1).createWager(matchId, stake);
      await escrow.connect(player2).joinWager(matchId);

      // Settle match: player1 wins
      // Total pot = 200 CHESS
      // 5% rake = 10 CHESS
      // Winner payout = 190 CHESS
      await escrow.settleWager(matchId, player1.address);

      const p1Balance = await token.balanceOf(player1.address);
      expect(p1Balance).to.equal(ethers.parseEther("190"));

      const accumulatedRake = await escrow.accumulatedRake();
      expect(accumulatedRake).to.equal(ethers.parseEther("10"));
    });

    it("should refund 100% of stakes on a draw (0% rake)", async function () {
      await escrow.connect(player1).createWager(matchId, stake);
      await escrow.connect(player2).joinWager(matchId);

      await escrow.settleDraw(matchId);

      expect(await token.balanceOf(player1.address)).to.equal(stake);
      expect(await token.balanceOf(player2.address)).to.equal(stake);
      expect(await escrow.accumulatedRake()).to.equal(0);
    });

    it("should enforce timeout safeguard on abandoned/unjoined matches", async function () {
      await escrow.connect(player1).createWager(matchId, stake);

      // Attempting to cancel before timeout fails
      await expect(escrow.connect(player1).cancelWager(matchId)).to.be.revertedWithCustomError(
        escrow,
        "MatchNotTimedOut"
      );

      // Advance time by 16 minutes (> 15 minutes TIMEOUT_DURATION)
      await time.increase(16 * 60);

      // Player 1 cancels and receives full refund
      await escrow.connect(player1).cancelWager(matchId);
      expect(await token.balanceOf(player1.address)).to.equal(stake);
    });
  });

  describe("4. Global Ranked Matchmaking Access (1 CHESS Fee)", function () {
    it("should unlock permanent ranked access by paying 1 CHESS token", async function () {
      const fee = ethers.parseEther("1");
      await token.mint(player1.address, fee);
      await token.connect(player1).approve(await escrow.getAddress(), fee);

      expect(await escrow.isRankedUnlocked(player1.address)).to.be.false;

      await escrow.connect(player1).unlockRankedAccess();

      expect(await escrow.isRankedUnlocked(player1.address)).to.be.true;
      expect(await escrow.accumulatedRake()).to.equal(fee);

      // Second unlock attempt should revert
      await expect(escrow.connect(player1).unlockRankedAccess()).to.be.revertedWithCustomError(
        escrow,
        "AlreadyUnlocked"
      );
    });
  });

  describe("5. Tournament Knockout Escrow Pools", function () {
    const tourneyId = ethers.keccak256(ethers.toUtf8Bytes("tourney_knockout_2026"));
    const entryFee = ethers.parseEther("50"); // 50 CHESS per entrant

    beforeEach(async function () {
      const players = [player1, player2, player3, player4];
      for (const p of players) {
        await token.mint(p.address, entryFee);
        await token.connect(p).approve(await escrow.getAddress(), entryFee);
      }
    });

    it("should handle tournament registration and Winner-Take-All payout minus 5% rake", async function () {
      // Create 4-player Winner Take All tournament
      await escrow.createTournament(tourneyId, entryFee, 4, 0); // 0 = WinnerTakeAll

      await escrow.connect(player1).registerTournament(tourneyId);
      await escrow.connect(player2).registerTournament(tourneyId);
      await escrow.connect(player3).registerTournament(tourneyId);
      await escrow.connect(player4).registerTournament(tourneyId);

      // Total pool = 200 CHESS
      // 5% rake = 10 CHESS
      // Net payout = 190 CHESS
      await escrow.distributeTournamentPrizes(tourneyId, [player1.address]);

      expect(await token.balanceOf(player1.address)).to.equal(ethers.parseEther("190"));
      expect(await escrow.accumulatedRake()).to.equal(ethers.parseEther("10"));
    });

    it("should refund all entrants if tournament is cancelled", async function () {
      await escrow.createTournament(tourneyId, entryFee, 4, 0);
      await escrow.connect(player1).registerTournament(tourneyId);
      await escrow.connect(player2).registerTournament(tourneyId);

      await escrow.cancelTournament(tourneyId);

      expect(await token.balanceOf(player1.address)).to.equal(entryFee);
      expect(await token.balanceOf(player2.address)).to.equal(entryFee);
    });
  });

  describe("6. Treasury Fee Withdrawal", function () {
    it("should allow owner to withdraw accumulated rake to treasury", async function () {
      // Generate 1 CHESS rake via ranked unlock
      const fee = ethers.parseEther("1");
      await token.mint(player1.address, fee);
      await token.connect(player1).approve(await escrow.getAddress(), fee);
      await escrow.connect(player1).unlockRankedAccess();

      expect(await escrow.accumulatedRake()).to.equal(fee);

      await escrow.withdrawAccumulatedRake();

      expect(await token.balanceOf(treasury.address)).to.equal(fee);
      expect(await escrow.accumulatedRake()).to.equal(0);
    });
  });
});
