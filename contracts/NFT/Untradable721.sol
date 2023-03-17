//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./Tradable721.sol";

contract Untradable721 is Tradable721 {
    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER_ROLE");

    constructor(string memory name, string memory symbol) Tradable721(name, symbol) {}

    function _beforeTokenTransfer(address from, address to, uint256) internal virtual override {
        if (from != address(0) && to != address(0)) {
            require(hasRole(TRANSFER_ROLE, msg.sender), "Must have tranfer role to transfer");
        }
    }
}
