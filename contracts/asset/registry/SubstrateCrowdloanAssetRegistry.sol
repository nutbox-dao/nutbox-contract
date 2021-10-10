// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '../interfaces/IAssetRegistry.sol';
import 'solidity-bytes-utils/contracts/BytesLib.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract SubstrateCrowdloanAssetRegistry is IAssetRegistry, Ownable {

    using BytesLib for bytes;

    struct Metadata {
        uint8 chainId;
        uint32 paraId;
        uint32 trieIndex;
        bytes32 communityAccount;
        bytes properties;
    }

    struct Properties {
        bytes empty;
    }

    address public registryHub;
    mapping (bytes32 => Metadata) public idToMetadata;
    mapping (bytes32 => bool) public assetLifeCycle;

    event SubstrateCrowdloanAssetRegistered(
        address indexed owner,
        bytes32 indexed id,
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
    //      chainId             uint8       bytes[0]        2: Polkadot, 3: Kusama, 4,5,6,7 are reserved for other relaychain
    //      paraId              uint32      bytes[1, 4]
    //      trieIndex           uint32      bytes[5, 8]
    //      communityAccountLenght  uint32  bytes[9, 12]
    //      communityAccount    bytes32     bytes[13, end]
    function registerAsset(bytes memory foreignLocation, address homeLocation, bytes memory properties) external override {
        require(foreignLocation.length == 45, 'SubstrateCrowdloanAssetRegistry: invalid foreignLocation format');
        // check foreignLocation
        uint8 chainId = foreignLocation.toUint8(0);
        require(chainId >= 2 && chainId <= 7, 'SubstrateCrowdloanAssetRegistry: invalid chain id');
        uint32 paraId = foreignLocation.toUint32(1);
        uint32 trieIndex = foreignLocation.toUint32(5);
        uint32 communityAccountLen = foreignLocation.toUint32(9);
        require(communityAccountLen == 32, 'Wrong substrate account address');
        bytes32 communityAccount = foreignLocation.toBytes32(13);

        Metadata memory meta = Metadata({
            chainId: chainId,
            paraId: paraId,
            trieIndex: trieIndex,
            communityAccount: communityAccount,
            properties: properties
        });

        // check homeLocation
        require(homeLocation == address(0), 'Invalid home location, should be 0');

        bytes32 assetId = keccak256(abi.encodePacked(foreignLocation, homeLocation));
        bytes memory data = abi.encodeWithSignature(
            "add(address,bytes32,address,bytes,bool)",
            msg.sender,
            assetId,
            homeLocation,
            foreignLocation,
            true
        );

        (bool success,) = registryHub.call(data);
        require(success, "failed to call register hub");

        idToMetadata[assetId] = meta;
        assetLifeCycle[assetId] = true;

        emit SubstrateCrowdloanAssetRegistered(msg.sender, assetId, meta);
    }
}
