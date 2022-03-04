import { expect } from "chai";
import { ethers } from "hardhat";
import { ICO, SpaceCoin } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
const { utils: { parseEther, formatEther } } = ethers;


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
        await ico.connect(larry).buy({ value: parseEther("500")});
        await ico.connect(larry).buy({ value: parseEther("500")});
        await ico.connect(larry).buy({ value: parseEther("500")});

        expect(await ico.userContributions(larry.address)).to.equal(parseEther("1500"));
    });

    it("only whitelisted investors cant purchase tokens during Phase Seed", async () => {
        await expect(ico.connect(larry).buy({ value: parseEther("1500")})).to.be.revertedWith("WHITELIST");
    });

    it("only the treasury can whitelist addresses", async () => {
        await expect(ico.connect(larry).whitelistAddress(jenny.address)).to.be.revertedWith("ONLY_TREASURY");
    });

    it("only raises 15000ETH during Phase Seed", async () => {
        expect(await ico.currentPhase()).to.equal(0);
        for(let i = 0; i < 10; i++) {
            await ico.connect(creator).whitelistAddress(addrs[i].address);
            await ico.connect(addrs[i]).buy({ value: parseEther("1490")});
        }

        expect(await ico.totalAmountRaised()).to.equal(parseEther("14900"));
        await ico.connect(creator).whitelistAddress(larry.address);
        await expect(ico.connect(larry).buy({ value: parseEther("101")})).to.be.revertedWith("INSUFFICIENT_AVAILABILITY");
        await ico.connect(larry).buy({ value: parseEther("100")});

        expect(await ico.totalAmountRaised()).to.equal(parseEther("15000"));
        expect(await ico.currentPhase()).to.equal(1);
    });

    it("maximum contribution 1500ETH during Phase Seed", async () => {
        await ico.connect(creator).whitelistAddress(larry.address);
        await ico.connect(larry).buy({ value: parseEther("500")});
        await ico.connect(larry).buy({ value: parseEther("500")});
        await expect(ico.connect(larry).buy({ value: parseEther("501")})).to.be.revertedWith("EXCEEDS_MAX_CONTRIBUTION");
    });

    it("any investors can purchase tokens during Phase General", async () => {
        await ico.connect(creator).advancePhase();
        expect(await ico.currentPhase()).to.equal(1);

        for(let i = 0; i < 5; i++) {
            await ico.connect(addrs[i]).buy({ value: parseEther("100")});
        }

        expect(await ico.totalAmountRaised()).to.equal(parseEther("500"));
    });

    it("raises up to 30000ETH during Phase General", async () => {
        expect(await ico.currentPhase()).to.equal(0);
        for(let i = 0; i < 5; i++) {
            await ico.connect(creator).whitelistAddress(addrs[i].address);
            await ico.connect(addrs[i]).buy({ value: parseEther("1000")});
        }

        expect(await ico.totalAmountRaised()).to.equal(parseEther("5000"));
        await ico.connect(creator).advancePhase();
        expect(await ico.currentPhase()).to.equal(1);

        for(let i = 5; i < 30; i++) {
            await ico.connect(addrs[i]).buy({ value: parseEther("990")});
        }
        expect(await ico.totalAmountRaised()).to.equal(parseEther("5000").add(parseEther("24750")));

        await expect(ico.connect(larry).buy({ value: parseEther("1000")})).to.be.revertedWith("INSUFFICIENT_AVAILABILITY");
        await ico.connect(larry).buy({ value: parseEther("250")});

        expect(await ico.totalAmountRaised()).to.equal(parseEther("30000"));
        expect(await ico.currentPhase()).to.equal(2);
    });

    it("maximum contribution 1000ETH during Phase General", async () => {
        await ico.connect(creator).advancePhase();
        expect(await ico.currentPhase()).to.equal(1);
        await expect(ico.connect(larry).buy({ value: parseEther("1001")})).to.be.revertedWith("EXCEEDS_MAX_CONTRIBUTION");
    });

    it("any investors can purchase tokens during Phase Open", async () => {
        await ico.connect(creator).advancePhase();
        await ico.connect(creator).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        for(let i = 0; i < 5; i++) {
            await ico.connect(addrs[i]).buy({ value: parseEther("100")});
        }

        expect(await ico.totalAmountRaised()).to.equal(parseEther("500"));
    });

    it("raises up to 30000ETH during Phase Open", async () => {
        expect(await ico.currentPhase()).to.equal(0);
        for(let i = 0; i < 5; i++) {
            await ico.connect(creator).whitelistAddress(addrs[i].address);
            await ico.connect(addrs[i]).buy({ value: parseEther("1000")});
        }
        expect(await ico.totalAmountRaised()).to.equal(parseEther("5000"));
        await ico.connect(creator).advancePhase();
        expect(await ico.currentPhase()).to.equal(1);

        for(let i = 5; i < 10; i++) {
            await ico.connect(addrs[i]).buy({ value: parseEther("1000")});
        }
        expect(await ico.totalAmountRaised()).to.equal(parseEther("5000").add(parseEther("5000")));
        await ico.connect(creator).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);

        await ico.connect(addrs[10]).buy({ value: parseEther("19000")});

        await expect(ico.connect(larry).buy({ value: parseEther("1001")})).to.be.revertedWith("INSUFFICIENT_AVAILABILITY");
        await ico.connect(larry).buy({ value: parseEther("1000")});

        expect(await ico.totalAmountRaised()).to.equal(parseEther("30000"));
    });

    it("no maximum contribution during Phase Open", async () => {
        await ico.connect(creator).advancePhase();
        await ico.connect(creator).advancePhase();
        expect(await ico.currentPhase()).to.equal(2);
        await ico.connect(larry).buy({ value: parseEther("30000")});
        expect(await ico.userContributions(larry.address)).to.equal(parseEther("30000"))
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
        expect(await ico.isPaused()).to.be.false;

        await ico.connect(creator).toggleIsPaused(true);
        expect(await ico.isPaused()).to.be.true;
        await expect(ico.connect(larry).buy({ value: parseEther("100")})).to.be.revertedWith("PAUSED_CAMPAIGN");
        await ico.connect(creator).toggleIsPaused(false);
        await ico.connect(larry).buy({ value: parseEther("100")});
        expect(await ico.userContributions(larry.address)).to.equal(parseEther("100"));
    });

    it("owner can add addresses to whitelist", async () => {
        await ico.connect(creator).whitelistAddress(larry.address);
        expect(await ico.whitelist(larry.address)).to.be.true;
    });

    it("collect tokens in Phase Open", async () => {
        await ico.connect(creator).advancePhase();
        await ico.connect(larry).buy({ value: parseEther("1000")});
        await ico.connect(creator).advancePhase();
        await ico.connect(jenny).buy({ value: parseEther("2000")});
        await ico.connect(larry).collectTokens();
        await ico.connect(jenny).collectTokens();
        const spcAddress = await ico.token();
        const spaceCoinFactory = await ethers.getContractFactory("SpaceCoin");
        const spaceCoin: SpaceCoin = spaceCoinFactory.attach(spcAddress);

        expect(await spaceCoin.balanceOf(larry.address)).to.equal(parseEther("1000").mul(5));
        expect(await spaceCoin.balanceOf(jenny.address)).to.equal(parseEther("2000").mul(5));
    });

    it("collect tokens in only Phase Open", async () => {
        await ico.connect(creator).advancePhase();
        await ico.connect(larry).buy({ value: parseEther("1000")});
        await expect(ico.connect(larry).collectTokens()).to.be.revertedWith("INCORRECT_PHASE");
    });

    it("prevents over collecting of tokens", async () => {
        await ico.connect(creator).advancePhase();
        await ico.connect(creator).advancePhase();
        await ico.connect(larry).buy({ value: parseEther("30000")});
        await ico.connect(larry).collectTokens();
        await expect(ico.connect(larry).collectTokens()).to.be.revertedWith("NO_TOKENS");
    });

    it("advances stages properly with contributions", async () => {
        expect(await ico.currentPhase()).to.equal(0);
        for(let i = 0; i < 10; i++) {
            await ico.connect(creator).whitelistAddress(addrs[i].address);
            await ico.connect(addrs[i]).buy({ value: parseEther("1500")});
        }
        expect(await ico.totalAmountRaised()).to.equal(parseEther("15000"));
        expect(await ico.currentPhase()).to.equal(1);

        for(let i = 10; i < 25; i++) {
            await ico.connect(addrs[i]).buy({ value: parseEther("1000")});
        }
        expect(await ico.totalAmountRaised()).to.equal(parseEther("30000"));
        expect(await ico.currentPhase()).to.equal(2);
    });

    it("treasury can withdraw contributions after the goal is reached", async () => {
        await ico.connect(creator).advancePhase();
        await ico.connect(creator).advancePhase();
        await ico.connect(larry).buy({ value: parseEther("30000")});
        await expect(await ico.connect(creator).withdrawContributions())
            .to.changeEtherBalance(creator, parseEther("30000"));
    });

    it("forces treasury to wait until the goal is reached to withdraw the contributions", async () => {
        await ico.connect(creator).advancePhase();
        await ico.connect(creator).advancePhase();
        await ico.connect(larry).buy({ value: parseEther("29999")});
        await expect(ico.connect(creator).withdrawContributions())
            .to.be.revertedWith("ICO_ACTIVE");
    });
});
