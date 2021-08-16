// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @dev Interface of the Trust Asset Handler.
 */
interface ITrustAssetHandler {
    /**
     * @dev Lock or Burn asset
     *
     * Lock asset into from depositer
     */
    function lockAsset(bytes32 source, bytes32 assetId, address depositer, uint256 amount) external;

    /**
     * @dev Unlock or Mint asset
     *
     * Unlock amount of token to recipient
     */
    function unlockAsset(bytes32 source, bytes32 assetId, address recipient, uint256 amount) external;
}

