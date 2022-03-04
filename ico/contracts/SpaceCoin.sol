//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SpaceCoin is ERC20 {
    bool public collectTaxes;
    address public treasury;

    constructor() ERC20("Space Coin", "SPC") {
        treasury = msg.sender;
        _mint(treasury, 500000 ether);
    }

    modifier onlyTreasurer() {
        require(msg.sender == treasury, "ONLY_TREASURY");
        _;
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual override {
        if (collectTaxes) {
            uint256 taxAmount = amount / 50;
            super._transfer(sender, treasury, taxAmount);
            amount -= taxAmount;
        }
        super._transfer(sender, recipient, amount);
    }

    function toggleTax(bool _tax) external onlyTreasurer {
        collectTaxes = _tax;
    }
}
