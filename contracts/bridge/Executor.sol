// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/access/AccessControl.sol';
import '../common/libraries/BytesLib.sol';
import './interfaces/IExecutor.sol';
import '../asset/interfaces/IRegistryHub.sol';

contract Executor is AccessControl, IExecutor {

    using BytesLib for bytes;

    address registryHub;
    address bridge;

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Sender is not admin");
        _;
    }

    modifier onlyBridge() {
        require(bridge != address(0) && msg.sender == bridge, "Sender is not bridge");
        _;
    }

    constructor(address _registryHub) public {
        require(_registryHub != address(0), 'Invalid registry hub address');
        registryHub = _registryHub;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function adminSetBridge(address _bridge) public onlyAdmin {
        require(_bridge != address(0), 'Invalid bridge address');
        bridge = _bridge;
    }

    function adminRenonceAdmin(address _newAdmin) external onlyAdmin {
        grantRole(DEFAULT_ADMIN_ROLE, _newAdmin);
        renounceRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function executeProposal(bytes calldata extrinsic) override external onlyBridge {
        uint8 extrinsicType = extrinsic.toUint8(0);
        if(extrinsicType == 0) {    // asset
            uint8 assetType = extrinsic.toUint8(1);
            bytes32 assetId = extrinsic.toBytes32(2);
            bytes memory recipientBytes = extrinsic.slice(34, 20);
            uint256 amount = extrinsic.toUint256(54);
            bytes32 bindAccount = extrinsic.toBytes32(86);
            bytes32 source = keccak256(abi.encodePacked(bridge, assetId));
            bytes20 recipient;
            assembly {
                recipient := mload(add(recipientBytes, 0x20))
            }

            if (assetType == 0) {    // trustless asset
                require(IRegistryHub(registryHub).isTrustless(assetId), 'Asset type mismatch');
                bytes memory data = abi.encodeWithSignature(
                    "updateBalance(bytes32,bytes32,address,uint256,bytes32)",
                    source,
                    assetId,
                    address(recipient),
                    amount,
                    bindAccount
                );
                (bool success,) = IRegistryHub(registryHub).getTrustlessAssetHandler().call(data);
                require(success, "failed to call updateBalance");

            } else if (assetType == 1) {    // trust asset: ERC20
                require(!IRegistryHub(registryHub).isTrustless(assetId), 'Asset type mismatch');
                bytes memory data = abi.encodeWithSignature(
                    "unlockOrMintAsset(bytes32,bytes32,address,uint256)",
                    source,
                    assetId,
                    address(recipient),
                    amount
                );
                (bool success,) = IRegistryHub(registryHub).getERC20AssetHandler().call(data);
                require(success, "failed to call ERC20AssetHandler::unlockOrMintAsset");

            } else if (assetType == 2) {    // trust asset: ERC721
                require(!IRegistryHub(registryHub).isTrustless(assetId), 'Asset type mismatch');
                bytes memory data = abi.encodeWithSignature(
                    "unlockOrMintAsset(bytes32,bytes32,address,uint256)",
                    source,
                    assetId,
                    address(recipient),
                    amount
                );
                (bool success,) = IRegistryHub(registryHub).getERC721AssetHandler().call(data);
                require(success, "failed to call ERC721AssetHandler::unlockOrMintAsset");

            } else {
                require(false, 'Unsupported asset type');
            }
        } else {    // message
            // TODO
        }
    }
}