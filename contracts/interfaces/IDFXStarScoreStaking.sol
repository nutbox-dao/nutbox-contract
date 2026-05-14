// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IDFXStarScoreStaking {
    function depositFromGame(address user, uint256 amount) external payable;

    function injectRewards(uint256 amount) external payable;

    function claimExternalRewards() external payable;

    function getPendingExternalRewards(
        address user
    ) external view returns (uint256);

    function getPendingCommunityRewards(
        address user
    ) external view returns (uint256);

    function getPendingAllRewards(
        address user
    ) external view returns (uint256 communityPending, uint256 externalPending);
}
