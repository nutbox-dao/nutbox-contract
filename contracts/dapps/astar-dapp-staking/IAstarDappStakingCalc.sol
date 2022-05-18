// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IAstarDappStakingCalc {
    /**
    @notice Get the reward of a single token of the specified era
    @param era the specified era id.
    @return uint256, returns the number of rewards for a single token (The return value is multiplied by 10^18)
    */
    function calcRewardByEra(uint32 era) external returns (uint256);

    /**
    @notice The factor by which the molecule is magnified. default: 10^18
    */
    function precision() external view returns (uint256);

    /**
    @notice Minimum stake amount
    */
    function minimumStake() external view returns (uint256);

    /**
    @notice The maximum number of participants per dapp.
    */
    function maximumStakers() external view returns (uint256);
}
