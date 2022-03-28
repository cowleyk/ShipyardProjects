//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./INFTMarketplace.sol";

/// @title A dummy market place for the CollectorDAO contract to interact with
/// @author Kevin Cowley
contract NftMarketplace is INftMarketplace {

    function getPrice(address nftContract, uint nftId) external override pure returns (uint price) {
        return 2 ether;
    }

    function buy(address nftContract, uint nftId) external override payable returns (bool success) {
        return true;
    }
}