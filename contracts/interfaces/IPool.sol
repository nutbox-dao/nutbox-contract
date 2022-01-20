// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

/**
 * @dev Interface of the staking pool.
 */
interface IPool {
    function getFactory() external view returns (address);

    function getUserStakedAmount(address user) external view returns (uint256);

    function getTotalStakedAmount() external view returns (uint256);
}
