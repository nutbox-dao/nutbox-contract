// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "../../interfaces/IPoolFactory.sol";
import "./ERC20Staking.sol";
import "../../CommunityFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Factory contract of Nutbox ERC20 staking pool.
 */
contract ERC20StakingFactory is IPoolFactory, Ownable {
    address public immutable communityFactory;

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
    }

    event ERC20StakingCreated(
        address indexed pool,
        address indexed community,
        string name,
        address erc20Token
    );

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        require(meta.length >= 20, "Invalid meta length");

        address stakeToken;
        assembly ("memory-safe") {
            stakeToken := shr(96, calldataload(meta.offset))
        }

        ERC20Staking pool = new ERC20Staking(community, name, stakeToken);
        emit ERC20StakingCreated(address(pool), community, name, stakeToken);
        return address(pool);
    }
}
