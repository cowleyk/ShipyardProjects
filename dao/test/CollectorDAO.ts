import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { CollectorDAO, NftMarketplace } from "../typechain";
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
        collectorDao = await CollectorDao.deploy(creator.address, [whitelisted1.address, whitelisted2.address]);
        await collectorDao.deployed();    
        domain = {
            name: 'CollectorDAO',
            // chainId = 31337 for hardhat network
            chainId: 31337,
            verifyingContract: collectorDao.address
        };
        types = {
            Ballot: [
                { name: 'proposalId', type: 'uint256' },
                { name: 'support', type: 'uint256' }
            ]
        };
    });

    it("Allows members to join for > 1 ETH", async () => {
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        const larryContributor = await collectorDao.contributors(larry.address);

        expect(larryContributor.contribution).to.equal(parseEther("1"))
        expect(await collectorDao.totalMembers()).to.equal(1);
    });

    it("Members must contribute 1 ETH to join", async () => {
        await expect(collectorDao.connect(larry).becomeMember({ value: parseEther("0.9")})).to.be.revertedWith("INSUFFICIENT_FUNDS");
    });

    it("Only can become a member once", async () => {
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await expect(collectorDao.connect(larry).becomeMember({ value: parseEther("1")})).to.be.revertedWith("MEMBER_EXISTS");
    });

    it("Allows members to increase stake", async () => {
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).increaseStake({ value: parseEther("0.3")});
        const larryContributor = await collectorDao.contributors(larry.address);

        expect(larryContributor.contribution).to.equal(parseEther("1.3"));
        expect(await collectorDao.totalMembers()).to.equal(1);
    });

    it("Only members can increase their stake", async () => {
        await expect(collectorDao.connect(larry).increaseStake({ value: parseEther("0.3")})).to.be.revertedWith("NOT_MEMBER");
    });

    it("Allows governer to whitelist proposers", async () => {
        const larryUnlisted = await collectorDao.contributors(larry.address);
        expect(larryUnlisted.whitelisted).to.be.false;
        await collectorDao.connect(creator).whitelistAddress(larry.address);
        const larryWhitelisted = await collectorDao.contributors(larry.address);
        expect(larryWhitelisted.whitelisted).to.be.true;
    });

    it("A member cannot add to whitelist", async () => {
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await expect(collectorDao.connect(larry).whitelistAddress(larry.address)).to.be.revertedWith("PERMISSION_ERROR");
    });

    it("Allows qualified addresses to create a proposal", async () => {
        // whitelisted1 becomes member, is already whitelisted, and can create a proposal
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose(
            [Wallet.createRandom().address, Wallet.createRandom().address], 
            [1, 2], 
            [randomBytes(1), randomBytes(1)], 
            ['functSig1', 'functSig2'], 
            'description'
        );
        const proposalId = 1;
        const newProposal = await collectorDao.proposals(proposalId);

        expect(await collectorDao.totalProposals()).to.equal(1);
        expect(newProposal.proposer).to.equal(whitelisted1.address);
        expect(newProposal.votes).to.equal(0);
    });

    it("Requires a proposal to have valid parameters", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        const invalidParameters =  collectorDao.connect(whitelisted1).propose(
            [Wallet.createRandom().address], 
            [1, 2], 
            [randomBytes(1), randomBytes(1)], 
            ['functSig1', 'functSig2'], 
            'description'
        );
        await expect(invalidParameters).to.be.revertedWith("INVALID_PARAMETERS");

        const missingParameters =  collectorDao.connect(whitelisted1).propose([], [], [], [], 'description');
        await expect(missingParameters).to.be.revertedWith("MISSING_FUNCTIONALITY");
    });
    
    it("Allows qualified addresses to cancel a proposal", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose(
            [Wallet.createRandom().address, Wallet.createRandom().address],
            [1, 2],
            [randomBytes(1), randomBytes(1)],
            ['functSig1', 'functSig2'],
            'description'
        );
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
        const larryProposal = collectorDao.connect(larry).propose(
            [Wallet.createRandom().address, Wallet.createRandom().address], 
            [1, 2], 
            [randomBytes(1), randomBytes(1)], 
            ['functSig1', 'functSig2'], 
            'description'
        );
        await expect(larryProposal).to.be.revertedWith("PERMISSION_ERROR")
    });

    it("Allows members to vote on a proposal", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose(
            [Wallet.createRandom().address, Wallet.createRandom().address], 
            [1, 2], 
            [randomBytes(1), randomBytes(1)], 
            ['functSig1', 'functSig2'], 
            'description'
        );
        const proposalId = 1;
        // const ballotValue = { proposalId };
        const ballotValue = { proposalId, support: 1 };

        // create EIP-712 signature
        let signature = await whitelisted1._signTypedData(domain, types, ballotValue);

        const whitelisted1BeforeVote = await collectorDao.contributors(whitelisted1.address);
        expect(whitelisted1BeforeVote.voteWeight).to.equal(parseEther("1"));
        expect(whitelisted1BeforeVote.voteCount).to.equal(0);
        
        // vote using EIP-712 signature
        await collectorDao.voteBySignatures(proposalId, [1], [signature]);
        const proposal = await collectorDao.proposals(proposalId);
        expect(proposal.votes).to.equal(1);
        const whitelisted1AfterVote = await collectorDao.contributors(whitelisted1.address);
        expect(whitelisted1AfterVote.voteWeight).to.equal(parseEther("1.05"));
        expect(whitelisted1AfterVote.voteCount).to.equal(1);

    });

    it("Requires a proposal to be in the correct state and receive valid parameters to vote", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose(
            [Wallet.createRandom().address, Wallet.createRandom().address], 
            [1, 2], 
            [randomBytes(1), randomBytes(1)], 
            ['functSig1', 'functSig2'], 
            'description'
        );
        const proposalId = 1;
        const ballotValue = { proposalId, support: 1 };

        let signature = await whitelisted1._signTypedData(domain, types, ballotValue);

        const whitelisted1BeforeVote = await collectorDao.contributors(whitelisted1.address);
        expect(whitelisted1BeforeVote.voteWeight).to.equal(parseEther("1"));
        expect(whitelisted1BeforeVote.voteCount).to.equal(0);
        
        // Mismatched votes and signatures fail
        await expect(collectorDao.voteBySignatures(proposalId, [1, 1], [signature])).to.be.revertedWith("INVALID_PARAMETERS");

        // A proposal not in review cannot be voted on
        await collectorDao.connect(creator).cancelProposal(proposalId);
        await expect(collectorDao.voteBySignatures(proposalId, [1], [signature])).to.be.revertedWith("INVALID_PROPOSAL");
    });

    it("Does not process bad signatures", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted2).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(jenny).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId = 1;
        const ballotValue = { proposalId, support: 1 };

        let whitelisted1Sig = await whitelisted1._signTypedData(domain, types, ballotValue);
        let whitelisted2Sig = await whitelisted2._signTypedData(domain, types, ballotValue);
        let larrySig = randomBytes(1);
        let jennySig = await jenny._signTypedData(domain, types, ballotValue);

        // send 4 total votes, but 1 voter (larry) has a bad signature
        await collectorDao.voteBySignatures(proposalId, [1, 1, 1, 1], [whitelisted1Sig, whitelisted2Sig, larrySig, jennySig]);

        // expect only 3 votes on the proposal
        const proposal = await collectorDao.proposals(proposalId);
        expect(proposal.votes).to.equal(3);
        expect(proposal.status).to.equal(1);
    });

    it("Ensures all signatures belong to members to be counted as votes", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted2).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId = 1;
        const ballotValue = { proposalId, support: 1 };

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
        const ballotValue = { proposalId, support: 1 };
        
        let whitelisted1Sig = await whitelisted1._signTypedData(domain, types, ballotValue);
        let whitelisted2Sig = await whitelisted2._signTypedData(domain, types, ballotValue);
        let larrySig = await larry._signTypedData(domain, types, ballotValue);
        let jennySig = await jenny._signTypedData(domain, types, ballotValue);
        
        await collectorDao.voteBySignatures(proposalId, [1, 1, 1, 1], [whitelisted1Sig, whitelisted2Sig, larrySig, jennySig]);
        
        const proposalPreExecute = await collectorDao.proposals(proposalId);
        expect(proposalPreExecute.votes).to.equal(4);
        expect(proposalPreExecute.status).to.equal(1);

        // let proposal "soak" for  > 7 days
        await increaseTime(60*60*24*8);
        
        // a non-proposer member cannot execute a proposal
        await expect(collectorDao.connect(larry).execute(proposalId)).to.be.revertedWith("PERMISSION_ERROR");
        
        // the proposer can execute a proposal
        await collectorDao.connect(whitelisted1).execute(proposalId);
        
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
        const ballotValue = { proposalId, support: 1 };
        let larrySig = await larry._signTypedData(domain, types, ballotValue);
        await collectorDao.voteBySignatures(proposalId, [1], [larrySig]);

        // only 1 out of 6 members have voted on the proposal, so it will not execute
        await expect(collectorDao.connect(creator).execute(proposalId)).to.be.revertedWith("QUORUM");
    });
    
    it("requires proposals to have a quorum weighted majority", async () => {
        await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted2).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(larry).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(jenny).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(addrs[1]).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(addrs[2]).becomeMember({ value: parseEther("1")});
        await collectorDao.connect(whitelisted1).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId = 1;
        const jennyBallotValue = { proposalId, support: 0 };
        const larryBallotValue = { proposalId, support: 1 };
        const whitelisted1BallotValue = { proposalId, support: 0 };

        let jennySig = await jenny._signTypedData(domain, types, jennyBallotValue);
        let larrySig = await larry._signTypedData(domain, types, larryBallotValue);
        let whitelisted1Sig = await whitelisted1._signTypedData(domain, types, whitelisted1BallotValue);

        // vote 3 times to reach a quorum
        await collectorDao.voteBySignatures(proposalId, [0, 1, 0], [jennySig, larrySig, whitelisted1Sig]);

        // let proposal "soak" for  > 7 days
        await increaseTime(60*60*24*8);
        
        // 2 anti votes and 1 pro vote fails to reach weighted majority
        await expect(collectorDao.connect(creator).execute(proposalId)).to.be.revertedWith("PROPOSAL_REJECTED");
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
        const whitelisted1BallotValue = { proposalId, support: 1 };
        const whitelisted2BallotValue = { proposalId, support: 0 };
        const larryBallotValue = { proposalId, support: 0 };

        // vote on proposal with 2 lower weight and 1 heavy weight vote
        let whitelisted1Sig = await whitelisted1._signTypedData(domain, types, whitelisted1BallotValue);
        let whitelisted2Sig = await whitelisted2._signTypedData(domain, types, whitelisted2BallotValue);
        let larrySig = await larry._signTypedData(domain, types, larryBallotValue);
        await collectorDao.voteBySignatures(proposalId, [1, 0, 0], [whitelisted1Sig, whitelisted2Sig, larrySig]);

        // let proposal "soak" for  > 7 days
        await increaseTime(60*60*24*8);

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
        const ballot1Value = { proposalId: proposalId1, support: 0 };
        let larrySig = await larry._signTypedData(domain, types, ballot1Value);
        await collectorDao.voteBySignatures(proposalId1, [0], [larrySig]);
        const larryPostVote = await collectorDao.contributors(larry.address);
        expect(larryPostVote.voteWeight).to.equal(parseEther("1.05"));

        await collectorDao.connect(whitelisted2).propose([Wallet.createRandom().address, Wallet.createRandom().address], [1, 2], [randomBytes(1), randomBytes(1)], ['functSig1', 'functSig2'], 'description');
        const proposalId2 = 2;
        const larryBallot2Value = { proposalId: proposalId2, support: 1 };
        const jennyBallot2Value = { proposalId: proposalId2, support: 0 };
        let larrySig2 = await larry._signTypedData(domain, types, larryBallot2Value);
        let jennySig2 = await jenny._signTypedData(domain, types, jennyBallot2Value);
        await collectorDao.voteBySignatures(proposalId2, [1, 0], [larrySig2, jennySig2]);

        // let proposal "soak" for  > 7 days
        await increaseTime(60*60*24*8);

        await collectorDao.connect(creator).execute(proposalId2)
        const proposalPostExecute = await collectorDao.proposals(proposalId2);
        expect(proposalPostExecute.status).to.equal(2)
    });

    it("requires proposals to 'soak' for 7 days", async () => {});

    it("allows voting with msg.sender instead of signature", async () => {});

    it("prevents duplicate proposals from being active at the same time", async () => {});

    // Remove `require(msg.sender == address(this))` from `CollectorDAO.buyNFT()` to execute this test
    // it("can buy an nft", async () => {
    //     // fund DAO
    //     await collectorDao.connect(whitelisted1).becomeMember({ value: parseEther("10")});
        
    //     // deploy marketplace
    //     const NftMarketplace = await ethers.getContractFactory("NftMarketplace");
    //     const nftMarketplace: NftMarketplace = await NftMarketplace.deploy();
    //     await nftMarketplace.deployed();

    //     await collectorDao.buyNFT(nftMarketplace.address, Wallet.createRandom().address, 3);
    // });

    // Helper function
    const increaseTime = async (seconds: number): Promise<void> => {
        await hre.network.provider.send("evm_increaseTime", [seconds]);
        await hre.network.provider.send("evm_mine");
    };
});
