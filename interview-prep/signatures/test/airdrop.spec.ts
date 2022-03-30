import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { Airdrop, ERC20, ShipyardToken } from "../typechain"

const provider = ethers.provider
let account1: SignerWithAddress
let account2: SignerWithAddress
let rest: SignerWithAddress[]

let shipToken: ShipyardToken
let airdrop: Airdrop
let merkleRoot: string

let domain: any;
let types : any;

describe("Airdrop", function () {
  before(async () => {
    ;[account1, account2, ...rest] = await ethers.getSigners()

    shipToken = (await (await ethers.getContractFactory("ShipyardToken")).deploy("Shipyard Token", "$SHIP")) as ShipyardToken
    await shipToken.deployed()

    // TODO: The bytes32 value below is just a random hash in order to get the tests to pass.
    // You must create a merkle tree for testing, computes it root, then set it here
    merkleRoot = "0x150d81d5384973959afe304312de1ccab6382a4dfd98f9211a32278bbafd016b"
  })

  beforeEach(async () => {
    airdrop = await (await ethers.getContractFactory("Airdrop")).deploy(merkleRoot, account1.address, shipToken.address)
    await airdrop.deployed()

    domain = {
        name: 'Airdrop',
        // chainId = 31337 for hardhat network
        version: "v1",
        chainId: 31337,
        verifyingContract: airdrop.address
    };
    // Claim(address claimer, uint256 amount)
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

//   describe("Merkle claiming", () => {
//     it ("TODO", async () => {
//       throw new Error("TODO: add more tests here!")

        // Will be given array of elements + leaf, need to generate proof

//     })
//   })

  describe("Signature claiming", () => {
    it ("TODO", async () => {
        const amount = parseEther("1");
        const claimValue = { claimer: account2.address, amount };
        let signature = await account1._signTypedData(domain, types, claimValue);
            
        await airdrop.connect(account2).signatureClaim(signature, account2.address, amount);

        const alreadyClaimed = await airdrop.alreadyClaimed(account2.address);
        expect(alreadyClaimed).to.be.true;

    })
  })
})