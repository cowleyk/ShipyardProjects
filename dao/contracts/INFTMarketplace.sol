//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface INftMarketplace {
    function getPrice(address nftContract, uint nftId) external returns (uint price);
    function buy(address nftContract, uint nftId) external payable returns (bool success);
}