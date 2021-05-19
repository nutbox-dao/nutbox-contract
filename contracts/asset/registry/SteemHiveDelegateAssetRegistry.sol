// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import '../interfaces/IAssetRegistry.sol';
import '../../common/access/Ownable.sol';
import '../../common/libraries/BytesLib.sol';

contract SteemHiveDelegateAssetRegistry is IAssetRegistry, Ownable {

    using BytesLib for bytes;

    struct Metadata {
        uint8 chainId;
        string assetType;
        bytes agentAccount;
    }

    struct Properties {
        bytes empty;
    }

    address public registryHub;
    mapping (bytes32 => bytes) public idToForeignLocation;
    mapping (bytes32 => Metadata) public idToMetadata;
    mapping (bytes32 => bool) public assetLifeCycle;

    event SteemHiveDelegateAssetRegisterd(
        address indexed owner,
        Metadata meta
    );

    constructor(address _registryHub) {
        require(_registryHub != address(0), 'Invalid registry hub address');
        registryHub = _registryHub;
    }

    function setRegistryHub(address _registryHub) public onlyOwner {
        require(_registryHub != address(0), 'Invalid registry hub address');
        registryHub = _registryHub;
    }

    //spec of foreignLocation:
    //  chainId             uint8   bytes[0]        1: Steem, 2: Hive
    //  assetType           bytes2  bytes[1, 2]     "sp"
    //  agentAccountLen     uint32  bytes[3, 6]
    //  agentAccount        bytes   bytes[7, end]
    function registerAsset(bytes memory foreignLocation, address homeLocation, bytes memory properties) external override {
        // check foreignLocation
        uint8 chainId = foreignLocation.toUint8(0);
        require(chainId == 1 || chainId == 2, 'SteemHiveDelegateAssetRegistry: invalid chain id');
        string memory assetType = string(foreignLocation.slice(1, 2));
        require(keccak256(abi.encodePacked((assetType))) == keccak256(abi.encodePacked(('sp'))), 'SteemHiveDelegateAssetRegistry: invalid asset type');
        uint32 agentAccountLen = foreignLocation.toUint32(3);
        bytes memory agentAccount = foreignLocation.slice(7, agentAccountLen);

        Metadata memory meta = Metadata({
            chainId: chainId,
            assetType: assetType,
            agentAccount: agentAccount
        });

        // check homeLocation
        require(homeLocation == address(0), 'Invalid home location, should be 0');

        bytes32 assetId = keccak256(abi.encodePacked(foreignLocation, homeLocation));
        bytes memory data = abi.encodeWithSignature(
            "add(address,bytes32)",
            msg.sender,
            assetId
        );

        (bool success,) = registryHub.call(data);
        require(success, "failed to call register bub");

        idToForeignLocation[assetId] = foreignLocation;
        idToMetadata[assetId] = meta;
        assetLifeCycle[assetId] = true;

        emit SteemHiveDelegateAssetRegisterd(msg.sender, meta);
    }
}
