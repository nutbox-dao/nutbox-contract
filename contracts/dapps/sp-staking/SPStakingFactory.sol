// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../interfaces/IPoolFactory.sol";
import "./SPStaking.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../CommunityFactory.sol";

/**
 * @dev Factory contract of Nutbox SP/HP staking pool.
 *
 * meta layout: [uint8 chainId (1 byte)][bytes32 delegatee (32 bytes)]
 * Total meta length: 33 bytes
 */
contract SPStakingFactory is IPoolFactory, Ownable {
    address public bridge;
    address public immutable communityFactory;
    address public immutable poolTemplate;

    constructor(address _communityFactory, address _poolTemplate) {
        require(_communityFactory != address(0), "Invalid address");
        require(_poolTemplate != address(0), "Invalid template");
        communityFactory = _communityFactory;
        poolTemplate = _poolTemplate;
    }

    event SPStakingCreated(
        address indexed pool,
        address indexed community,
        string name,
        uint8 chainId,
        bytes32 delegatee
    );

    event BridgeChange(address indexed oldBridge, address indexed newBridge);

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(payable(communityFactory)).createdCommunity(community), "Invalid community");
        require(meta.length >= 33, "Invalid meta length");

        uint8 chainId;
        bytes32 delegatee;
        assembly ("memory-safe") {
            // first byte is chainId
            chainId := shr(248, calldataload(meta.offset))
            // next 32 bytes is delegatee
            delegatee := calldataload(add(meta.offset, 1))
        }

        address clone = Clones.clone(poolTemplate);
        SPStaking pool = SPStaking(payable(clone));
        pool.initialize(community, name, chainId, delegatee);
        emit SPStakingCreated(address(pool), community, name, chainId, delegatee);
        return address(pool);
    }

    function adminSetBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "Invalid address");
        emit BridgeChange(bridge, _bridge);
        bridge = _bridge;
    }
}
