// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/IPool.sol";

/**
 * @dev Template contract of SP/HP staking pool.
 * Delegation only can be updated through update().
 *
 */
contract SPStaking is IPool {
    using SafeMath for uint256;

    struct StakingInfo {
        // First time when user staking, we need set options like userDebt to zero
        bool hasDeposited;
        // User staked amount
        uint256 amount;
        // User's foreign account identity
        string bindAccount;
    }

    // fetch address use bound account
    mapping(string => address) public accountBindMap;

    // stakingInfo used to save every user's staking information,
    // including how many they deposited and its external chain account
    // ( we support crosschain asset staking). With every staking event
    // happened including deposit and withdraw asset this field should be updated.
    mapping(address => StakingInfo) stakingInfo;

    // all staked account
    address[] stakingList;

    // total stakers of this pool
    uint64 stakerCount;

    // community that pool belongs to
    address community;

    // Total staked amount
    uint256 totalStakedAmount;

    event Deposited(
        address indexed who,
        uint256 amount
    );
    event Withdrawn(
        address indexed who,
        uint256 amount
    );

    constructor(address _community) {
        community = _community;
    }

    function _deposit(
        address depositor,
        uint256 amount,
        string memory _bindAccount
    ) private {
        require(ICommunity(community).poolActived(address(this)), 'Can not deposit to a closed pool.');
        if (amount == 0) return;

        // Add to staking list if account hasn't deposited before
        if (!stakingInfo[depositor].hasDeposited) {
            stakingInfo[depositor].hasDeposited = true;
            stakingInfo[depositor].amount = 0;
            stakingInfo[depositor].bindAccount = _bindAccount;
            stakingList.push(depositor);
            stakerCount += 1;
            accountBindMap[_bindAccount] = depositor;
        } else {
            require(
                keccak256(
                    abi.encodePacked(
                        stakingInfo[depositor].bindAccount
                    )
                ) == keccak256(abi.encodePacked(_bindAccount)),
                "Bound account dismatch"
            );
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

        emit Deposited(depositor, amount);
    }

    function _withdraw(
        address depositor,
        uint256 amount
    ) private {
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

        emit Withdrawn(depositor, withdrawAmount);
    }

    function update(
        address depositor,
        uint256 amount,
        string memory _bindAccount
    ) external {
        uint256 prevAmount = stakingInfo[depositor].amount;

        if (prevAmount < amount) {
            // deposit
            _deposit(depositor, amount.sub(prevAmount), _bindAccount);
        } else {
            // withdraw
            _withdraw(depositor, prevAmount.sub(amount));
        }
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
