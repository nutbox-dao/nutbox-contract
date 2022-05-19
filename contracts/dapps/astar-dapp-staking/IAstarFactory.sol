// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IAstarFactory {
    function delegateDappsStakingContract() external view returns (address);
}
