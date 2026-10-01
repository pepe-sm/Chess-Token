// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ChessToken
 * @notice Fixed hard cap ERC-20 token for the tokenized chess ecosystem.
 * Hard cap is strictly capped at 10,000,000 CHESS tokens.
 */
contract ChessToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10**18; // 10,000,000 tokens

    address public bondingCurve;
    address public escrow;

    event BondingCurveSet(address indexed bondingCurve);
    event EscrowSet(address indexed escrow);

    error ExceedsMaxSupply(uint256 requested, uint256 currentSupply, uint256 maxSupply);
    error UnauthorizedMinter(address caller);
    error UnauthorizedBurner(address caller);

    constructor(address initialOwner) ERC20("Chess Token", "CHESS") Ownable(initialOwner) {}

    /**
     * @notice Sets the authorized bonding curve AMM address.
     */
    function setBondingCurve(address _bondingCurve) external onlyOwner {
        bondingCurve = _bondingCurve;
        emit BondingCurveSet(_bondingCurve);
    }

    /**
     * @notice Sets the authorized escrow contract address.
     */
    function setEscrow(address _escrow) external onlyOwner {
        escrow = _escrow;
        emit EscrowSet(_escrow);
    }

    /**
     * @notice Mints tokens. Only the owner or bonding curve can mint.
     * Enforces the immutable 10,000,000 hard supply cap.
     */
    function mint(address to, uint256 amount) external {
        if (msg.sender != owner() && msg.sender != bondingCurve) {
            revert UnauthorizedMinter(msg.sender);
        }
        if (totalSupply() + amount > MAX_SUPPLY) {
            revert ExceedsMaxSupply(amount, totalSupply(), MAX_SUPPLY);
        }
        _mint(to, amount);
    }

    /**
     * @notice Burns tokens. Callable by the token holder or bonding curve/escrow with allowance.
     */
    function burn(address from, uint256 amount) external {
        if (msg.sender != from && msg.sender != bondingCurve && msg.sender != escrow) {
            _spendAllowance(from, msg.sender, amount);
        }
        _burn(from, amount);
    }
}
