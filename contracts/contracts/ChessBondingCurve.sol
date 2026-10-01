// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ChessToken.sol";

/**
 * @title ChessBondingCurve
 * @notice Automated Market Maker that sells up to 60% of total CHESS supply (6,000,000 tokens)
 * along a linear bonding curve (cheaper early on, scaling up as supply is purchased).
 * Once the 6,000,000 cap is reached, curve minting automatically stops.
 */
contract ChessBondingCurve is Ownable, ReentrancyGuard {
    ChessToken public immutable chessToken;

    // Up to 60% of total 10M supply
    uint256 public constant CURVE_SUPPLY_CAP = 6_000_000 * 10**18;

    // Pricing parameters: P(s) = P_BASE + k * s
    // P_BASE = 0.00001 ETH per 1 CHESS token = 10,000,000,000,000 wei (1e13 wei)
    uint256 public constant P_BASE = 1e13; 
    // Slope factor: at 6M tokens, price reaches ~0.001 ETH (1e15 wei)
    // k = (1e15 - 1e13) / (6_000_000 * 1e18) = 9.9e14 / 6e24 = 1.65e-10 wei per token wei
    uint256 public constant SLOPE_NUMERATOR = 165;
    uint256 public constant SLOPE_DENOMINATOR = 10**12; // Scaled to prevent precision loss

    uint256 public curveSupplyMinted;
    uint256 public reserveBalance;

    event TokensPurchased(address indexed buyer, uint256 tokensMinted, uint256 ethSpent, uint256 newSupply);
    event TokensSold(address indexed seller, uint256 tokensBurned, uint256 ethRefunded, uint256 newSupply);

    error CurveCapExceeded(uint256 requested, uint256 available);
    error InsufficientPayment(uint256 sent, uint256 required);
    error ZeroAmount();
    error TransferFailed();

    constructor(address _chessToken, address initialOwner) Ownable(initialOwner) {
        chessToken = ChessToken(_chessToken);
    }

    /**
     * @notice Computes cost in wei to purchase `tokenAmount` given `startingSupply`.
     * Integral: Cost = P_BASE * (amount/1e18) + (k / 2) * ((S + amount)^2 - S^2) / 1e36
     */
    function calculatePurchaseCost(uint256 startingSupply, uint256 tokenAmount) public pure returns (uint256) {
        if (tokenAmount == 0) return 0;

        // Base cost: P_BASE * tokenAmount / 1e18
        uint256 baseCost = (P_BASE * tokenAmount) / 1e18;

        // Slope cost: k/2 * (2 * S * amount + amount^2) / 1e36
        // Re-arranged for safe integer precision:
        uint256 s1 = startingSupply / 1e9;
        uint256 da = tokenAmount / 1e9;
        uint256 sumSq = (2 * s1 * da + da * da); // in 1e18 scale
        uint256 slopeCost = (sumSq * SLOPE_NUMERATOR) / (2 * SLOPE_DENOMINATOR * 1e9);

        return baseCost + slopeCost;
    }

    /**
     * @notice Computes refund in wei for selling `tokenAmount` given `startingSupply`.
     */
    function calculateSaleReturn(uint256 startingSupply, uint256 tokenAmount) public pure returns (uint256) {
        if (tokenAmount == 0 || startingSupply < tokenAmount) return 0;
        uint256 finalSupply = startingSupply - tokenAmount;
        return calculatePurchaseCost(finalSupply, tokenAmount);
    }

    /**
     * @notice Returns current spot price for 1 CHESS token (1e18 wei) in ETH wei.
     */
    function getCurrentPrice() external view returns (uint256) {
        uint256 s = curveSupplyMinted / 1e18;
        return P_BASE + (s * SLOPE_NUMERATOR * 1e18) / SLOPE_DENOMINATOR;
    }

    /**
     * @notice Buy exact amount of CHESS tokens through the bonding curve.
     * Any excess ETH sent is refunded back to the sender.
     */
    function buyExactTokens(uint256 tokenAmount) external payable nonReentrant {
        if (tokenAmount == 0) revert ZeroAmount();
        if (curveSupplyMinted + tokenAmount > CURVE_SUPPLY_CAP) {
            revert CurveCapExceeded(tokenAmount, CURVE_SUPPLY_CAP - curveSupplyMinted);
        }

        uint256 cost = calculatePurchaseCost(curveSupplyMinted, tokenAmount);
        if (msg.value < cost) {
            revert InsufficientPayment(msg.value, cost);
        }

        curveSupplyMinted += tokenAmount;
        reserveBalance += cost;

        // Mint CHESS tokens to buyer
        chessToken.mint(msg.sender, tokenAmount);

        // Refund excess ETH
        uint256 refund = msg.value - cost;
        if (refund > 0) {
            (bool success, ) = payable(msg.sender).call{value: refund}("");
            if (!success) revert TransferFailed();
        }

        emit TokensPurchased(msg.sender, tokenAmount, cost, curveSupplyMinted);
    }

    /**
     * @notice Sell CHESS tokens back to the bonding curve to receive reserve ETH.
     */
    function sellTokens(uint256 tokenAmount) external nonReentrant {
        if (tokenAmount == 0) revert ZeroAmount();
        if (tokenAmount > curveSupplyMinted) revert ZeroAmount();

        uint256 refund = calculateSaleReturn(curveSupplyMinted, tokenAmount);
        if (refund > address(this).balance) {
            refund = address(this).balance;
        }

        curveSupplyMinted -= tokenAmount;
        reserveBalance = reserveBalance >= refund ? reserveBalance - refund : 0;

        // Burn tokens from seller
        chessToken.burn(msg.sender, tokenAmount);

        (bool success, ) = payable(msg.sender).call{value: refund}("");
        if (!success) revert TransferFailed();

        emit TokensSold(msg.sender, tokenAmount, refund, curveSupplyMinted);
    }

    receive() external payable {}
}
