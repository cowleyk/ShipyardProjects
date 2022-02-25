import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { CampaignFactory, Crowdfundr } from "../typechain";
const { utils: { parseEther } } = ethers;

describe("CampaignFactory", () => {
    let campaignFactory: CampaignFactory;
    let _deployer: SignerWithAddress;
    let creator: SignerWithAddress;
    let larry: SignerWithAddress;
    let jenny: SignerWithAddress;
    let addrs: SignerWithAddress[];

    beforeEach(async () => {
        [_deployer, creator, larry, jenny, ...addrs] = await ethers.getSigners();
        const campaignFactoryFactory = await ethers.getContractFactory("CampaignFactory");
        campaignFactory = await campaignFactoryFactory.deploy();
        await campaignFactory.deployed();
    });

    it('deploys a child Crowdfundr contract', async () => {
        await campaignFactory.createCampaign(creator.address, parseEther("3"));
        const campaigns = await campaignFactory.getCampaigns();
        const crowdfundrFactory = await ethers.getContractFactory("Crowdfundr");
        const crowdfundr: Crowdfundr = crowdfundrFactory.attach(campaigns[0]);

        expect(await crowdfundr.creator()).to.equal(creator.address);
        expect(await crowdfundr.goal()).to.equal(parseEther("3"));
    });

    it('emits a CampaignCreated event when a Crowdfundr child is created', async () => {
        const newCampaign = await campaignFactory.createCampaign(creator.address, parseEther("3"));
        const campaigns = await campaignFactory.getCampaigns();

        await expect(newCampaign)
            .to.emit(campaignFactory, "CampaignCreated")
            .withArgs(creator.address, campaigns[0]);
    });

    it('returns all created Crowdfundr campaigns', async () => {
        await campaignFactory.createCampaign(creator.address, parseEther("3"));
        await campaignFactory.createCampaign(larry.address, parseEther("4"));
        await campaignFactory.createCampaign(jenny.address, parseEther("5"));

        const campaigns = await campaignFactory.getCampaigns();
        expect(campaigns.length).to.equal(3);
    });
});
