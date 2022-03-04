//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title A token built for raising funds
/// @author Kevin Cowley
contract SpaceCoin is ERC20 {
    /// @notice are transactions being taxed
    bool public collectTaxes;

    /// @notice controlling address
    address public treasury;

    constructor() ERC20("Space Coin", "SPC") {
        treasury = msg.sender;

        /// @notice a fixed supply of 500,000 SPC are minted
        _mint(treasury, 500000 ether);
    }

    modifier onlyTreasurer() {
        require(msg.sender == treasury, "ONLY_TREASURY");
        _;
    }

    /// @notice override internal transfer function to allow for collecting taxes
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual override {
        /// @notice collect 2% tax
        if (collectTaxes) {
            uint256 taxAmount = amount / 50;
            super._transfer(sender, treasury, taxAmount);
            amount -= taxAmount;
        }
        super._transfer(sender, recipient, amount);
    }

    /// @notice allow toggling of tax collection
    function toggleTax(bool _tax) external onlyTreasurer {
        collectTaxes = _tax;
    }
}
