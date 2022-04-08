// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/IPool.sol";
import "../../ERC20Helper.sol";
import "./DappsStaking.sol";

/**
 * @dev Proxy contract of Astar Dapp staking pool.
 *
 * This contract maintains a ledger that saves users staking information for the Dapp.
 * When create this contract instance, a Dapp entity should be setted, and after user
 * deposited their SDN to this contract, the contract will stake those asset into the
 * Astar Dapp staking contract, so the for the Astar network, the contract address would
 * be the real staker, that means the network rewards would be sent to this contract directly.
 * Those rewards would be kept in this contract, and user an withdraw their rewards which calculated
 * based on their stake amount at any time.
 */
contract AstarDappStaking is IPool, ERC20Helper, ReentrancyGuard {
    using SafeMath for uint256;

    struct StakingInfo {
        // Mark if user has staked
        bool hasStaked;
        // User staked amount
        uint256 amount;
        // Unclaimed amount that already unbounded
        uint256 unwithdrew;
    }

    // stakingInfo used to save every user's staking information,
    // including how many they deposited.
    mapping(address => StakingInfo) stakingInfo;

    // Total staked amount
    uint256 public totalStakedAmount;
    // Total stakers, up to 1024
    uint256 public totalStakers;
    // Minimum stake amount, current 50 SDN
    uint256 public MINIMUM_STAKE = 50000000000000;
    uint256 public MAXIMUM_STAKERS = 1024;

    address private factory;
    address private stakingContract;
    address private community;
    address private dapp;
    string name;
    address private owner;

    event Staked(
        address indexed community,
        address indexed who,
        uint256 amount
    );
    event UnStaked(
        address indexed community,
        address indexed who,
        uint256 amount
    );
    event Withdraw(
        address indexed community,
        address indexed who,
        uint256 amount
    );
    event StakeClaimed(
        address indexed community,
        address indexed dapp,
        uint256 amount
    );
    event DappClaimed(
        address indexed community,
        address indexed dapp,
        uint256 amount
    );

    constructor(address _stakingContract, address _community, string memory _name, address _dapp, address _owner) {
        factory = msg.sender;
        stakingContract = _stakingContract;
        community = _community;
        dapp = _dapp;
        name = _name;
        owner = _owner;

        // Register DApp on Astar network, developer
        DappsStaking(stakingContract).register(dapp);
    }

    function stake(uint128 amount) external payable nonReentrant {
        require(amount >= MINIMUM_STAKE, "Invalid stake amount");

        // Transfer user assets to the contract
        payable(msg.sender).transfer(amount);

        // Stake asset for the DApp
        DappsStaking(stakingContract).bond_and_stake(dapp, amount);

        // trigger community update all pool staking info.
        ICommunity(community).updatePools("USER", msg.sender);

        // Upate the ledger
        require(totalStakers <= MAXIMUM_STAKERS, "Too many stakers");
        if (stakingInfo[msg.sender].hasStaked == false) {
            stakingInfo[msg.sender].hasStaked = true;
            stakingInfo[msg.sender].unwithdrew = 0;
            totalStakers += 1;
        }
        uint256 pending = stakingInfo[msg.sender]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12)
            .sub(ICommunity(community).getUserDebt(address(this), msg.sender));
        if (pending > 0) {
            ICommunity(community).appendUserReward(msg.sender, pending);
        }

        stakingInfo[msg.sender].amount += amount;
        totalStakedAmount += amount;

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));
        
        emit Staked(community, msg.sender, amount);
    }

    function unstake(uint128 amount) external payable nonReentrant {
        if (amount <= 0) return;
        if (stakingInfo[msg.sender].amount == 0) return;

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

        uint256 unstakeAmount;
        if (amount >= stakingInfo[msg.sender].amount)
            unstakeAmount = stakingInfo[msg.sender].amount;
        else unstakeAmount = amount;

        // Unbond stake, note the staked amount will not settle immediately, user need claim 
        // manually after ubound period complete.
        DappsStaking(stakingContract).unbond_and_unstake(dapp, amount);

        // Update ledger
        stakingInfo[msg.sender].amount -= unstakeAmount;
        stakingInfo[msg.sender].unwithdrew += unstakeAmount;
        totalStakedAmount -= unstakeAmount;

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));

        emit UnStaked(community, msg.sender, unstakeAmount);        
    }

    // Withdraw unbounded amount, only work after unbound period has complete after unstake triggered.
    function withdraw_unbonded() external nonReentrant {
        require(stakingInfo[msg.sender].unwithdrew > 0, "No fund to be withdraw");

        uint256 withdraw_amount = stakingInfo[msg.sender].unwithdrew;

        // Essentially address(this) is the real staker, so we always withdraw all unbounded fund here
        // and then send back to users. That means actually withdrawn amount from staking contract could
        // greater than withdraw_amount.
        DappsStaking(stakingContract).withdraw_unbonded();

        // Transfer back the fund that belongs to the user
        bool hasSent = payable(msg.sender).send(withdraw_amount);
        require(hasSent, "Failed to transfer Fund");

        // Update ledger
        stakingInfo[msg.sender].unwithdrew -= withdraw_amount;

        emit Withdraw(community, msg.sender, withdraw_amount);
    }

    // Claim one era of unclaimed rewards. The rewards first send to the real staker, e.g. address(this),
    // then we transfer to community contract, user then can claim their rewards according to the ledger.
    function claim_stake_reward() external nonReentrant {
        uint256 old_balance = address(this).balance;

        // Claim rewards for the staker, e.g. this contract.
        DappsStaking(stakingContract).claim_staker(dapp);
        uint256 new_balance = address(this).balance;

        // Transfer to community contract
        bool hasSent = payable(address(community)).send(new_balance);
        require(hasSent, "Failed to transfer Fund");

        emit StakeClaimed(community, dapp, new_balance.sub(old_balance));
    }

    // Claim the specific era of unclaimed rewards for the DApp, rewards would be sent to owner of the DApp.
    function claim_dapp_reward(uint128 era) external nonReentrant {
        uint256 old_balance = address(this).balance;

        // Claim rewards for the DApp
        DappsStaking(stakingContract).claim_dapp(dapp, era);
        uint256 new_balance = address(this).balance;

        // Transfer to community owner
        bool hasSent = payable(address(owner)).send(new_balance.sub(old_balance));
        require(hasSent, "Failed to transfer Fund");

        emit DappClaimed(community, dapp, new_balance.sub(old_balance));
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
