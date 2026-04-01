// SPDX-License-Identifier: MIT

// This is a factory contract to create a new token
// token's mint right will totally transfer to community contract and can't be changed in the future

pragma solidity ^0.8.20;

import "./MintableERC20.sol";
import "../interfaces/ICommunityTokenFactory.sol";

contract MintableERC20Factory is ICommunityTokenFactory {

    constructor () {
    }

    function createCommunityToken(bytes calldata meta) external override returns (address) {
        // Minimum: 1(nameLen) + 1(name≥1) + 1(symbolLen) + 1(symbol≥1) + 32(supply) + 20(owner) = 56
        // The exact layout check is enforced by the supplyOffset guard below.
        
        uint8 nameLength;
        assembly ("memory-safe") {
            nameLength := shr(248, calldataload(meta.offset))
        }
        bytes memory nameBytes = new bytes(nameLength);
        for(uint i = 0; i < nameLength; i++) {
            nameBytes[i] = meta[1 + i];
        }
        string memory name = string(nameBytes);
        
        uint256 symbolOffset = 1 + nameLength;
        uint8 symbolLength;
        assembly ("memory-safe") {
            symbolLength := shr(248, calldataload(add(meta.offset, symbolOffset)))
        }
        bytes memory symbolBytes = new bytes(symbolLength);
        for(uint i = 0; i < symbolLength; i++) {
            symbolBytes[i] = meta[symbolOffset + 1 + i];
        }
        string memory symbol = string(symbolBytes);
        
        uint256 supplyOffset = symbolOffset + 1 + symbolLength;
        require(meta.length >= supplyOffset + 52, "Meta layout error");
        
        uint256 supply;
        address owner;
        assembly ("memory-safe") {
            supply := calldataload(add(meta.offset, supplyOffset))
            owner := shr(96, calldataload(add(meta.offset, add(supplyOffset, 32))))
        }
        
        MintableERC20 token = new MintableERC20(name, symbol, supply, owner, msg.sender);
        return address(token);
    }
}