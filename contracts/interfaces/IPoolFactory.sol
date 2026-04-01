// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @dev Interface of the pool factory.
 */
interface IPoolFactory {
    function createPool(address community, string memory name, bytes calldata meta)
        external
        returns (address);
}
