// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "../../interfaces/IPoolFactory.sol";
import "./ERC1155Staking.sol";
import "../../CommunityFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Factory contract of Nutbox ERC1155 staking pool.
 *
 * meta layout: [address stakeToken (20 bytes)][uint256 tokenId (32 bytes)]
 * Total meta length: 52 bytes
 */
contract ERC1155StakingFactory is IPoolFactory, Ownable {
    address public immutable communityFactory;

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
    }

    event ERC1155StakingCreated(
        address indexed pool,
        address indexed community,
        string name,
        address indexed erc1155Token,
        uint256 id
    );

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        require(meta.length >= 52, "Invalid meta length");

        address stakeToken;
        uint256 id;
        assembly ("memory-safe") {
            stakeToken := shr(96, calldataload(meta.offset))
            id := calldataload(add(meta.offset, 20))
        }

        ERC1155Staking pool = new ERC1155Staking(community, name, stakeToken, id);
        emit ERC1155StakingCreated(address(pool), community, name, stakeToken, id);
        return address(pool);
    }
}
