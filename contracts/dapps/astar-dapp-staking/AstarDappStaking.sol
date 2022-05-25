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
        // The last era to claim the reward
        uint256 lastClaimRewardEra;
        uint256 lastSaveEra;
        uint256 lastWithdrewEra;
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

    // Unclaimed amount that already unbounded
    // user(era=>unwithdrew)
    mapping(address => mapping(uint256 => uint256)) unWithdrew;

    // Total staked amount
    uint256 public totalStakedAmount;
    // Total stakers, up to 1024
    uint256 public totalStakers;

    address private factory;
    address private community;
    address public dapp;
    string public name;
    uint256 private lastClaimEra;
    bool isSetDestination = false;

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
    }

    function _set_reward_destination() internal {
        if (false == isSetDestination) {
            isSetDestination = true;
            dappsStaking().set_reward_destination(0);
        }
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
        stakingInfo[msg.sender].lastSaveEra = era - 1;
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
            lastClaimEra += 1;
            eraInfo[lastClaimEra].isClaimed = true;
            eraInfo[lastClaimEra].totalReward = reward;
            // calc unit reward
            _calcUnitReward(lastClaimEra);
        }
    }

    function stake() public payable nonReentrant {
        require(ICommunity(community).poolActived(address(this)), "Pool has been closed");
        uint256 amount = msg.value;
        require(amount > 0, "Must stake some token");
        checkAndClaim();
        uint256 currentEra = dappsStaking().read_current_era();
        _saveEraStake(currentEra);

        // Stake asset for the DApp
        if (totalStakedAmount >= dappsStaking().minimumStake()) {
            dappsStaking().bond_and_stake(dapp, amount);
        } else if (totalStakedAmount + amount >= dappsStaking().minimumStake()) {
            dappsStaking().bond_and_stake(dapp, totalStakedAmount + amount);
            _set_reward_destination();
        }

        // trigger community update all pool staking info.
        ICommunity(community).updatePools("USER", msg.sender);

        if (stakingInfo[msg.sender].hasStaked == false) {
            stakingInfo[msg.sender].hasStaked = true;
            stakingInfo[msg.sender].lastWithdrewEra = currentEra - dappsStaking().read_unbonding_period();
            stakingInfo[msg.sender].lastClaimRewardEra = currentEra - 1;
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
        uint256 currentEra = dappsStaking().read_current_era();
        _saveEraStake(currentEra);

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

        // unbond
        if (totalStakedAmount >= dappsStaking().minimumStake()) dappsStaking().unbond_and_unstake(dapp, unstakeAmount);

        // Update ledger
        stakingInfo[msg.sender].amount -= unstakeAmount;
        unWithdrew[msg.sender][currentEra] += unstakeAmount;
        totalStakedAmount -= unstakeAmount;
        // save stake amount
        _saveStake();

        ICommunity(community).setUserDebt(msg.sender, stakingInfo[msg.sender].amount.mul(ICommunity(community).getShareAcc(address(this))).div(1e12));

        emit UnStaked(community, msg.sender, unstakeAmount);
    }

    // Withdraw unbounded amount, only work after unbound period has complete after unstake triggered.
    function withdraw_unbonded() external nonReentrant {
        checkAndClaim();
        uint256 periodEra = dappsStaking().read_unbonding_period();
        uint256 currentEra = dappsStaking().read_current_era();
        _saveEraStake(currentEra);

        uint256 withdraw_amount;
        for (uint256 i = stakingInfo[msg.sender].lastWithdrewEra + 1; i <= currentEra - periodEra; i++) {
            withdraw_amount += unWithdrew[msg.sender][i];
        }
        require(withdraw_amount > 0, "No fund to be withdraw");

        // Update ledger
        stakingInfo[msg.sender].lastWithdrewEra = currentEra - periodEra;

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
        uint256 curEra = dappsStaking().read_current_era();
        if (era <= stakingInfo[msg.sender].lastClaimRewardEra || era > curEra) era = curEra;

        _saveEraStake(era); // will calculate the current era

        uint256 reward;
        // Cannot claim current era rewards
        if (era == curEra) era -= 1;
        for (uint256 i = stakingInfo[msg.sender].lastClaimRewardEra + 1; i <= era; i++) {
            // TODO If you want to deal with the precision problem,
            // you can cancel the `.div(precision)` of `_calcUnitReward()` and add `.div(precision)` here
            reward += eraInfo[i].unitReward * eraStaked[msg.sender][i];
        }

        stakingInfo[msg.sender].lastClaimRewardEra = era;

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

    // Get the token that has been unbound by the specified user.
    function getUnbonded(address user) public view returns (uint256[] memory, uint256[] memory) {
        uint256 currentEra = dappsStaking().read_current_era();
        uint256 periodEra = dappsStaking().read_unbonding_period();
        uint256 max = dappsStaking().maxUnlockingChunks();
        uint256 len = currentEra - periodEra - stakingInfo[user].lastWithdrewEra;
        if (len > max) len = max;
        uint256[] memory chunks = new uint256[](len);
        uint256[] memory eras = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            eras[i] = currentEra + i + 1 - periodEra - len;
            chunks[i] = unWithdrew[user][eras[i]];
        }
        return (eras, chunks);
    }
}
