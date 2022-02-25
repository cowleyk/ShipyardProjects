//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract CampaignFactory {
    event CampaignCreated(address _creator, address _campaign);
    Crowdfundr[] public campaigns;

    function createCampaign(address _creator, uint256 _goal)
        external
        returns (address)
    {
        Crowdfundr newCampaign = new Crowdfundr(_creator, _goal);
        campaigns.push(newCampaign);
        emit CampaignCreated(_creator, address(newCampaign));
        return address(newCampaign);
    }

    function getCampaigns()
        external
        view
        returns (Crowdfundr[] memory _campaigns)
    {
        _campaigns = new Crowdfundr[](campaigns.length);
        return campaigns;
    }
}

contract Crowdfundr is ERC721, ReentrancyGuard {
    uint256 private _tokenId = 0;

    address payable public creator;
    uint256 public goal;
    uint256 public contributed;
    uint256 public deadline;
    bool public cancelledByCreator;
    bool public goalMet;

    mapping(address => uint256) public contributions;

    constructor(address _creator, uint256 _goal)
        ERC721("ContributorBadge", "BDG")
    {
        require(_creator != address(0), "Must provide a creator address");
        require(_goal >= 0.01 ether, "Goal must be meet min donation");
        creator = payable(_creator);
        goal = _goal;
        deadline = block.timestamp + 30 days;
    }

    modifier isActive() {
        require(!cancelledByCreator, "The campaign has ended");
        require(block.timestamp < deadline, "The campaign has ended");
        require(contributed < goal, "The campaign has ended");
        _;
    }

    modifier canWithdrawContribution() {
        require(
            cancelledByCreator || (!goalMet && block.timestamp > deadline),
            "Withdrawals are locked"
        );
        _;
    }

    modifier isCreator() {
        require(msg.sender == creator, "Must be campaign creator");
        _;
    }

    function cancelCampaign() external isActive isCreator {
        cancelledByCreator = true;
    }

    // since only the creator can withdraw, is a nonReentrant modifier needed?
    // "defense in depth" - could add nonReentrant
    // weary of optimization
    function withdrawFunds(uint256 _withdrawalAmount) external isCreator {
        require(goalMet, "Goal has not been met");

        contributed -= _withdrawalAmount;
        (bool success, ) = creator.call{value: _withdrawalAmount}("");
        require(success, "Failed to withdraw");
    }

    // Cannot restart a campaign => no need to update `contributed`
    function withdrawContribution() external canWithdrawContribution nonReentrant {
        require(contributions[msg.sender] > 0, "No contribution to withdraw");

        uint256 withdrawal = contributions[msg.sender];
        contributions[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: withdrawal}("");
        require(success, "Failed to withdraw");
    }

    function contribute() external payable isActive {
        require(msg.value >= 0.01 ether, "Must meet minimum donation");

        contributions[msg.sender] += msg.value;
        contributed += msg.value;
        if(contributed >= goal) {
            goalMet = true;
        }

        // Calculate contribution amount that has not already been rewarded a badge
        uint256 amountToReward = contributions[msg.sender] -
            (balanceOf(msg.sender) * 1 ether);
        // For every ether that has not been rewarded, mint a new contribution badge
        while (amountToReward >= 1 ether) {
            amountToReward -= 1 ether;
            _tokenId++;
            _safeMint(msg.sender, _tokenId);
        }
    }

    function getBadgesByOwner(address _owner)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory result = new uint256[](balanceOf(_owner));
        uint256 counter = 0;
        for (uint256 i = 1; i < _tokenId + 1; i++) {
            if (ownerOf(i) == _owner) {
                result[counter] = i;
                counter++;
            }
        }
        return result;
    }
}
