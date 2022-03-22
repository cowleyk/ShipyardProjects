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
    // uint private constant MINIMUM_LIQUIDITY = 500;

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
            amountKvy = Math.sqrt(mintableEth * mintableSpc);
        } else {
            /// @notice mint liquidity proportional to the current totalSupply or SPC or ETH
            /// liquidity = delta_token / previous_token * total_KVY
            uint liqEth = mintableEth * _totalSupplyKvy / _reserveEth;
            uint liqSpc = mintableSpc * _totalSupplyKvy / _reserveSpc;

            // QUESTION: ANY REASON ^^ USES RESERVE INSTEAD OF CURRENT?

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

        uint returnEth = liquidity * currentEth  / _totalSupplyKvy;
        uint returnSpc = liquidity * currentSpc  / _totalSupplyKvy;

        (bool successEth, ) = burner.call{value: returnEth}("");
        require(successEth, "FAILED_ETH_TRANSFER");
        bool successSpc = spcToken.transfer(burner, returnSpc);
        require(successSpc, "FAILED_SPC_TRANSFER");
        _burn(address(this), liquidity);
        _update(address(this).balance, spcToken.balanceOf(address(this)));
    }

    function swap(address swapper, uint amountToTransfer, bool isAmountEth) external override nonReentrant {
        /// @notice balances before swap
        uint _reserveEth = reserveEth;
        uint _reserveSpc = reserveSpc;

        // TODO: QUESTION: SPLIT THIS OUT INTO HANDLE ETH/HANDLE SPC FUNCTIONS

        if(isAmountEth) {
            /// @notice user deposited SPC, expects ETH out
            (bool success,) = swapper.call{value: amountToTransfer}("");
            require(success, "FAILED_ETH_TRANSFER");
        } else {
            /// @notice user deposited ETH, expects SPC out
            bool success = spcToken.transfer(swapper, amountToTransfer);
            require(success, "FAILED_SPC_TRANSFER");
        }

        /// @notice calculate the amounts deposited based on current vs reserve balances
        uint currentSpc = spcToken.balanceOf(address(this));
        uint expectedSpc = currentSpc - (_reserveSpc - (isAmountEth ? 0 : amountToTransfer));
        uint currentEth = address(this).balance;
        uint expectedEth = currentEth - (_reserveEth - (isAmountEth ? amountToTransfer : 0));
        require(isAmountEth ? expectedSpc > 0 : expectedEth > 0, "INSUFFICIENT_DEPOSIT");

        /// @notice K = amount_eth * amount_spc, it should never decrease
        /// @notice use K to ensure expected 1% fee is removed
        uint kBefore = (100 * _reserveEth) * (100 * _reserveSpc);
        uint kAfter = (100 * currentEth - expectedEth) * (100 * currentSpc - expectedSpc);
        require(kAfter >= kBefore, "INVALID_K");
        _update(currentEth, currentSpc);
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
