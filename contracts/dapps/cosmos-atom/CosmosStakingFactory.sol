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
    address public bridge;
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

    event BridgeChange(address indexed oldBridge, address indexed newBridge);

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        uint8 chainId = meta.toUint8(0);  // cosmos-hub: 3
        address delegatee = meta.toAddress(1);
        CosmosStaking pool = new CosmosStaking(community, name, chainId, delegatee);
        emit CosmosStakingCreated(address(pool), community, name, chainId, delegatee);
        return address(pool);
    }

    function adminSetBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "Invalid address");
        emit BridgeChange(bridge, _bridge);
        bridge = _bridge;
    }
}
