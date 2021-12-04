// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/IPool.sol";
import "../../ERC20Helper.sol";

/**
 * @dev Template contract of Nutbox staking pool.
 *
 * Every pool saves a user staking ledger of a specific staking asset.
 * The only place that user can deposit and withdraw their staked asset.
 * Also only user themself than withdraw their staked asset
 */
contract ERC20Staking is IPool, ERC20Helper {
    using SafeMath for uint256;

    struct StakingInfo {
        // First time when user staking, we need set options like userDebt to zero
        bool hasDeposited;
        // User staked amount
        uint256 amount;
    }

    // stakingInfo used to save every user's staking information,
    // including how many they deposited and its external chain account
    // ( we support crosschain asset staking). With every staking event
    // happened including deposit and withdraw asset this field should be updated.
    mapping(address => StakingInfo) stakingInfo;

    // all staked account
    address[] stakingList;

    // total stakers of this pool
    uint64 stakerCount;
    string public name;

    // stakeToken actually is a asset contract entity, it represents the asset user stake of this pool.
    // Bascially, it should be a normal ERC20 token or a lptoken of a specific token exchange pair
    address immutable stakeToken;
    // community that pool belongs to
    address immutable community;

    // Total staked amount
    uint256 totalStakedAmount;

    event Deposited(
        address indexed community,
        address indexed who,
        uint256 amount
    );
    event Withdrawn(
        address indexed community,
        address indexed who,
        uint256 amount
    );

    constructor(address _community, string memory _name, address _stakeToken) {
        community = _community;
        name = _name;
        stakeToken = _stakeToken;
    }

    function deposit(
        address depositor,
        uint256 amount
    ) public {
        require(ICommunity(community).poolActived(address(this)), 'Can not deposit to a closed pool.');
        if (amount == 0) return;

        // Add to staking list if account hasn't deposited before
        if (!stakingInfo[depositor].hasDeposited) {
            stakingInfo[depositor].hasDeposited = true;
            stakingInfo[depositor].amount = 0;
            stakingList.push(depositor);
            stakerCount += 1;
        }

        // trigger community update all pool staking info
        ICommunity(community).updatePools(depositor);

        if (stakingInfo[depositor].amount > 0) {
            uint256 pending = stakingInfo[depositor]
                .amount
                .mul(ICommunity(community).getShareAcc(address(this)))
                .div(1e12)
                .sub(ICommunity(community).getUserDebt(address(this), depositor));
            if (pending > 0) {
                ICommunity(community).appendUserReward(address(this), depositor, pending);
            }
        }

        lockERC20(stakeToken, depositor, address(this), amount);

        stakingInfo[depositor].amount = stakingInfo[depositor]
            .amount
            .add(amount);
        totalStakedAmount = totalStakedAmount
            .add(amount);

        ICommunity(community).setUserDebt(
            address(this),
            depositor,
            stakingInfo[depositor]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));

        emit Deposited(community, depositor, amount);
    }

    function withdraw(
        address depositor,
        uint256 amount
    ) public {
        if (amount == 0) return;
        if (stakingInfo[depositor].amount == 0) return;

        // trigger community update all pool staking info
        ICommunity(community).updatePools(depositor);

        uint256 pending = stakingInfo[depositor]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12)
            .sub(ICommunity(community).getUserDebt(address(this), depositor));
        if (pending > 0) {
            ICommunity(community).appendUserReward(address(this), depositor, pending);
        }

        uint256 withdrawAmount;
        if (amount >= stakingInfo[depositor].amount)
            withdrawAmount = stakingInfo[depositor].amount;
        else withdrawAmount = amount;

        releaseERC20(stakeToken, address(depositor), amount);

        stakingInfo[depositor].amount = stakingInfo[depositor]
            .amount
            .sub(withdrawAmount);
        totalStakedAmount = totalStakedAmount
            .sub(withdrawAmount);

        ICommunity(community).setUserDebt(
            address(this),
            depositor,
            stakingInfo[depositor]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));

        emit Withdrawn(community, depositor, withdrawAmount);
    }

    function getUserStakedAmount(address user)
        external
        view
        override returns (uint256)
    {
        return stakingInfo[user].amount;
    }

    function getTotalStakedAmount()
        external
        view
        override returns (uint256)
    {
        return totalStakedAmount;
    }

    function getUserDepositInfo(address user)
        external
        view
        returns (StakingInfo memory)
    {
        return stakingInfo[user];
    }
}
