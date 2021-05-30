// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @dev Interface of the Trust Asset Handler.
 */
interface ITrustAssetHandler {
    /**
     * @dev Lock or Burn asset
     *
     * If the asset is mintable, we burn it from depositer
     * If the asset is not mintable, we lock it into from depositer
     */
    function lockOrBurnAsset(bytes32 source, bytes32 assetId, address depositer, uint256 amount) external;

    /**
     * @dev Unlock or Mint asset
     *
     * If the asset is mintable, we mint amount of token to recipient
     * If the asset is not mintable, we unlock amounty of token to recipient
     */
    function unlockOrMintAsset(bytes32 source, bytes32 assetId, address recipient, uint256 amount) external;
}

