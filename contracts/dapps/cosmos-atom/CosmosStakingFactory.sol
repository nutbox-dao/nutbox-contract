// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "../../interfaces/IPoolFactory.sol";
import "./CosmosStaking.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import "../../CommunityFactory.sol";

/**
 * @dev Factory contract of Nutbox cosmos delegate pool.
 * Like the sp delegate, we use update method to update user's total delegate amount of the validator
 *x
 */
contract CosmosStakingFactory is IPoolFactory, Ownable {
    using BytesLib for bytes;
    // chain id => user address => is bridge
    // every chain has it's own bridge accounts
    mapping (uint8 => mapping(address => bool)) public isBridge;
    address public immutable communityFactory;

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
    }

    event CosmosStakingCreated(
        address indexed pool,
        address indexed community,
        string name,
        uint8 chainId,
        address delegatee
    );

    event AdminAddBridge(uint8 indexed chainId, address indexed bridge);
    event AdminRemoveBridge(uint8 indexed chainId, address indexed bridge);

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        uint8 chainId = meta.toUint8(0);  // cosmos-hub: 3
        address delegatee = meta.toAddress(1);
        CosmosStaking pool = new CosmosStaking(community, name, chainId, delegatee);
        emit CosmosStakingCreated(address(pool), community, name, chainId, delegatee);
        return address(pool);
    }

    function adminAddBridge(uint8 _chainId, address _bridge) external onlyOwner {
        require(_bridge != address(0), "Invalid address");
        isBridge[_chainId][_bridge] = true;
        emit AdminAddBridge(_chainId, _bridge);
    }

    function adminRemoveBridge(uint8 _chainId, address _bridge) external onlyOwner {
        require(_bridge != address(0), "Invalid address");
        isBridge[_chainId][_bridge] = false;
        emit AdminRemoveBridge(_chainId, _bridge);
    }
}
