// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @dev Interface of the reward calculator.
 *
 * Clock: each implementation defines a native unit (block height, unix seconds, etc.).
 * `rewardHead()` returns the current chain head in that unit.
 *
 * `calculateReward(staking, lastCursor, head)` sums emissions over the half-open interval
 * (lastCursor, head] — i.e. strictly after `lastCursor` up to and including `head`,
 * interpreted in the same unit as `rewardHead()`.
 */
interface ICalculator {
    /// @notice Current head value in this calculator's native unit (e.g. `block.number` or `block.timestamp`).
    function rewardHead() external view returns (uint256);

    function calculateReward(
        address staking,
        uint256 lastCursor,
        uint256 head
    ) external view returns (uint256);

    function setDistributionEra(address staking, bytes calldata policy)
        external
        returns (bool);

    /// @notice Emission rate for the active era: reward amount per one step of this calculator's clock (one block or one second, etc.).
    function getCurrentRewardRate(address staking) external view returns (uint256);

    /// @notice Start cursor of the first distribution era, in the same unit as `rewardHead()`.
    function getStartCursor(address staking) external view returns (uint256);
}
