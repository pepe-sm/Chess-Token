import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy ChessToken
  const ChessTokenFactory = await ethers.getContractFactory("ChessToken");
  const token = await ChessTokenFactory.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("ChessToken deployed to:", tokenAddress);

  // 2. Deploy ChessBondingCurve
  const BondingCurveFactory = await ethers.getContractFactory("ChessBondingCurve");
  const bondingCurve = await BondingCurveFactory.deploy(tokenAddress, deployer.address);
  await bondingCurve.waitForDeployment();
  const curveAddress = await bondingCurve.getAddress();
  console.log("ChessBondingCurve deployed to:", curveAddress);

  // 3. Deploy ChessEscrow (treasury defaults to deployer)
  const ChessEscrowFactory = await ethers.getContractFactory("ChessEscrow");
  const escrow = await ChessEscrowFactory.deploy(tokenAddress, deployer.address, deployer.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("ChessEscrow deployed to:", escrowAddress);

  // Configure authorizations
  await token.setBondingCurve(curveAddress);
  await token.setEscrow(escrowAddress);
  console.log("Authorizations configured successfully!");

  console.log("\n--- Deployment Summary ---");
  console.log(`CHESS_TOKEN_ADDRESS="${tokenAddress}"`);
  console.log(`BONDING_CURVE_ADDRESS="${curveAddress}"`);
  console.log(`CHESS_ESCROW_ADDRESS="${escrowAddress}"`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
