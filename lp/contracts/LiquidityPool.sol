//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./interfaces/ILiquidityPool.sol";
import "./libraries/Math.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract LiquidityPool is ReentrancyGuard, ILiquidityPool, ERC20 {
    
    IERC20 immutable public spcToken;
    uint private reserveEth;
    uint private reserveSpc;
    uint private klast;
    uint private constant MINIMUM_LIQUIDITY = 1000;

    constructor(address _spcToken) ERC20("KevvySwaps Coin", "KVY") {
        spcToken = IERC20(_spcToken);
    }

    function mint(address to) external override nonReentrant returns (uint amountKvy) {
        uint _reserveEth = reserveEth;
        uint _reserveSpc = reserveSpc;
        uint currentEth = address(this).balance;
        uint currentSpc = spcToken.balanceOf(address(this));
        require(currentEth > _reserveEth, "UNMINTABLE");
        require(currentSpc > _reserveSpc, "UNMINTABLE");

        uint mintableEth = currentEth - _reserveEth;
        uint mintableSpc = currentSpc - _reserveSpc;
        uint _totalSupplyKvy = totalSupply();

        if(_totalSupplyKvy == 0) {
            /// @notice assume initial liquidity added is equal value of each token
            amountKvy = Math.sqrt(mintableEth * mintableSpc) - MINIMUM_LIQUIDITY;
        } else {
            /// @notice mint liquidity proportional to the current totalSupply or SPC or ETH
            /// @dev based on: liquidity = delta_token / previous_token * total_KVY
            uint liqEth = mintableEth * _totalSupplyKvy / _reserveEth;
            uint liqSpc = mintableSpc * _totalSupplyKvy / _reserveSpc;

            /// @notice use the minimum of the liquidity calculations
            amountKvy = liqSpc < liqEth ? liqSpc : liqEth;
        }

        _update(currentEth, currentSpc);
        _mint(to, amountKvy);
    }

    function burn(address burner) external override nonReentrant {
        /// @notice liquidity deposited by burner is the current balance of KVY in this contract
        /// this contract does not hold any KVY, it just mints to distribute and burns whats transferred in
        uint liquidity = balanceOf(address(this));
        uint currentEth = address(this).balance;
        uint currentSpc = spcToken.balanceOf(address(this));
        require(currentEth > 0 && currentSpc > 0 && liquidity > 0, "INSUFFICIENT_LIQUIDITY");

        uint _totalSupplyKvy = totalSupply();
        /// @dev Subtracting MINIMUM_LIQUIDITY from the initial minting in side _mint and this require
            /// help prevent the minimum price of a share from skyrocketting
            /// this require is done to mimic Uniswap's _mint(address(0), MINIMUM_LIQUIDITY)
        require(_totalSupplyKvy > MINIMUM_LIQUIDITY, "MINIMUM_LIQUIDITY");

        uint returnEth = liquidity * currentEth  / _totalSupplyKvy;
        uint returnSpc = liquidity * currentSpc  / _totalSupplyKvy;

        _burn(address(this), liquidity);
        (bool successEth, ) = burner.call{value: returnEth}("");
        require(successEth, "FAILED_ETH_TRANSFER");
        bool successSpc = spcToken.transfer(burner, returnSpc);
        require(successSpc, "FAILED_SPC_TRANSFER");
        _update(address(this).balance, spcToken.balanceOf(address(this)));
    }

    function swapEthForSpc(address swapper, uint amountSpcOut) external override nonReentrant {
        uint _reserveEth = reserveEth;

        // *should* equal reserve
        uint currentSpc = spcToken.balanceOf(address(this));
        // reserve + amount transferred in
        uint currentEth = address(this).balance;

        uint expectedEth = currentEth - _reserveEth;
        require(expectedEth > 0, "INSUFFICIENT_DEPOSIT");

        uint kBefore = (100 * _reserveEth) * (100 * reserveSpc);
        uint kAfter = (100 * currentEth - expectedEth) * (100 * (currentSpc - amountSpcOut));
        require(kAfter >= kBefore, "INVALID_K");

        bool success = spcToken.transfer(swapper, amountSpcOut);
        require(success, "FAILED_SPC_TRANSFER");
        _update(currentEth, spcToken.balanceOf(address(this)));
    }

    function swapSpcForEth(address swapper, uint amountEthOut) external override nonReentrant {
        uint _reserveSpc = reserveSpc;

        // reserve + amount transferred in
        uint currentSpc = spcToken.balanceOf(address(this));
        // *should* equal reserve
        uint currentEth = address(this).balance;

        uint expectedSpc = currentSpc - _reserveSpc;
        require(expectedSpc > 0, "INSUFFICIENT_DEPOSIT");

        uint kBefore = (100 * reserveEth) * (100 * _reserveSpc);
        uint kAfter = (100 * (currentEth - amountEthOut)) * (100 * currentSpc - expectedSpc);
        require(kAfter >= kBefore, "INVALID_K");

        (bool success,) = swapper.call{value: amountEthOut}("");
        require(success, "FAILED_ETH_TRANSFER");
        _update(address(this).balance, currentSpc);
    }

    function getReserves() external view override returns (uint _reserveEth, uint _reserveSpc) {
        _reserveEth = reserveEth;
        _reserveSpc = reserveSpc;
    }

    function _update(uint newEth, uint newSpc) internal {
        reserveEth = newEth;
        reserveSpc = newSpc;
    }

    function sync() external nonReentrant {
        _update(address(this).balance, spcToken.balanceOf(address(this)));
    }

    receive() external payable {}
}
