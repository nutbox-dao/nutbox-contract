// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import './libraries/Types.sol';
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

    function createStakingFeast (
        NutboxERC20 _rewardToken,
        Types.Distribution[] memory _distributionEras,
        Types.EndowedAccount[] memory _endowedAccounts
    ) public returns(address) {
        require(address(_rewardToken) != address(0), 'Invalid reward token address');
        require(_distributionEras.length > 0, 'Should give at least one distribution');

        address feastAddress;
        bytes memory bytecode = type(StakingTemplate).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(_rewardToken));
        assembly {
            feastAddress := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        StakingTemplate(feastAddress).initialize(
            msg.sender,
            _rewardToken,
            _distributionEras,
            _endowedAccounts
        );

        emit StakingFeastCreated(msg.sender, feastAddress, address(_rewardToken));
        return feastAddress;
    }

    function setFeeAddress(address _feeAddress) public {
        require(msg.sender == feeAddress, 'Permission denied to set fee address');
        feeAddress = _feeAddress;
    }

}
