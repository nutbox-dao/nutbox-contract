// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '../MintableERC20.sol';
import '../common/Types.sol';
import './StakingTemplate.sol';
import '../NoDelegateCall.sol';

/**
 * @dev Factory contract to create an StakingTemplate entity
 *
 * This is the entry contract that user start to create their own staking economy.
 */
contract StakingFactory is NoDelegateCall {

    address public registryHub;
    address public feeAddress;

    // owner => stakingFeastList
    mapping (address => address[]) public stakingFeastRecord;
    // owner => counter
    mapping (address => uint8) public stakingFeastCounter;

    event StakingFeastCreated(address indexed creater, address stakingFeast, bytes32 rewardAsset);

    constructor(address _registryHub, address _feeAddress) {
        registryHub = _registryHub;
        feeAddress = _feeAddress;
    }

    // only owner of reward token can call this method
    function createStakingFeast (
        bytes32 _rewardAsset,
        Types.Distribution[] memory _distributionEras
    ) public noDelegateCall {
        require(_distributionEras.length > 0, 'Should give at least one distribution');
        
        address tokenAddress = IRegistryHub(registryHub).getHomeLocation(_rewardAsset);
        require(tokenAddress != address(0), 'Reward asset is not registered');

        StakingTemplate feastAddress = new StakingTemplate(registryHub);

        if (IRegistryHub(registryHub).mintable(_rewardAsset)) {
            // grant MINTER_ROLE to staking feast contract
            bytes32 MINTER_ROLE = MintableERC20(tokenAddress).MINTER_ROLE();
            (bool success, ) = tokenAddress.delegatecall(
                abi.encodeWithSignature("grantRole(bytes32,address)", MINTER_ROLE, address(feastAddress))
            );
            require(success, 'Failed to grant mint role for staking feast');
        }

        feastAddress.initialize(
            msg.sender,
            _rewardAsset,
            _distributionEras
        );

        // add feast into whitelist of ERC20AssetHandler
        bytes memory data = abi.encodeWithSignature(
            "setWhitelist(address)",
            feastAddress
        );
        (bool success1,) = IRegistryHub(registryHub).getERC20AssetHandler().call(data);
        require(success1, "failed to call ERC20AssetHandler.setWhitelist");

        // add feast into whitelist of TrustlessAssetHandler
        (bool success2,) = IRegistryHub(registryHub).getTrustlessAssetHandler().call(data);
        require(success2, "failed to call TrustlessAssetHandler.setWhitelist");

        // TODO: add feast into whitelist of ERC721AssetHandler

        // save record
        stakingFeastRecord[msg.sender].push(address(feastAddress));
        stakingFeastCounter[msg.sender] = stakingFeastCounter[msg.sender] + 1;

        emit StakingFeastCreated(msg.sender, address(feastAddress), _rewardAsset);
    }

    function setFeeAddress(address _feeAddress) public {
        require(msg.sender == feeAddress, 'Permission denied to set fee address');
        feeAddress = _feeAddress;
    }

}
