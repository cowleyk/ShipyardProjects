//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./ProposalFactory.sol";

/// @title A governance contract meant for buying NFTs
/// @author Kevin Cowley
/// @notice Proposal and contributor functionality are inside the associated factories
contract CollectorDAO is ProposalFactory {
    /// @dev EIP-712 constants
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,uint256 chainId,address verifyingContract)"
        );
    bytes32 public constant BALLOT_TYPEHASH =
        keccak256("Ballot(uint256 proposalId,uint256 support)");

    event VoteFailed(bytes _signature);
    event BatchVotesSubmitted(uint256 indexed _proposalId, bytes[] _errors);
    event ProposalFailed(uint256 indexed _proposalId);
    event ProposalExecuted(uint256 _proposalId);

    /// @notice set up initial data of contract
    /// @param _govenor special permissions address for DAO manangement
    /// @param _whitelist list of addresses that can propose immediately after becoming members
    constructor(address _govenor, address[] memory _whitelist) {
        govenor = _govenor;
        contributors[govenor].whitelisted = true;
        for (uint256 i = 0; i < _whitelist.length; i++) {
            contributors[_whitelist[i]].whitelisted = true;
        }
    }

    /// @notice process batch votes all at once
    /// @notice all signatures that fail to be counted as votes are returned for the client to handle
    /// @dev signatures are required to be up to EIP-712 spec
    /// @param proposalId which proposal to vote on
    /// @param votes yes or no votes corresponding to the signature at the same index in the `signatures` array
    /// @param signatures array of EIP-712 sigantures from members
    function voteBySignatures(
        uint256 proposalId,
        uint256[] memory votes,
        bytes[] memory signatures
    ) external returns (bytes[] memory) {
        require(
            proposals[proposalId].status == ProposalStatus.REVIEW,
            "INVALID_PROPOSAL"
        );
        require(votes.length == signatures.length, "INVALID_PARAMETERS");
        require(votes.length > 0, "INVALID_PARAMETERS");

        bytes[] memory errors = new bytes[](signatures.length);
        for (uint256 i = 0; i < signatures.length; i++) {
            if (signatures[i].length == 65) {
                /// @dev pull out signature data
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

                /// @dev pull out EIP-712 data
                /// @dev validates support and proposal ID are correct
                bytes32 domainSeparator = keccak256(
                    abi.encode(
                        DOMAIN_TYPEHASH,
                        keccak256(bytes("CollectorDAO")),
                        block.chainid,
                        address(this)
                    )
                );
                bytes32 structHash = keccak256(
                    abi.encode(BALLOT_TYPEHASH, proposalId, votes[i])
                );
                bytes32 digest = keccak256(
                    abi.encodePacked("\x19\x01", domainSeparator, structHash)
                );

                /// @dev recover signature address
                address signatory = ecrecover(digest, v, r, s);

                bool voted = _castVote(proposalId, votes[i], signatory);
                if (!voted) {
                    /// @notice vote failed to be counted, add to errors
                    emit VoteFailed(signatures[i]);
                    errors[i] = signatures[i];
                }
            } else {
                /// @notice signature was not in correct format, add to errors
                errors[i] = signatures[i];
            }
        }
        emit BatchVotesSubmitted(proposalId, errors);
        /// @notice return accumulated failed signatures to client
        return errors;
    }

    /// @notice enable vote casting with non-signature transaction
    function castVote(uint256 proposalId, uint256 support) external {
        bool success = _castVote(proposalId, support, msg.sender);
        require(success, "VOTE_FAILED");
    }

    /// @notice internal function to process signatures and accumulate votes
    /// @dev sigantures are checked to be non-zero address and checked to be an existing member
    function _castVote(
        uint256 proposalId,
        uint256 support,
        address signatory
    ) internal returns (bool) {
        /// @notice check that signature is non-zero
        if (signatory == address(0)) {
            return false;
        }
        /// @notice check that signature is a member
        if (contributors[signatory].contribution < 1 ether) {
            return false;
        }

        /// @notice update proposal vote count and credit contributor for voting
        _updateProposal(proposalId, support, contributors[signatory].voteWeight);
        _updateContributor(signatory);
        return true;
    }

    /// @notice execute proposal
    function execute(uint256 proposalId) external payable {
        Proposal memory proposal = proposals[proposalId];
        require(
            msg.sender == govenor || msg.sender == proposal.proposer,
            "PERMISSION_ERROR"
        );
        require(_proposalValid(proposalId), "INVALID_PROPOSAL");

        proposals[proposalId].status = ProposalStatus.EXECUTED;
        /// @notice allow proposal to be resubmitted
        bytes32 hashedProposal = keccak256(
            abi.encode(proposal.targets, proposal.values, proposal.calldatas, proposal.signatures)
        );
        activeProposals[hashedProposal] = false;

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, ) = _executeTransaction(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i]
            );
            if (!success) {
                proposals[proposalId].status = ProposalStatus.FAILED;
                emit ProposalFailed(proposalId);
            }
            require(success, "EXECUTION_FAILED");
        }
        emit ProposalExecuted(proposalId);
    }

    /// @notice internal function to execute single action of a proposal
    function _executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data
    ) internal returns (bool success, bytes memory returnData) {
        bytes memory callData;
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }
        (success, returnData) = target.call{value: value}(callData);
    }

    /// @notice NFT Marketplace interactions
    function buyNFT(
        address marketPlaceAddress,
        address nftContract,
        uint256 nftId
    ) public payable returns (bool bought, uint256 price) {
        /// @notice only this contract can call this function
        require(msg.sender == address(this), "PERMISSION_ERROR");

        /// @notice send an empty signature but pre-encode entire calldata
        bytes memory priceCalldata = abi.encodeWithSignature("getPrice(address,uint256)", nftContract, nftId);
        (bool success, bytes memory data) = _executeTransaction(marketPlaceAddress, 0, "", priceCalldata);
        require(success, "FAILED_PRICE_FETCH");

        price = abi.decode(data, (uint256));
        /// @notice ensure funds are available for the purchase
        require(price < address(this).balance, "INSUFFICIENT_FUNDS");

        bytes memory buyCalldata = abi.encodeWithSignature("buy(address,uint256)", nftContract, nftId);
        (bought,) = _executeTransaction(marketPlaceAddress, price, "", buyCalldata);
        require(bought, "FAILED_NFT_BUY");
    }
}
