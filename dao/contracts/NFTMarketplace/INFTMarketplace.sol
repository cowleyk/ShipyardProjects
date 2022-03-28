//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface INftMarketplace {
    function getPrice(address nftContract, uint256 nftId)
        external
        returns (uint256 price);

    function buy(address nftContract, uint256 nftId)
        external
        payable
        returns (bool success);
}
