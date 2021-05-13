// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import '../common/Types.sol';
import './StakingTemplate.sol';

/**
 * @dev Factory contract to create an StakingTemplate entity
 *
 * This is the entry contract that user start to create their own staking economy.
 */
contract StakingFactory {

    address public feeAddress;

    event StakingFeastCreated(address indexed creater, address stakingFeast, address rewardToken);

    constructor(address _feeAddress) {
        feeAddress = _feeAddress;
    }

    // only owner of reward token can call this method
    function createStakingFeast (
        address _rewardToken,
        Types.Distribution[] memory _distributionEras
    ) public {
        require(address(_rewardToken) != address(0), 'Invalid reward token address');
        require(_distributionEras.length > 0, 'Should give at least one distribution');

        StakingTemplate feastAddress = new StakingTemplate();
        // transfer ownership from user to staking contract so that token can be minted by contract
        (bool success, ) = address(_rewardToken).delegatecall(abi.encodeWithSignature("transferOwnership(address)", address(feastAddress)));
        
        feastAddress.initialize(
            msg.sender,
            _rewardToken,
            _distributionEras
        );

        emit StakingFeastCreated(msg.sender, address(feastAddress), address(_rewardToken));
    }

    function setFeeAddress(address _feeAddress) public {
        require(msg.sender == feeAddress, 'Permission denied to set fee address');
        feeAddress = _feeAddress;
    }

}
