// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../common/Types.sol';

/**
 * @dev Interface of Bridge.
 */
interface IBridge {
    function getProposal(uint8 chainId, uint64 sequence, bytes32 extrinsicHash) external returns(Types.Proposal memory);
    function voteProposal(uint8 chainId, uint64 sequence, bytes32 extrinsicHash, bytes calldata extrinsic) external;
    function cancelProposal(uint8 chainId, uint64 sequence, bytes32 extrinsicHash) external;
}
