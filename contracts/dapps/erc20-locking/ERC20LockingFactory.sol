// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "../../interfaces/IPoolFactory.sol";
import "./ERC20Locking.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "../../CommunityFactory.sol";

/**
 * @dev Factory contract of Nutbox ERC20 locking pool.
 *      Deploys ERC20Locking implementation once for EIP-1167 clones.
 *
 * meta layout: [address stakeToken (20 bytes)][uint256 lockDuration (32 bytes)]
 * Total meta length: 52 bytes
 */
contract ERC20LockingFactory is IPoolFactory {
    address public immutable communityFactory;
    address public immutable poolTemplate;

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
        poolTemplate = address(new ERC20Locking());
    }

    event ERC20LockingCreated(
        address indexed pool,
        address indexed community,
        string name,
        address erc20Token,
        uint256 lockDuration
    );

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(payable(communityFactory)).createdCommunity(community), "Invalid community");
        require(meta.length >= 52, "Invalid meta length");

        address stakeToken;
        uint256 lockDuration;
        assembly ("memory-safe") {
            stakeToken := shr(96, calldataload(meta.offset))
            lockDuration := calldataload(add(meta.offset, 20))
        }

        require(lockDuration > 0, "Lock duration must be > 0");

        address clone = Clones.clone(poolTemplate);
        ERC20Locking pool = ERC20Locking(payable(clone));
        pool.initialize(community, name, stakeToken, lockDuration);
        emit ERC20LockingCreated(address(pool), community, name, stakeToken, lockDuration);
        return address(pool);
    }
}
