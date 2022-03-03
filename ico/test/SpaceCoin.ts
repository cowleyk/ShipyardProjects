import { expect } from "chai";
import { ethers } from "hardhat";
import { SpaceCoin } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
const { constants: { ZERO_ADDRESS } } = require("@openzeppelin/test-helpers");
const { utils: { parseEther } } = ethers;


describe("SpaceCoin", function () {
    let spaceCoin: SpaceCoin;
    let creator: SignerWithAddress;
    let larry: SignerWithAddress;
    let jenny: SignerWithAddress;
    let addrs: SignerWithAddress[];

    beforeEach(async () => {
        [creator, larry, jenny, ...addrs] = await ethers.getSigners();
        const spaceCoinFactory = await ethers.getContractFactory("SpaceCoin");
        spaceCoin = await spaceCoinFactory.deploy(creator.address);
        await spaceCoin.deployed();
    });

    it("treasury can toggle tax on and off", async () => {});
    it("only treasury can toggle tax", async () => {});
    it("collects aside 2% tax on all transfers when toggled on", async () => {});
});
