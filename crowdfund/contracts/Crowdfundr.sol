//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Crowdfundr is ERC721 {
  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds;

  address payable public creator;
  uint public goal;
  uint public contributed;
  uint public deadline;
  bool public ended;

  struct Contribution {
    uint total;
    uint[] badges;
  }

  mapping(address => Contribution) public contributions;


  constructor(address _creator, uint _goal) ERC721("ContributorBadge", "BDG") {
    require(_creator != address(0), "Must provide a creator address");
    require(_goal > 0, "Don't waste gas");
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
    // use `assert` or other form?
    require(ended || (contributed < goal && block.timestamp > deadline), "The campaign is still active");
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
  function withdrawFunds(uint withdrawalAmount) external isCreator {
    require(contributed >= goal, "Goal has not been met");

    contributed -= withdrawalAmount;
    (bool success, ) = creator.call{value: withdrawalAmount}("");
    require(success, "Failed to withdraw");
  }
  
  // Cannot restart a campaign => no need to update `contributed` or `contributions[msg.sender]`
  function withdrawContribution() external hasEnded {
    (bool success, ) = msg.sender.call{value: contributions[msg.sender].total}("");
    require(success, "Failed to withdraw");
  }

  function contribute() external payable isActive {
    require(msg.value >= 0.01 ether, "Must meet minimum donation");

    contributions[msg.sender].total += msg.value;
    contributed += msg.value;

    uint amountToReward = contributions[msg.sender].total - (contributions[msg.sender].badges.length * 1 ether);
    while (amountToReward >= 1 ether) {
      amountToReward -= 1 ether;
      _tokenIds.increment();
      uint256 badgeId = _tokenIds.current();
      contributions[msg.sender].badges.push(badgeId);
      _safeMint(msg.sender, badgeId);
    }
    // ?????? contributions[msg.sender].nftTracker += msg.value % 1;
  }

  // convience function: DELETE LATER  
  function getBadges() external view returns(uint[] memory) {
    return contributions[msg.sender].badges;
  }
}
// multitoken-standard erc1155 has bulk mint :eyes:
// proxy contract 
  // https://discord.com/channels/870313767873962014/945737533340405780/946073897336438824