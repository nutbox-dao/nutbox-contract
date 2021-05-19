// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import '../interfaces/IRegistryHub.sol';
import '../../common/access/Ownable.sol';

contract RegistryHub is IRegistryHub, Ownable {

    // contract => hasWhitelisted
    mapping (address => bool) public whiteList;
    // owner => assetIdList
    mapping (address => bytes32[]) public registryHub;
    // owner => assetId => hasRegistered
    mapping (address => mapping (bytes32 => bool)) private registryRecord;

    event NewAsset(address owner, bytes32 id);

    constructor() {

    }

    function setWhiteList(address _contract) public onlyOwner {
        require(_contract != address(0), 'Invalid contract address');
        whiteList[_contract] = true;
    }

    function add(address owner, bytes32 id) external override {
        require(whiteList[msg.sender], 'Permission denied: contract is not white list');
        require(registryRecord[owner][id] == false, 'Asset already registered');

        registryHub[owner].push(id);
        registryRecord[owner][id] = true;
        emit NewAsset(owner, id);
    }

}
