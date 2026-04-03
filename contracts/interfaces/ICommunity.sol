// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @dev Interface of the community.
 * All write functions should have whitelist ensured
 */
interface ICommunity {
    function poolActived(address pool) external view returns (bool);

    function getShareAcc(address pool) external view returns (uint256);

    function getCommunityToken() external view returns (address);

    function getCommittee() external view returns (address);

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

    function updatePools() external;

    /// @dev Pull this pool's accrued community-token rewards to the caller (must be a pool with stake).
    function withdrawPoolsRewards(
        address[] memory poolAddresses
    ) external payable;
}
