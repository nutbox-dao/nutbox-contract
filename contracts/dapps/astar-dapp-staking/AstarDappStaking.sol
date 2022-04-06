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

    event Staked(
        address indexed community,
        address indexed who,
        uint256 amount
    );
    event Claimed(
        address indexed community,
        address indexed who,
        uint256 amount
    );

    constructor(address _stakingContract, address _community, string memory _name, address _dapp) {
        factory = msg.sender;
        stakingContract = _stakingContract;
        community = _community;
        dapp = _dapp;
        name = _name;

        // Register DApp on Astar network, developer
        DappsStaking(stakingContract).register(dapp);
    }

    function stake(uint128 amount) external payable {
        require(amount >= MINIMUM_STAKE, "Invalid stake amount");

        // Transfer user assets to the contract
        payable(msg.sender).transfer(amount);

        // Stake asset for the DApp
        DappsStaking(stakingContract).bond_and_stake(dapp, amount);

        // trigger community update all pool staking info, send factory as fee payer to ignore fee payment.
        ICommunity(community).updatePools("USER", factory);

        // Upate the ledger
        require(totalStakers <= MAXIMUM_STAKERS, "Too many stakers");
        if (stakingInfo[msg.sender].hasStaked == false) {
            stakingInfo[msg.sender].hasStaked = true;
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
        totalStakedAmount  += amount;

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));
        
        emit Staked(community, msg.sender, amount);
    }

    function claim(
        uint256 amount
    ) external nonReentrant {
        if (amount < 0) return;
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

        uint256 claimAmount;
        if (amount >= stakingInfo[msg.sender].amount)
            claimAmount = stakingInfo[msg.sender].amount;
        else claimAmount = amount;

        // TODO: unbond & transfer reward to community

        // Update ledger
        stakingInfo[msg.sender].amount -= claimAmount;
        totalStakedAmount -= claimAmount;

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));

        emit Claimed(community, msg.sender, claimAmount);
    }

    function current_era() external view returns (uint256) {
        return DappsStaking(stakingContract).current_era();
    }

    function era_reward_and_stake(uint32 era) external view returns (uint128, uint128) {
        return DappsStaking(stakingContract).era_reward_and_stake(era);
    }

    function registered_contract() external view returns (uint256) {
        return DappsStaking(stakingContract).registered_contract(msg.sender);
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
