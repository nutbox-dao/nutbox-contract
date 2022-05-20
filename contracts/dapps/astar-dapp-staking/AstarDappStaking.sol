// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/IPool.sol";
import "../../ERC20Helper.sol";
import "./DelegateDappsStaking.sol";
import "./IAstarFactory.sol";

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
        // The last era to claim the reward
        uint256 lastClaimRewardEra;
        uint256 lastSaveEra;
    }

    struct EraInfo {
        bool isClaimed;
        uint256 totalStake;
        uint256 totalReward;
        uint256 unitReward;
    }

    // stakingInfo used to save every user's staking information,
    // including how many they deposited.
    mapping(address => StakingInfo) stakingInfo;

    mapping(uint256 => EraInfo) eraInfo;

    // user(era=> staked amount)
    mapping(address => mapping(uint256 => uint256)) eraStaked;

    // Total staked amount
    uint256 public totalStakedAmount;
    // Total stakers, up to 1024
    uint256 public totalStakers;

    address private factory;
    address private community;
    address public dapp;
    string public name;
    uint256 private lastClaimEra;

    event Staked(address indexed community, address indexed who, uint256 amount);
    event UnStaked(address indexed community, address indexed who, uint256 amount);
    event Withdraw(address indexed community, address indexed who, uint256 amount);
    event StakeClaimed(address indexed community, address indexed dapp, uint256 amount);

    constructor(
        address _community,
        string memory _name,
        address _dapp
    ) {
        factory = msg.sender;
        community = _community;
        dapp = _dapp;
        name = _name;

        lastClaimEra = dappsStaking().read_current_era() - 1;
        eraInfo[lastClaimEra].isClaimed = true;

        // Register DApp on Astar network, developer
        // dappsStaking().register(dapp);
        dappsStaking().set_reward_destination(0);
    }

    function dappsStaking() private view returns (DelegateDappsStaking) {
        return DelegateDappsStaking(IAstarFactory(factory).delegateDappsStakingContract());
    }

    // can move this method to Delegate contract
    function _calcUnitReward(uint256 era) private {
        uint256 precision = dappsStaking().precision();
        // reward can not div precision, div precision until the final result
        uint256 reward = eraInfo[era].totalReward.mul(precision).div(eraInfo[era].totalStake).div(precision);
        eraInfo[era].unitReward = reward;
    }

    function _saveStake() internal {
        uint256 staked = dappsStaking().read_staked_amount_on_contract(dapp, abi.encodePacked(address(this)));
        uint256 era = dappsStaking().read_current_era();
        if (eraInfo[era].totalStake != staked) {
            eraInfo[era].totalStake = staked;
        }
        // Reward is 0
        if (eraInfo[era].totalStake == 0) {
            eraInfo[era].unitReward = 0;
        }
        eraStaked[msg.sender][era] = stakingInfo[msg.sender].amount;
        if (stakingInfo[msg.sender].lastSaveEra != era) {
            stakingInfo[msg.sender].lastSaveEra = era;
        }
    }

    function _saveEraStake(uint256 _era) internal {
        uint256 lastSaveEra = stakingInfo[msg.sender].lastSaveEra;
        uint256 era = dappsStaking().read_current_era();

        if (lastSaveEra == 0) lastSaveEra = era;

        if (_era > lastSaveEra && _era <= era) era = _era;

        for (uint256 i = lastSaveEra + 1; i < era; i++) {
            eraStaked[msg.sender][i] = stakingInfo[msg.sender].amount;
        }
        stakingInfo[msg.sender].lastSaveEra = era;
    }

    // I suggest move this method to Delegate contract
    function checkAndClaim() public {
        uint256 era = dappsStaking().read_current_era();
        uint256 diff = era - lastClaimEra - 1;
        uint256 oldBalance;
        uint256 newBalance;
        uint256 reward;
        for (uint256 i = 0; i < diff; i++) {
            oldBalance = address(this).balance;
            dappsStaking().claim_staker(dapp);
            newBalance = address(this).balance;
            reward = newBalance - oldBalance;
            // no need to judge reward > 0 
            if (reward > 0) {
                lastClaimEra += 1;
                eraInfo[lastClaimEra].isClaimed = true;
                eraInfo[lastClaimEra].totalReward = reward;
                // calc unit reward
                _calcUnitReward(lastClaimEra);
            }
        }
    }

    function stake() public payable nonReentrant {
        require(ICommunity(community).poolActived(address(this)), "Pool has been closed");
        uint256 amount = msg.value;
        require(amount > 0, "Must stake some token");
        checkAndClaim();
        _saveEraStake(dappsStaking().read_current_era());

        // bool poolActived = ICommunity(community).poolActived(address(this));
        // if (poolActived == false) {
        //     // Refund if closed
        //     payable(msg.sender).transfer(amount);
        //     return;
        // }

        // Stake asset for the DApp
        if (totalStakedAmount >= dappsStaking().minimumStake()) {
            dappsStaking().bond_and_stake(dapp, amount);
        } else if (totalStakedAmount + amount >= dappsStaking().minimumStake()) {
            dappsStaking().bond_and_stake(dapp, totalStakedAmount + amount);
        }

        // trigger community update all pool staking info.
        ICommunity(community).updatePools("USER", msg.sender);

        if (stakingInfo[msg.sender].hasStaked == false) {
            stakingInfo[msg.sender].hasStaked = true;
            stakingInfo[msg.sender].unwithdrew = 0;
            stakingInfo[msg.sender].lastClaimRewardEra = dappsStaking().read_current_era() - 1;
            totalStakers += 1;
        }
        uint256 pending = stakingInfo[msg.sender].amount.mul(ICommunity(community).getShareAcc(address(this))).div(1e12).sub(
            ICommunity(community).getUserDebt(address(this), msg.sender)
        );
        if (pending > 0) {
            ICommunity(community).appendUserReward(msg.sender, pending);
        }

        stakingInfo[msg.sender].amount += amount;
        totalStakedAmount += amount;

        //save stake
        _saveStake();

        ICommunity(community).setUserDebt(msg.sender, stakingInfo[msg.sender].amount.mul(ICommunity(community).getShareAcc(address(this))).div(1e12));

        emit Staked(community, msg.sender, amount);
    }

    function unstake(uint128 amount) external payable nonReentrant {
        checkAndClaim();
        if (amount <= 0) return;
        if (stakingInfo[msg.sender].amount == 0) return;
        _saveEraStake(dappsStaking().read_current_era());

        // trigger community update all pool staking info
        ICommunity(community).updatePools("USER", msg.sender);

        uint256 pending = stakingInfo[msg.sender].amount.mul(ICommunity(community).getShareAcc(address(this))).div(1e12).sub(
            ICommunity(community).getUserDebt(address(this), msg.sender)
        );
        if (pending > 0) {
            ICommunity(community).appendUserReward(msg.sender, pending);
        }

        uint256 unstakeAmount;
        if (amount >= stakingInfo[msg.sender].amount) unstakeAmount = stakingInfo[msg.sender].amount;
        else unstakeAmount = amount;

        // here need to judge the left total amount if less than 500, every stake will canceled
        // need udpate all left user's stake to 0

        // Unbond stake, note the staked amount will not settle immediately, user need claim
        // manually after ubound period complete.

        // need to save the unbond era, then we can know which era he can claim the unbond token
        dappsStaking().unbond_and_unstake(dapp, unstakeAmount);

        // Update ledger
        stakingInfo[msg.sender].amount -= unstakeAmount;
        stakingInfo[msg.sender].unwithdrew += unstakeAmount;
        totalStakedAmount -= unstakeAmount;

        // save stake amount
        _saveStake();

        uint256 staked = dappsStaking().read_staked_amount_on_contract(dapp, abi.encodePacked(address(this)));
        if (staked == 0) {
            // less than minimumStake
            // need update all left user's stake amount
            totalStakedAmount = 0;
        }

        ICommunity(community).setUserDebt(msg.sender, stakingInfo[msg.sender].amount.mul(ICommunity(community).getShareAcc(address(this))).div(1e12));

        emit UnStaked(community, msg.sender, unstakeAmount);
    }

    // withdraw when the pool is closed
    // can withdraw even if the pool is active
    function withdraw() public nonReentrant returns (bool) {
        bool poolActived = ICommunity(community).poolActived(address(this));
        // there's no possibility the total amount less than minimumStake
        if (poolActived == false || totalStakedAmount < dappsStaking().minimumStake()) {
            uint256 unwithdraw_amount = stakingInfo[msg.sender].unwithdrew;
            uint256 amount = stakingInfo[msg.sender].amount;

            stakingInfo[msg.sender].unwithdrew = 0;
            stakingInfo[msg.sender].amount = 0;
            amount += unwithdraw_amount;

            if (address(this).balance >= amount) {
                bool hasSent = payable(msg.sender).send(amount);
                require(hasSent, "Failed to transfer Fund");
                emit Withdraw(community, msg.sender, amount);
                return true;
            }
        }
        return false;
    }

    // Withdraw unbounded amount, only work after unbound period has complete after unstake triggered.
    function withdraw_unbonded() external nonReentrant {
        checkAndClaim();
        _saveEraStake(dappsStaking().read_current_era());
        require(stakingInfo[msg.sender].unwithdrew > 0, "No fund to be withdraw");

        uint256 withdraw_amount = stakingInfo[msg.sender].unwithdrew;
        // Update ledger
        stakingInfo[msg.sender].unwithdrew -= withdraw_amount;

        // Essentially address(this) is the real staker, so we always withdraw all unbounded fund here
        // and then send back to users. That means actually withdrawn amount from staking contract could
        // greater than withdraw_amount.
        dappsStaking().withdraw_unbonded();

        if (address(this).balance >= withdraw_amount) {
            // Transfer back the fund that belongs to the user
            bool hasSent = payable(msg.sender).send(withdraw_amount);
            require(hasSent, "Failed to transfer Fund");
            emit Withdraw(community, msg.sender, withdraw_amount);
        }
    }

    // Claim one era of unclaimed rewards. The rewards first send to the real staker, e.g. address(this),
    // then we transfer to community contract, user then can claim their rewards according to the ledger.
    function claim_stake_reward(uint256 _era) external nonReentrant {
        checkAndClaim();

        uint256 era = _era;
        uint256 tmpEra = dappsStaking().read_current_era();
        if (era <= stakingInfo[msg.sender].lastClaimRewardEra || era > tmpEra) era = tmpEra;

        _saveEraStake(era);

        uint256 reward;
        for (uint256 i = stakingInfo[msg.sender].lastClaimRewardEra + 1; i < era; i++) {
            reward += eraInfo[i].unitReward * eraStaked[msg.sender][i];
        }
        stakingInfo[msg.sender].lastClaimRewardEra = era - 1;
        if (address(this).balance >= reward) {
            bool hasSent = payable(address(msg.sender)).send(reward);
            require(hasSent, "Failed to transfer Fund");
            emit StakeClaimed(community, dapp, reward);
        }
    }

    function getFactory() external view override returns (address) {
        return factory;
    }

    function getCommunity() external view override returns (address) {
        return community;
    }

    function getUserStakedAmount(address user) external view override returns (uint256) {
        return stakingInfo[user].amount;
    }

    function getTotalStakedAmount() external view override returns (uint256) {
        return totalStakedAmount;
    }

    function getUserDepositInfo(address user) external view returns (StakingInfo memory) {
        return stakingInfo[user];
    }
}
