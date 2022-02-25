//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title A factory for creating Crowdfundr campaigns
/// @author Kevin Cowley
/// @dev All calls to createCampaign need a _creator parameter
contract CampaignFactory {
    event CampaignCreated(address _creator, address _campaign);
    Crowdfundr[] public campaigns;

    /// @notice Deploy a new Crowdfund campaign
    /// @param _creator Address of the designated creator
    /// @param _goal Contribution goal in WEI
    /// @return Address of the deployed campaign
    function createCampaign(address _creator, uint256 _goal)
        external
        returns (address)
    {
        Crowdfundr newCampaign = new Crowdfundr(_creator, _goal);
        campaigns.push(newCampaign);
        emit CampaignCreated(_creator, address(newCampaign));
        return address(newCampaign);
    }

    /// @return _campaigns List of deployed campaign
    function getCampaigns()
        external
        view
        returns (Crowdfundr[] memory _campaigns)
    {
        _campaigns = new Crowdfundr[](campaigns.length);
        return campaigns;
    }
}

/// @title A campaign to collect funds for an idea
/// @author Kevin Cowley
contract Crowdfundr is ERC721, ReentrancyGuard {
    /// @dev Initializes ID counter for contribution badge
    uint256 private _tokenId = 0;

    address payable immutable creator;
    uint256 immutable goal;
    /// @notice total amount contributed to the campaign
    uint256 public contributed;
    /// @notice timestamp when the campaign must have reached its funding
        /// or it will be cancelled
    uint256 immutable deadline;
    /// @dev bool toggled when the campaign is manually cancelled
    bool public cancelledByCreator;
    /// @notice whether the contributions have reached the goal
    bool public goalMet;

    /// @notice storage of each contributer's total contribution in WEI
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

    /// @notice check if the campaign is still receiving contributions 
    modifier isActive() {
        require(!cancelledByCreator, "The campaign has ended");
        /// make sure the current time is before the deadline
        require(block.timestamp < deadline, "The campaign has ended");
        require(contributed < goal, "The campaign has ended");
        _;
    }

    /// @notice check if contributors can pull back their contribution
        /// the campaign must have either been cancelled or 
        /// failed to reach the goal before the deadline
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

    /// @notice creator can end the campaign early
    function cancelCampaign() external isActive isCreator {
        cancelledByCreator = true;
    }

    /// @notice allow creator to collect the funds once the goal has been met
    /// @dev no reentrancy guard was added; the creator is allowed to draw down the funds to 0
        /// reentrancy by the creator is a valid use case
    /// @dev once there campaign is over there is technnically no need to continue updating
        /// `contributed` or `contributions`, but the public `contributed` will give the
        /// an idea of how much is left in the contract
    function withdrawFunds(uint256 _withdrawalAmount) external isCreator {
        require(goalMet, "Goal has not been met");

        contributed -= _withdrawalAmount;
        (bool success, ) = creator.call{value: _withdrawalAmount}("");
        require(success, "Failed to withdraw");
    }

    /// @notice allow contributors to recoup their contributions after a contract fails
    function withdrawContribution()
        external
        canWithdrawContribution
        nonReentrant
    {
        require(contributions[msg.sender] > 0, "No contribution to withdraw");

        uint256 withdrawal = contributions[msg.sender];
        /// @dev setting contributions to 0 prevents contributors from withdrawing multiple times
        contributions[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: withdrawal}("");
        require(success, "Failed to withdraw");
    }

    /// @notice contribute funds to the campaign and earn a badge for every 1 ETH
    function contribute() external payable isActive {
        require(msg.value >= 0.01 ether, "Must meet minimum donation");

        contributions[msg.sender] += msg.value;
        contributed += msg.value;
        /// @dev permanently toggles goalMet
        if (contributed >= goal) {
            goalMet = true;
        }

        /// @dev calculate amount of total contributions that has not already been rewarded a badge
        uint256 amountToReward = contributions[msg.sender] -
            (balanceOf(msg.sender) * 1 ether);
        /// @dev for every 1 ether that has not already been rewarded, mint a new contribution badge
        while (amountToReward >= 1 ether) {
            amountToReward -= 1 ether;
            _tokenId++;
            _safeMint(msg.sender, _tokenId);
        }
    }

    /// @param _owner address to check for badges
    /// @return list of badges owned by address
    function getBadgesByOwner(address _owner)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory badges = new uint256[](balanceOf(_owner));
        uint256 counter = 0;
        for (uint256 i = 1; i < _tokenId + 1; i++) {
            if (ownerOf(i) == _owner) {
                badges[counter] = i;
                counter++;
            }
        }
        return badges;
    }
}
