//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Crowdfundr is ERC721 {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    address payable public creator;
    uint256 public goal;
    uint256 public contributed;
    uint256 public deadline;
    bool public ended;

    struct Contribution {
        uint256 total;
        uint256[] badges;
    }

    mapping(address => Contribution) public contributions;

    constructor(address _creator, uint256 _goal)
        ERC721("ContributorBadge", "BDG")
    {
        require(_creator != address(0), "Must provide a creator address");
        require(_goal > 0, "Provide a fundraising goal");
        creator = payable(_creator);
        goal = _goal;
        deadline = block.timestamp + 30 days;
    }

    modifier isActive() {
        require(!ended, "The campaign has ended");
        require(block.timestamp < deadline, "The campaign has ended");
        require(contributed < goal, "The campaign has ended");
        _;
    }

    modifier hasEnded() {
        require(
            ended || (contributed < goal && block.timestamp > deadline),
            "The campaign is still active"
        );
        _;
    }

    modifier isCreator() {
        require(msg.sender == creator, "Must be campaign creator");
        _;
    }

    function endCampaign() external isActive isCreator {
        ended = true;
    }

    // since only the creator can withdraw, is a nonReentrant modifier needed?
    // "defense in depth" - could add nonReentrant
    // weary of optimization
    function withdrawFunds(uint256 withdrawalAmount) external isCreator {
        require(contributed >= goal, "Goal has not been met");

        contributed -= withdrawalAmount;
        (bool success, ) = creator.call{value: withdrawalAmount}("");
        require(success, "Failed to withdraw");
    }

    // Cannot restart a campaign => no need to update `contributed`
    function withdrawContribution() external hasEnded {
        require(contributions[msg.sender].total > 0, "No contribution to withdraw");

        uint256 withdrawal = contributions[msg.sender].total;
        contributions[msg.sender].total = 0;
        (bool success, ) = msg.sender.call{ value: withdrawal }("");
        require(success, "Failed to withdraw");
    }

    function contribute() external payable isActive {
        require(msg.value >= 0.01 ether, "Must meet minimum donation");

        contributions[msg.sender].total += msg.value;
        contributed += msg.value;

        // Calculate contribution amount that has not already been rewarded a badge
        uint256 amountToReward = contributions[msg.sender].total -
            (contributions[msg.sender].badges.length * 1 ether);
        // For every ether that has not been rewarded, mint a new contribution badge
        while (amountToReward >= 1 ether) { 
            amountToReward -= 1 ether;
            _tokenIds.increment();
            uint256 badgeId = _tokenIds.current();
            contributions[msg.sender].badges.push(badgeId);
            _safeMint(msg.sender, badgeId);
        }
    }
}
