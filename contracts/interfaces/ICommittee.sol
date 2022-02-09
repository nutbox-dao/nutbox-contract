// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

/**
 * @dev Interface of the committee.
 */
interface ICommittee {
    function setFeePayer(address payer) external;

    function getFee(string memory feeType) external view returns (uint256);

    function getNut() external view returns (address);

    function getTreasury() external view returns (address);

    function getGauge() external view returns (address);

    function updateLedger(
        string memory feeType,
        address community,
        address pool,
        address who
    ) external;

    function getRevenue(string memory feeType) external view returns (uint256);

    function verifyContract(address factory) external view returns (bool);

    function getFeeFree(address freeAddress) external view returns (bool);

    function getPoolFees(address pool) 
            external 
            view 
            returns (uint256);
}
