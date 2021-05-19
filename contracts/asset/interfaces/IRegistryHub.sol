// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

/**
 * @dev Interface of the Asset Registry.
 */
interface IRegistryHub {
    function add(address owner, bytes32 id) external;
}
