// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '../interfaces/ITrustlessAssetHandler.sol';
import '../interfaces/IRegistryHub.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import "@openzeppelin/contracts/access/AccessControl.sol";

contract TrustlessAssetHandler is ITrustlessAssetHandler, AccessControl {
    using SafeMath for uint256;

    struct PoolInfo {
        address stakingFeast;
        uint8 pid;
    }

    address public registryHub;
    address public bridge;

    // contract => hasWhitelisted
    mapping (address => bool) private whiteList;
    // source => account => amount
    mapping (bytes32 => mapping (address => uint256)) private depositBalance;
    // assetId => PoolInfo
    mapping (bytes32 => PoolInfo) private attachedPool;

    event AttachedPool(bytes32 assetId, address stakingFeast, uint8 pid);
    event BalanceUpdated(bytes32 source, bytes32 assetId, address account, uint256 amount);

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Sender is not admin");
        _;
    }

    modifier onlyBridge() {
        require(msg.sender == bridge, "sender is not bridge");
        _;
    }

    constructor(address _registryHub, address _bridge) public {
        require(_registryHub != address(0), 'Invalid registry hub address');
        require(_bridge != address(0), 'Invalid bridge hub address');
        registryHub = _registryHub;
        bridge = _bridge;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setRegistryHub(address _registryHub) public onlyAdmin {
        require(_registryHub != address(0), 'Invalid registry hub address');
        registryHub = _registryHub;
    }

    function attachPool(bytes32 assetId, address stakingFeast, uint8 pid) external onlyBridge {
        attachedPool[assetId].stakingFeast = stakingFeast;
        attachedPool[assetId].pid = pid;
        emit AttachedPool(assetId, stakingFeast, pid);
    }

    function updateBalance(bytes32 source, bytes32 assetId, address account, uint256 amount) override external onlyBridge {
        // check if the asset is trustless
        require(IRegistryHub(registryHub).isTrustless(assetId), 'Asset is not trustless');
        depositBalance[source][account] = amount;

        // if attached staking pool, update pool
        if (attachedPool[assetId].stakingFeast != address(0)) {
            bytes memory data = abi.encodeWithSignature(
                "update(uint8,address,uint256)",
                attachedPool[assetId].pid,
                account,
                amount
            );
            (bool success,) = attachedPool[assetId].stakingFeast.call(data);
            require(success, "failed to call stakingFeast::update");
        }

        emit BalanceUpdated(source, assetId, account, amount);
    }

    function getBalance(bytes32 source, address account) override view external returns(uint256) {
        return depositBalance[source][account];
    }
}