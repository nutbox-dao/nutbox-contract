// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../common/Types.sol';
import '../asset/interfaces/IRegistryHub.sol';
import '../asset/handler/ERC20AssetHandler.sol';

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

         // total stakers of this pool
        uint64 stakers;

        // Pool name that user provided
        string poolName;

        // When pool was added, we treat it actived.
        bool hasActived;

        // poolRatio is a configuration argument that the staking pool deployer give.
        // Case NutboxStakingTemplate contract support mult-pool staking, every pool's
        // reward of current block are distributed by this options.
        // Suport 2 decimals
        uint16 poolRatio;

        // stakingPair actually is a asset contract entity, it represents the asset user stake of this pool. 
        // Bascially, it should be a normal ERC20 token or a lptoken of a specific token exchange pair 
        // or the trustless asset.
        bytes32 stakingPair;

        // Pool accumulation factor, updated when user deposit and withdraw staking asset.
        // Used to calculate rewards of every user rewards with a giving formula.
        uint256 shareAcc;

        // Total staked amount
        uint256 totalStakedAmount;
    }

    uint8 constant MAX_POOLS = 10;
    uint8 constant MAX_DISTRIBUTIONS = 6;

    address admin;
    address dev;
    uint16 devRewardRatio;    // actually fee is reward.mult(devRewardRatio).div(10000)
    uint8 public numberOfPools;
    uint8 public numberOfDistributionEras;
    Pool[MAX_POOLS] public openedPools;
    Types.Distribution[MAX_DISTRIBUTIONS] public distributionEras;
    uint256 public lastRewardBlock;
    bytes32 public rewardAsset;
    address factory;
    address registryHub;

    event Deposit(uint8 pid, address nutboxAccount, uint256 amount);
    event Withdraw(uint8 pid, address nutboxAccount, uint256 amount);
    event WithdrawRewards(address nutboxAccount, uint256 amount);
    event NewDistributionEra(uint256 amount, uint256 startHeight, uint256 stopHeight);
    event PoolUpdated(uint8 pid, uint256 reward, uint256 shareAcc);
    event RewardComputed(uint256 from, uint256 to, uint256 reward);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Account is not the admin");
        _;
    }

    constructor(address _registryHub) {
        registryHub = _registryHub;
        factory = msg.sender;
        devRewardRatio = 0;
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
        bytes32 _rewardAsset,
        Types.Distribution[] memory _distributionEras
    ) public {
        require(msg.sender == factory, 'Only Nutbox factory contract can create staking feast'); // sufficient check

        admin = _admin;
        dev = _admin;
        numberOfPools = 0;
        numberOfDistributionEras = 0;
        lastRewardBlock = 0;
        rewardAsset = _rewardAsset;
        _applyDistributionEras(_distributionEras);
    }

    function adminDepositReward(uint256 amount) public onlyAdmin {
        bytes32 source = keccak256(abi.encodePacked(address(this), rewardAsset));
        bytes memory data = abi.encodeWithSignature(
            "lockAsset(bytes32,bytes32,address,uint256)",
            source,
            rewardAsset,
            msg.sender,
            amount
        );
        (bool success,) = IRegistryHub(registryHub).getERC20AssetHandler().call(data);
        require(success, "failed to call lockAsset");
    }

    function adminWithdrawReward(uint256 amount) public onlyAdmin {
        bytes32 source = keccak256(abi.encodePacked(address(this), rewardAsset));
        bytes memory data = abi.encodeWithSignature(
            "unlockAsset(bytes32,bytes32,address,uint256)",
            source,
            rewardAsset,
            msg.sender,
            amount
        );
        (bool success,) = IRegistryHub(registryHub).getERC20AssetHandler().call(data);
        require(success, "failed to call unlockAsset");
    }

    // function getCurrentDeposit() public view returns(uint256) {
    //     bytes32 source = keccak256(abi.encodePacked(address(this), rewardAsset));
    //     address erc20Handler = IRegistryHub(registryHub).getERC20AssetHandler();
    //     return ERC20AssetHandler(erc20Handler).getBalance(source);
    // }

    function addPool(bytes32 pair, string memory poolName, uint16[] memory ratios) public onlyAdmin returns (uint8) {
        require(numberOfPools < MAX_POOLS, 'Exceed MAX_POOLS, can not add pool any more');
        require((numberOfPools + 1) == ratios.length, 'Wrong ratio count');

        // precheck ratios summary
        _checkRatioSum(ratios);

        _updatePools();

        if (IRegistryHub(registryHub).isTrustless(pair)) {
            bytes memory data = abi.encodeWithSignature(
                "attachPool(bytes32,address,uint8)",
                pair,
                address(this),
                numberOfPools
            );
            (bool success,) = IRegistryHub(registryHub).getTrustlessAssetHandler().call(data);
            require(success, "failed to call attachPool");
        }

        openedPools[numberOfPools].pid = numberOfPools;
        openedPools[numberOfPools].poolName = poolName;
        openedPools[numberOfPools].hasActived = true;
        openedPools[numberOfPools].stakingPair = pair;
        openedPools[numberOfPools].shareAcc = 0;
        openedPools[numberOfPools].totalStakedAmount = 0;
        openedPools[numberOfPools].stakers = 0;
        numberOfPools += 1;
        // _applyPoolsRatio never failed
        _applyPoolsRatio(ratios);

        return numberOfPools;
    }

    function setPoolRatios(uint16[] memory ratios) public onlyAdmin {
        require(numberOfPools >  0, 'No pool exist');
        require((numberOfPools) == ratios.length, 'Wrong ratio count');

        // precheck ratios summary
        _checkRatioSum(ratios);

        _updatePools();

        _applyPoolsRatio(ratios);
    }

    function getPoolRatios() public view returns (uint16[MAX_POOLS] memory) {
        uint16[MAX_POOLS] memory ratios;
        for(uint16 i = 0; i < numberOfPools; i++) {
            ratios[i] = openedPools[i].poolRatio;
        }
        return ratios;
    }

    function getSinglePoolRatio(uint8 pid) public view returns (uint16) {
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

    function deposit(uint8 pid, address depositer, uint256 amount) public {
        if (IRegistryHub(registryHub).isTrustless(openedPools[pid].stakingPair)) {
            require(IRegistryHub(registryHub).getTrustlessAssetHandler() == msg.sender, 'Sender is not trustless asset handler');
        }
        internalDeposit(pid, depositer, amount);
    }

    function internalDeposit(uint8 pid, address depositer, uint256 amount) private {
        // check pid
        require(numberOfPools > 0 && numberOfPools > pid, 'Pool does not exist');
        // check distribution era 0 to see whether the game has started
        if(distributionEras[0].hasPassed == false && distributionEras[0].startHeight > block.number) return;
        // check amount
        if (amount == 0) return;

        // we set lastRewardBlock as current block number, then our game starts!
        if (lastRewardBlock == 0) {
            lastRewardBlock = block.number;
        }

        // Add to staking list if account hasn't deposited before
        if(!openedPools[pid].stakingInfo[depositer].hasDeposited) {
            openedPools[pid].stakingInfo[depositer].hasDeposited = true;
            openedPools[pid].stakingInfo[depositer].availableRewards = 0;
            openedPools[pid].stakingInfo[depositer].amount = 0;
            openedPools[pid].stakingInfo[depositer].userDebt = 0;
            openedPools[pid].stakingList.push(depositer);
            openedPools[pid].stakers += 1;
        }

        _updatePools();

        if (openedPools[pid].stakingInfo[depositer].amount > 0) {
            uint256 pending = openedPools[pid].stakingInfo[depositer].amount.mul(openedPools[pid].shareAcc).div(1e12).sub(openedPools[pid].stakingInfo[depositer].userDebt);
            if(pending > 0) {
                openedPools[pid].stakingInfo[depositer].availableRewards = openedPools[pid].stakingInfo[depositer].availableRewards.add(pending);
            }
        }

        if (!IRegistryHub(registryHub).isTrustless(openedPools[pid].stakingPair)) {
            bytes32 source = keccak256(abi.encodePacked(address(this), openedPools[pid].stakingPair));
            bytes memory data = abi.encodeWithSignature(
                "lockAsset(bytes32,bytes32,address,uint256)",
                source,
                openedPools[pid].stakingPair,
                depositer,
                amount
            );
            (bool success,) = IRegistryHub(registryHub).getERC20AssetHandler().call(data);
            require(success, "failed to call lockAsset");
        }

        openedPools[pid].stakingInfo[depositer].amount = openedPools[pid].stakingInfo[depositer].amount.add(amount);
        openedPools[pid].totalStakedAmount = openedPools[pid].totalStakedAmount.add(amount);

        openedPools[pid].stakingInfo[depositer].userDebt = openedPools[pid].stakingInfo[depositer].amount.mul(openedPools[pid].shareAcc).div(1e12);

        emit Deposit(pid, depositer, amount);
    }

    function withdraw(uint8 pid, address depositer, uint256 amount) public {
        if (IRegistryHub(registryHub).isTrustless(openedPools[pid].stakingPair)) {
            require(IRegistryHub(registryHub).getTrustlessAssetHandler() == msg.sender, 'Sender is not trustless asset handler');
        }
        internalWithdraw(pid, depositer, amount);
    }

    function internalWithdraw(uint8 pid, address depositer, uint256 amount) private {
        // check pid
        require(numberOfPools > 0 && numberOfPools > pid, 'Pool does not exist');
        // check distribution era 0 to see whether the game has started
        if(distributionEras[0].hasPassed == false && distributionEras[0].startHeight > block.number) return;
        // check withdraw amount
        if (amount == 0) return;
        // check deposited amount
        if (openedPools[pid].stakingInfo[depositer].amount == 0) return;

        _updatePools();

        uint256 pending = openedPools[pid].stakingInfo[depositer].amount.mul(openedPools[pid].shareAcc).div(1e12).sub(openedPools[pid].stakingInfo[depositer].userDebt);
        if(pending > 0) {
            openedPools[pid].stakingInfo[depositer].availableRewards = openedPools[pid].stakingInfo[depositer].availableRewards.add(pending);
        }

        uint256 withdrawAmount;
        if (amount >= openedPools[pid].stakingInfo[depositer].amount)
            withdrawAmount = openedPools[pid].stakingInfo[depositer].amount;
        else
            withdrawAmount = amount;

        if (!IRegistryHub(registryHub).isTrustless(openedPools[pid].stakingPair)) {
            bytes32 source = keccak256(abi.encodePacked(address(this), openedPools[pid].stakingPair));
            bytes memory data = abi.encodeWithSignature(
                "unlockAsset(bytes32,bytes32,address,uint256)",
                source,
                openedPools[pid].stakingPair,
                depositer,
                withdrawAmount
            );
            (bool success,) = IRegistryHub(registryHub).getERC20AssetHandler().call(data);
            require(success, "failed to call unlockAsset");
        }

        openedPools[pid].stakingInfo[depositer].amount = openedPools[pid].stakingInfo[depositer].amount.sub(withdrawAmount);
        openedPools[pid].totalStakedAmount = openedPools[pid].totalStakedAmount.sub(withdrawAmount);

        openedPools[pid].stakingInfo[depositer].userDebt = openedPools[pid].stakingInfo[depositer].amount.mul(openedPools[pid].shareAcc).div(1e12);

        emit Withdraw(pid, depositer, withdrawAmount);
    }

    function update(uint8 pid, address depositer, uint256 amount) public
    {
        uint256 prevAmount = openedPools[pid].stakingInfo[depositer].amount;

        if (prevAmount < amount) { // deposit
            deposit(pid, depositer, amount.sub(prevAmount));
        } else {   // withdraw
            withdraw(pid, depositer, prevAmount.sub(amount));
        }
    }

    /**
     * @dev This function would withdraw siingle pool rewards that exist in the pool which available for user
     */    
    function withdrawPoolRewards(uint8 pid) public {
        // game has not started
        if (lastRewardBlock == 0) return;

        // There are new blocks created after last updating, so update pools before withdraw
        if(block.number > lastRewardBlock) {
            _updatePools();
        }

        uint256 availableRewards = 0;
        uint256 pending = openedPools[pid].stakingInfo[msg.sender].amount.mul(openedPools[pid].shareAcc).div(1e12).sub(openedPools[pid].stakingInfo[msg.sender].userDebt);
        if(pending > 0) {
            openedPools[pid].stakingInfo[msg.sender].availableRewards = openedPools[pid].stakingInfo[msg.sender].availableRewards.add(pending);
        }
        // add all pools available rewards
        availableRewards = availableRewards.add(openedPools[pid].stakingInfo[msg.sender].availableRewards);

        // transfer rewards to user
        bytes32 source = keccak256(abi.encodePacked(address(this), rewardAsset));
        bytes memory data = abi.encodeWithSignature(
            "unlockOrMintAsset(bytes32,bytes32,address,uint256)",
            source,
            rewardAsset,
            msg.sender,
            availableRewards
        );
        (bool success,) = IRegistryHub(registryHub).getERC20AssetHandler().call(data);
        require(success, "failed to call unlockOrMintAsset");

        // after tranfer successfully, update staking info
        openedPools[pid].stakingInfo[msg.sender].userDebt = openedPools[pid].stakingInfo[msg.sender].amount.mul(openedPools[pid].shareAcc).div(1e12);
        openedPools[pid].stakingInfo[msg.sender].availableRewards = 0;

        emit WithdrawRewards(msg.sender, availableRewards);
    }

    /**
     * @dev This function would withdraw all rewards that exist in all pools which available for user
     */
    function withdrawTotalRewards() public {

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
            totalAvailableRewards = totalAvailableRewards.add(openedPools[pid].stakingInfo[msg.sender].availableRewards);
        }

        // transfer rewards to user
        bytes32 source = keccak256(abi.encodePacked(address(this), rewardAsset));
        bytes memory data = abi.encodeWithSignature(
            "unlockOrMintAsset(bytes32,bytes32,address,uint256)",
            source,
            rewardAsset,
            msg.sender,
            totalAvailableRewards
        );
        (bool success,) = IRegistryHub(registryHub).getERC20AssetHandler().call(data);
        require(success, "failed to call unlockOrMintAsset");

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
            uint256 unmintedRewards = _calculateReward(lastRewardBlock + 1, currentBlock).mul(10000 - devRewardRatio).div(10000);
            _shareAcc = _shareAcc.add(unmintedRewards.mul(1e12).mul(openedPools[pid].poolRatio).div(100).div(openedPools[pid].totalStakedAmount));
            uint256 pending = openedPools[pid].stakingInfo[msg.sender].amount.mul(_shareAcc).div(1e12).sub(openedPools[pid].stakingInfo[msg.sender].userDebt);
            return openedPools[pid].stakingInfo[msg.sender].availableRewards.add(pending);
        } else {
            return openedPools[pid].stakingInfo[msg.sender].availableRewards;
        }
    }

    function getTotalPendingRewards() public view returns(uint256) {
        uint256 rewards = 0;
        for (uint8 pid = 0; pid < numberOfPools; pid++) {
            rewards = rewards.add(getPoolPendingRewards(pid));
        }
        return rewards;
    }

    function getUserStakedAmount(uint8 pid) public view returns(uint256) {
        return openedPools[pid].stakingInfo[msg.sender].amount;
    }

    function getPoolTotalStakedAmount(uint8 pid) public view returns(uint256) {
        return openedPools[pid].totalStakedAmount;
    }

    function setAdmin(address _admin) public onlyAdmin {
        admin = _admin;
    }

    function getAdmin() public view returns(address) {
        return admin;
    }

    function setDev(address _dev) public onlyAdmin {
        dev = _dev;
    }

    function getDev() public view returns(address) {
        return dev;
    }

    function setDevRewardRatio(uint16 _ratio) public {
        require(_ratio <= 10000, 'can not set ratio greater than 10000');

        _updatePools();
        
        devRewardRatio = _ratio;
    }

    function getDevRewardRatio() public view returns(uint16) {
        return devRewardRatio;
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
        emit RewardComputed(lastRewardBlock + 1, currentBlock, rewardsReadyToMinted);

        // save all rewards to contract temporary
        if (rewardsReadyToMinted > 0) {
            if (devRewardRatio > 0) {
                // only send rewards belong to dev, reward belong to user would send when
                // they withdraw reward manually
                bytes32 source = keccak256(abi.encodePacked(address(this), rewardAsset));
                bytes memory data = abi.encodeWithSignature(
                    "unlockOrMintAsset(bytes32,bytes32,address,uint256)",
                    source,
                    rewardAsset,
                    dev,
                    rewardsReadyToMinted.mul(devRewardRatio).div(10000)
                );
                (bool success,) = IRegistryHub(registryHub).getERC20AssetHandler().call(data);
                require(success, "failed to call unlockOrMintAsset");

                // only rewards belong to pools can used to compute shareAcc
                rewardsReadyToMinted = rewardsReadyToMinted.mul(10000 - devRewardRatio).div(10000);
            }
        }

        // update shareAcc of all pools
        for (uint8 pid = 0; pid < numberOfPools; pid++) {
            uint256 poolRewards = rewardsReadyToMinted.mul(1e12).mul(openedPools[pid].poolRatio).div(100);
            openedPools[pid].shareAcc = openedPools[pid].shareAcc.add(poolRewards.div(openedPools[pid].totalStakedAmount));
            emit PoolUpdated(pid, poolRewards.div(1e12), openedPools[pid].shareAcc);
        }

        lastRewardBlock = currentBlock;

        for (uint8 era = 0; era < distributionEras.length; era++) {
            if (distributionEras[era].hasPassed == false && lastRewardBlock >= distributionEras[era].stopHeight) {
                distributionEras[era].hasPassed = true;
            }
        }
    }

    function _calculateReward(uint256 from, uint256 to) internal view returns (uint256) {
        uint256 rewardedBlock = lastRewardBlock;
        uint256 rewards = 0;

        if (distributionEras.length == 0) {
            rewardedBlock = to;
            return rewards;
        }

        for (uint8 i = 0; i < distributionEras.length; i++) {
            if (distributionEras[i].hasPassed == true) {
                require(from > distributionEras[i].stopHeight, 'Distribution era already passed');
                continue;
            }

            if (to <= distributionEras[i].stopHeight) {
                rewards = rewards.add(to.sub(rewardedBlock).mul(distributionEras[i].amount));
                return rewards;
            } else {
                rewards = rewards.add(distributionEras[i].stopHeight.sub(rewardedBlock).mul(distributionEras[i].amount));
                rewardedBlock = distributionEras[i].stopHeight;
            }
        }
    }

    function _checkRatioSum(uint16[] memory ratios) private pure {
        uint16 ratioSum = 0;
        for(uint16 i = 0; i < ratios.length; i++) {
            ratioSum += ratios[i];
        }
        require(ratioSum == 10000, 'Ratio summary not equal to 10000');
    }

    /**
     * @dev Iterate every pool to update their ratio. 
     * Every ratio is an integer between [0, 10000], the summuary of all pool's ration should 
     * equal to 10000.
     * Because pools always less than MAX_POOLS, so the loop is in control
     */
    function _applyPoolsRatio(uint16[] memory ratios) private {
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
}
