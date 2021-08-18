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

    // all ERC20 token deployed by this factory
    address[] tokenAddresses;
    // all ERC20 token count
    uint16 tokenCount;

    event CreateNewERC20(address creator, string tokenName, string tokenSymbol, address tokenAddress,bool isMintable);

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
            tokenAddresses.push(address(mintableERC20));
            mintableList[address(mintableERC20)] = true;
            bytes32 MINTER_ROLE = mintableERC20.MINTER_ROLE();
            (bool success, ) = address(mintableERC20).call(
                abi.encodeWithSignature("grantRole(bytes32,address)", MINTER_ROLE, IRegistryHub(registryHub).getERC20AssetHandler())
            );
            require(success, 'Failed to grant mint role for staking feast');
            emit CreateNewERC20(msg.sender, name, symbol, address(mintableERC20), true);
            tokenCount += 1;
            return address(mintableERC20);
        }else{
            SimpleERC20 simpleERC20 = new SimpleERC20(name, symbol, initialSupply, owner);
            tokenAddresses.push(address(simpleERC20));
            emit CreateNewERC20(msg.sender, name, symbol, address(simpleERC20), false);
            tokenCount += 1;
            return address(simpleERC20);
        } 
    }
}