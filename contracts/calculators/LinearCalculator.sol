// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import '../interfaces/ICalculator.sol';

/**
 * @title LinearCalculator (block clock)
 * @dev Linear emission; policy encodes eras as `(startCursor, stopCursor, amount)` in **block height**;
 *      `amount` is rewards per block. Same cursor domain as `rewardHead() == block.number`.
 */
contract LinearCalculator is ICalculator {
    struct Distribution {
        /// @dev Rewards emitted for each block step in this era.
        uint256 amount;
        /// @dev Inclusive era start cursor (block height).
        uint256 startCursor;
        /// @dev Inclusive era end cursor (block height).
        uint256 stopCursor;
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

    /// @inheritdoc ICalculator
    function rewardHead() external view override returns (uint256) {
        return block.number;
    }

    function setDistributionEra(address community, bytes calldata policy) onlyFactory external override returns(bool) {
        require(community != address(0), 'Invalid address');
        require(distributionErasMap[community].length == 0, 'Already initialized');
        _applyDistributionEras(community, policy);
        emit DistributionEraSet(community, policy);
        return true;
    }



    /// @inheritdoc ICalculator
    /// @param lastCursor Last block cursor already fully settled by `Community` (0 = not started).
    /// @param head Current block cursor upper bound (`rewardHead()` / `block.number`).
    function calculateReward(address community, uint256 lastCursor, uint256 head) external view override returns (uint256) {
        // Last cursor credited before the open end of (lastCursor, head]
        uint256 rewardedCursor = lastCursor;
        uint256 rewards = 0;
        Distribution[] memory eras = distributionErasMap[community];

        if (eras.length == 0 || block.number <= eras[0].startCursor) {
            return rewards;
        }
        if (rewardedCursor < eras[0].startCursor) {
            rewardedCursor = eras[0].startCursor - 1;
        }

        for (uint256 i = 0; i < eras.length; i++) {
            if (rewardedCursor > eras[i].stopCursor) {
                continue;
            }

            if (rewardedCursor < eras[i].startCursor - 1) {
                rewardedCursor = eras[i].startCursor - 1;
            }

            if (head <= rewardedCursor) {
                return rewards;
            }

            if (head <= eras[i].stopCursor) {
                rewards = rewards + (head - rewardedCursor) * eras[i].amount;
                return rewards;
            } else {
                rewards = rewards + (eras[i].stopCursor - rewardedCursor) * eras[i].amount;
                rewardedCursor = eras[i].stopCursor;
            }
        }
        return rewards;
    }

    /// @inheritdoc ICalculator
    function getCurrentRewardRate(address community) external view override returns (uint256) {
        return getCurrentDistributionEra(community).amount;
    }

    function getCurrentDistributionEra(address community) public view returns (Distribution memory era) {
        Distribution[] memory eras = distributionErasMap[community];
        for (uint256 i = 0; i < distributionCountMap[community]; i++) {
            if (block.number >= eras[i].startCursor && block.number <= eras[i].stopCursor) {
                era = eras[i];
                return era;
            }
        }
    }

    /// @inheritdoc ICalculator
    function getStartCursor(address community) external view override returns (uint256) {
        return distributionErasMap[community][0].startCursor;
    }

    /**
     * @dev Policy: [uint8 erasLength][uint256 startCursor, uint256 stopCursor, uint256 amount]...
     * Cursors are block heights; `amount` is per block. Total: 1 + erasLength * 96 bytes.
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
        for (uint256 i = 0; i < erasLength; i++) {
            uint256 start;
            uint256 stopCursor;
            uint256 amount;
            assembly ("memory-safe") {
                start := calldataload(add(policy.offset, offset))
                stopCursor := calldataload(add(policy.offset, add(offset, 32)))
                amount := calldataload(add(policy.offset, add(offset, 64)))
            }
            offset += 96;

            require(amount > 0, "Invalid reward amount of distribution, consider giving a positive integer");
            if (i == 0) {
                require(start > block.number, "Invalid start cursor of distribution");
            } else {
                require(start > distributionErasMap[community][i - 1].stopCursor, "Subsequent eras must start after previous era ends");
            }
            require(start < stopCursor, "Invalid stop cursor of distribution");
            distributionErasMap[community].push(
                Distribution({amount: amount, startCursor: start, stopCursor: stopCursor})
            );
            distributionCountMap[community] = distributionCountMap[community] + 1;
        }
    }
}
