import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { CollectorDAO } from "../typechain";
import { Wallet } from "ethers";
const { utils: { parseEther, randomBytes } } = ethers;

describe("CollectorDAO", function () {
    let collectorDao: CollectorDAO;
    let creator: SignerWithAddress;
    let larry: SignerWithAddress;
    let jenny: SignerWithAddress;
    let whitelisted1: SignerWithAddress;
    let whitelisted2: SignerWithAddress;
    let addrs: SignerWithAddress[];
    let domain: any;
    let types: any;

    beforeEach(async () => {
        [creator, larry, jenny, whitelisted1, whitelisted2, ...addrs] = await ethers.getSigners();
        const CollectorDao = await ethers.getContractFactory("CollectorDAO");
        collectorDao = await CollectorDao.deploy(creator.address, 5, [whitelisted1.address, whitelisted2.address]);
        await collectorDao.deployed();    
        domain = {
            name: 'CollectorDAO',
            // chainId = 31337 for hardhat network
            chainId: 31337,
            verifyingContract: collectorDao.address
        };
        types = {
            Ballot: [{ name: 'proposalId', type: 'uint256' }]
        };
    });

    it("Allows members to join for > 1 ETH", async () => {
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        const larryContributor = await collectorDao.contributors(larry.address);

        expect(larryContributor.contribution).to.equal(parseEther("1"))
        expect(await collectorDao.totalContributions()).to.equal(parseEther("1"));
        expect(await collectorDao.totalMembers()).to.equal(1);
    });

    it("Members must contribute 1 ETH to join", async () => {
        await expect(collectorDao.connect(larry).becomeMember({ value: parseEther("0.9")})).to.be.revertedWith("INSUFFICIENT_FUNDS");
    });

    it("Allows members to increase stake", async () => {
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).increaseStake({ value: parseEther("0.3")});
        const larryContributor = await collectorDao.contributors(larry.address);

        expect(larryContributor.contribution).to.equal(parseEther("1.3"));
        expect(await collectorDao.totalContributions()).to.equal(parseEther("1.3"));
        expect(await collectorDao.totalMembers()).to.equal(1);
    });

    it("Allows governer to whitelist proposers", async () => {
        const larryUnlisted = await collectorDao.contributors(larry.address);
        expect(larryUnlisted.whitelisted).to.be.false;
        await collectorDao.connect(creator).whitelistAddress(larry.address);
        const larryWhitelisted = await collectorDao.contributors(larry.address);
        expect(larryWhitelisted.whitelisted).to.be.true;
    });

    it("Allows qualified addresses to create a proposal", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const newProposal = await collectorDao.proposals(0);
        const whitelistedContributor = await collectorDao.contributors(whitelisted1.address);

        expect(await collectorDao.totalProposals()).to.equal(1);
        expect(newProposal.proposer).to.equal(whitelisted1.address);
        expect(newProposal.votes).to.equal(0);
        expect(whitelistedContributor.recentProposalId).to.equal(newProposal.id);

        await expect(collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description'))
            .to.be.revertedWith('MEMBER_PROPOSAL_EXISTS')
    });
    
    it("Allows qualified addresses to cancel a proposal", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        const { value: proposalId } = await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalPreCancel = await collectorDao.proposals(proposalId);
        expect(proposalPreCancel.status).to.equal(1)

        await expect(collectorDao.connect(jenny).cancelProposal(proposalId)).to.be.revertedWith("PERMISSION_ERROR");
        await collectorDao.connect(creator).cancelProposal(proposalId);
        const proposalPostCancel = await collectorDao.proposals(proposalId);
        expect(proposalPostCancel.status).to.equal(4);
    });

    it("Requires non-whitelisted addresses to have voted 5 times to create a proposal", async () => {
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        const larryProposal = collectorDao.connect(larry).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        await expect(larryProposal).to.be.revertedWith("PERMISSION_ERROR")
    });

    it("Allows members to vote on a proposal", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        const { value: proposalId } = await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');

        const ballotValue = { proposalId };

        let signature = await whitelisted1._signTypedData(domain, types, ballotValue);

        const whitelisted1BeforeVote = await collectorDao.contributors(whitelisted1.address);
        expect(whitelisted1BeforeVote.voteWeight).to.equal(parseEther("1"));
        expect(whitelisted1BeforeVote.voteCount).to.equal(0);
        
        await collectorDao.voteBySignatures(proposalId, [1], [signature]);
        
        const whitelisted1AfterVote = await collectorDao.contributors(whitelisted1.address);
        expect(whitelisted1AfterVote.voteWeight).to.equal(parseEther("1.05"));
        expect(whitelisted1AfterVote.voteCount).to.equal(1);

        const proposal = await collectorDao.proposals(0);
        expect(proposal.votes).to.equal(1);
    });

    it("Govenor or Proposer can execute a valid proposal", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted2).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(jenny).becomeMember({ value: parseEther("1")});
        const { value: proposalId } = await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');

        const ballotValue = { proposalId };

        let whitelisted1Sig = await whitelisted1._signTypedData(domain, types, ballotValue);
        let whitelisted2Sig = await whitelisted2._signTypedData(domain, types, ballotValue);
        let larrySig = await larry._signTypedData(domain, types, ballotValue);
        let jennySig = await jenny._signTypedData(domain, types, ballotValue);

        await collectorDao.voteBySignatures(proposalId, [1, 1, 1, 1], [whitelisted1Sig, whitelisted2Sig, larrySig, jennySig]);

        const proposalPreExecute = await collectorDao.proposals(proposalId);
        expect(proposalPreExecute.votes).to.equal(4);
        expect(proposalPreExecute.status).to.equal(1);
        
        await collectorDao.connect(creator).execute(proposalId)
        
        const proposalPostExecute = await collectorDao.proposals(proposalId);
        expect(proposalPostExecute.status).to.equal(2)
    });

    it("requires proposals to have a 25% quarum", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted2).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(jenny).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(addrs[1]).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(addrs[2]).becomeMember({ value: parseEther("1")});
        const { value: proposalId } = await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');

        const value = { proposalId };
        let larrySig = await larry._signTypedData(domain, types, value);

        await collectorDao.voteBySignatures(proposalId, [1], [larrySig]);
        await expect(collectorDao.connect(creator).execute(proposalId)).to.be.revertedWith("INVALID_PROPOSAL");
    });
    
    it("requires proposals to have a quarum weighted majority", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted2).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(jenny).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(addrs[1]).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(addrs[2]).becomeMember({ value: parseEther("1")});
        const { value: proposalId } = await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');

        const ballotValue = { proposalId };

        let jennySig = await jenny._signTypedData(domain, types, ballotValue);
        let larrySig = await larry._signTypedData(domain, types, ballotValue);
        let whitelisted1Sig = await whitelisted1._signTypedData(domain, types, ballotValue);

        await collectorDao.voteBySignatures(proposalId, [0, 1, 0], [jennySig, larrySig, whitelisted1Sig]);
        
        const proposalPreExecute = await collectorDao.proposals(proposalId);
        await expect(collectorDao.connect(creator).execute(proposalId)).to.be.revertedWith("INVALID_PROPOSAL");
    });

    it("Allows greater influence for larger contributors", async () => {
        // create proposal
        // 5 total members
        // 1 whale vote
        // 1 normal
        // vote passes
    });
});
