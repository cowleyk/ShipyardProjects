//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRouter {
    function addLiquidity(uint amountSpc) external payable;
    function removeLiquidity(uint liquidity) external;
    function swapEthForSpc(uint minSpcReturn) external payable;
    function swapSpcforEth(uint spcDeposit, uint isDepositEth) external;
}
