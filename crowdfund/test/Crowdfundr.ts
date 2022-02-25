import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Crowdfundr } from "../typechain";
import { BigNumber } from "ethers";
const { utils: { parseEther } } = ethers;
const { constants: { ZERO_ADDRESS } } = require("@openzeppelin/test-helpers");

describe("Crowdfundr", () => {
    let crowdfundr: Crowdfundr;
    let creator: SignerWithAddress;
    let larry: SignerWithAddress;
    let jenny: SignerWithAddress;
    let addrs: SignerWithAddress[];

    beforeEach(async () => {
        [creator, larry, jenny, ...addrs] = await ethers.getSigners();
        const crowdfundrFactory = await ethers.getContractFactory("Crowdfundr");
        crowdfundr = await crowdfundrFactory.deploy(creator.address, parseEther("5"));
        await crowdfundr.deployed();
    });

    it("does not allow creation of a contract with a zero address or goal", async () => {
        const crowdfundrFactory = await ethers.getContractFactory("Crowdfundr");

        await expect(crowdfundrFactory.deploy(ZERO_ADDRESS, parseEther("5")))
            .to.be.revertedWith("Must provide a creator address");
        await expect(crowdfundrFactory.deploy(creator.address, parseEther("0")))
            .to.be.revertedWith("Goal must be meet min donation");
    })

    // Creator functionality
    it("allows the creator to withdraw funds when the goal is met", async () => {
        await crowdfundr.connect(larry).contribute({value: parseEther("2")});
        await crowdfundr.connect(jenny).contribute({value: parseEther("4")});

        await expect(await crowdfundr.connect(creator).withdrawFunds(parseEther("2")))
            .to.changeEtherBalance(creator, parseEther("2"));
        await expect(await crowdfundr.connect(creator).withdrawFunds(parseEther("2")))
            .to.changeEtherBalance(creator, parseEther("2"));
    });

    it("prevents the creator from withdrawing funds until the goal is met", async () => {
        await crowdfundr.connect(jenny).contribute({value: parseEther("4")});
        await expect(crowdfundr.connect(creator).withdrawFunds(parseEther("2")))
            .to.be.revertedWith("Goal has not been met")
    });

    it("only the creator can withdraw funds", async () => {
        await crowdfundr.connect(larry).contribute({value: parseEther("2")});
        await crowdfundr.connect(jenny).contribute({value: parseEther("4")});

        await expect(crowdfundr.connect(larry).withdrawFunds(parseEther("1")))
            .to.be.revertedWith("Must be campaign creator")
    });

    it("allows the creator to cancel the campaign", async () => {
        await crowdfundr.connect(creator).cancelCampaign();
        expect(await crowdfundr.cancelledByCreator()).to.equal(true);
    });

    it("allows only the creator to cancel the campaign", async () => {
        await expect(crowdfundr.connect(larry).cancelCampaign())
            .to.be.revertedWith("Must be campaign creator")
        expect(await crowdfundr.cancelledByCreator()).to.equal(false);
    });

    // Contributor functionality
    it("allows contributors to contribute", async () => {
        expect(await crowdfundr.contributed()).to.equal(parseEther("0"));
        await crowdfundr.connect(jenny).contribute({value: parseEther("1")});
        expect(await crowdfundr.contributions(jenny.address)).to.equal(parseEther("1"));

        await crowdfundr.connect(jenny).contribute({value: parseEther("1")});
        expect(await crowdfundr.contributions(jenny.address)).to.equal(parseEther("2"));
        expect(await crowdfundr.contributed()).to.equal(parseEther("2"));
    });

    it("requires a minimum donation of 0.01 ETH", async () => {
        await expect(crowdfundr.connect(larry).contribute({value: parseEther("0.009")})).to.be.revertedWith("Must meet minimum donation");
    });

    it("allows contributors to withdraw funds after cancellation", async () => {
        await crowdfundr.connect(larry).contribute({value: parseEther("2")});
        await expect(crowdfundr.connect(larry).withdrawContribution())
            .to.be.revertedWith("Withdrawals are locked");
        await crowdfundr.connect(creator).cancelCampaign();

        await expect(await crowdfundr.connect(larry).withdrawContribution())
            .to.changeEtherBalance(larry, parseEther("2"));
    });
  
    it("allows contributors to withdraw funds after 30 days if goal is not met", async () => {
        await crowdfundr.connect(jenny).contribute({value: parseEther("2")});
        await expect(crowdfundr.connect(larry).withdrawContribution())
            .to.be.revertedWith("Withdrawals are locked");

        // advance time 15 days
        await increaseTime(60*60*24*15);
        await expect(crowdfundr.connect(larry).withdrawContribution())
            .to.be.revertedWith("Withdrawals are locked");

        // advance time another 15 days (30 days after deployment)
        await increaseTime(60*60*24*15);
        await expect(await crowdfundr.connect(jenny).withdrawContribution())
            .to.changeEtherBalance(jenny, parseEther("2"));
    });

    const increaseTime = async (seconds: number): Promise<void> => {
        await hre.network.provider.send("evm_increaseTime", [seconds]);
        await hre.network.provider.send("evm_mine");
    };

    it("allows contributors to withdraw only their contribution amount", async () => {
        await crowdfundr.connect(larry).contribute({value: parseEther("2")});
        await crowdfundr.connect(jenny).contribute({value: parseEther("2")});
        await crowdfundr.connect(creator).cancelCampaign();

        await expect(await crowdfundr.connect(larry).withdrawContribution())
            .to.changeEtherBalance(larry, parseEther("2"));
        await expect(crowdfundr.connect(larry).withdrawContribution())
            .to.be.revertedWith("No contribution to withdraw");
    });

    it("does not allow contribution withdrawal if the contribution goal is met", async () => {
        await crowdfundr.connect(larry).contribute({value: parseEther("3")});
        await crowdfundr.connect(jenny).contribute({value: parseEther("2")});
        await expect(crowdfundr.connect(larry).withdrawContribution())
            .to.be.revertedWith("Withdrawals are locked");
    });

    it("sets toggles goalMet when contributions reach goal", async () => {
        expect(await crowdfundr.goalMet()).to.be.false;
        await crowdfundr.connect(larry).contribute({value: parseEther("3")});
        await crowdfundr.connect(jenny).contribute({value: parseEther("3")});
        expect(await crowdfundr.goalMet()).to.be.true;
    });

    // NFT awarding
    it("awards a NFT for a contribution of 1ETH", async () => {
        expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(0);
        await crowdfundr.connect(jenny).contribute({value: parseEther("1")});
        expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(1);
    });

    it("awards an NFT when combined contributions equal 1ETH", async () => {
        expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(0);
        await crowdfundr.connect(jenny).contribute({value: parseEther("0.4")});
        await crowdfundr.connect(jenny).contribute({value: parseEther("0.7")});
        expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(1);
    });

    it("awards another NFT for each 1ETH donated", async () => {
        expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(0);
        await crowdfundr.connect(jenny).contribute({value: parseEther("1.6")});

        expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(1);
        let badges = await crowdfundr.connect(jenny).getBadgesByOwner(jenny.address);
        expect(badges).to.deep.equal([BigNumber.from(1)])

        await crowdfundr.connect(jenny).contribute({value: parseEther("1.7")});
        expect(await crowdfundr.connect(jenny).balanceOf(jenny.address)).to.equal(3);
        badges = await crowdfundr.connect(jenny).getBadgesByOwner(jenny.address);
        expect(badges).to.deep.equal([ BigNumber.from(1), BigNumber.from(2), BigNumber.from(3) ])
    });

    it("retreives badges by owner", async () => {
        await crowdfundr.connect(jenny).contribute({value: parseEther("1")});
        await crowdfundr.connect(larry).contribute({value: parseEther("1")});
        await crowdfundr.connect(jenny).contribute({value: parseEther("1")});

        const jennyBadges = await crowdfundr.getBadgesByOwner(jenny.address);
        const larryBadges = await crowdfundr.getBadgesByOwner(larry.address);
        expect(jennyBadges).to.deep.equal([ BigNumber.from(1), BigNumber.from(3) ])
        expect(larryBadges).to.deep.equal([ BigNumber.from(2) ])
    })
});
