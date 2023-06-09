// SPDX-License-Identifier: MIT

// This is a factory contract to create a new point(cant transfer from unauthorized address)
// token's mint right will totally transfer to community contract and can't be changed in the future

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "./MintablePoint.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "../interfaces/ICommunityTokenFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MintablePointFactory is ICommunityTokenFactory, Ownable {

    using BytesLib for bytes;
    
    address public TransferModitor;
    event UpdateNewTransferModitor(address indexed oldTransferModitor, address indexed newTransferModitor);

    constructor (address _transferModitor) {
        TransferModitor = _transferModitor;
    }

    function updateNewTransferModitor(address _newTransferModitor) external onlyOwner {
        address oldTransferModitor = TransferModitor;
        TransferModitor = _newTransferModitor;
        emit UpdateNewTransferModitor(oldTransferModitor, TransferModitor);
    }

    function createCommunityToken(bytes calldata meta) external override returns (address) {
        uint8 nameLength = meta.toUint8(0);
        string memory name = string(meta.slice(1, nameLength));
        uint8 symbolLength = meta.toUint8(nameLength + 1);
        string memory symbol = string(meta.slice(nameLength + 2, symbolLength));
        uint256 supply = meta.toUint256(nameLength + symbolLength + 2);
        address owner = meta.toAddress(nameLength + symbolLength + 34);
        MintablePoint point = new MintablePoint(TransferModitor, name, symbol, supply, owner, msg.sender);
        return address(point);
    }
}