// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Fixed-supply ERC20 for tests (non-mintable community token scenario).
contract FixedSupplyERC20 is ERC20 {
    constructor(uint256 supply) ERC20("Fixed Test Token", "FIX") {
        _mint(msg.sender, supply);
    }
}
