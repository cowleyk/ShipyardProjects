import { expect } from "chai";
import { ethers } from "hardhat";

describe("Crowdfundr", () => {
  let deployer;
  let creator;
  let alice;
  let bob;
  let addrs;

  beforeEach(async () => {
    [deployer, creator, alice, bob, ...addrs] = await ethers.getSigners();
    const Crowdfundr = await ethers.getContractFactory("Crowdfundr");
    const crowdfundr = await Crowdfundr.deploy("Hello, world!");
    await crowdfundr.deployed();
  })
});
