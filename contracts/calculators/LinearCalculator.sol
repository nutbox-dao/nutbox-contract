// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import '../interfaces/ICalculator.sol';
import "@openzeppelin/contracts/access/Ownable2Step.sol";

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
contract LinearCalculator is ICalculator {
    struct Distribution {
        // rewards per block of this distribution.
        uint256 amount;
        // when current block height > startHeight, distribution was enabled.
        uint256 startHeight;
        // when curent block height > stopHeight, distribution was disabled
        uint256 stopHeight;
    }



    address immutable communityFactory;
    mapping (address => Distribution[]) public distributionErasMap;
    mapping (address => uint8) public distributionCountMap;

    event DistributionEraSet(address indexed community, bytes policy);

    modifier onlyFactory() {
        require(msg.sender == communityFactory, "Account is not the community factory");
        _;
    }

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
    }

    function setDistributionEra(address community, bytes calldata policy) onlyFactory external override returns(bool) {
        require(community != address(0), 'Invalid address');
        require(distributionErasMap[community].length == 0, 'Already initialized');
        _applyDistributionEras(community, policy);
        emit DistributionEraSet(community, policy);
        return true;
    }



    function calculateReward(address community, uint256 from, uint256 to) external view override returns(uint256) {
        uint256 rewardedBlock = from - 1;
        uint256 rewards = 0;
        Distribution[] memory eras = distributionErasMap[community];

        if (eras.length == 0 || block.number <= eras[0].startHeight) {
            return rewards;
        }
        if (rewardedBlock < eras[0].startHeight){
            rewardedBlock = eras[0].startHeight - 1;
        }

        for (uint256 i = 0; i < eras.length; i++) {
            if (rewardedBlock > eras[i].stopHeight){
                continue;
            }

            // Fast-forward rewardedBlock if it's lagging behind the current era's start
            if (rewardedBlock < eras[i].startHeight - 1) {
                rewardedBlock = eras[i].startHeight - 1;
            }
            
            // If the query ends completely inside a gap before this era starts, stop calculation
            if (to <= rewardedBlock) {
                return rewards;
            }

            if (to <= eras[i].stopHeight) {
                rewards = rewards + (to - rewardedBlock) * eras[i].amount;
                return rewards;
            } else {
                rewards = rewards + (eras[i].stopHeight - rewardedBlock) * eras[i].amount;
                rewardedBlock = eras[i].stopHeight;
            }
        }
        return rewards;
    }
    
    function getCurrentRewardPerBlock(address community) external view override returns (uint256) {
        return getCurrentDistributionEra(community).amount;
    }

    function getCurrentDistributionEra(address community) public view returns (Distribution memory era) {
        Distribution[] memory eras = distributionErasMap[community];
        for(uint256 i = 0; i < distributionCountMap[community]; i++) {
            if (block.number >= eras[i].startHeight && block.number <= eras[i].stopHeight) {
                era = eras[i];
                return era;
            }
        }
    }
    
    function getStartBlock(address community) external view override returns (uint256) {
        return distributionErasMap[community][0].startHeight;
    }

    /**
     * @dev Check and set distribution policy
     * policy layout: [uint8 erasLength][uint256 start, uint256 stop, uint256 amount]...
     * Total: 1 + erasLength * 96 bytes
     */
    function _applyDistributionEras(address community, bytes calldata policy) private {
        require(policy.length >= 1, "Empty policy");
        
        uint8 erasLength;
        assembly ("memory-safe") {
            erasLength := shr(248, calldataload(policy.offset))
        }
        require(erasLength >= 1, 'At least one distribution era is needed');
        require(policy.length >= 1 + uint256(erasLength) * 96, 'Policy too short');

        uint256 offset = 1;
        for(uint256 i = 0; i < erasLength; i++) {
            uint256 start;
            uint256 stopHeight;
            uint256 amount;
            assembly ("memory-safe") {
                start := calldataload(add(policy.offset, offset))
                stopHeight := calldataload(add(policy.offset, add(offset, 32)))
                amount := calldataload(add(policy.offset, add(offset, 64)))
            }
            offset += 96;

            // check 1)
            require(amount > 0, 'Invalid reward amount of distribution, consider giving a positive integer');
            // check 2)
            if (i == 0) {
                require(start > block.number, 'Invalid start height of distribution');
            } else {
                // Ensure eras strictly follow sequentially to avoid overlap inconsistencies
                require(start > distributionErasMap[community][i-1].stopHeight, 'Subsequent eras must start after previous era ends');
            }
            // check 3)
            require(start < stopHeight, 'Invalid stop height of distribution');
            // set distribution policy
            distributionErasMap[community].push(Distribution ({
                startHeight: start,
                stopHeight: stopHeight,
                amount: amount
            }));
            distributionCountMap[community] = distributionCountMap[community] + 1;
        }
    }
}
