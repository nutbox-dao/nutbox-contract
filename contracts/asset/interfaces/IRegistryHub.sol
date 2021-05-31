// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @dev Interface of the Asset Registry.
 */
interface IRegistryHub {
    function add(address owner, bytes32 id, address homeLocation, bytes memory foreignLocation, bool trustless) external;
    function setMintable(bytes32 id) external;
    function mintable(bytes32 id) external returns(bool);
    function isTrustless(bytes32 id) external returns(bool);
    function getHomeLocation(bytes32 id) external returns(address);
    function getForeignLocation(bytes32 id) external returns(bytes memory);

    function getERC20AssetHandler() external returns(address);
    function getERC721AssetHandler() external returns(address);
    function getTrustlessAssetHandler() external returns(address);
}
