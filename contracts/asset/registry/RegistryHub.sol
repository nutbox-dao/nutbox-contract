// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '../interfaces/IRegistryHub.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract RegistryHub is IRegistryHub, Ownable {

    // contract => hasWhitelisted
    mapping (address => bool) public whiteList;
    // owner => assetIdList
    mapping (address => bytes32[]) public registryHub;
    // owner => assetId => hasRegistered
    mapping (address => mapping (bytes32 => bool)) private registryRecord;
    // assetId => isMintable
    mapping (bytes32 => bool) private mintableRecord;
    // assetId => foreignLocation
    mapping (bytes32 => bytes) private idToForeignLocation;
    // assetId => homeLocation
    mapping (bytes32 => address) private idToHomeLocation;
    // assetid => trustless
    mapping (bytes32 => bool) private trustlessAsset;

    address erc20AssetHandler;
    address erc721AssetHandler;
    address trustlessAssetHandler;

    event NewAsset(address owner, bytes32 id);

    constructor(address _erc20AssetHandler, address _erc721AssetHandler, address _trustlessAssetHandler) {
        erc20AssetHandler = _erc20AssetHandler;
        erc721AssetHandler = _erc721AssetHandler;
        trustlessAssetHandler = _trustlessAssetHandler;
    }

    function setWhiteList(address _contract) public onlyOwner {
        require(_contract != address(0), 'Invalid contract address');
        whiteList[_contract] = true;
    }

    function add(address owner, bool trustless, bytes32 id, address homeLocation, bytes memory foreignLocation) external override {
        require(whiteList[msg.sender], 'Permission denied: contract is not white list');
        require(registryRecord[owner][id] == false, 'Asset already registered');

        registryHub[owner].push(id);
        registryRecord[owner][id] = true;
        idToForeignLocation[id] = foreignLocation;
        idToHomeLocation[id] = homeLocation;
        trustlessAsset[id] = trustless;
        emit NewAsset(owner, id);
    }

    function setMintable(bytes32 id) external override {
        require(whiteList[msg.sender], 'Permission denied: contract is not white list');
        mintableRecord[id] = true;
    }

    function mintable(bytes32 id) external override view returns(bool) {
        return mintableRecord[id];
    }

    function isTrustless(bytes32 id) external override view returns(bool) {
        return trustlessAsset[id];
    }

    function getHomeLocation(bytes32 id) external override view returns(address) {
        return idToHomeLocation[id];
    }

    function getForeignLocation(bytes32 id) external override view returns(bytes memory) {
        return idToForeignLocation[id];
    }

    function getERC20AssetHandler() external override view returns(address) {
        return erc20AssetHandler;
    }

    function getERC721AssetHandler() external override view returns(address) {
        return erc721AssetHandler;
    }

    function getTrustlessAssetHandler() external override view returns(address) {
        return trustlessAssetHandler;
    }
}
