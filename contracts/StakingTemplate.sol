// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import './access/Ownable.sol';
import './libraries/SafeMath.sol';
import './libraries/Types.sol';
import './interfaces/IERC20.sol';
import './NutboxERC20.sol';

/**
 * @dev Template contract of Nutbox staking module.
 *
 * StakingFactory Contract always returns an entity of this contract.
 * Support add serial StakingPair into it.
 */
contract StakingTemplate is Ownable {

    using SafeMath for uint256;

    struct UserStakingInfo {
        // First time when user staking, we need set options like userDebt to zero
        bool hasDeposited;
        // User staked amount
        uint256 amount;
        // Rewards that can be withdraw
        uint256 availableRewards;
        // User's debt that should be removed when calculating their final rewards.
        uint256 userDebt;
        // External accountId, e.g. a Polkadot acccount or a Steem account
        string externalAccount;
    }

    struct Pool {
        // Pool id
        uint8 pid;

        // stakingInfo used to save every user's staking information, 
        // including how many they deposited and its external chain account 
        // ( we support crosschain asset staking). With every staking event 
        // happened including deposit and withdraw asset this field should be updated. 
        // It also be used to calculate the reward user can get.
        mapping (address => UserStakingInfo) stakingInfo;

        // We add stakingList here to let us iterate stakingInfo sometimes
        address[] stakingList;

        // When pool was added, we treat it actived.
        bool hasActived;

        // poolRatio is a configuration argument that the staking pool deployer give.
        // Case NutboxStakingTemplate contract support mult-pool staking, every pool's
        // reward of current block are distributed by this options.
        uint8 poolRatio;

        // stakingPair actually is a NutboxERC20Token entity (e.g. a contract address),
        // it represents the asset user stake of this pool. Bascially, it should be a 
        // normal ERC20 token and a lptoken of a specific token exchange pair.
        NutboxERC20 stakingPair;

        // Pool accumulation factor, updated when user deposit and withdraw staking asset.
        // Used to calculate rewards of every user rewards with a giving formula.
        uint256 shareAcc;

        // Total staked amount
        uint256 totalStakedAmount;
    }

    uint8 constant MAX_POOLS = 10;
    uint8 constant MAX_DISTRIBUTIONS = 6;
    uint8 constant MAX_ENDOWEDACCOUNTS = 10;

    address admin;
    uint8 numberOfPools;
    uint8 numberOfDistributionEras;
    Pool[MAX_POOLS] openedPools;
    Types.Distribution[MAX_DISTRIBUTIONS] distributionEras;
    uint256 lastRewardBlock;
    NutboxERC20 rewardToken;
    address factory;

    event Deposit(uint8 pid, string externalAccount, address nutboxAccount, uint256 amount);
    event Withdraw(uint8 pid, string externalAccount, address nutboxAccount, uint256 amount);
    event WithdrawRewards(address nutboxAccount, uint256 amount);
    event NewDistributionEra(uint256 amount, uint256 startHeight, uint256 stopHeight);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Account is not the admin");
        _;
    }

    constructor() {
        factory = msg.sender;
    }

    /**
     * @dev Create staking template contract instance.
     * The admin is the account who use StakingFactory contract deploy this template.
     * numberOfPools is set to zero, which would be increased one by one when pool was added.
     *
     * Notice:
     * Here we use Struct as function parameter, which supported in ABI-Encode-V2
     */
    function initialize (
        address _admin,
        NutboxERC20 _rewardToken,
        Types.Distribution[] memory _distributionEras,
        Types.EndowedAccount[] memory _endowedAccounts
    ) public {
        require(msg.sender == factory, 'Only Nutbox factory contract can create staking feast'); // sufficient check

        admin = _admin;
        numberOfPools = 0;
        numberOfDistributionEras = 0;
        lastRewardBlock = 0;
        rewardToken = _rewardToken;
        _applyDistributionEras(_distributionEras);
        _applyEndowedAccountsMining(_endowedAccounts);
    }

    function addPool(NutboxERC20 pair, uint8[] memory ratios) public onlyAdmin returns (uint8) {
        require(numberOfPools < MAX_POOLS, 'Can not add pool');
        require((numberOfPools + 1) == ratios.length, 'Wrong ratio count');

        openedPools[numberOfPools].pid = numberOfPools;
        openedPools[numberOfPools].hasActived = true;
        openedPools[numberOfPools].stakingPair = pair;
        openedPools[numberOfPools].shareAcc = 0;
        openedPools[numberOfPools].totalStakedAmount = 0;
        numberOfPools += 1;
        _applyPoolsRatio(ratios);

        return numberOfPools;
    }

    function setPoolRatios(uint8[] memory ratios) public onlyAdmin {
        _applyPoolsRatio(ratios);
    }

    function getPoolRatios() public view returns (uint8[MAX_POOLS] memory) {
        uint8[MAX_POOLS] memory ratios;
        for(uint8 i = 0; i < numberOfPools; i++) {
            ratios[i] = openedPools[i].poolRatio;
        }
        return ratios;
    }

    function getSinglePoolRatio(uint8 pid) public view returns (uint8) {
        require(pid < MAX_POOLS, 'Invalid pid');
        return openedPools[pid].poolRatio;
    }

    function getCurrentDistributionEra() public view returns (Types.Distribution memory) {
        for(uint8 i = 0; i < numberOfDistributionEras; i++) {
            if (block.number >= distributionEras[i].startHeight && block.number <= distributionEras[i].stopHeight) {
                return distributionEras[i];
            }
        }
    }

    function deposit(uint8 pid, string memory externalAccount, address nutboxAccount, uint256 amount) public {
        // check pid
        require(numberOfPools > pid, 'Pool does not exist');
        // check amount
        if (amount == 0) return;

        // we set lastRewardBlock as current block number, then our game starts!
        if (lastRewardBlock == 0) {
            lastRewardBlock = block.number;
        }

        // Add to staking list if account hasn't deposited before
        if(!openedPools[pid].stakingInfo[nutboxAccount].hasDeposited) {
            openedPools[pid].stakingInfo[nutboxAccount].hasDeposited = true;
            openedPools[pid].stakingInfo[nutboxAccount].availableRewards = 0;
            openedPools[pid].stakingInfo[nutboxAccount].externalAccount = externalAccount;
            openedPools[pid].stakingInfo[nutboxAccount].amount = 0;
            openedPools[pid].stakingInfo[nutboxAccount].userDebt = 0;
            openedPools[pid].stakingList.push(nutboxAccount);
        }

        _updatePools();

        if (openedPools[pid].stakingInfo[nutboxAccount].amount > 0) {
            uint256 pending = openedPools[pid].stakingInfo[nutboxAccount].amount.mul(openedPools[pid].shareAcc).div(1e12).sub(openedPools[pid].stakingInfo[nutboxAccount].userDebt);
            if(pending > 0) {
                openedPools[pid].stakingInfo[nutboxAccount].availableRewards = openedPools[pid].stakingInfo[nutboxAccount].availableRewards.add(pending);
            }

            openedPools[pid].stakingPair.transferFrom(msg.sender, address(this), amount);
        }

        openedPools[pid].stakingInfo[nutboxAccount].amount = openedPools[pid].stakingInfo[nutboxAccount].amount.add(amount);
        openedPools[pid].totalStakedAmount = openedPools[pid].totalStakedAmount.add(amount);

        openedPools[pid].stakingInfo[nutboxAccount].userDebt = openedPools[pid].stakingInfo[nutboxAccount].amount.mul(openedPools[pid].shareAcc).div(1e12);

        emit Deposit(pid, externalAccount, nutboxAccount, amount);
    }

    function withdraw(uint8 pid, string memory externalAccount, address nutboxAccount, uint256 amount) public {
        // check pid
        require(numberOfPools > pid, 'Pool does not exist');
        // check withdraw amount
        if (amount == 0) return;
        // check deposited amount
        if (openedPools[pid].stakingInfo[nutboxAccount].amount == 0) return;

        _updatePools();

        uint256 pending = openedPools[pid].stakingInfo[nutboxAccount].amount.mul(openedPools[pid].shareAcc).div(1e12).sub(openedPools[pid].stakingInfo[nutboxAccount].userDebt);
        if(pending > 0) {
            openedPools[pid].stakingInfo[nutboxAccount].availableRewards = openedPools[pid].stakingInfo[nutboxAccount].availableRewards.add(pending);
        }

        uint256 withdrawAmount;
        if (amount >= openedPools[pid].stakingInfo[nutboxAccount].amount)
            withdrawAmount = openedPools[pid].stakingInfo[nutboxAccount].amount;
        else
            withdrawAmount = amount;

        openedPools[pid].stakingPair.transfer(msg.sender, amount);

        openedPools[pid].stakingInfo[nutboxAccount].amount = openedPools[pid].stakingInfo[nutboxAccount].amount.sub(withdrawAmount);
        openedPools[pid].totalStakedAmount = openedPools[pid].totalStakedAmount.sub(withdrawAmount);

        openedPools[pid].stakingInfo[nutboxAccount].userDebt = openedPools[pid].stakingInfo[nutboxAccount].amount.mul(openedPools[pid].shareAcc).div(1e12);

        emit Withdraw(pid, externalAccount, nutboxAccount, withdrawAmount);
    }

    function update(uint8 pid, string memory externalAccount, address nutboxAccount, uint256 amount) public
    {
        // check pid
        require(numberOfPools > pid, 'Pool does not exist');
        // check withdraw amount
        if (amount == 0) return;

        uint256 prevAmount = openedPools[pid].stakingInfo[nutboxAccount].amount;

        if (prevAmount < amount) { // deposit
            deposit(pid, externalAccount, nutboxAccount, amount.sub(prevAmount));
        } else {   // withdraw
            withdraw(pid, externalAccount, nutboxAccount, prevAmount.sub(amount));
        }
    }

    /**
     * @dev This function would withdraw all rewards that exist in all pools which available for user
     */
    function withdrawRewards() public {

        // game has not started
        if (lastRewardBlock == 0) return;

        // There are new blocks created after last updating, so update pools before withdraw
        if(block.number > lastRewardBlock) {
            _updatePools();
        }

        uint256 totalAvailableRewards = 0;
        for (uint8 pid = 0; pid < numberOfPools; pid++) {
            uint256 pending = openedPools[pid].stakingInfo[msg.sender].amount.mul(openedPools[pid].shareAcc).div(1e12).sub(openedPools[pid].stakingInfo[msg.sender].userDebt);
            if(pending > 0) {
                openedPools[pid].stakingInfo[msg.sender].availableRewards = openedPools[pid].stakingInfo[msg.sender].availableRewards.add(pending);
            }
            // add all pools available rewards
            totalAvailableRewards.add(openedPools[pid].stakingInfo[msg.sender].availableRewards);
        }

        // transfer rewards to user
        rewardToken.transfer(msg.sender, totalAvailableRewards);

        // after tranfer successfully, update staking info
        for (uint8 pid = 0; pid < numberOfPools; pid++) {
            openedPools[pid].stakingInfo[msg.sender].userDebt = openedPools[pid].stakingInfo[msg.sender].amount.mul(openedPools[pid].shareAcc).div(1e12);
            openedPools[pid].stakingInfo[msg.sender].availableRewards = 0;
        }

        emit WithdrawRewards(msg.sender, totalAvailableRewards);
    }

    function getPoolPendingRewards(uint8 pid) public view returns(uint256) {
        uint256 currentBlock = block.number;
        // game has not started
        if (lastRewardBlock == 0) return 0;

        // our lastRewardBlock isn't up to date, as the result, the availableRewards isn't
        // the right amount that delegator can award
        if (currentBlock > lastRewardBlock) {
            uint256 _shareAcc = openedPools[pid].shareAcc;
            uint256 unmintedRewards = _calculateReward(lastRewardBlock + 1, currentBlock);
            _shareAcc = _shareAcc.add(unmintedRewards.mul(1e12).div(openedPools[pid].totalStakedAmount));
            uint256 pending = openedPools[pid].stakingInfo[msg.sender].amount.mul(_shareAcc).div(1e12).sub(openedPools[pid].stakingInfo[msg.sender].userDebt);
            return openedPools[pid].stakingInfo[msg.sender].availableRewards.add(pending);
        } else {
            return openedPools[pid].stakingInfo[msg.sender].availableRewards;
        }
    }

    function getPendingRewards() public view returns(uint256) {
        uint256 rewards = 0;
        for (uint8 pid = 0; pid < numberOfPools; pid++) {
            rewards.add(getPoolPendingRewards(pid));
        }
        return rewards;
    }

    function getPoolStakedAmount(uint8 pid) public view returns(uint256) {
        return openedPools[pid].stakingInfo[msg.sender].amount;
    }

    function getPoolTotalStakedAmount(uint8 pid) public view returns(uint256) {
        return openedPools[pid].totalStakedAmount;
    }

    function _updatePools() private {
        uint256 rewardsReadyToMinted = 0;
        uint256 currentBlock = block.number;

        // game has not started
        if (lastRewardBlock == 0) return;

        // make sure one block can only be calculated one time.
        // think about this situation that more than one deposit/withdraw/withdrowRewards transactions 
        // were exist in the same block, delegator.amout should be updated after _updateRewardInfo being 
        // invoked and it's award Rewards should be calculated next time
        if (currentBlock <= lastRewardBlock) return;

        // calculate reward Rewards under current blocks
        rewardsReadyToMinted = _calculateReward(lastRewardBlock + 1, currentBlock);

        // save all rewards to contract temporary
        rewardToken.mint(address(this), rewardsReadyToMinted);

        // update shareAcc of all pools
        for (uint8 pid; pid < numberOfPools; pid++) {
            uint256 poolRewards = rewardsReadyToMinted.mul(1e12).mul(openedPools[pid].poolRatio).div(100);
            openedPools[pid].shareAcc = openedPools[pid].shareAcc.add(poolRewards.div(openedPools[pid].totalStakedAmount));
        }

        lastRewardBlock = block.number;

        for (uint8 era = 0; era < distributionEras.length; era++) {
            if (distributionEras[era].hasPassed == false && lastRewardBlock >= distributionEras[era].stopHeight) {
                distributionEras[era].hasPassed = true;
            }
        }
    }

    function _calculateReward(uint256 from, uint256 to) internal view returns (uint256) {
        uint256 rewardedBlock = lastRewardBlock;
        uint256 rewards = 0;
        for (uint8 i = 0; i < distributionEras.length; i++) {
            if (distributionEras[i].hasPassed == true) {
                require(from > distributionEras[i].stopHeight, 'Distribution era already passed');
                continue;
            }

            if (to <= distributionEras[i].stopHeight) {
                rewards.add(to.sub(rewardedBlock).mul(distributionEras[i].amount));
                rewardedBlock = to;
                return rewards;
            } else {
                rewards.add(distributionEras[i].stopHeight.sub(rewardedBlock).mul(distributionEras[i].amount));
                rewardedBlock = distributionEras[i].stopHeight;
            }
        }
    }

    /**
     * @dev Iterate every pool to update their ratio. 
     * Every ratio is an integer between [0, 100], the summuary of all pool's ration should 
     * equal to 100.
     * Because pools always less than MAX_POOLS, so the loop is in control
     */
    function _applyPoolsRatio(uint8[] memory ratios) private {
        require(numberOfPools == ratios.length, 'Wrong ratio count');

        // precheck ratios summary
        uint8 ratioSum = 0;
        for(uint8 i = 0; i < numberOfPools; i++) {
            ratioSum += ratios[i];
        }
        require(ratioSum == 100, 'Ratio summary not equal to 100');

        // update pool ratio index
        for(uint8 i = 0; i < numberOfPools; i++) {
            openedPools[i].poolRatio = ratios[i];
        }
    }

    /**
     * @dev Check and set distribution policy
     * _distributionEras must less than or equal to MAX_DISTRIBUTIONS and all distribution should meet following condidtion: 
     * 1) hasPassed should be false
     * 2) amount should greater than 0
     * 3) first distrubtion startHeight should greater than current block height
     * 4) startHeight shold less than stopHeight
     */
    function _applyDistributionEras(Types.Distribution[] memory _distributionEras) private {
        require(_distributionEras.length <= MAX_DISTRIBUTIONS, 'Too many distribution policy');

        // prechek
        for(uint8 i = 0; i < _distributionEras.length; i++) {
            // check 1)
            require(_distributionEras[i].hasPassed == false, 'Invlalid initial state of distribution');
            // check 2)
            require(_distributionEras[i].amount > 0, 'Invalid reward amount of distribution, consider giving a positive integer');
            // check 3)
            if (i == 0) {
                require(_distributionEras[i].startHeight > block.number, 'Invalid start height of distribution');
            }
            // check 4)
            require(_distributionEras[i].startHeight < _distributionEras[i].stopHeight, 'Invalid stop height of distribution');
        }

        // set distribution policy
        for(uint8 i = 0; i < _distributionEras.length; i++) {
            distributionEras[i] = _distributionEras[i];
            numberOfDistributionEras++;
        }
    }

    function _applyEndowedAccountsMining(Types.EndowedAccount[] memory _endowedAccounts) private {
        require(_endowedAccounts.length <= MAX_ENDOWEDACCOUNTS, 'Too many endowed accounts');

        // mint reward token to them
        for(uint8 i = 0; i < _endowedAccounts.length; i++) {
            if (_endowedAccounts[i].account != address(0)) {
                rewardToken.mint(_endowedAccounts[i].account, _endowedAccounts[i].amount);
            }
        }
    }
}
