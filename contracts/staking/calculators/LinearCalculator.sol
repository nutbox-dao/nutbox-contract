// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import './ICalculator.sol';
import '../../common/Types.sol';

contract LinearCalculator is ICalculator, Ownable {

    using SafeMath for uint256;

    uint8 constant MAX_DISTRIBUTIONS = 6;
    address admin;
    address factory;
    mapping (address => Types.Distribution[]) public distributionErasMap;
    mapping (address => uint8) public distributionCountMap;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Account is not the admin");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Account is not the staking factory");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function adminSetStakingFactory(address _factory) onlyAdmin public {
        factory = _factory;
    }

    function setDistributionEra(address staking, Types.Distribution[] memory _distributionEras) onlyFactory public override returns(bool) {
        _applyDistributionEras(staking, _distributionEras);
        return true;
    }

    function calculateReward(address staking, uint256 from, uint256 to) public view override returns(uint256) {
        uint256 rewardedBlock = from - 1;
        uint256 rewards = 0;
        Types.Distribution[] memory eras = distributionErasMap[staking];

        if (eras.length == 0 || block.number <= eras[0].startHeight) {
            return rewards;
        }
        if (rewardedBlock < eras[0].startHeight){
            rewardedBlock = eras[0].startHeight - 1;
        }

        for (uint8 i = 0; i < eras.length; i++) {
            if (rewardedBlock > eras[i].stopHeight){
                continue;
            }

            if (to <= eras[i].stopHeight) {
                rewards = rewards.add(to.sub(rewardedBlock).mul(eras[i].amount));
                return rewards;
            } else {
                rewards = rewards.add(eras[i].stopHeight.sub(rewardedBlock).mul(eras[i].amount));
                rewardedBlock = eras[i].stopHeight;
            }
        }
        return rewards;
    }
    
    function getCurrentRewardPerBlock(address staking) public view override return (uint256) {
        return getCurrentDistributionEra(staking).amount;
    }

    function getCurrentDistributionEra(address staking) public view returns (Types.Distribution memory) {
        Types.Distribution[] memory eras = distributionErasMap[staking];
        for(uint8 i = 0; i < distributionCountMap[staking]; i++) {
            if (block.number >= eras[i].startHeight && block.number <= eras[i].stopHeight) {
                return eras[i];
            }
        }
    }

    /**
     * @dev Check and set distribution policy
     * _distributionEras must less than or equal to MAX_DISTRIBUTIONS and all distribution should meet following condidtion: 
     * 1) amount should greater than 0
     * 2) first distrubtion startHeight should greater than current block height
     * 3) startHeight shold less than stopHeight
     */
    function _applyDistributionEras(address staking, Types.Distribution[] memory _distributionEras) private {
        require(_distributionEras.length <= MAX_DISTRIBUTIONS, 'Too many distribution policy');

        // prechek
        for(uint8 i = 0; i < _distributionEras.length; i++) {
            // check 1)
            require(_distributionEras[i].amount > 0, 'Invalid reward amount of distribution, consider giving a positive integer');
            // check 2)
            if (i == 0) {
                require(_distributionEras[i].startHeight > block.number, 'Invalid start height of distribution');
            }
            // check 3)
            require(_distributionEras[i].startHeight < _distributionEras[i].stopHeight, 'Invalid stop height of distribution');
        }

        // set distribution policy
        for(uint8 i = 0; i < _distributionEras.length; i++) {
            distributionErasMap[staking].push(_distributionEras[i]);
            distributionCountMap[staking] = distributionCountMap[staking] + 1;
        }
    }
}
