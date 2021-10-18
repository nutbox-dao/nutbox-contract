// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../MintableERC20.sol";
import "../SimpleERC20.sol";
import '../asset/interfaces/IRegistryHub.sol';

/**
 * @dev Factory contract to create an ERC20 entity
 *
 * This is the entry contract that user start to create their own token.
 */
contract ERC20Factory {
    address public registryHub;

    // address => isMintable
    mapping (address => bool) public mintableList;

    // address => isNonMintable
    mapping (address => bool) public nonMintableList;

    // all tokens
    address[] public allTokens;
    uint64 public allTokensCount;

    event ERC20TokenCreated(address indexed creator, string tokenName, string tokenSymbol, address indexed tokenAddress,bool isMintable);

    constructor(address _registryHub) {
        registryHub = _registryHub;
    }

    function createERC20 (
        string memory name, 
        string memory symbol, 
        uint256 initialSupply,
        address owner,
        bool isMintable
    ) public returns(address){
        if (isMintable){
            MintableERC20 mintableERC20 = new MintableERC20(name, symbol, initialSupply, owner);
            mintableList[address(mintableERC20)] = true;
            allTokens.push(address(mintableERC20));
            allTokensCount += 1;
            bytes32 MINTER_ROLE = mintableERC20.MINTER_ROLE();
            (bool success, ) = address(mintableERC20).call(
                abi.encodeWithSignature("grantRole(bytes32,address)", MINTER_ROLE, IRegistryHub(registryHub).getERC20AssetHandler())
            );
            require(success, 'Failed to grant mint role for staking feast');

            bytes32 assetId = keccak256(abi.encodePacked(bytes(""), address(mintableERC20)));

            bytes memory setMintableData = abi.encodeWithSignature(
                "setMintable(bytes32)",
                assetId
            );
            (bool setMintableResult,) = registryHub.call(setMintableData);
            require(setMintableResult, "failed to call set mintable asset");
            emit ERC20TokenCreated(msg.sender, name, symbol, address(mintableERC20), true);
            return address(mintableERC20);
        } else {
            SimpleERC20 simpleERC20 = new SimpleERC20(name, symbol, initialSupply, owner);
            nonMintableList[address(simpleERC20)] = true;
            allTokens.push(address(simpleERC20));
            allTokensCount += 1;
            emit ERC20TokenCreated(msg.sender, name, symbol, address(simpleERC20), false);
            return address(simpleERC20);
        } 
    }
}