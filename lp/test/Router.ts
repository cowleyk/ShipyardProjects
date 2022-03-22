import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { SpaceCoin, Router, LiquidityPool } from "../typechain";
const { utils: { parseEther, formatEther } } = ethers;

describe("Router", function () {
    let router: Router;
    let spaceCoin: SpaceCoin;
    let liquidityPool: LiquidityPool;
    let creator: SignerWithAddress;
    let larry: SignerWithAddress;
    let jenny: SignerWithAddress;
    let addrs: SignerWithAddress[];

    beforeEach(async () => {
        [creator, larry, jenny, ...addrs] = await ethers.getSigners();
        const SpaceCoinFactory = await ethers.getContractFactory("SpaceCoin");
        const LiquidityPoolFactory = await ethers.getContractFactory("LiquidityPool");
        const RouterFactory = await ethers.getContractFactory("Router");

        // TODO: DEPLOY SPACE COIN AND USE THAT ADDRESS INSIDE CONSTRUCTOR
        spaceCoin = await SpaceCoinFactory.deploy();
        liquidityPool = await LiquidityPoolFactory.deploy(spaceCoin.address);
        router = await RouterFactory.deploy(liquidityPool.address, spaceCoin.address);
        await spaceCoin.deployed();
        await liquidityPool.deployed();
        await router.deployed();
    });

    it("adds initial liquidity", async function () {
        await spaceCoin.connect(creator).transfer(larry.address, parseEther("50"));
        spaceCoin.connect(larry).approve(router.address, parseEther("50"));
        await expect(await router.connect(larry).addLiquidity(parseEther("50"), {value: parseEther("10")}))
            .to.changeEtherBalance(liquidityPool, parseEther("10"));
        expect(await spaceCoin.balanceOf(liquidityPool.address)).to.equal(parseEther("50"));
        const larryKVYTokens = await liquidityPool.balanceOf(larry.address);
        expect(larryKVYTokens.gt(0)).to.be.true;
    });

    it("adds liquidy to an existing pool", async () => {
        // set up liquidity pool
        await spaceCoin.approve(router.address, parseEther("50"));
        await router.addLiquidity(parseEther("50"), {value: parseEther("10")});        
        await spaceCoin.transfer(jenny.address, parseEther("50"));

        await spaceCoin.connect(jenny).approve(router.address, parseEther("10"));
        await router.connect(jenny).addLiquidity(parseEther("10"), {value: parseEther("2")});
        expect(await spaceCoin.balanceOf(liquidityPool.address)).to.equal(parseEther("60"));
        const jennyKVYTokens = await liquidityPool.balanceOf(jenny.address);
        expect(jennyKVYTokens.gt(0)).to.be.true;
    });

    it("refunds excess ETH deposited", async () => {
        // set up liquidity pool
        await spaceCoin.approve(router.address, parseEther("50"));
        await router.addLiquidity(parseEther("50"), {value: parseEther("10")});        
        await spaceCoin.transfer(jenny.address, parseEther("50"));

        await spaceCoin.connect(jenny).approve(router.address, parseEther("10"));
        const addTxn = await router.connect(jenny).addLiquidity(parseEther("10"), {value: parseEther("10")});
        expect(await spaceCoin.balanceOf(liquidityPool.address)).to.equal(parseEther("60"));

        await expect(addTxn).to.changeEtherBalance(jenny, parseEther("2").mul(-1));
        await expect(addTxn).to.changeEtherBalance(liquidityPool, parseEther("2"));
    })

    it("swaps ETH for SPC", async () => {
        // set up liquidity pool
        await spaceCoin.approve(router.address, parseEther("500"));
        await router.addLiquidity(parseEther("500"), {value: parseEther("100")});

        const spcEstimate = await router.getSwapEstimate(parseEther("1"), true);
        const minSpcReturn = parseEther("4.5");
        await router.connect(jenny).swapEthForSpc(minSpcReturn, { value: parseEther("1")});

        const jennySpcBalance = await spaceCoin.balanceOf(jenny.address);
        expect(jennySpcBalance.gt(minSpcReturn)).to.be.true;
        expect(jennySpcBalance.lte(spcEstimate)).to.be.true;
    });

    it("swaps SPC for ETH", async () => {
        // set up liquidity pool
        await spaceCoin.approve(router.address, parseEther("500"));
        await router.addLiquidity(parseEther("500"), {value: parseEther("100")});

        const ethEstimate = await router.getSwapEstimate(parseEther("5"), false);
        const minEthReturn = (parseEther("0.8"));
        await spaceCoin.transfer(jenny.address, parseEther("5"))
        await spaceCoin.connect(jenny).approve(router.address, parseEther("5"));
        const swap = await router.connect(jenny).swapSpcforEth(parseEther("5"), minEthReturn);

        await expect(swap).to.changeEtherBalance(jenny, ethEstimate);

        const ethEstimate_2 = await router.getSwapEstimate(parseEther("5"), false);
        const minEthReturn_2 = (parseEther("0.8"));
        await spaceCoin.transfer(jenny.address, parseEther("5"))
        await spaceCoin.connect(jenny).approve(router.address, parseEther("5"));
        const swap_2 = await router.connect(jenny).swapSpcforEth(parseEther("5"), minEthReturn_2);

        await expect(swap_2).to.changeEtherBalance(jenny, ethEstimate_2);
        expect(ethEstimate_2.lt(ethEstimate)).to.be.true;
    });

    it("includes fees in estimate for swap", async () => {
        // create initial 5:1 SPC:ETH 
        const ethDeposit = parseEther("10")
        const spcDeposit = parseEther("10").mul(5);
        await spaceCoin.approve(router.address, parseEther("500"));
        await router.addLiquidity(spcDeposit, {value: ethDeposit});

        // estimated SPC returned for depositing 1 ETH
        const ethEstimate = await router.getSwapEstimate(parseEther("1"), true);
        expect(ethEstimate < parseEther("1").mul(5)).to.be.true;
    });

    it("", async () => {

    });
});