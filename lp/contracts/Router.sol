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
            uint expectedEth = quote(depositedSpc, reserveSpc, reserveEth);
            if(expectedEth <= msg.value) {
                amountEth = expectedEth;
                amountSpc = depositedSpc;
                (bool success,) = msg.sender.call{value: msg.value - amountEth}("");
                require(success, "FAILED_ETH_REFUND");
            } else {
                uint expectedSpc = quote(msg.value, reserveEth, reserveSpc);
                require(expectedSpc <= depositedSpc, "INSUFFICIENT_SPC_DEPOSIT");
                amountEth = msg.value;
                amountSpc = expectedSpc;
            }
        }

        // send eth to pool
        (bool successEth, ) = address(pool).call{value: amountEth}("");
        // (bool sent, bytes memory data) = _to.call{value: msg.value}("");
        require(successEth, "FAILED_ETH_TRANSFER");

        // transfer tokens to pool (UI button click has already approved pool addr)
        bool successSpc = spcToken.transferFrom(msg.sender, address(pool), amountSpc);
        require(successSpc, "FAILED_SPC_TRANSFER");

        // mint tokens for sender
        pool.mint(msg.sender);
    }

    function removeLiquidity(uint liquidity) external override nonReentrant {
        // send KVY to liquidity pool
        (uint reserveEth, uint reserveSpc) = pool.getReserves();
        require(reserveEth > 0 && reserveSpc > 0, "INSUFFICIENT_LIQUIDITY");
        bool successSpc = pool.transferFrom(msg.sender, address(pool), liquidity);
        require(successSpc, "FAILED_SPC_TRANSFER");
        pool.burn(msg.sender);
    }

    function quote(uint amountA, uint reserveA, uint reserveB) internal pure returns (uint amountB) {
        // x1 / y1 = x2 / y2
        require(amountA > 0, "INSUFFICIENT_AMOUNT");
        require(reserveA > 0 && reserveB > 0, "INSUFFICIENT_LIQUIDITY");
        // uint ratio = reserveB / reserveA;
        // return amountA / ratio;
        amountB = (amountA * reserveB) / reserveA;
    }

    /// @param minSpcReturn minimum amount user will accept for swap. Rely on client to convert from slippage %
    function swapEthForSpc(uint minSpcReturn) external payable override nonReentrant {

        // TODO: MAKE SURE SPC IS AVAILABLE
        (uint reserveEth, uint reserveSpc) = pool.getReserves();

        // calculate how much SPC to return
        uint spcToSender = getAmountOut(msg.value, reserveEth, reserveSpc);
        require(spcToSender > minSpcReturn, "SLIPPAGE");

        // calls `spcToken.approve()`
        (bool success,) = address(pool).call{value: msg.value}("");
        require(success, "FAILED_ETH_TRANSFER");
        pool.swap(msg.sender, spcToSender, false);
    }

    function swapSpcforEth(uint spcDeposit, uint minEthReturn) external override nonReentrant {

        // TODO: MAKE SURE ETH IS AVAILABLE
        (uint reserveEth, uint reserveSpc) = pool.getReserves();
        
        /// @notice calculate the value in ETH of SPC - 1% fee 
        uint ethToSender = getAmountOut(spcDeposit, reserveSpc, reserveEth);
        require(ethToSender > minEthReturn, "SLIPPAGE");

        // assumes user already approved
        bool success = spcToken.transferFrom(msg.sender, address(pool), spcDeposit);
        require(success, "FAILED_SPC_TRANSFER");
        pool.swap(msg.sender, ethToSender, true);
    }

    function getSwapEstimate(uint deposit, bool isDepositEth) external view returns (uint estimate) {
        (uint reserveEth, uint reserveSpc) = pool.getReserves();
        if(isDepositEth) {
            estimate = getAmountOut(deposit, reserveEth, reserveSpc);
        } else {
            estimate = getAmountOut(deposit, reserveSpc, reserveEth);
        }
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
        // x1 * y1 = x2 * y2
        // x1 * y1 = (x1 + xin)(y1 + - yout)
        // yout = (xin * y1) / (x1 + xin)
        require(amountIn > 0, "INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQUIDITY");
        uint amountInWithFee = amountIn * 99;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = reserveIn * 100 + amountInWithFee;
        amountOut = numerator / denominator;
    }
}
