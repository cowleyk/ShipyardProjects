import { expect } from "chai";
import { ethers } from "hardhat";
import { ICO, SpaceCoin } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
const { utils: { parseEther } } = ethers;


describe("ICO", function () {
    let ico: ICO;
    let creator: SignerWithAddress;
    let larry: SignerWithAddress;
    let jenny: SignerWithAddress;
    let addrs: SignerWithAddress[];

    beforeEach(async () => {
        [creator, larry, jenny, ...addrs] = await ethers.getSigners();
        const icoFactory = await ethers.getContractFactory("ICO");
        ico = await icoFactory.deploy();
        await ico.deployed();
    });

    it("investors can purchase tokens during Phase Seed", async () => {
        await ico.connect(creator).whitelistAddress(larry.address);
        await ico.connect(larry).buy({ value: parseEther("1500")});

        expect(await ico.userTokens(larry.address)).to.equal(parseEther("1500").mul(5));
    });

    it("only whitelisted investors cant purchase tokens during Phase Seed", async () => {
        await expect(ico.connect(larry).buy({ value: parseEther("1500")})).to.be.revertedWith("WHITELIST");
    });

    it("only raises 15000ETH during Phase Seed", async () => {
        expect(await ico.currentPhase()).to.equal(0);
        for(let i = 0; i < 10; i++) {
            await ico.connect(creator).whitelistAddress(addrs[i].address);
            await ico.connect(addrs[i]).buy({ value: parseEther("1490")});
        }

        await ico.connect(creator).whitelistAddress(larry.address);
        await expect(ico.connect(larry).buy({ value: parseEther("101")})).to.be.revertedWith("INSUFFICIENT_AVAILABILITY");
        await ico.connect(larry).buy({ value: parseEther("100")});

        expect(await ico.totalAmountRaised()).to.equal(parseEther("15000"));
        expect(await ico.currentPhase()).to.equal(1);
    });

    it("maximum contribution 1500ETH during Phase Seed", async () => {
        await ico.connect(creator).whitelistAddress(larry.address);
        await expect(ico.connect(larry).buy({ value: parseEther("1501")})).to.be.revertedWith("EXCEEDS_MAX_CONTRIBUTION");
    });

    it("any investors can purchase tokens during Phase General", async () => {
        await ico.connect(creator).advancePhase();
        expect(await ico.currentPhase()).to.equal(1);

        for(let i = 0; i < 5; i++) {
            await ico.connect(addrs[i]).buy({ value: parseEther("100")});
        }

        expect(await ico.totalAmountRaised()).to.equal(parseEther("500"));
    });

    it("only raises 15000ETH during Phase General", async () => {
        expect(await ico.currentPhase()).to.equal(0);
        for(let i = 0; i < 5; i++) {
            await ico.connect(creator).whitelistAddress(addrs[i].address);
            await ico.connect(addrs[i]).buy({ value: parseEther("1000")});
        }

        expect(await ico.totalAmountRaised()).to.equal(parseEther("5000"));
        await ico.connect(creator).advancePhase();
        expect(await ico.currentPhase()).to.equal(1);

        let counter = 0;
        for(let i = 5; i < 20; i++) {
            await ico.connect(addrs[i]).buy({ value: parseEther("990")});
            counter++;
        }
        expect(await ico.totalAmountRaised()).to.equal(parseEther("5000").add(parseEther("14850")));

        await expect(ico.connect(larry).buy({ value: parseEther("151")})).to.be.revertedWith("INSUFFICIENT_AVAILABILITY");
        await ico.connect(larry).buy({ value: parseEther("150")});

        expect(await ico.totalAmountRaised()).to.equal(parseEther("5000").add(parseEther("15000")));
        expect(await ico.currentPhase()).to.equal(2);
        // console.log('token', await ico.token())
    });

    it("maximum contribution 1000ETH during Phase General", async () => {
        await ico.connect(creator).advancePhase();
        expect(await ico.currentPhase()).to.equal(1);
        await expect(ico.connect(larry).buy({ value: parseEther("1001")})).to.be.revertedWith("EXCEEDS_MAX_CONTRIBUTION");
    });

    it("owner can advance phase anytime", async () => {
        expect(await ico.currentPhase()).to.equal(0);
        await ico.connect(creator).advancePhase();
        expect(await ico.currentPhase()).to.equal(1);
        await ico.connect(creator).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);
        await expect(ico.connect(creator).advancePhase()).to.be.revertedWith("INCORRECT_PHASE");
    });

    it("owner can pause/resume campaign anytime", async () => {
        await ico.connect(creator).whitelistAddress(larry.address);
        expect(await ico.active()).to.be.true;

        await ico.connect(creator).toggleActive(false);
        expect(await ico.active()).to.be.false;
        await expect(ico.connect(larry).buy({ value: parseEther("100")})).to.be.revertedWith("PAUSED_CAMPAIGN");
        await ico.connect(creator).toggleActive(true);
        await ico.connect(larry).buy({ value: parseEther("100")});
        expect(await ico.userTokens(larry.address)).to.equal(parseEther("100").mul(5));
    });

    it("owner can add addresses to whitelist", async () => {
        await ico.connect(creator).whitelistAddress(larry.address);
        expect(await ico.whitelist(larry.address)).to.be.true;
    });

    it("collect tokens after ICO", async () => {
        await ico.connect(creator).advancePhase();
        await ico.connect(larry).buy({ value: parseEther("100")});
        await ico.connect(creator).advancePhase();
        await ico.connect(larry).collectTokens();
        const spcAddress = await ico.token();
        const spaceCoinFactory = await ethers.getContractFactory("SpaceCoin");
        const spaceCoin: SpaceCoin = spaceCoinFactory.attach(spcAddress);

        expect(await spaceCoin.balanceOf(larry.address)).to.equal(parseEther("100").mul(5));
    });
});
