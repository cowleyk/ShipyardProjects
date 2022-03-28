//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./INFTMarketplace.sol";

/// @title A dummy market place for the CollectorDAO contract to interact with
/// @author Kevin Cowley
contract NftMarketplace is INftMarketplace {
    function getPrice(address nftContract, uint256 nftId)
        external
        pure
        override
        returns (uint256 price)
    {
        return 2 ether;
    }

    function buy(address nftContract, uint256 nftId)
        external
        payable
        override
        returns (bool success)
    {
        return true;
    }
}
