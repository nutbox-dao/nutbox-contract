// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @dev Interface of the community token factory.
 */
interface ICommunityTokenFactory {

    function createCommunityToken(bytes calldata meta)
        external
        returns (address);
}