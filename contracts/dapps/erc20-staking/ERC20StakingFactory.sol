// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "../../interfaces/IPoolFactory.sol";
import "./ERC20Staking.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "../../CommunityFactory.sol";

/**
 * @dev Factory contract of Nutbox ERC20 staking pool.
 *      Deploys the ERC20Staking implementation once in the constructor for EIP-1167 clones.
 */
contract ERC20StakingFactory is IPoolFactory {
    address public immutable communityFactory;
    address public immutable poolTemplate;

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
        // Implementation is locked by ERC20Staking's constructor (_disableInitializers); clones call initialize.
        poolTemplate = address(new ERC20Staking());
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

        address clone = Clones.clone(poolTemplate);
        ERC20Staking pool = ERC20Staking(payable(clone));
        pool.initialize(community, name, stakeToken);
        emit ERC20StakingCreated(address(pool), community, name, stakeToken);
        return address(pool);
    }
}
