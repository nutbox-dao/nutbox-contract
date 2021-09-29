// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '../interfaces/IAssetRegistry.sol';
import '../../common/libraries/BytesLib.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract SubstrateNominateAssetRegistry is IAssetRegistry, Ownable {

    using BytesLib for bytes;

    struct Metadata {
        uint8 chainId;
        bytes32 validatorAccount;
    }

    struct Properties {
        bytes empty;
    }

    address public registryHub;
    mapping (bytes32 => Metadata) public idToMetadata;
    mapping (bytes32 => bool) public assetLifeCycle;

    event SubstrateNominateAssetRegistered(
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
    //                                                      8-107 are reserved for FRAME based standalone chains
    //      validatorAccount    bytes32     bytes[1, end]
    function registerAsset(bytes memory foreignLocation, address homeLocation, bytes memory properties) external override {
        require(foreignLocation.length == 52, 'SubstrateNominateAssetRegistry: invalid foreignLocation format');

        // check foreignLocation
        uint8 chainId = foreignLocation.toUint8(0);
        require(chainId >= 2 && chainId <= 107, 'SubstrateNominateAssetRegistry: invalid chain id');
        uint32 validatorAccountLen = foreignLocation.toUint32(1);
        require(validatorAccountLen == 47, 'Wrong substrate account address');
        bytes32 validatorAccount = foreignLocation.toBytes32(5);

        Metadata memory meta = Metadata({
            chainId: chainId,
            validatorAccount: validatorAccount
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

        emit SubstrateNominateAssetRegistered(msg.sender, assetId, meta);
    }
}
