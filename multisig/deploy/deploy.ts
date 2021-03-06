// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import { formatEther, parseEther } from "ethers/lib/utils";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  const addrs = await ethers.getSigners(); //get the account to deploy the contract

  console.log("Deploying contracts with the account:", addrs[0].address);

  const SpaceCoin = await ethers.getContractFactory("SpaceCoin");
  const spaceCoin = await SpaceCoin.deploy();
  await spaceCoin.deployed();
  
  const ICO = await ethers.getContractFactory("ICO");
  const ico = await ICO.deploy([]);
  await ico.deployed();

  const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
  const liquidityPool = await LiquidityPool.deploy(spaceCoin.address);
  await liquidityPool.deployed();

  const Router = await ethers.getContractFactory("Router");
  const router = await Router.deploy(liquidityPool.address, spaceCoin.address);
  await router.deployed();

  console.log("spaceCoin deployed to:", spaceCoin.address);
  console.log("ico deployed to:", ico.address);
  console.log("liquidityPool deployed to:", liquidityPool.address);
  console.log("router deployed to:", router.address);

  // Transfer Owners of contracts
  // gnosis dummy-safe addr: rin:0x5a6eDdB5afD8105D0E92178af51D5a95bf466b05
  // gnosis bar0-sunny-kcowley-safe address: rin:0xf329Cf2c512f3ac4cEA1F361589258896f298b9B
  const gnosisSafe = '0xf329Cf2c512f3ac4cEA1F361589258896f298b9B'
  console.log('')
  console.log('transferring space coin ownership');
  const spcTxn = await spaceCoin.transferOwnership(gnosisSafe);
  spcTxn.wait();
  console.log('finished space coin transfer')
  console.log('')
  await delay(10000);

  console.log('transferring ico ownership');
  const icoTxn = await ico.transferOwnership(gnosisSafe);
  icoTxn.wait();
  console.log('finished ico transfer')
  console.log('')
  await delay(10000);

  console.log('transferring liquidity pool ownership');
  const lpTxn = await liquidityPool.transferOwnership(gnosisSafe);
  lpTxn.wait();
  console.log('finished liquidity pool transfer')
  console.log('')
  await delay(10000);

  console.log('transferring router ownership')
  const rtrTxn = await router.transferOwnership(gnosisSafe);
  rtrTxn.wait();
  console.log('finished router transfer')
  await delay(10000);
}

function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// dummy-safe OUTPUT

// Deploying contracts with the account: 0x80Fe107F18f2860e27413d48CD819d36Aad5DCFF
// spaceCoin deployed to: 0xc7D4d361d17987B9908a0a682Ba30EdECb0Db1B1
// ico deployed to: 0x2CcA422D5c7D1bd2c38fAf5B7B94C14dE5D6D3c7
// liquidityPool deployed to: 0xCA591767656D841e788B5b28d0cf58dda8e5Edd2
// router deployed to: 0x89a9DBcc55754c27ec3335C3708D8d9F0966F028

// transferring space coin ownership
// finished space coin transfer

// transferring ico ownership
// finished ico transfer

// transferring liquidity pool ownership
// finished liquidity pool transfer

// transferring router ownership
// finished router transfer

// bar0-sunny-kcowley-safe safe OUTPUT

// Deploying contracts with the account: 0x80Fe107F18f2860e27413d48CD819d36Aad5DCFF
// spaceCoin deployed to: 0x2A8A6fA7F9eA9749C05D2265bc982780b442a394
// ico deployed to: 0x6f23a3d15D603f9D15e70C4A5914B197a8b908C7
// liquidityPool deployed to: 0xfEb5E42A3EF721451CF2D1d1F10A0056a6Fd1E03
// router deployed to: 0xfd15C9F2B53CbD82e8a371A21Edc2BaC1d9E6190

// transferring space coin ownership
// finished space coin transfer

// transferring ico ownership
// finished ico transfer

// transferring liquidity pool ownership
// finished liquidity pool transfer

// transferring router ownership
// finished router transfer
