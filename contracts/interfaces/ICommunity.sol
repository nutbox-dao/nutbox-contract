// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

/**
 * @dev Interface of the staking pool.
 * All write functions should have whilist ensured
 */
interface ICommunity {
    function poolActived(address pool) external view returns (bool);

    function getShareAcc(address pool) external view returns (uint256);

    function getUserDebt(address pool, address user)
        external
        view
        returns (uint256);

    function appendUserReward(
        address pool,
        address user,
        uint256 amount
    ) external;

    function setUserDebt(
        address pool,
        address user,
        uint256 debt
    ) external;

    function updatePools(address feePayer) external;

    function getOwner() external view returns (address);
}
