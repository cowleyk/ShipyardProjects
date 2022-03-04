//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SpaceCoin.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ICO is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address immutable public treasury;
    mapping (address => bool) public whitelist;
    uint256 public totalAmountRaised;
    mapping(address => uint256) public userContributions;

    mapping(Phase => uint256) public maxIndividualContribution;
    mapping(Phase => uint256) public maxPhaseTotalContribution;
    Phase public currentPhase;
    enum Phase {
        SEED,
        GENERAL,
        OPEN
    }

    bool public isPaused;

    IERC20 public token;

    uint256 public constant RATE = 5;
    string constant private INCORRECT_PHASE = "INCORRECT_PHASE";

    event PhaseAdvanced(string _newPhase);
    event UserContribution(address indexed _contributor, uint256 _amount);
    event AddressWhitelisted(address _contributor);
    event ICOStatusChange(string _status);
    event ContributionsWithdrawn(uint256 _amount);
    event TokensCollected(address indexed _contributor, uint256 _amount);

    constructor() {
        treasury = msg.sender;

        maxIndividualContribution[Phase.SEED] = 1500 ether;
        maxIndividualContribution[Phase.GENERAL] = 1000 ether;
        maxIndividualContribution[Phase.OPEN] = 30000 ether;

        maxPhaseTotalContribution[Phase.SEED] = 15000 ether;
        maxPhaseTotalContribution[Phase.GENERAL] = 30000 ether;
        maxPhaseTotalContribution[Phase.OPEN] = 30000 ether;
    }

    modifier onlyTreasury() {
        require(msg.sender == treasury, "ONLY_TREASURY");
        _;
    }

    modifier icoEnded() {
        require(totalAmountRaised == 30000 ether, "ICO_ENDED");
        _;
    }

    function whitelisted() internal view returns (bool) {
        if(currentPhase != Phase.SEED) {
            return true;
        }
        return whitelist[msg.sender];
    }

    function buy() public payable {
        require(!isPaused, "PAUSED_CAMPAIGN");
        require(userContributions[msg.sender] + msg.value <= maxIndividualContribution[currentPhase], "EXCEEDS_MAX_CONTRIBUTION");
        require(totalAmountRaised + msg.value <= maxPhaseTotalContribution[currentPhase], "INSUFFICIENT_AVAILABILITY");
        require(whitelisted(), "WHITELIST");

        userContributions[msg.sender] += msg.value;
        totalAmountRaised += msg.value;
        emit UserContribution(msg.sender, msg.value);

        if(totalAmountRaised == maxPhaseTotalContribution[currentPhase] && currentPhase != Phase.OPEN) {
            _advancePhase();
        }
    }

    function _advancePhase() private {
        require(currentPhase == Phase.SEED || currentPhase == Phase.GENERAL, INCORRECT_PHASE);

        currentPhase = Phase(uint(currentPhase) + 1);
        emit PhaseAdvanced(currentPhase == Phase.GENERAL ? "General" : "Open");

        if(currentPhase == Phase.OPEN) {
            token = new SpaceCoin();
        }
    }

    function advancePhase() external onlyTreasury {
        _advancePhase();
    }

    function whitelistAddress(address _address) external onlyTreasury {
        whitelist[_address] = true;
        emit AddressWhitelisted(_address);
    }

    function toggleIsPaused(bool _pause) external onlyTreasury {
        isPaused = _pause;
        emit ICOStatusChange(_pause ? "Paused" : "Resumed" );
    }

    function withdrawContributions() external onlyTreasury icoEnded nonReentrant {
        uint256 withdrawalAmount = totalAmountRaised;
        delete totalAmountRaised;

        (bool sent,) = treasury.call{ value: withdrawalAmount }("");
        require(sent, "WITHDRAWAL_FAILURE");
        emit ContributionsWithdrawn(withdrawalAmount);
    }

    function collectTokens() external icoEnded nonReentrant {
        require(userContributions[msg.sender] > 0, "NO_TOKENS");

        uint256 amount = userContributions[msg.sender] * RATE;
        delete userContributions[msg.sender];
        token.safeTransfer(msg.sender, amount);
        emit TokensCollected(msg.sender, amount);
    }

    receive() external payable {
        buy();
    }
}
