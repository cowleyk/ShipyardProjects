//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./ContributorFactory.sol";

/// @title Factory contract for creating and cancelling proposals
contract ProposalFactory is ContributorFactory {
    /// @dev INITIATED status is never assigned or referenced
    /// @dev INITIATED keeps keeps non-existant proposals from defaulting and being treated as in "REVIEW" state
    enum ProposalStatus {
        INITIATED,
        REVIEW,
        EXECUTED,
        FAILED,
        CANCELLED
    }

    /// @notice information about a specific proposal
    struct Proposal {
        uint256 id;
        address proposer;
        /// @dev information about the proposals actions
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string[] signatures;
        /// @dev data for calculating if proposal can be executed
        uint256 votes;
        uint256 totalVoteWeight;
        uint256 proVoteWeight;
        uint256 created;
        ProposalStatus status;
    }

    /// @notice lookup of proposal data by ID
    mapping(uint256 => Proposal) public proposals;

    /// @notice lookup of proposal hashes
    /// @dev used to ensure same proposal isn't proposed twice
    mapping(bytes32 => bool) public activeProposals;

    /// @notice how many proposals have been submitted
    /// @dev use totalProposals to assign an ID to a new proposal
    uint256 public totalProposals;

    event ProposalCreated(uint256 indexed _id, address indexed _proposer);
    event ProposalCancelled(uint256 _proposalId);

    /// @notice create a proposal with a list of functionality
    /// @dev an action's target address, value and function call must be separate parameters and line up with the proper indices
    /// @dev every proposal must include at leaast one action
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string[] memory signatures
    ) external isMember returns (uint256) {
        /// @notice member is required to either be white listed or have voted on 5 other proposals before permitted to create a proposal
        require(
            contributors[msg.sender].whitelisted ||
                contributors[msg.sender].voteCount >= 5,
            "PERMISSION_ERROR"
        );
        require(
            targets.length == values.length &&
                targets.length == calldatas.length &&
                targets.length == signatures.length,
            "INVALID_PARAMETERS"
        );
        require(targets.length != 0, "MISSING_FUNCTIONALITY");

        /// @notice check that a duplicate proposal is not currently active
        bytes32 hashedProposal = keccak256(
            abi.encode(targets, values, calldatas, signatures)
        );
        require(!activeProposals[hashedProposal], "PROPOSAL_ACTIVE");
        /// @notice set this proposal to active
        activeProposals[hashedProposal] = true;

        totalProposals++;
        Proposal memory newProposal = Proposal({
            id: totalProposals,
            proposer: msg.sender,
            targets: targets,
            values: values,
            calldatas: calldatas,
            signatures: signatures,
            votes: 0,
            totalVoteWeight: 0,
            proVoteWeight: 0,
            status: ProposalStatus.REVIEW,
            created: block.timestamp
        });

        proposals[newProposal.id] = newProposal;
        emit ProposalCreated(newProposal.id, msg.sender);
        return newProposal.id;
    }

    /// @notice the govenor can cancel a proposal at any time
    /// @notice the propser can cancel a proposal as long as it is not eligible for execution
    /// @notice proposal must be in "REVIEW" state
    function cancelProposal(uint256 proposalId) external {
        Proposal memory proposal = proposals[proposalId];
        bool preQuorum = proposal.votes * 4 < totalMembers;
        require(
            msg.sender == govenor ||
                (msg.sender == proposal.proposer && preQuorum),
            "PERMISSION_ERROR"
        );
        require(proposal.status == ProposalStatus.REVIEW, "INVALID_PROPOSAL");
        proposals[proposalId].status = ProposalStatus.CANCELLED;
        emit ProposalCancelled(proposalId);
    }

    /// @notice make sure the proposal about to be executed meets the DAO criteria
    function _proposalValid(uint256 proposalId) internal view returns (bool) {
        Proposal memory proposal = proposals[proposalId];

        /// @notice proposal must have gotten a vote from 25% of all members
        require((proposal.votes * 4) >= totalMembers, "QUORUM");

        /// @notice proposal must not have been previously executed, cancelled, or failed
        require(proposal.status == ProposalStatus.REVIEW, "INVALID_STATE");

        /// @notice proposal must have been in review for 7 days
        require(proposal.created + 7 days < block.timestamp, "SOAK_TIME");

        /// @notice proposal's voteWeight for must be > 50% of the total voteWeight
        require(
            proposal.proVoteWeight >
                (proposal.totalVoteWeight - proposal.proVoteWeight),
            "PROPOSAL_REJECTED"
        );

        return true;
    }

    function _updateProposal(
        uint256 proposalId,
        uint256 support,
        uint256 voteWeight
    ) internal {
        /// @notice accumulate proposal's total votes
        proposals[proposalId].votes++;

        /// @notice accumulate proposal's pro votes weighted
        if (support > 0) {
            proposals[proposalId].proVoteWeight += voteWeight;
        }

        /// @notice accumulate proposal's total votes weighted
        proposals[proposalId].totalVoteWeight += voteWeight;
    }
}
