// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import './ICalculator.sol';
import '../../common/Types.sol';
import '../../common/libraries/BytesLib.sol';

/**
 * LinearCalculator is a distribution mechanism that people can set a reward on specific blocks height.
 *
 * Spec:
 *     length: uint8, distribution eras length
 *     eras[0]
 *     eras[1]
 *     ...
 *     eras[n]
 *     Era:
 *         uint256: startHeight,
 *         uint256: stopHeight,
 *         uint256: amount
 */
contract LinearCalculator is ICalculator, Ownable {

    using SafeMath for uint256;
    using BytesLib for bytes;

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

    function setDistributionEra(address staking, bytes calldata policy) onlyFactory public override returns(bool) {
        _applyDistributionEras(staking, policy);
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
    
    function getCurrentRewardPerBlock(address staking) public view override returns (uint256) {
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
     * All distribution should meet following condidtion: 
     * 1) amount should greater than 0
     * 2) first distrubtion startHeight should greater than current block height
     * 3) startHeight shold less than stopHeight
     */
    function _applyDistributionEras(address staking, bytes calldata policy) private {
        uint8 erasLength = policy.toUint8(0);
        require(erasLength >= 1, 'At least one distribution era is needed');

        uint8 index = 1;
        for(uint8 i = 0; i < erasLength; i++) {
            uint256 start = policy.toUint256(index);
            index = index + 32;
            uint256 stop = policy.toUint256(index);
            index = index + 32;
            uint256 amount = policy.toUint256(index);

            // check 1)
            require(amount > 0, 'Invalid reward amount of distribution, consider giving a positive integer');
            // check 2)
            if (i == 0) {
                require(start > block.number, 'Invalid start height of distribution');
            }
            // check 3)
            require(start < stop, 'Invalid stop height of distribution');
            // set distribution policy
            distributionErasMap[staking].push(Types.Distribution ({
                startHeight: start,
                stopHeight: stop,
                amount: amount
            }));
            distributionCountMap[staking] = distributionCountMap[staking] + 1;
        }
    }
}
