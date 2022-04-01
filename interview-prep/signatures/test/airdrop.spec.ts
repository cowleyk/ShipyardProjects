import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
import { ethers } from "hardhat";
import { utils, Wallet } from "ethers";
import { Airdrop, ShipyardToken } from "../typechain"
const { parseEther, solidityKeccak256 } = utils;

let account1: SignerWithAddress
let account2: SignerWithAddress
let rest: SignerWithAddress[]

let shipToken: ShipyardToken
let airdrop: Airdrop
let merkleRoot: string
let merkleTree: any;
let leafs: any;

let domain: any;
let types : any;

describe("Airdrop", function () {
  before(async () => {
    ;[account1, account2, ...rest] = await ethers.getSigners()

    shipToken = (await (await ethers.getContractFactory("ShipyardToken")).deploy("Shipyard Token", "$SHIP")) as ShipyardToken
    await shipToken.deployed()

    leafs = rest.map(addr => solidityKeccak256(["address", "uint256"], [addr.address, parseEther("10")]));

    merkleTree = new MerkleTree(leafs, keccak256, { sort: true });
    merkleRoot = merkleTree.getHexRoot();
    // "0x3ab8be7f3469fd0e416d66bf2f0fcc6435be678219d068a4f30f51d2def0f23e"
  })

  beforeEach(async () => {
    airdrop = await (await ethers.getContractFactory("Airdrop")).deploy(merkleRoot, account1.address, shipToken.address)
    await airdrop.deployed()
    await shipToken.transfer(airdrop.address, parseEther("50"));

    domain = {
        name: 'Airdrop',
        version: "v1",
        // chainId = 31337 for hardhat network
        chainId: 31337,
        verifyingContract: airdrop.address
    };
    types = {
        Claim: [
            { name: 'claimer', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ]
    };
  })

  describe("setup and disabling ECDSA", () => {

    it("should deploy correctly", async () => {
      // if the beforeEach succeeded, then this succeeds
    })

    it("should disable ECDSA verification", async () => {
      // first try with non-owner user
      await expect(airdrop.connect(account2).disableECDSAVerification()).to.be.revertedWith("Ownable: caller is not the owner")

      // now try with owner
      await expect(airdrop.disableECDSAVerification())
        .to.emit(airdrop, "ECDSADisabled")
        .withArgs(account1.address)
    })
  })

  describe("Merkle claiming", () => {
    it ("Allows users included in a merkle tree to claim ERC-20 tokens", async () => {
        const leaf = leafs[1];
        const proof = merkleTree.getHexProof(leaf);
        await airdrop.merkleClaim(proof, rest[1].address, parseEther("10"));
        const alreadyClaimed = await airdrop.alreadyClaimed(account1.address);
        expect(alreadyClaimed).to.be.true;
    });
    
    it ("Rejects addresses not in the merkle tree", async () => {
        // try with random address
        const badAddress = Wallet.createRandom().address;
        const badLeaf = solidityKeccak256(["address", "uint256"], [badAddress, parseEther("10")]);
        const badProof = merkleTree.getHexProof(badLeaf);
        await expect(airdrop.merkleClaim(badProof, badAddress, parseEther("10")))
            .to.be.revertedWith("INVALID_CLAIM");
    })
  })

  describe("Signature claiming", () => {
    it ("Allows users with a valid signature to claim ERC-20 tokens", async () => {
        const amount = parseEther("1");
        const claimValue = { claimer: account2.address, amount };
        let signature = await account1._signTypedData(domain, types, claimValue);
            
        await airdrop.connect(account2).signatureClaim(signature, account2.address, amount);
        const alreadyClaimed = await airdrop.alreadyClaimed(account2.address);
        expect(alreadyClaimed).to.be.true;
    });
    
    it ("Rejects invalid signatures trying to claim ERC-20 tokens", async () => {
        const amount = parseEther("1");
        const claimValue = { claimer: account2.address, amount };
        let signature = await account2._signTypedData(domain, types, claimValue);
            
        await expect(airdrop.connect(account2).signatureClaim(signature, account2.address, amount))
            .to.be.revertedWith("INVALID_CLAIM");
    });
  })
})