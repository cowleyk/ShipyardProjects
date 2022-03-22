//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILiquidityPool is IERC20 {
    function getReserves() external view returns (uint reserveEth, uint reserveSpc);
    function mint(address to) external returns (uint amountKVY);
    function burn(address burner) external;
    function swap(address swapper, uint amountToTransfer, bool isAmountEth) external;
}
