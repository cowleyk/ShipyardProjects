//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SpaceCoin.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ICO {
    using SafeERC20 for IERC20;

    address immutable public treasury;
    mapping (address => bool) public whitelist;
    uint256 public totalAmountRaised;
    uint256 public currentPhaseAmountRaised;
    mapping(address => uint256) public userTokens;

    mapping(Phase => uint256) public maxContributions;
    Phase public currentPhase;
    enum Phase {
        SEED,
        GENERAL,
        OPEN
    }

    uint256 public constant PHASE_CONTRIBUTION_CAP = 15000 ether;
    bool public active = true;

    IERC20 public token;

    uint256 public constant RATE = 5;
    string constant private INCORRECT_PHASE = "INCORRECT_PHASE";

    // TODO: CONSTRUCT/EMIT EVENTS

    constructor() {
        treasury = msg.sender;

        maxContributions[Phase.SEED] = 1500 ether;
        maxContributions[Phase.GENERAL] = 1000 ether;
    }

    modifier onlyTreasury() {
        require(msg.sender == treasury, "ONLY_TREASURY");
        _;
    }

    modifier icoEnded() {
        require(currentPhase == Phase.OPEN, INCORRECT_PHASE);
        _;
    }

    

    function whitelisted() internal view returns (bool) {
        if(currentPhase == Phase.GENERAL) {
            return true;
        }
        return whitelist[msg.sender];
    }

    function buy() public payable {
        require(active, "PAUSED_CAMPAIGN");
        require(userTokens[msg.sender] + msg.value <= maxContributions[currentPhase], "EXCEEDS_MAX_CONTRIBUTION");
        require(currentPhaseAmountRaised + msg.value <= PHASE_CONTRIBUTION_CAP, "INSUFFICIENT_AVAILABILITY");
        require(currentPhase == Phase.SEED || currentPhase == Phase.GENERAL, INCORRECT_PHASE);
        require(whitelisted(), "WHITELIST");

        userTokens[msg.sender] += msg.value * RATE;
        totalAmountRaised += msg.value;
        currentPhaseAmountRaised += msg.value;

        if(currentPhaseAmountRaised == PHASE_CONTRIBUTION_CAP) {
            _advancePhase();
        }
    }

    function _advancePhase() private {
        require(currentPhase == Phase.SEED || currentPhase == Phase.GENERAL, INCORRECT_PHASE);
        currentPhase = Phase(uint(currentPhase) + 1);
        delete currentPhaseAmountRaised;

        if(currentPhase == Phase.OPEN) {
            token = new SpaceCoin();
        }
    }

    function advancePhase() public onlyTreasury {
        _advancePhase();
    }

    function whitelistAddress(address _address) public onlyTreasury {
        whitelist[_address] = true;
    }

    function toggleActive(bool _active) public onlyTreasury {
        active = _active;
    }

    // TODO: ADD NONREENTRANCY
    function withdrawContributions() public onlyTreasury icoEnded {
        uint256 withdrawalAmount = totalAmountRaised;
        delete totalAmountRaised;

        (bool sent,) = treasury.call{ value: withdrawalAmount }("");
        require(sent, "WITHDRAWAL_FAILURE");
    }

    // TODO: ADD NONREENTRY
    function collectTokens() public icoEnded {
        require(userTokens[msg.sender] > 0, "NO_TOKENS");

        uint256 amount = userTokens[msg.sender];
        delete userTokens[msg.sender];
        token.safeTransfer(msg.sender, amount);
    }

    receive() external payable {
        buy();
    }
}
