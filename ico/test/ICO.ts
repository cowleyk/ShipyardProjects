import { expect } from "chai";
import { ethers } from "hardhat";
import { ICO } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
const { constants: { ZERO_ADDRESS } } = require("@openzeppelin/test-helpers");
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
        ico = await icoFactory.deploy(creator.address);
        await ico.deployed();
    });

    it("investors can purchase tokens during Phase Seed", async () => {});
    it("only whitelisted investors cant purchase tokens during Phase Seed", async () => {});
    it("only raises 15000ETH during Phase Seed", async () => {});
    it("maximum contribution 1500ETH during Phase Seed", async () => {});
    it("any investors can purchase tokens during Phase General", async () => {});
    it("only raises 15000ETH during Phase General", async () => {});
    it("maximum contribution 1000ETH during Phase General", async () => {});

    it("owner can advance phase anytime", async () => {});
    it("owner can pause/resume campaign anytime", async () => {});
    it("owner can add addresses to whitelist", async () => {});
    it("collect tokens after ICO", async () => {});
});
