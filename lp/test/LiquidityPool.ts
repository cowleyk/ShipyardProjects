import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { LiquidityPool, SpaceCoin } from "../typechain";
const { utils: { parseEther, formatEther } } = ethers;

describe("LiquidityPool", function () {
    let spaceCoin: SpaceCoin;
    let liquidityPool: LiquidityPool;
    let creator: SignerWithAddress;
    let larry: SignerWithAddress;
    let jenny: SignerWithAddress;
    let addrs: SignerWithAddress[];

    beforeEach(async () => {
        [creator, larry, jenny, ...addrs] = await ethers.getSigners();
        const SpaceCoinFactory = await ethers.getContractFactory("SpaceCoin");
        const LiquidityPool = await ethers.getContractFactory("LiquidityPool");

        spaceCoin = await SpaceCoinFactory.deploy();
        liquidityPool = await LiquidityPool.deploy(spaceCoin.address);
        await spaceCoin.deployed();
        await liquidityPool.deployed();
    });

    it("Should return the new greeting once it's changed", async function () {

    });
});
