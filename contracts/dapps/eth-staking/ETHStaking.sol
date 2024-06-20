// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/IPool.sol";
import "../../interfaces/IPoolFactory.sol";
import "../../ERC20Helper.sol";

/**
 * @dev Template contract of Nutbox staking pool.
 *
 * Every pool saves a user staking ledger of a specific staking asset.
 * The only place that user can deposit and withdraw their staked asset.
 * Also only user themself than withdraw their staked asset
 */
contract ETHStaking is IPool, ERC20Helper, ReentrancyGuard {
    using SafeMath for uint256;

    struct StakingInfo {
        // First time when user staking, we need set options like userDebt to zero
        bool hasDeposited;
        // User staked amount
        uint256 amount;
    }
    address immutable factory;

    // stakingInfo used to save every user's staking information,
    // including how many they deposited and its external chain account
    // ( we support crosschain asset staking). With every staking event
    // happened including deposit and withdraw asset this field should be updated.
    mapping(address => StakingInfo) stakingInfo;

    string public name;

    // community that pool belongs to
    address immutable community;

    // Total staked amount
    uint256 public totalStakedAmount;

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

    constructor(address _community, string memory _name) {
        factory = msg.sender;
        community = _community;
        name = _name;
    }

    receive() external payable {}

    function deposit() external nonReentrant payable {
        uint256 amount = msg.value;
        require(ICommunity(community).poolActived(address(this)), 'Can not deposit to a closed pool.');
        if (amount == 0) return;

        // check fee
        (address receiver, uint256 feeAmount) = IPoolFactory(factory).getFeeInfo();
        if (feeAmount > 0) {
            require(amount >= feeAmount, "Insufficient fee");
            (bool success, ) = receiver.call{value: feeAmount}("");
            require(success, "cost fee fail");
            amount = amount.sub(feeAmount);
        }

        // Add to staking list if account hasn't deposited before
        if (!stakingInfo[msg.sender].hasDeposited) {
            stakingInfo[msg.sender].hasDeposited = true;
            stakingInfo[msg.sender].amount = 0;
        }

        // trigger community update all pool staking info
        ICommunity(community).updatePools("USER", msg.sender);

        if (stakingInfo[msg.sender].amount > 0) {
            uint256 pending = stakingInfo[msg.sender]
                .amount
                .mul(ICommunity(community).getShareAcc(address(this)))
                .div(1e12)
                .sub(ICommunity(community).getUserDebt(address(this), msg.sender));
            if (pending > 0) {
                ICommunity(community).appendUserReward(msg.sender, pending);
            }
        }

        stakingInfo[msg.sender].amount = stakingInfo[msg.sender]
            .amount
            .add(amount);
        totalStakedAmount = totalStakedAmount
            .add(amount);

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));

        emit Deposited(community, msg.sender, amount);
    }

    function withdraw(
        uint256 amount
    ) external nonReentrant payable {
        if (amount == 0) return;
        if (stakingInfo[msg.sender].amount == 0) return;

        // check fee
        (address receiver, uint256 feeAmount) = IPoolFactory(factory).getFeeInfo();
        if (feeAmount > 0) {
            require(amount > feeAmount, "Insufficient fee");
            (bool success1, ) = receiver.call{value: feeAmount}("");
            require(success1, "Cost Fee fail");
            amount = amount.sub(feeAmount);
        }

        // trigger community update all pool staking info
        ICommunity(community).updatePools("USER", msg.sender);

        uint256 pending = stakingInfo[msg.sender]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12)
            .sub(ICommunity(community).getUserDebt(address(this), msg.sender));
        if (pending > 0) {
            ICommunity(community).appendUserReward(msg.sender, pending);
        }

        uint256 withdrawAmount;
        if (amount >= stakingInfo[msg.sender].amount)
            withdrawAmount = stakingInfo[msg.sender].amount;
        else withdrawAmount = amount;

        // releaseERC20(stakeToken, address(msg.sender), withdrawAmount);
        (bool success, ) = msg.sender.call{value: withdrawAmount}('');
        require(success, "Withdraw fail");

        stakingInfo[msg.sender].amount = stakingInfo[msg.sender]
            .amount
            .sub(withdrawAmount);
        totalStakedAmount = totalStakedAmount
            .sub(withdrawAmount);

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));

        emit Withdrawn(community, msg.sender, withdrawAmount);
    }

    function getFactory() external view override returns (address) {
        return factory;
    }

    function getCommunity() external view override returns (address) {
        return community;
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
