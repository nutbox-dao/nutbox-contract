// SPDX-License-Identifier: MIT

// This is a factory contract to create a new token
// token's mint right will totally transfer to community contract and can't be changed in the future

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "./Point.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "../interfaces/ICommunityTokenFactory.sol";

contract PointFactory is ICommunityTokenFactory {

    using BytesLib for bytes;

    constructor () {
    }

    function createCommunityToken(bytes calldata meta) external override returns (address) {
        uint8 nameLength = meta.toUint8(0);
        string memory name = string(meta.slice(1, nameLength));
        uint8 symbolLength = meta.toUint8(nameLength + 1);
        string memory symbol = string(meta.slice(nameLength + 2, symbolLength));
        uint256 startTradeTime = meta.toUint256(nameLength + symbolLength + 2);
        uint256 supply = meta.toUint256(nameLength + symbolLength + 34);
        address owner = meta.toAddress(nameLength + symbolLength + 66);
        Point token = new Point(name, symbol, startTradeTime, supply, owner, msg.sender);
        return address(token);
    }
}