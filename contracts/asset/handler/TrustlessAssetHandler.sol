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
        bytes32 assetId;
    }

    address public registryHub;
    address public executor;

    // contract => hasWhitelisted
    mapping (address => bool) private whiteList;
    // source => account => amount
    mapping (bytes32 => mapping (address => uint256)) private depositBalance;
    // source => PoolInfo
    mapping (bytes32 => PoolInfo) private attachedPool;

    bytes32 public constant WHITELIST_MANAGER_ROLE = keccak256("WHITELIST_MANAGER_ROLE");

    event WhitelistManagerAdded(address manager);
    event WhitelistManagerRemoved(address manager);
    event AttachedPool(bytes32 assetId, address stakingFeast, uint8 pid);
    event BalanceUpdated(bytes32 source, bytes32 assetId, address account, uint256 amount, string bindAccount);
    event SetExecutor(address executor);
    event SetRegistryHub(address registryHub);
    event SetWhiteList(address contractAddress);
    event RemoveWhiteList(address contractAddress);

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Sender is not admin");
        _;
    }

    modifier onlyAdminOrWhitelistManager() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || hasRole(WHITELIST_MANAGER_ROLE, msg.sender),
            "Sender is not admin or in whitelist manager group");
        _;
    }

    modifier onlyExecutor() {
        require(msg.sender == executor, "sender is not executor");
        _;
    }

    constructor(address _registryHub, address _executor) public {
        require(_registryHub != address(0), 'Invalid registry hub address');
        require(_executor != address(0), 'Invalid executor hub address');
        registryHub = _registryHub;
        executor = _executor;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setRoleAdmin(WHITELIST_MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
    }

    function setExecutor(address _executor) external onlyAdmin {
        require(_executor != address(0), 'Invalid executor hub address');
        executor = _executor;
        emit SetExecutor(_executor);
    }

    function setRegistryHub(address _registryHub) external onlyAdmin {
        require(_registryHub != address(0), 'Invalid registry hub address');
        registryHub = _registryHub;
        emit SetRegistryHub(_registryHub);
    }

    function adminAddWhitelistManager(address _manager) external onlyAdmin {
        require(!hasRole(WHITELIST_MANAGER_ROLE, _manager), "Address already in the whitelist manager group");
        grantRole(WHITELIST_MANAGER_ROLE, _manager);
        emit WhitelistManagerAdded(_manager);
    }

    function adminRemoveWhitelistManager(address _manager) external onlyAdmin {
        require(hasRole(WHITELIST_MANAGER_ROLE, _manager), "Address not in the whitelist manager group");
        revokeRole(WHITELIST_MANAGER_ROLE, _manager);
        emit WhitelistManagerRemoved(_manager);
    }

    function setWhitelist(address _contract) external onlyAdminOrWhitelistManager {
        require(_contract != address(0), 'Invalid contract address');
        whiteList[_contract] = true;
        emit SetWhiteList(_contract);
    }

    function removeWhiteList(address _contract) external onlyAdminOrWhitelistManager {
        require(_contract != address(0), 'Invalid contract address');
        whiteList[_contract] = false;
        emit RemoveWhiteList(_contract);
    }

    function attachPool(bytes32 assetId, address stakingFeast, uint8 pid) external {
        require(whiteList[msg.sender], 'Permission denied: contract not in whitelist');
        bytes32 source = keccak256(abi.encodePacked(stakingFeast, pid, assetId));
        attachedPool[source].stakingFeast = stakingFeast;
        attachedPool[source].pid = pid;
        attachedPool[source].assetId = assetId;

        emit AttachedPool(assetId, stakingFeast, pid);
    }

    function updateBalance(bytes32 source, bytes32 assetId, address account, uint256 amount, string memory bindAccount) override external onlyExecutor {
        // check if the asset is trustless
        require(IRegistryHub(registryHub).isTrustless(assetId), 'Asset is not trustless');
        depositBalance[source][account] = amount;

        // if attached staking pool, update pool
        if (attachedPool[source].stakingFeast != address(0)) {
            bytes memory data = abi.encodeWithSignature(
                "update(uint8,address,uint256,string)",
                attachedPool[source].pid,
                account,
                amount,
                bindAccount
            );
            (bool success,) = attachedPool[source].stakingFeast.call(data);
            require(success, "failed to call stakingFeast::update");
            emit BalanceUpdated(source, assetId, account, amount, bindAccount);
        }
    }

    function getBalance(bytes32 source, address account) override view external returns(uint256) {
        return depositBalance[source][account];
    }
}