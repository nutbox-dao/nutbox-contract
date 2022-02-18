// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/IPool.sol";
import "./CosmosStakingFactory.sol";

/**
 * @dev Template contract of Atom staking pool.
 * Delegation only can be updated through update() by bridge.
 *
 */
contract CosmosStaking is IPool {
    using SafeMath for uint256;

    struct StakingInfo {
        // First time when user staking, we need set options like userDebt to zero
        bool hasDeposited;
        // User staked amount
        uint256 amount;
        // User's foreign account identity
        address bindAccount;
    }

    // fetch address use bound account
    mapping(address => address) public accountBindMap;

    // stakingInfo used to save every user's staking information,
    // including how many they deposited and its external chain account
    // ( we support crosschain asset staking). With every staking event
    // happened including deposit and withdraw asset this field should be updated.
    mapping(address => StakingInfo) stakingInfo;

    address immutable factory;
    string public name;

    // community that pool belongs to
    address immutable community;
    // delegatee account,the pubkey of cosmos is bytes20, so here encode it to address
    // It should be convert to specify format to the corresponding blockchain
    address public delegatee;
    // chain id: atom: 3
    uint8 immutable chainId;

    // Total staked amount
    uint256 public totalStakedAmount;

    event UpdateStaking(
        address indexed community,
        address indexed who,
        uint256 previousAmount,
        uint256 newAmount
    );

    constructor(address _community, string memory _name, uint8 _chainId, address _delegatee) {
        factory = msg.sender;
        community = _community;
        name = _name;
        delegatee = _delegatee;
        chainId = _chainId;
    }

    function update(
        uint8 _chainId,
        address _delegatee,
        address depositor,
        uint256 amount,
        address _bindAccount
    ) external {
        require(CosmosStakingFactory(factory).isBridge(msg.sender), "Only verified bridge can call");
        require(chainId == _chainId, "Wrong chain id");
        require(delegatee == _delegatee, "Wrong delegatee account");
        require(accountBindMap[_bindAccount] == address(0) || accountBindMap[_bindAccount] == depositor, "Bound bsc account dismatch");

        uint256 prevAmount = stakingInfo[depositor].amount;
        if (prevAmount == amount) return;
        if (prevAmount < amount) {
            // deposit
            require(ICommunity(community).poolActived(address(this)), 'Can not deposit to a closed pool.');
        }

        // Add to staking list if account hasn't deposited before
        if (!stakingInfo[depositor].hasDeposited) {
            stakingInfo[depositor].hasDeposited = true;
            stakingInfo[depositor].bindAccount = _bindAccount;
            accountBindMap[_bindAccount] = depositor;
        } else {
            require(stakingInfo[depositor].bindAccount == _bindAccount,
                "Bound cosmos account dismatch"
            );
        }

        // trigger community update all pool staking info, send factory as fee payer to ignore fee payment.
        ICommunity(community).updatePools("USER", factory);

        if (stakingInfo[depositor].amount > 0) {
            uint256 pending = stakingInfo[depositor]
                .amount
                .mul(ICommunity(community).getShareAcc(address(this)))
                .div(1e12)
                .sub(ICommunity(community).getUserDebt(address(this), depositor));
            if (pending > 0) {
                ICommunity(community).appendUserReward(depositor, pending);
            }
        }

        totalStakedAmount = totalStakedAmount.add(amount).sub(prevAmount);
        stakingInfo[depositor].amount = amount;

        ICommunity(community).setUserDebt(
            depositor,
            stakingInfo[depositor]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));
        
        emit UpdateStaking(community, depositor, prevAmount, amount);
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
