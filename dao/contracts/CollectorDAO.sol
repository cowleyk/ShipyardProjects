//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

/// @title A governance contract meant for buying NFTs
/// @author Kevin Cowley
contract CollectorDAO {
    /// @notice address responsible for maintaining DAO
    address public govenor;

    /// @notice total number of eligible voters
    uint8 public totalMembers;

    /// @notice total amount of ETH contributed by members
    uint256 public totalContributions;

    /// @notice a member's information
    struct Contributor {
        address _address;
        uint256 voteWeight;
        uint256 voteCount;
        uint256 contribution;
        uint256 recentProposalId;
        bool whitelisted;
    }

    /// @notice lookup of member data by address
    mapping(address => Contributor) public contributors;

    /// @dev EIP-712 constants
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,uint256 chainId,address verifyingContract)"
        );
    bytes32 public constant BALLOT_TYPEHASH =
        keccak256("Ballot(uint256 proposalId)");

    enum ProposalStatus {
        INITIATED,
        REVIEW,
        EXECUTED,
        FAILED,
        CANCELLED
    }

    /// @notice information about a specific proposal
    struct Proposal {
        uint8 id;
        address proposer;
        /// @dev information about the proposals actions
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string[] signatures;
        string description;
        /// @dev data for calculating if proposal can be executed
        uint8 votes;
        uint256 totalVoteWeight;
        uint256 proVoteWeight;
        ProposalStatus status;
    }

    /// @notice lookup of proposal data by ID
    mapping(uint256 => Proposal) public proposals;

    /// @notice how many proposals have been submitted
    /// @dev use totalProposals to assign an ID to a new proposal
    uint8 public totalProposals;

    /// @notice the maximum number of actions a proposal can perform
    uint256 public immutable maxTargets;

    event AddressWhitelisted(address _proposer);
    event MemberJoined(address _member);
    event MemberIncreasedStake(address indexed _member, uint256 _amount);
    event ProposalCreated(
        uint8 indexed _id,
        address indexed _proposer,
        address[] _targets,
        uint256[] _values,
        string[] _signatures,
        bytes[] _calldatas,
        string _description
    );
    event ProposalCancelled(uint8 _proposalId);
    event VoteFailed(bytes _signature);
    event BatchVotesSubmitted(uint8 indexed _proposalId, bytes[] _errors);
    event ProposalFailed(uint8 indexed _proposalId, address _target, uint256 _value, string _signature, bytes _calldata);
    event ExecuteTransaction(uint8 indexed _proposalId, address _target, uint256 _value, string _signature, bytes _calldata);
    event ProposalExecuted(uint8 _proposalId);

    /// @notice set up initial data of contract
    /// @param _govenor special permissions address for DAO manangement
    /// @param _maxTargets limit of actions per proposal
    /// @param _whitelist list of addresses that can propose immediately after becoming members
    constructor(
        address _govenor,
        uint256 _maxTargets,
        address[] memory _whitelist
    ) {
        govenor = _govenor;
        contributors[govenor].whitelisted = true;
        maxTargets = _maxTargets;
        for (uint256 i = 0; i < _whitelist.length; i++) {
            contributors[_whitelist[i]].whitelisted = true;
        }
    }

    modifier isGovenor() {
        require(msg.sender == govenor, "PERMISSION_ERROR");
        _;
    }

    modifier isMember() {
        require(contributors[msg.sender].contribution >= 1 ether, "NOT_MEMBER");
        _;
    }

    /// @notice member is required to either be white listed or have voted on 5 other proposals before permitted to create a proposal
    /// @notice a member can only have one active proposal at a time
    modifier canPropose() {
        require(
            contributors[msg.sender].whitelisted ||
                contributors[msg.sender].voteCount >= 5,
            "PERMISSION_ERROR"
        );
        require(
            proposals[contributors[msg.sender].recentProposalId].status !=
                ProposalStatus.REVIEW,
            "MEMBER_PROPOSAL_EXISTS"
        );
        _;
    }

    /// @notice allow govenor to add whitelisted addresses on the fly
    function whitelistAddress(address proposer) external isGovenor {
        contributors[proposer].whitelisted = true;
        emit AddressWhitelisted(proposer);
    }

    /// @notice an address can become a member with a 1 ETH contribution
    function becomeMember() external payable {
        require(msg.value >= 1 ether, "INSUFFICIENT_FUNDS");
        require(contributors[msg.sender].contribution == 0, "MEMBER_EXISTS");

        contributors[msg.sender].contribution += msg.value;
        contributors[msg.sender].voteWeight += msg.value;
        totalContributions += msg.value;
        totalMembers++;

        emit MemberJoined(msg.sender);
    }

    /// @notice a member can buy more influence by contriubting ETH
    function increaseStake() external payable isMember {
        contributors[msg.sender].contribution += msg.value;
        contributors[msg.sender].voteWeight += msg.value;
        totalContributions += msg.value;
        emit MemberIncreasedStake(msg.sender, msg.value);
    }

    /// @notice create a proposal with a list of functionality
    /// @dev an action's target address, value and function call must be separate parameters and line up with the proper indices
    /// @dev every proposal must include at leaast one action
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string[] memory signatures,
        string memory description
    ) external isMember canPropose returns (uint8) {
        require(
            targets.length == values.length &&
                targets.length == calldatas.length,
            "INVALID_PARAMETERS"
        );
        require(targets.length != 0, "MISSING_FUNCTIONALITY");
        require(targets.length <= maxTargets, "ACTIONS_OVERFLOW");

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
            description: description,
            status: ProposalStatus.REVIEW
        });

        proposals[newProposal.id] = newProposal;
        contributors[msg.sender].recentProposalId = newProposal.id;
        emit ProposalCreated(newProposal.id, msg.sender, targets, values, signatures, calldatas, description);
        return newProposal.id;
    }

    /// @notice the govenor or the proposing member can cancel a proposal
    function cancelProposal(uint8 proposalId) external {
        require(
            msg.sender == proposals[proposalId].proposer ||
                msg.sender == govenor,
            "PERMISSION_ERROR"
        );
        require(
            proposals[proposalId].status == ProposalStatus.REVIEW,
            "INVALID_PROPOSAL"
        );
        proposals[proposalId].status = ProposalStatus.CANCELLED;
        emit ProposalCancelled(proposalId);
    }

    /// @notice process batch votes all at once
    /// @notice all signatures that to be counted as votes are returned for the client to handle
    /// @dev signatures are required to be up to EIP-712 spec
    /// @param proposalId which proposal to vote on
    /// @param votes yes or no votes corresponding to the signature at the same index in the `signatures` array
    /// @param signatures array of EIP-712 sigantures from members
    function voteBySignatures(
        uint8 proposalId,
        uint8[] memory votes,
        bytes[] memory signatures
    ) external returns (bytes[] memory) {
        require(
            proposals[proposalId].status == ProposalStatus.REVIEW,
            "INVALID_PROPOSAL"
        );
        require(votes.length == signatures.length, "INVALID_PARAMETERS");

        bytes[] memory errors = new bytes[](signatures.length);
        for (uint256 i = 0; i < signatures.length; i++) {
            if (signatures[i].length == 65) {
                bytes memory signature = signatures[i];
                bytes32 r;
                bytes32 s;
                uint8 v;

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    r := mload(add(signature, 0x20))
                    s := mload(add(signature, 0x40))
                    v := byte(0, mload(add(signature, 0x60)))
                }
                bool voted = castVote(proposalId, votes[i], v, r, s);
                if (!voted) {
                    emit VoteFailed(signatures[i]);
                    errors[i] = signatures[i];
                }
            } else {
                errors[i] = signatures[i];
            }
        }
        emit BatchVotesSubmitted(proposalId, errors);
        return errors;
    }

    /// @notice internal function to process signatures and accumulate votes
    /// @dev sigantures are checked to be non-zero address and checked to be an existing member
    function castVote(
        uint8 proposalId,
        uint8 support,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal returns (bool) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("CollectorDAO")),
                getChainIdInternal(),
                address(this)
            )
        );
        bytes32 structHash = keccak256(abi.encode(BALLOT_TYPEHASH, proposalId));
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );

        /// @dev recover signature address
        address signatory = ecrecover(digest, v, r, s);

        /// @notice check that signature is non-zero
        if (signatory == address(0)) {
            return false;
        }

        /// @notice check that signature is a member
        if (contributors[signatory].contribution < 1 ether) {
            return false;
        }

        proposals[proposalId].votes++;

        /// @notice accumulate proposal's pro votes
        if (support > 0) {
            proposals[proposalId].proVoteWeight += contributors[signatory]
                .voteWeight;
        }

        /// @notice accumulate proposal's total votes
        proposals[proposalId].totalVoteWeight += contributors[signatory]
            .voteWeight;

        /// @notice reward contributor for participating in vote
        contributors[signatory].voteCount++;
        contributors[signatory].voteWeight += 0.05 ether;
        return true;
    }

    /// @notice make sure the proposal about to be executed meets the DAO criteria
    function proposalValid(uint8 proposalId) internal view returns (bool) {
        Proposal memory proposal = proposals[proposalId];

        /// @notice proposal must have gotten a vote from 25% of all members
        if ((proposal.votes * 4) < totalMembers) {
            return false;
        }

        /// @notice proposal's voteWeight for must be > 50% of the total voteWeight
        if (
            proposal.proVoteWeight <=
            (proposal.totalVoteWeight - proposal.proVoteWeight)
        ) {
            return false;
        }

        /// @notice proposal must not have been previously executed, cancelled, or failed
        if (proposal.status != ProposalStatus.REVIEW) {
            return false;
        }

        return true;
    }

    /// @notice execute proposal
    /// @return bool false indicate failed, true to indicate successes
    /// @return address if failed, the target's address of the failed action.  Else zero-address
    function execute(uint8 proposalId)
        external
        payable
        returns (bool, address)
    {
        Proposal memory proposal = proposals[proposalId];
        require(
            msg.sender == govenor || msg.sender == proposal.proposer,
            "PERMISSION_ERROR"
        );
        require(proposalValid(proposalId), "INVALID_PROPOSAL");

        proposals[proposalId].status = ProposalStatus.EXECUTED;
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, ) = executeTransaction(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i]
            );
            if (!success) {
                proposals[proposalId].status = ProposalStatus.FAILED;
                emit ProposalFailed(proposalId, proposal.targets[i], proposal.values[i], proposal.signatures[i], proposal.calldatas[i]);
                return (false, proposal.targets[i]);
            }
            emit ExecuteTransaction(proposalId, proposal.targets[i], proposal.values[i], proposal.signatures[i], proposal.calldatas[i]);
        }

        emit ProposalExecuted(proposalId);
        return (true, address(0));
    }

    /// @notice internal function to execute single action of a proposal
    function executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data
    ) internal returns (bool, bytes memory) {
        bytes memory callData;
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(
                bytes4(keccak256(bytes(signature))),
                data
            );
        }

        (bool success, bytes memory returnData) = target.call{value: value}(
            callData
        );
        return (success, returnData);
    }

    /// @notice return chain ID of chain that contract is running on
    /// @dev required for EIP-712 spec
    function getChainIdInternal() internal view returns (uint256) {
        uint256 chainId;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
}
