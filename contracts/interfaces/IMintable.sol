// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @dev Minimal interface for mintable ERC20 tokens used by ERC20Helper.
 * Replaces the deprecated ERC20PresetMinterPauser dependency.
 */
interface IMintable {
    function mint(address to, uint256 amount) external;
}
