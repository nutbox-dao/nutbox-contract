// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

interface IDappToolkit {
    function updateLedger(address community, address pool, uint256 amount) external;
    function getDappToolsRatio() external view returns (uint256);
    function toolCreated(address pool) external returns (bool);
}