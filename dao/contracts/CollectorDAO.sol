//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract CollectorDAO {
    address public govenor;
    uint8 public totalMembers;
    uint256 public totalContributions;
    uint256 public totalVotesPool;

    struct Contributor {
        address _address;
        uint256 voteWeight;
        uint256 voteCount;
        uint256 contribution;
        uint256 recentProposalId;
        bool whitelisted;
    }
    mapping(address => Contributor) public contributors;

    bytes32 constant public DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 constant public BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId)");

    enum ProposalStatus {
        INITIATED,
        REVIEW,
        EXECUTED,
        FAILED,
        CANCELLED
    }

    struct Proposal {
        uint8 id;
        address proposer;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string[] signatures;
        uint8 votes;
        uint256 totalVoteWeight;
        uint256 proVoteWeight;
        string description;
        ProposalStatus status;
    }
    mapping(uint => Proposal) public proposals;
    uint8 public totalProposals;
    uint256 public immutable maxTargets;

    event MemberJoined(address _member);
    event VoteCast(address indexed voter, uint proposalId, uint8 support, uint votes, string reason);

    constructor(address _govenor, uint256 _maxTargets, address[] memory _whitelist) {
        govenor = _govenor;
        contributors[govenor].whitelisted = true;
        maxTargets = _maxTargets;
        for(uint i = 0; i < _whitelist.length; i++) {
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

    modifier canPropose() {
        require(contributors[msg.sender].whitelisted || contributors[msg.sender].voteCount >= 5, "PERMISSION_ERROR");
        require(proposals[contributors[msg.sender].recentProposalId].status != ProposalStatus.REVIEW, "MEMBER_PROPOSAL_EXISTS");
        _;
    }

    function whitelistAddress(address proposer) external isGovenor() {
        contributors[proposer].whitelisted = true;
    }

    function becomeMember() external payable {
        require(msg.value >= 1 ether, "INSUFFICIENT_FUNDS");
        require(contributors[msg.sender].contribution == 0, "MEMBER_EXISTS");

        contributors[msg.sender].contribution += msg.value;
        contributors[msg.sender].voteWeight += msg.value;
        totalContributions += msg.value;
        totalMembers++;

        emit MemberJoined(msg.sender);
    }

    function increaseStake() external payable isMember {
        contributors[msg.sender].contribution += msg.value;
        contributors[msg.sender].voteWeight += msg.value;
        totalContributions += msg.value;
    }

    function propose(address[] memory targets, uint[] memory values, bytes[] memory calldatas, string[] memory signatures, string memory description) external isMember canPropose returns (uint8) {
        require(targets.length == values.length && targets.length == calldatas.length, "INVALID_PARAMETERS");
        require(targets.length != 0, "MISSING_FUNCTIONALITY");
        require(targets.length <= maxTargets, "ACTIONS_OVERFLOW");


        Proposal memory newProposal = Proposal({
            id: totalProposals,
            // solhint-disable-next-line not-rely-on-time
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
        totalProposals++;        

        proposals[newProposal.id] = newProposal;
        contributors[msg.sender].recentProposalId = newProposal.id;

        // emit ProposalCreated(newProposal.id, msg.sender, targets, values, signatures, calldatas, startBlock, endBlock, description);
        return newProposal.id;
    }

    function cancelProposal(uint256 proposalId) external {
        require(msg.sender == proposals[proposalId].proposer || msg.sender == govenor, "PERMISSION_ERROR");
        proposals[proposalId].status = ProposalStatus.CANCELLED;
    }

    function voteBySignatures(uint proposalId, uint8[] memory votes, bytes[] memory signatures) external returns (bytes[] memory) {
        require(proposals[proposalId].status ==  ProposalStatus.REVIEW, "INVALID_PROPOSAL");
        require(votes.length == signatures.length, "INVALID_PARAMETERS");

        bytes[] memory errors;
        for(uint256 i = 0; i < signatures.length; i++) {
            if(signatures[i].length == 65) {
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
                if(!voted) {
                    errors[i] = signatures[i];
                }
            } else {
                errors[i] = signatures[i];
            }
        }
        return errors;
    }

    function castVote(uint proposalId, uint8 support, uint8 v, bytes32 r, bytes32 s) internal returns (bool) {
        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes("CollectorDAO")), getChainIdInternal(), address(this)));
        bytes32 structHash = keccak256(abi.encode(BALLOT_TYPEHASH, proposalId));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        
        address signatory = ecrecover(digest, v, r, s);
        if(signatory == address(0)) {
            return false;
        }
        
        proposals[proposalId].votes++;
        if(support > 0) {
            proposals[proposalId].proVoteWeight += contributors[signatory].voteWeight;
        }
        proposals[proposalId].totalVoteWeight += contributors[signatory].voteWeight;
        contributors[signatory].voteCount++;
        contributors[signatory].voteWeight += 0.05 ether;
        return true;

        // emit VoteCast(signatory, proposalId, support, castVoteInternal(signatory, proposalId, support), "");
    }

    function proposalValid(uint8 proposalId) internal view returns (bool) {
        Proposal memory proposal = proposals[proposalId];
        bool valid = true;

        if((proposal.votes * 4) < totalMembers) {
            valid = false;
        }
        if(proposal.proVoteWeight <= (proposal.totalVoteWeight - proposal.proVoteWeight)) {
            valid = false;
        }
        console.log("valid %s", valid);
        return valid;
    }

    function execute(uint8 proposalId) external payable returns (bool, address) {
        Proposal memory proposal = proposals[proposalId];
        require(msg.sender == govenor || msg.sender == proposal.proposer, "PERMISSION_ERROR");
        require(proposalValid(proposalId), "INVALID_PROPOSAL");

        proposals[proposalId].status = ProposalStatus.EXECUTED;
        for (uint i = 0; i < proposal.targets.length; i++) {
            (bool success, ) = executeTransaction(proposal.targets[i], proposal.values[i], proposal.signatures[i], proposal.calldatas[i]);
            if(!success) {
                proposals[proposalId].status = ProposalStatus.FAILED;
                return (false, proposal.targets[i]);
            }
            // emit ExecuteTransaction(txHash, target, value, signature, data, eta);
        }

        // emit ProposalExecuted(proposalId);
        return (true, address(0));
    }

    function executeTransaction(address target, uint value, string memory signature, bytes memory data) internal returns (bool, bytes memory) {
        bytes memory callData;
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        (bool success, bytes memory returnData) = target.call{ value: value }(callData);
        return (success, returnData);
    }

    function getChainIdInternal() internal view returns (uint) {
        uint chainId;

        // solhint-disable-next-line no-inline-assembly
        assembly { chainId := chainid() }
        return chainId;
    }
}
