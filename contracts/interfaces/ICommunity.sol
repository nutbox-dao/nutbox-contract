// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

/**
 * @dev Interface of the staking pool.
 * All write functions should have whilist ensured
 */
interface ICommunity {
    function poolActived(address pool) external view returns (bool);

    function getShareAcc(address pool) external view returns (uint256);

    function getCommunityToken() external view returns (address);

    function getUserDebt(address pool, address user)
        external
        view
        returns (uint256);

    function appendUserReward(
        address user,
        uint256 amount
    ) external;

    function setUserDebt(
        address user,
        uint256 debt
    ) external;

    function updatePools(string memory feeType, address feePayer) external;
}
