// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

interface IGauge {
    function updateLedger(address community, address pool, uint256 amount) external;
    function getGaugeRatio() external view returns (uint16);
    function hasGaugeEnabled(address pool) external returns (bool);
}