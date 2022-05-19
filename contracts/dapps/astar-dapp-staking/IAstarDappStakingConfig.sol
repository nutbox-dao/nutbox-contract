// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IAstarDappStakingConfig {
    
    /**
    @notice The factor by which the molecule is magnified. default: 10^18
    */
    function precision() external view returns (uint256);

    /**
    @notice Minimum stake amount
    */
    function minimumStake() external view returns (uint256);

}
