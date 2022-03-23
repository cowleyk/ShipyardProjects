//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./interfaces/IRouter.sol";
import "./interfaces/ILiquidityPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Router is ReentrancyGuard, IRouter {
    ILiquidityPool public pool;
    IERC20 public spcToken;

    constructor(address _pool, address _spcToken) {
        pool = ILiquidityPool(_pool);
        spcToken = IERC20(_spcToken);
    }

    function addLiquidity(uint depositedSpc) external payable override nonReentrant {
        uint amountEth;
        uint amountSpc;
        (uint reserveEth, uint reserveSpc) = pool.getReserves();

        if (reserveEth == 0 && reserveSpc == 0) {
            amountEth = msg.value;
            amountSpc = depositedSpc;
        } else {
            /// @notice calculate the value of ETH that matches the value of deposited SPC
            uint expectedEth = quote(depositedSpc, reserveSpc, reserveEth);
            if(expectedEth <= msg.value) {
                /// @notice the user deposited too much value ETH for the amount of SPC, refund extra ETH
                amountEth = expectedEth;
                amountSpc = depositedSpc;
                (bool success,) = msg.sender.call{value: msg.value - amountEth}("");
                require(success, "FAILED_ETH_REFUND");
            } else {
                uint expectedSpc = quote(msg.value, reserveEth, reserveSpc);
                /// @dev this assert should NEVER throw
                assert(expectedSpc <= depositedSpc);
                amountEth = msg.value;
                amountSpc = expectedSpc;
            }
        }

        // send eth to pool
        (bool successEth, ) = address(pool).call{value: amountEth}("");
        require(successEth, "FAILED_ETH_TRANSFER");

        // transfer tokens to pool (UI button click has already approved pool addr)
        bool successSpc = spcToken.transferFrom(msg.sender, address(pool), amountSpc);
        require(successSpc, "FAILED_SPC_TRANSFER");

        // mint tokens for sender
        pool.mint(msg.sender);
    }

    function removeLiquidity(uint liquidity) external override nonReentrant {
        /// @notice send KVY to liquidity pool
        (uint reserveEth, uint reserveSpc) = pool.getReserves();
        require(reserveEth > 0 && reserveSpc > 0 && liquidity > 0, "INSUFFICIENT_LIQUIDITY");
        bool successSpc = pool.transferFrom(msg.sender, address(pool), liquidity);
        require(successSpc, "FAILED_SPC_TRANSFER");
        pool.burn(msg.sender);
    }

    function quote(uint amountA, uint reserveA, uint reserveB) internal pure returns (uint amountB) {
        require(amountA > 0, "INSUFFICIENT_AMOUNT");
        /// @dev this assert should NEVER happen, if reserveA or reserveB is zero, addLiquidity() should not call quote
        assert(reserveA > 0 && reserveB > 0);
        /// @dev base equation: x1 / y1 = x2 / y2
        amountB = (amountA * reserveB) / reserveA;
    }

    /// @param minSpcReturn minimum amount user will accept for swap. Rely on client to convert from slippage %
    function swapEthForSpc(uint minSpcReturn) external payable override nonReentrant {
        (uint reserveEth, uint reserveSpc) = pool.getReserves();

        /// @notice calculate how much SPC to return after taking out 1% fee of ETH deposit
        uint spcToSender = getAmountOut(msg.value, reserveEth, reserveSpc);
        require(spcToSender > minSpcReturn, "SLIPPAGE");

        (bool success,) = address(pool).call{value: msg.value}("");
        require(success, "FAILED_ETH_TRANSFER");
        pool.swap(msg.sender, spcToSender, false);
    }

    /// @param minEthReturn minimum amount user will accept for swap. Rely on client to convert from slippage %
    function swapSpcforEth(uint spcDeposit, uint minEthReturn) external override nonReentrant {
        (uint reserveEth, uint reserveSpc) = pool.getReserves();
        
        /// @notice calculate how much ETH to return after taking out 1% fee of SPC deposit
        uint ethToSender = getAmountOut(spcDeposit, reserveSpc, reserveEth);
        require(ethToSender > minEthReturn, "SLIPPAGE");

        /// @notice assumes user already approved
        bool success = spcToken.transferFrom(msg.sender, address(pool), spcDeposit);
        require(success, "FAILED_SPC_TRANSFER");
        pool.swap(msg.sender, ethToSender, true);
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
        require(amountIn > 0, "INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQUIDITY");
        uint amountInWithFee = amountIn * 99;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = reserveIn * 100 + amountInWithFee;
        /// @dev algrebra breakdown:
        /// x1 * y1 = x2 * y2
        /// x1 * y1 = (x1 + xin)(y1 - yout)
        /// x1 * y1 = (x1 * y1) + (xin * y1) - (x1 * yout) - (xin * yout)
        /// yout = (xin * y1) / (x1 + xin)
        amountOut = numerator / denominator;
    }

    // UI helper functions
    function getSwapEstimate(uint deposit, bool isDepositEth) external view returns (uint estimate) {
        (uint reserveEth, uint reserveSpc) = pool.getReserves();
        if(isDepositEth) {
            estimate = getAmountOut(deposit, reserveEth, reserveSpc);
        } else {
            estimate = getAmountOut(deposit, reserveSpc, reserveEth);
        }
    }

    function getReserveEth() external view returns (uint reserveEth) {
        (reserveEth, ) = pool.getReserves();
    }
    function getReserveSpc() external view returns (uint reserveSpc) {
        (, reserveSpc) = pool.getReserves();
    }
}
