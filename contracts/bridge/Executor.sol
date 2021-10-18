// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/access/AccessControl.sol';
import 'solidity-bytes-utils/contracts/BytesLib.sol';
import './interfaces/IExecutor.sol';
import '../asset/interfaces/IRegistryHub.sol';

contract Executor is AccessControl, IExecutor {

    using BytesLib for bytes;

    address immutable registryHub;
    address bridge;
    string version = "executor:version 1.0";

    event AdminSetBridge(address bridge);
    event AdminRenonceAdmin(address newAdmin);
    event ExecuteProposal(bytes extrinsic);

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

    function adminSetBridge(address _bridge) external onlyAdmin {
        require(_bridge != address(0), 'Invalid bridge address');
        bridge = _bridge;
        emit AdminSetBridge(_bridge);
    }

    function adminRenonceAdmin(address _newAdmin) external onlyAdmin {
        grantRole(DEFAULT_ADMIN_ROLE, _newAdmin);
        renounceRole(DEFAULT_ADMIN_ROLE, msg.sender);
        emit AdminRenonceAdmin(_newAdmin);
    }

    function adminExecuteProposal(bytes calldata extrinsic) public onlyAdmin {
        _executeProposal(extrinsic);
    }

    function executeProposal(bytes calldata extrinsic) override external onlyBridge {
        _executeProposal(extrinsic);
    }

    function _executeProposal(bytes calldata extrinsic) private {
        uint8 extrinsicType = extrinsic.toUint8(0);
        if(extrinsicType == 0) {    // asset
            uint8 assetType = extrinsic.toUint8(1);
            bytes32 assetId = extrinsic.toBytes32(2);
            bytes memory stakingFeastBytes = extrinsic.slice(34, 20);
            uint8 pid = extrinsic.toUint8(54);
            bytes memory recipientBytes = extrinsic.slice(55, 20);
            uint256 amount = extrinsic.toUint256(75);
            uint32 accountLen = extrinsic.toUint32(107);
            string memory bindAccount = string(extrinsic.slice(111, accountLen));
            bytes20 stakingFeast;
            assembly {
                stakingFeast := mload(add(stakingFeastBytes, 0x20))
            }

            bytes32 source = keccak256(abi.encodePacked(address(stakingFeast), pid, assetId));
            bytes20 recipient;
            assembly {
                recipient := mload(add(recipientBytes, 0x20))
            }

            if (assetType == 0) {    // trustless asset
                require(IRegistryHub(registryHub).isTrustless(assetId), 'Asset type mismatch');
                bytes memory data = abi.encodeWithSignature(
                    "updateBalance(bytes32,bytes32,address,uint256,string)",
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
            emit ExecuteProposal(extrinsic);
        } else {    // message
            // TODO
        }
    }
}