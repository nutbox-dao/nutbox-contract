// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IAstarDappStakingCalc.sol";
import "./DappsStaking.sol";

contract AstarDappStakingCalc is IAstarDappStakingCalc {
    address public dappStakingContract;
    uint256 public precision = 10**18;
    uint256 public minimumStake = 5000000000000000000;
    uint256 public maximumStakers = 2048;
    mapping(uint32 => uint256) eraReward;

    constructor(address _dappStakingContract) {
        dappStakingContract = _dappStakingContract;
    }

    function calcRewardByEra(uint32 era) public returns (uint256 reward) {
        reward = eraReward[era];
        if (reward == 0) {
            DappsStaking ds = DappsStaking(dappStakingContract);
            uint256 era_staked = ds.read_era_staked(era);
            uint256 era_reward = ds.read_era_reward(era);
            reward = (era_reward * precision) / era_staked;
            eraReward[era] = reward;
        }
    }
}
