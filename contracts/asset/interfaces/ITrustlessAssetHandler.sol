// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @dev Interface of the Trustless Asset Handler.
 */
interface ITrustlessAssetHandler {
    /**
     * @dev Update balance of account to amount
     *
     * If the asset has binded a staking pool, the pool would be updated at the same time
     */
    function updateBalance(bytes32 source, bytes32 assetId, address account, uint256 amount, bytes32 bindAccount) external;
    function getBalance(bytes32 source, address account) external returns(uint256);
}