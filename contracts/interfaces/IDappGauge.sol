// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

interface IDappGauge {
    function updateLedger(address community, address pool, uint256 amount) external;
    function getGaugesRatio() external view returns (uint256);
    function gaugeCreated(address pool) external returns (bool);
}