// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '../interfaces/IAssetRegistry.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
interface MintableERC20Contract  {
    function isMintable() external view returns (bool isMintable);
}

contract HomeChainAssetRegistry is IAssetRegistry, Ownable {

    address public registryHub;

    event HomeChainAssetRegistered(
        address indexed owner,
        bytes32 indexed id,
        address indexed homeLocation
    );

    event ReadMintableResult(string msg, bool isMintable);

    constructor(address _registryHub) {
        require(_registryHub != address(0), 'Invalid registry hub address');
        registryHub = _registryHub;
    }

    function setRegistryHub(address _registryHub) public onlyOwner {
        require(_registryHub != address(0), 'Invalid registry hub address');
        registryHub = _registryHub;
    }

    function registerAsset(bytes memory foreignLocation, address homeLocation, bytes memory properties) external override {

        require(foreignLocation.length == 0, 'HomeChainAssetRegistry: invalid foreignLocation format');
        require(homeLocation != address(0), 'HomeChainAssetRegistry: homeLocation should not be 0');

        bytes32 assetId = keccak256(abi.encodePacked(foreignLocation, homeLocation));
        bytes memory data = abi.encodeWithSignature(
            "add(address,bytes32,address,bytes,bool)",
            msg.sender,
            assetId,
            homeLocation,
            foreignLocation,
            false
        );

        (bool success,) = registryHub.call(data);
        require(success, "failed to call register hub");
        
        // set mintable asset
        try MintableERC20Contract(homeLocation).isMintable() {
             bytes memory setMintableData = abi.encodeWithSignature(
                "setMintable(bytes32)",
                assetId
            );
            (bool setMintableResult,) = registryHub.call(setMintableData);
            emit ReadMintableResult("setMintableResult", setMintableResult);
            require(setMintableResult, "failed to call set mintable asset");
        } catch (bytes memory returnData) {
            emit ReadMintableResult("Get mintable fail", false);
        }

        emit HomeChainAssetRegistered(msg.sender, assetId, homeLocation);
    }
}