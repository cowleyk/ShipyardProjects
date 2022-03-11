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
        // whitelisted1 becomes member, is already whitelisted, and can create a proposal
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId = 1;
        const newProposal = await collectorDao.proposals(proposalId);
        const whitelistedContributor = await collectorDao.contributors(whitelisted1.address);

        expect(await collectorDao.totalProposals()).to.equal(1);
        expect(newProposal.proposer).to.equal(whitelisted1.address);
        expect(newProposal.votes).to.equal(0);
        expect(whitelistedContributor.recentProposalId).to.equal(newProposal.id);

        // whitelisted1 cannot create a second proposal while they have an active proposal
        await expect(collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description'))
            .to.be.revertedWith('MEMBER_PROPOSAL_EXISTS')
    });
    
    it("Allows qualified addresses to cancel a proposal", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId = 1;
        const proposalPreCancel = await collectorDao.proposals(proposalId);
        expect(proposalPreCancel.status).to.equal(1)

        // a random address cannot cancel a proposal
        await expect(collectorDao.connect(jenny).cancelProposal(proposalId)).to.be.revertedWith("PERMISSION_ERROR");

        // the govenor can cancel a proposal
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
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId = 1;
        const ballotValue = { proposalId };

        // create EIP-712 signature
        let signature = await whitelisted1._signTypedData(domain, types, ballotValue);

        const whitelisted1BeforeVote = await collectorDao.contributors(whitelisted1.address);
        expect(whitelisted1BeforeVote.voteWeight).to.equal(parseEther("1"));
        expect(whitelisted1BeforeVote.voteCount).to.equal(0);
        
        // vote using EIP-712 signature
        await collectorDao.voteBySignatures(proposalId, [1], [signature]);
        
        const whitelisted1AfterVote = await collectorDao.contributors(whitelisted1.address);
        expect(whitelisted1AfterVote.voteWeight).to.equal(parseEther("1.05"));
        expect(whitelisted1AfterVote.voteCount).to.equal(1);

        const proposal = await collectorDao.proposals(proposalId);
        expect(proposal.votes).to.equal(1);
    });

    it("Ensures all signatures belong to members to be counted as votes", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted2).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId = 1;
        const ballotValue = { proposalId };

        let whitelisted1Sig = await whitelisted1._signTypedData(domain, types, ballotValue);
        let whitelisted2Sig = await whitelisted2._signTypedData(domain, types, ballotValue);
        let larrySig = await larry._signTypedData(domain, types, ballotValue);
        let jennySig = await jenny._signTypedData(domain, types, ballotValue);

        // send 4 total votes, but 1 voter (jenny) is not a member
        await collectorDao.voteBySignatures(proposalId, [1, 1, 1, 1], [whitelisted1Sig, whitelisted2Sig, larrySig, jennySig]);

        // expect only 3 votes on the proposal
        const proposal = await collectorDao.proposals(proposalId);
        expect(proposal.votes).to.equal(3);
        expect(proposal.status).to.equal(1);
    });

    it("Govenor or Proposer can execute a valid proposal", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted2).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(jenny).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId = 1;
        const ballotValue = { proposalId };

        let whitelisted1Sig = await whitelisted1._signTypedData(domain, types, ballotValue);
        let whitelisted2Sig = await whitelisted2._signTypedData(domain, types, ballotValue);
        let larrySig = await larry._signTypedData(domain, types, ballotValue);
        let jennySig = await jenny._signTypedData(domain, types, ballotValue);

        await collectorDao.voteBySignatures(proposalId, [1, 1, 1, 1], [whitelisted1Sig, whitelisted2Sig, larrySig, jennySig]);

        const proposalPreExecute = await collectorDao.proposals(proposalId);
        expect(proposalPreExecute.votes).to.equal(4);
        expect(proposalPreExecute.status).to.equal(1);
        
        // a non-proposer member cannot cancel a proposal
        await expect(collectorDao.connect(larry).execute(proposalId)).to.be.revertedWith("PERMISSION_ERROR");

        // the proposer can execute a proposal
        await collectorDao.connect(whitelisted1).execute(proposalId)
        
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
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId = 1;
        const value = { proposalId };
        let larrySig = await larry._signTypedData(domain, types, value);
        await collectorDao.voteBySignatures(proposalId, [1], [larrySig]);

        // only 1 out of 6 members have voted on the proposal, so it will not execute
        await expect(collectorDao.connect(creator).execute(proposalId)).to.be.revertedWith("INVALID_PROPOSAL");
    });
    
    it("requires proposals to have a quarum weighted majority", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted2).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(jenny).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(addrs[1]).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(addrs[2]).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId = 1;
        const ballotValue = { proposalId };

        let jennySig = await jenny._signTypedData(domain, types, ballotValue);
        let larrySig = await larry._signTypedData(domain, types, ballotValue);
        let whitelisted1Sig = await whitelisted1._signTypedData(domain, types, ballotValue);

        // vote 3 times to reach a quorum
        await collectorDao.voteBySignatures(proposalId, [0, 1, 0], [jennySig, larrySig, whitelisted1Sig]);
        
        // 2 anti votes and 1 pro vote fails to reach weighted majority
        await expect(collectorDao.connect(creator).execute(proposalId)).to.be.revertedWith("INVALID_PROPOSAL");
    });

    it("Allows greater influence for larger contributors", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("3")});
        await collectorDao.connect(whitelisted2).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(jenny).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(addrs[1]).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(addrs[2]).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId = 1;
        const ballotValue = { proposalId };

        // vote on proposal with 2 lower weight and 1 heavy weight vote
        let whitelisted1Sig = await whitelisted1._signTypedData(domain, types, ballotValue);
        let whitelisted2Sig = await whitelisted2._signTypedData(domain, types, ballotValue);
        let larrySig = await larry._signTypedData(domain, types, ballotValue);
        await collectorDao.voteBySignatures(proposalId, [1, 0, 0], [whitelisted1Sig, whitelisted2Sig, larrySig]);

        const proposalPreExecute = await collectorDao.proposals(proposalId);
        expect(proposalPreExecute.votes).to.equal(3);
        expect(proposalPreExecute.status).to.equal(1);
        expect(proposalPreExecute.proVoteWeight).to.equal(parseEther("3"));
        expect(proposalPreExecute.totalVoteWeight).to.equal(parseEther("5"));
        
        // Even though only 1 of 3 votes were cast, the heavy weighted vote still pushed the proposal through
        await collectorDao.connect(creator).execute(proposalId)
        const proposalPostExecute = await collectorDao.proposals(proposalId);
        expect(proposalPostExecute.status).to.equal(2)
    });

    it("increases member influence with participation", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("3")});
        await collectorDao.connect(whitelisted2).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(jenny).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(addrs[1]).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(addrs[2]).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId1 = 1;

        // larry votes on a proposal, boosting he voteWeight
        const ballot1Value = { proposalId: proposalId1 };
        let larrySig = await larry._signTypedData(domain, types, ballot1Value);
        await collectorDao.voteBySignatures(proposalId1, [0], [larrySig]);
        const larryPostVote = await collectorDao.contributors(larry.address);
        expect(larryPostVote.voteWeight).to.equal(parseEther("1.05"));

        await collectorDao.connect(whitelisted2).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId2 = 2;
        const ballot2Value = { proposalId: proposalId2 };
        let larrySig2 = await larry._signTypedData(domain, types, ballot2Value);
        let jennySig2 = await jenny._signTypedData(domain, types, ballot2Value);
        await collectorDao.voteBySignatures(proposalId2, [1, 0], [larrySig2, jennySig2]);

        await collectorDao.connect(creator).execute(proposalId2)
        const proposalPostExecute = await collectorDao.proposals(proposalId2);
        expect(proposalPostExecute.status).to.equal(2)
    });
});
