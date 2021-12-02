// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../../interfaces/IPoolFactory.sol";
import "./SPStaking.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";

/**
 * @dev Factory contract of Nutbox ERC20 staking pool.
 *x
 */
contract SPStakingFactory is IPoolFactory, Ownable {
    using BytesLib for bytes;
    address public bridge;

    constructor() {
    }

    event SPStakingCreated(
        address indexed pool,
        address indexed community,
        uint8 chainId,
        bytes32 delegatee
    );

    function createPool(address community, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        uint8 chainId = meta.toUint8(0);
        bytes32 delegatee = meta.toBytes32(1);
        SPStaking pool = new SPStaking(community, chainId, delegatee);
        emit SPStakingCreated(address(pool), community, chainId, delegatee);
        return address(pool);
    }

    function adminSetBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "Invalid address");
        bridge = _bridge;
    }
}