// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @dev Interface of proposal executor.
 */
interface IExecutor {
    function executeProposal(bytes calldata extrinsic) external;
}
