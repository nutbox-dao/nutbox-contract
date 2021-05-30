// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @dev Interface of the Asset Registry.
 */
interface IAssetRegistry {
    // foreignLocation and homeLocation(if not address(0)) should not have been registered;
    // properties handled by specific registry contract
    function registerAsset(
        bytes memory foreignLocation,
        address homeLocation,
        bytes memory properties
    ) external;
}
