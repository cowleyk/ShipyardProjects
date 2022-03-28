//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

/// @title factory contract for managing contributors
contract ContributorFactory {
    /// @notice address responsible for maintaining DAO
    address public govenor;

    /// @notice total number of eligible voters
    uint256 public totalMembers;

    /// @notice a member's information
    struct Contributor {
        uint256 voteWeight;
        uint256 voteCount;
        uint256 contribution;
        bool whitelisted;
    }

    /// @notice lookup of member data by address
    mapping(address => Contributor) public contributors;

    event AddressWhitelisted(address _proposer);
    event MemberJoined(address _member);
    event MemberIncreasedStake(address indexed _member, uint256 _amount);

    modifier isMember() {
        require(contributors[msg.sender].contribution >= 1 ether, "NOT_MEMBER");
        _;
    }

    /// @notice allow govenor to add whitelisted addresses on the fly
    function whitelistAddress(address proposer) external {
        require(msg.sender == govenor, "PERMISSION_ERROR");
        contributors[proposer].whitelisted = true;
        emit AddressWhitelisted(proposer);
    }

    /// @notice an address can become a member with a 1 ETH contribution
    /// @notice members must contribute a least 1 ETH up front to become a member
    function becomeMember() external payable {
        require(msg.value >= 1 ether, "INSUFFICIENT_FUNDS");
        require(contributors[msg.sender].contribution == 0, "MEMBER_EXISTS");

        contributors[msg.sender].contribution += msg.value;
        contributors[msg.sender].voteWeight += msg.value;
        totalMembers++;

        emit MemberJoined(msg.sender);
    }

    /// @notice a member can buy more influence by contriubting ETH
    function increaseStake() external payable isMember {
        contributors[msg.sender].contribution += msg.value;
        contributors[msg.sender].voteWeight += msg.value;
        emit MemberIncreasedStake(msg.sender, msg.value);
    }

    function _updateContributor(address signatory) internal {
        /// @notice reward contributor for participating in vote
        contributors[signatory].voteCount++;
        contributors[signatory].voteWeight += 0.05 ether;
    }
}
