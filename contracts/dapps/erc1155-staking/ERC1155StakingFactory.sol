// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "solidity-bytes-utils/contracts/BytesLib.sol";
import "../../interfaces/IPoolFactory.sol";
import "./ERC1155Staking.sol";
import "../../CommunityFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Factory contract of Nutbox ERC1155 staking pool.
 *x
 */
contract ERC1155StakingFactory is IPoolFactory, Ownable {
    using BytesLib for bytes;
    address public immutable communityFactory;
    uint256 private transFee = 0.00001 ether;

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

    function getFeeInfo() public override view returns (address, uint256) {
        return (owner(), transFee);
    }

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        address stakeToken = meta.toAddress(0);
        uint256 id = meta.toUint256(20);
        ERC1155Staking pool = new ERC1155Staking(community, name, stakeToken, id);
        emit ERC1155StakingCreated(address(pool), community, name, stakeToken, id);
        return address(pool);
    }
}
