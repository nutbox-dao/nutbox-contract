// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "solidity-bytes-utils/contracts/BytesLib.sol";
import "../../interfaces/IPoolFactory.sol";
import "./ERC20Staking.sol";

/**
 * @dev Factory contract of Nutbox ERC20 staking pool.
 *x
 */
contract ERC20StakingFactory is IPoolFactory {
    using BytesLib for bytes;

    constructor() {
    }

    event ERC20StakingCreated(
        address indexed pool,
        address indexed community,
        string name,
        address erc20Token
    );

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        bytes memory stakeTokenBytes = meta.slice(0, 20);
        bytes20 stakeToken;
        assembly {
            stakeToken := mload(add(stakeTokenBytes, 0x20))
        }
        ERC20Staking pool = new ERC20Staking(community, name, address(stakeToken));
        emit ERC20StakingCreated(address(pool), community, name, address(stakeToken));
        return address(pool);
    }
}
