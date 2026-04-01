// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @dev Interface of the committee.
 */
interface ICommittee {
    function getFeeRecipient() external view returns (address payable);

    function getCreateCommunityFee() external view returns (uint256);

    function getCommunitySettingsFee() external view returns (uint256);

    function getPoolOperationFee() external view returns (uint256);

    function verifyContract(address factory) external view returns (bool);

    function getFeeFree(address freeAddress) external view returns (bool);
}
