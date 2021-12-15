// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/IPool.sol";
import "./SPStakingFactory.sol";

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
        bytes32 bindAccount;
    }

    // fetch address use bound account
    mapping(bytes32 => address) public accountBindMap;

    // stakingInfo used to save every user's staking information,
    // including how many they deposited and its external chain account
    // ( we support crosschain asset staking). With every staking event
    // happened including deposit and withdraw asset this field should be updated.
    mapping(address => StakingInfo) stakingInfo;

    // all staked account
    address[] stakingList;

    // total stakers of this pool
    uint64 stakerCount;

    address immutable factory;
    string public name;

    // community that pool belongs to
    address immutable community;
    // delegatee account
    bytes32 public delegatee;
    // chain id: steem : 1  hive: 2
    uint8 immutable chainId;

    // Total staked amount
    uint256 totalStakedAmount;

    event UpdateStaking(
        address indexed community,
        address indexed who,
        uint256 previousAmount,
        uint256 newAmount
    );

    constructor(address _community, string memory _name, uint8 _chainId, bytes32 _delegatee) {
        factory = msg.sender;
        community = _community;
        name = _name;
        delegatee = _delegatee;
        chainId = _chainId;
    }

    function update(
        uint8 _chainId,
        bytes32 _delegatee,
        address depositor,
        uint256 amount,
        bytes32 _bindAccount
    ) external {
        require(msg.sender == SPStakingFactory(factory).bridge(), "Only verified bridge can call");
        require(chainId == _chainId, "Wrong chain id");
        require(delegatee == _delegatee, "Wrong delegatee account");

        uint256 prevAmount = stakingInfo[depositor].amount;
        if (prevAmount == amount) return;
        if (prevAmount < amount) {
            // deposit
            require(ICommunity(community).poolActived(address(this)), 'Can not deposit to a closed pool.');
        }

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

        // trigger community update all pool staking info, send factory as fee payer to ignore fee payment.
        ICommunity(community).updatePools(factory);

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

        totalStakedAmount = totalStakedAmount.add(amount).sub(prevAmount);
        stakingInfo[depositor].amount = amount;

        ICommunity(community).setUserDebt(
            address(this),
            depositor,
            stakingInfo[depositor]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));
        
        emit UpdateStaking(community, depositor, prevAmount, amount);
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
