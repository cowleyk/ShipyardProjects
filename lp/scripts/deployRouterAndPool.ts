// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  const addrs = await ethers.getSigners(); //get the account to deploy the contract

  console.log("Deploying contracts with the account:", addrs[1].address);

  const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
  // GRAB _spcToken 
  const _spcTokenAddress = '< grab off ICO after ICO is completed >'
  const liquidityPool = await LiquidityPool.deploy(_spcTokenAddress);

  const Router = await ethers.getContractFactory("Router");
  const router = await Router.deploy(liquidityPool.address, _spcTokenAddress);

  await liquidityPool.deployed();
  await router.deployed();

  console.log("liquidityPool deployed to:", liquidityPool.address);
  console.log("router deployed to:", router.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
