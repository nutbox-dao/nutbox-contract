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
    // owner => counter
    mapping (address => uint8) public registryCounter;
    // owner => assetId => hasRegistered
    mapping (bytes32 => bool) private registryRecord;
    // assetId => isMintable
    mapping (bytes32 => bool) private mintableRecord;
    // assetId => foreignLocation
    mapping (bytes32 => bytes) private idToForeignLocation;
    // assetId => homeLocation
    mapping (bytes32 => address) private idToHomeLocation;
    // assetId => registryContract
    mapping (bytes32 => address) private idToRegistryContract;
    // assetid => trustless
    mapping (bytes32 => bool) private trustlessAsset;
    // when create new pool, need user stake some NUT
    bytes32 NUT;
    uint256 stakedNUT;

    address erc20AssetHandler;
    address erc721AssetHandler;
    address erc1155AssetHandler;
    address trustlessAssetHandler;

    event NewAsset(address indexed owner, bytes32 indexed id);
    event SetAssetHandlers(address erc20AssetHandler, address erc721AssetHandler, address erc1155AssetHandler, address trustlessAssetHandler);
    event SetWhiteList(address contractAddress);
    event RemoveWhiteList(address contractAddress);
    event SetNUTStaking(bytes32 nut, uint256 stakedAmount);
    event SetMintable(bytes32 id);

    constructor() {
    }

    function setAssetHandlers(address _erc20AssetHandler, address _erc721AssetHandler, address _erc1155AssetHandler, address _trustlessAssetHandler) external onlyOwner {
        require(_erc20AssetHandler != address(0) && _erc721AssetHandler != address(0) &&  _erc1155AssetHandler != address(0) && _trustlessAssetHandler != address(0), 'Invalid address');
        erc20AssetHandler = _erc20AssetHandler;
        erc721AssetHandler = _erc721AssetHandler;
        erc1155AssetHandler = _erc1155AssetHandler;
        trustlessAssetHandler = _trustlessAssetHandler;
        emit SetAssetHandlers(_erc20AssetHandler, _erc721AssetHandler, _erc1155AssetHandler, _trustlessAssetHandler);
    }

    function setWhiteList(address _contract) external onlyOwner {
        require(_contract != address(0), 'Invalid contract address');
        whiteList[_contract] = true;
        emit SetWhiteList(_contract);
    }

    function removeWhiteList(address _contract) external onlyOwner {
        require(_contract != address(0), 'Invalid contract address');
        whiteList[_contract] = false;
        emit RemoveWhiteList(_contract);
    }

    function setNUTStaking(bytes32 _nut, uint256 _stakedAmount) external onlyOwner {
        NUT = _nut;
        stakedNUT = _stakedAmount;
        emit SetNUTStaking(_nut, _stakedAmount);
    }

    function add(address owner, bytes32 id, address homeLocation, bytes memory foreignLocation, bool trustless) external override {
        require(whiteList[msg.sender], 'Permission denied: contract is not white list');
        require(registryRecord[id] == false, 'Asset already registered');
        require(owner != address(0), 'Invalid address');

        registryHub[owner].push(id);
        registryRecord[id] = true;
        registryCounter[owner] = registryCounter[owner] + 1;
        idToForeignLocation[id] = foreignLocation;
        idToHomeLocation[id] = homeLocation;
        idToRegistryContract[id] = msg.sender;
        trustlessAsset[id] = trustless;
        emit NewAsset(owner, id);
    }

    function setMintable(bytes32 id) external override {
        require(whiteList[msg.sender], 'Permission denied: contract is not white list');
        mintableRecord[id] = true;
        emit SetMintable(id);
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

    function getRegistryContract(bytes32 id) external override view returns(address) {
        return idToRegistryContract[id];
    }

    function getERC20AssetHandler() external override view returns(address) {
        return erc20AssetHandler;
    }

    function getERC721AssetHandler() external override view returns(address) {
        return erc721AssetHandler;
    }

    function getERC1155AssetHandler() external override view returns(address) {
        return erc1155AssetHandler;
    }

    function getTrustlessAssetHandler() external override view returns(address) {
        return trustlessAssetHandler;
    }

    function getNUT() external override view returns(bytes32) {
        return NUT;
    }

    function getStakedNUT() external override view returns(uint256) {
        return stakedNUT;
    }

}
