//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SpaceCoin.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title A contract for raising ICO funds
/// @author Kevin Cowley
contract ICO is ReentrancyGuard {
    /// @dev This implementation using `SpaceCoin` does not need SafeERC20
    /// This was added in case `SpaceCoin` is swapped out for a token that isn't based
    /// off openzeppelin's ERC20
    using SafeERC20 for IERC20;

    /// @notice owner of the contract with special permissions
    address public immutable treasury;

    /// @notice addresses allow to contribute during Phase Seed
    mapping(address => bool) public whitelist;

    /// @notice contract's value
    uint256 public totalAmountRaised;

    /// @notice tracks how much wei an individual has contributed
    mapping(address => uint256) public userContributions;

    /// @notice look up by phase for max contribution per person
    /// @dev treated as immutable, values are initialized in constructor
    mapping(Phase => uint256) public maxIndividualContribution;

    /// @notice look up by phase for max contribution before changing phases or ending the ICO
    /// @dev treated as immutable, values are initialized in constructor
    mapping(Phase => uint256) public maxPhaseTotalContribution;

    /// @notice Phase Seed, General, or Open
    Phase public currentPhase;
    enum Phase {
        SEED,
        GENERAL,
        OPEN
    }

    /// @notice toggle controlled by `treasury` to pause/resume collection contributions
    bool public isPaused;

    /// @notice token that will be distributed
    IERC20 public token;

    /// @notice SPC per ETH
    uint256 public constant RATE = 5;

    string private constant INCORRECT_PHASE = "INCORRECT_PHASE";

    /// @notice state change events
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

    /// @dev check if msg.sender is able to contribute
    /// whitelist is only applicable during Phase Seed
    function whitelisted() internal view returns (bool) {
        if (currentPhase != Phase.SEED) {
            return true;
        }
        return whitelist[msg.sender];
    }

    /// @notice buy SPC
    /// total contributions must be under or exactly equal to the phase goal to be valid
    function buy() public payable {
        require(!isPaused, "PAUSED_CAMPAIGN");
        require(
            userContributions[msg.sender] + msg.value <=
                maxIndividualContribution[currentPhase],
            "EXCEEDS_MAX_CONTRIBUTION"
        );
        require(
            totalAmountRaised + msg.value <=
                maxPhaseTotalContribution[currentPhase],
            "INSUFFICIENT_AVAILABILITY"
        );
        require(whitelisted(), "WHITELIST");

        userContributions[msg.sender] += msg.value;
        totalAmountRaised += msg.value;
        emit UserContribution(msg.sender, msg.value);

        /// @notice if the contribution caps out the current phase, advance to the next phase
        if (
            totalAmountRaised == maxPhaseTotalContribution[currentPhase] &&
            currentPhase != Phase.OPEN
        ) {
            _advancePhase();
        }
    }

    /// @dev private function only available to this contract for programatically advancing
    /// @notice call `advancePhase()` from the treasury address to advance phases from outside this contract
    function _advancePhase() private {
        require(
            currentPhase == Phase.SEED || currentPhase == Phase.GENERAL,
            INCORRECT_PHASE
        );

        currentPhase = Phase(uint256(currentPhase) + 1);
        emit PhaseAdvanced(currentPhase == Phase.GENERAL ? "General" : "Open");

        /// @notice once Phase Open is reached, mint the SPC
        /// @dev SpaceCoin is initialized at end of SPC to avoid
        /// having to build transfer locks into the SPC contract
        if (currentPhase == Phase.OPEN) {
            token = new SpaceCoin();
        }
    }

    /// @notice accessible function for treasury to manually advance phases
    function advancePhase() external onlyTreasury {
        _advancePhase();
    }

    /// @notice add address to whitelist (treasury only)
    function whitelistAddress(address _address) external onlyTreasury {
        whitelist[_address] = true;
        emit AddressWhitelisted(_address);
    }

    /// @notice allow treasury to pause/resume SPC purchasing
    function toggleIsPaused(bool _pause) external onlyTreasury {
        isPaused = _pause;
        emit ICOStatusChange(_pause ? "Paused" : "Resumed");
    }

    /// @notice allow treasury to collect funds once the ICO ends
    function withdrawContributions() external onlyTreasury nonReentrant {
        require(totalAmountRaised == 30000 ether, "ICO_ACTIVE");
        uint256 withdrawalAmount = totalAmountRaised;
        delete totalAmountRaised;

        (bool sent, ) = treasury.call{value: withdrawalAmount}("");
        require(sent, "WITHDRAWAL_FAILURE");
        emit ContributionsWithdrawn(withdrawalAmount);
    }

    /// @notice pull method for contributors to collect their tokens once Phase Open starts
    function collectTokens() external nonReentrant {
        require(currentPhase == Phase.OPEN, INCORRECT_PHASE);
        require(userContributions[msg.sender] > 0, "NO_TOKENS");

        /// @notice each user is granted 5 SPC per 1 ETH
        uint256 amount = userContributions[msg.sender] * RATE;
        delete userContributions[msg.sender];
        token.safeTransfer(msg.sender, amount);
        emit TokensCollected(msg.sender, amount);
    }

    receive() external payable {
        buy();
    }
}
