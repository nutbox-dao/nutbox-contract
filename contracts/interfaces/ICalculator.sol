// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

/**
 * @dev Interface of the reward calculator.
 */
interface ICalculator {
    function calculateReward(
        address staking,
        uint256 from,
        uint256 to
    ) external view returns (uint256);

    function setDistributionEra(address staking, bytes calldata policy)
        external
        returns (bool);

    function getCurrentRewardPerBlock(address staking)
        external
        returns (uint256);

    function getStartBlock(address staking)
        external
        returns (uint256);
}
