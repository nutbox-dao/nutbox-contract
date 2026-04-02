// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./HookCommunityToken.sol";

interface ICommunityRewards {
    function withdrawPoolsRewards(address[] memory poolAddresses) external payable;
}

interface IPoolStake {
    function deposit(uint256 amount) external payable;
    function withdraw(uint256 amount) external payable;
}

interface IERC20Minimal {
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @dev Contract staker that claims rewards; token hook calls back to attempt reentrancy.
 *      mode: 1 = reenter withdrawPoolsRewards, 2 = reenter pool.deposit, 3 = reenter pool.withdraw
 */
contract RewardReentryAttacker is IRewardHook {
    ICommunityRewards public immutable community;
    address[] internal claimPools;
    address public pool;
    IERC20Minimal public stakeToken;
    uint8 public mode;
    bool public reentryAttempted;
    /// @dev True if the nested call returned without revert (should stay false for mode 1 if guard works).
    bool public nestedCallSucceeded;

    constructor(address _community) {
        require(_community != address(0), "community");
        community = ICommunityRewards(_community);
    }

    function configure(
        address[] calldata _pools,
        address _pool,
        address _stakeToken,
        uint8 _mode
    ) external {
        delete claimPools;
        for (uint256 i = 0; i < _pools.length; i++) {
            claimPools.push(_pools[i]);
        }
        pool = _pool;
        stakeToken = IERC20Minimal(_stakeToken);
        mode = _mode;
        reentryAttempted = false;
        nestedCallSucceeded = false;
    }

    function approvePool(uint256 amount) external {
        stakeToken.approve(pool, amount);
    }

    function stake(uint256 amount) external payable {
        IPoolStake(pool).deposit{value: msg.value}(amount);
    }

    function claim() external payable {
        community.withdrawPoolsRewards{value: msg.value}(claimPools);
    }

    function onRewardDelivery() external override {
        reentryAttempted = true;
        if (mode == 1) {
            try community.withdrawPoolsRewards{value: 0}(claimPools) {
                nestedCallSucceeded = true;
            } catch {
                nestedCallSucceeded = false;
            }
        } else if (mode == 2) {
            try IPoolStake(pool).deposit{value: 0}(1) {
                nestedCallSucceeded = true;
            } catch {
                nestedCallSucceeded = false;
            }
        } else if (mode == 3) {
            try IPoolStake(pool).withdraw{value: 0}(1) {
                nestedCallSucceeded = true;
            } catch {
                nestedCallSucceeded = false;
            }
        }
    }
}
