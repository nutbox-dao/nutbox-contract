// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../../interfaces/IPoolFactory.sol";
import "./SPStaking.sol";

/**
 * @dev Factory contract of Nutbox ERC20 staking pool.
 *x
 */
contract SPStakingFactory is IPoolFactory {

    constructor() {
    }

    event SPStakingCreated(
        address indexed pool,
        address indexed community
    );

    function createPool(address community, bytes calldata meta) override external returns(address) {
        require(ICommunity(community).getOwner() == tx.origin, 'Permission denied: caller is not the admin of community');
        SPStaking pool = new SPStaking(community);
        emit SPStakingCreated(address(pool), community);
        return address(pool);
    }
}
