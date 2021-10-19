// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../common/Types.sol';
import '../asset/interfaces/IRegistryHub.sol';
import '../asset/handler/ERC20AssetHandler.sol';
import './calculators/ICalculator.sol';
import '../asset/handler/TrustlessAssetHandler.sol';

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
        // User's foreign account identity
        string bindAccount;
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

        bytes32 NUT;
        uint256 stakedNUT;

        // We add stakingList here to let us iterate stakingInfo sometimes
        address[] stakingList;

         // total stakers of this pool
        uint64 stakerCount;

        // Pool name that user provided
        string poolName;

        // When pool was added, we treat it actived.
        bool hasActived;

        // When pool was stopped, staking into this pool will be denied
        bool hasStopped;

        // Only assets been withdrawn back to user, pool can be removed
        bool canRemove;

        // Just set flag not removed from storage
        bool hasRemoved;

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

    address admin;
    address dev;
    uint16 devRewardRatio;    // actually fee is reward.mult(devRewardRatio).div(10000)
    uint8 public numberOfPools;
    Pool[30] public openedPools;
    uint256 public lastRewardBlock;
    bytes32 public rewardAsset;
    address immutable factory;
    address immutable registryHub;
    address public rewardCalculator;

    // fetch address use bound account
    mapping (uint8 => mapping (string => address)) public accountBindMap;

    event Addpool(bytes32 indexed pair, string poolName);
    event Deposit(uint8 indexed pid, address indexed nutboxAccount, uint256 amount);
    event Withdraw(uint8 indexed pid, address indexed nutboxAccount, uint256 amount);
    event WithdrawRewards(address indexed nutboxAccount, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "NA"); // not admin
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
        address _rewardCalculator
    ) public {
        require(msg.sender == factory, 'WP'); // wrong permission
        admin = _admin;
        dev = _admin;
        numberOfPools = 0;
        lastRewardBlock = 0;
        rewardAsset = _rewardAsset;
        rewardCalculator = _rewardCalculator;
    }

    function adminDepositReward(uint256 amount) external onlyAdmin {
       _lockAsset(keccak256(abi.encodePacked(address(this), rewardAsset, bytes("admin"))),
            rewardAsset,
            msg.sender,
            amount);
    }

    function adminWithdrawReward(uint256 amount) external onlyAdmin {
        _unlockAsset(keccak256(abi.encodePacked(address(this), rewardAsset, bytes("admin"))), rewardAsset, msg.sender, amount);
    }

    function addPool(bytes32 pair, string memory poolName, uint16[] memory ratios) external onlyAdmin{
        require(numberOfPools < 30 && (numberOfPools + 1) == ratios.length, 'WRC');// wrong pool ratio count

        // precheck ratios summary
        _checkRatioSum(ratios);

        bytes32 NUT = IRegistryHub(registryHub).getNUT();
        uint256 stakedNUT = IRegistryHub(registryHub).getStakedNUT();
        if (stakedNUT != 0) {
            _lockAsset(keccak256(abi.encodePacked(address(this), numberOfPools, bytes("NUT"))), NUT, msg.sender, stakedNUT);
        }

        _updatePools();

        if (IRegistryHub(registryHub).isTrustless(pair)) {
            TrustlessAssetHandler(IRegistryHub(registryHub).getTrustlessAssetHandler()).attachPool(
                pair,address(this), numberOfPools
            );
        }

        openedPools[numberOfPools].pid = numberOfPools;
        openedPools[numberOfPools].poolName = poolName;
        openedPools[numberOfPools].NUT = NUT;
        openedPools[numberOfPools].stakedNUT = stakedNUT;
        openedPools[numberOfPools].hasActived = true;
        openedPools[numberOfPools].hasStopped = false;
        openedPools[numberOfPools].canRemove = true;
        openedPools[numberOfPools].hasRemoved = false;
        openedPools[numberOfPools].stakingPair = pair;
        openedPools[numberOfPools].shareAcc = 0;
        openedPools[numberOfPools].totalStakedAmount = 0;
        openedPools[numberOfPools].stakerCount = 0;
        numberOfPools += 1;
        // _applyPoolsRatio never failed
        _applyPoolsRatio(ratios);
        emit Addpool(pair, poolName);
    }

    function removePool(uint8 pid) external onlyAdmin {
        require(openedPools[pid].pid == pid, 'WP'); // wrong pid
        require(openedPools[pid].hasStopped, 'PNS'); //Pool has not been stopped
        require(openedPools[pid].canRemove, 'PNR'); // Pool can not be removed'

        openedPools[pid].hasRemoved = true;

        if (openedPools[pid].stakedNUT != 0){
            bytes32 NUT = openedPools[pid].NUT;
            _unlockAsset(keccak256(abi.encodePacked(address(this), pid, bytes("NUT"))),
             NUT, msg.sender, openedPools[pid].stakedNUT);
        }
    }

    // Admin should call this methods multiple times until all users get refunded,
    // then pool.canRemove set to true, means pool can be removed safely.
    function tryWithdraw(uint8 pid) external onlyAdmin {
        require(openedPools[pid].pid == pid, 'WP'); // wrong pid
        require(openedPools[pid].hasStopped, 'PNS');

        bool isTrustless = IRegistryHub(registryHub).isTrustless(openedPools[pid].stakingPair);
        // Maybe need to change step to 50 on ethereum mainnet
        Pool storage pool = openedPools[pid];
        uint8 refund_times = 0;
        uint256 current_length = pool.stakingList.length;
        while (current_length > 0) {
            address depositor = pool.stakingList[current_length - 1];
            uint256 amount = pool.stakingInfo[depositor].amount;
            if (amount > 0) {
                // refund staking if it's home chain asset
                if (!isTrustless){
                    _unlockAsset(keccak256(abi.encodePacked(address(this), pid, pool.stakingPair)), pool.stakingPair, depositor, amount);
                }

                // update pool data
                uint256 pending = pool.stakingInfo[depositor].amount.mul(pool.shareAcc).div(1e12).sub(pool.stakingInfo[depositor].userDebt);
                if(pending > 0) {
                    openedPools[pid].stakingInfo[depositor].availableRewards = pool.stakingInfo[depositor].availableRewards.add(pending);
                }
                openedPools[pid].totalStakedAmount = pool.totalStakedAmount.sub(amount);
                openedPools[pid].stakingInfo[depositor].userDebt = 0;
                openedPools[pid].stakingInfo[depositor].amount = 0;
                refund_times = refund_times + 1;
            }
            current_length = current_length - 1;
            if (refund_times == 100) break;
        }
        if (current_length == 0) openedPools[pid].canRemove = true;
    }

    // Stop pool, then admin should call tryWithdraw() to send back assets that user staked into this pool.
    function stopPool(uint8 pid) external onlyAdmin {
        require(openedPools[pid].pid == pid, 'WP');
        require(!openedPools[pid].hasStopped, 'PHS'); // pool has stopped
        uint8 opendPoolCount = 0;
        for(uint8 i = 0; i < numberOfPools; i++) {
            if (!openedPools[i].hasStopped){
                opendPoolCount += 1;
            }
        }
        if (opendPoolCount > 1){
            require(openedPools[pid].poolRatio == 0, 'PR0'); // set pool ratio to 0 first
        }

        _updatePools();

        if (openedPools[pid].totalStakedAmount == 0) {
            // no need to withdraw staking assets to users if this is an trustless asset staking pool
            openedPools[pid].canRemove = true;
        }
        openedPools[pid].hasStopped = true;
        openedPools[pid].poolRatio = 0;
    }

    function setPoolRatios(uint16[] memory ratios) external onlyAdmin {
        require(numberOfPools >  0, 'NPE'); // No pool exist
        require((numberOfPools) == ratios.length, 'WRC'); // wrong ratio counts

        // precheck ratios summary
        _checkRatioSum(ratios);

        _updatePools();

        _applyPoolsRatio(ratios);
    }

    function deposit(uint8 pid, address depositor, uint256 amount, string memory _bindAccount) public {
        require(!openedPools[pid].hasStopped, 'PHS');

        if (IRegistryHub(registryHub).isTrustless(openedPools[pid].stakingPair)) {
            require(IRegistryHub(registryHub).getTrustlessAssetHandler() == msg.sender, 'WS');//Sender is not trustless asset handler
            internalDeposit(pid, depositor, amount, _bindAccount);
        }else{
            internalDeposit(pid, msg.sender, amount, _bindAccount);
        }
    }

    function internalDeposit(uint8 pid, address depositor, uint256 amount, string memory _bindAccount) private {
        // check pid
        require(numberOfPools > 0 && numberOfPools > pid, 'PNE'); // pool not exist
        // check amount
        if (amount == 0) return;

        // we set lastRewardBlock as current block number, then our game starts!
        if (lastRewardBlock == 0) {
            lastRewardBlock = block.number;
            openedPools[pid].canRemove = false;
        }

        // Add to staking list if account hasn't deposited before
        if(!openedPools[pid].stakingInfo[depositor].hasDeposited) {
            openedPools[pid].stakingInfo[depositor].hasDeposited = true;
            openedPools[pid].stakingInfo[depositor].availableRewards = 0;
            openedPools[pid].stakingInfo[depositor].amount = 0;
            openedPools[pid].stakingInfo[depositor].userDebt = 0;
            openedPools[pid].stakingInfo[depositor].bindAccount = _bindAccount;
            openedPools[pid].stakingList.push(depositor);
            openedPools[pid].stakerCount += 1;
            accountBindMap[pid][_bindAccount] = depositor;
        } else {
            require(keccak256(abi.encodePacked(openedPools[pid].stakingInfo[depositor].bindAccount)) == keccak256(abi.encodePacked(_bindAccount)), 'Bound account dismatch');
        }

        _updatePools();

        if (openedPools[pid].stakingInfo[depositor].amount > 0) {
            uint256 pending = openedPools[pid].stakingInfo[depositor].amount.mul(openedPools[pid].shareAcc).div(1e12).sub(openedPools[pid].stakingInfo[depositor].userDebt);
            if(pending > 0) {
                openedPools[pid].stakingInfo[depositor].availableRewards = openedPools[pid].stakingInfo[depositor].availableRewards.add(pending);
            }
        }

        if (!IRegistryHub(registryHub).isTrustless(openedPools[pid].stakingPair)) {
            _lockAsset(keccak256(abi.encodePacked(address(this), pid, openedPools[pid].stakingPair)),
             openedPools[pid].stakingPair, depositor, amount);
        }

        openedPools[pid].stakingInfo[depositor].amount = openedPools[pid].stakingInfo[depositor].amount.add(amount);
        openedPools[pid].totalStakedAmount = openedPools[pid].totalStakedAmount.add(amount);

        openedPools[pid].stakingInfo[depositor].userDebt = openedPools[pid].stakingInfo[depositor].amount.mul(openedPools[pid].shareAcc).div(1e12);

        emit Deposit(pid, depositor, amount);
    }

    function withdraw(uint8 pid, address depositor, uint256 amount) public {
        if (IRegistryHub(registryHub).isTrustless(openedPools[pid].stakingPair)) {
            require(IRegistryHub(registryHub).getTrustlessAssetHandler() == msg.sender, 'WS');
            internalWithdraw(pid, depositor, amount);
        }else{
            internalWithdraw(pid, msg.sender, amount);
        }
    }

    function internalWithdraw(uint8 pid, address depositor, uint256 amount) private {
        // check pid
        require(numberOfPools > 0 && numberOfPools > pid, 'PNE');
        // check withdraw amount
        if (amount == 0) return;
        // check deposited amount
        if (openedPools[pid].stakingInfo[depositor].amount == 0) return;

        _updatePools();

        uint256 pending = openedPools[pid].stakingInfo[depositor].amount.mul(openedPools[pid].shareAcc).div(1e12).sub(openedPools[pid].stakingInfo[depositor].userDebt);
        if(pending > 0) {
            openedPools[pid].stakingInfo[depositor].availableRewards = openedPools[pid].stakingInfo[depositor].availableRewards.add(pending);
        }

        uint256 withdrawAmount;
        if (amount >= openedPools[pid].stakingInfo[depositor].amount)
            withdrawAmount = openedPools[pid].stakingInfo[depositor].amount;
        else
            withdrawAmount = amount;

        if (!IRegistryHub(registryHub).isTrustless(openedPools[pid].stakingPair)) {
            _unlockAsset(keccak256(abi.encodePacked(address(this), pid, openedPools[pid].stakingPair)),
             openedPools[pid].stakingPair, depositor, withdrawAmount);
        }

        openedPools[pid].stakingInfo[depositor].amount = openedPools[pid].stakingInfo[depositor].amount.sub(withdrawAmount);
        openedPools[pid].totalStakedAmount = openedPools[pid].totalStakedAmount.sub(withdrawAmount);

        openedPools[pid].stakingInfo[depositor].userDebt = openedPools[pid].stakingInfo[depositor].amount.mul(openedPools[pid].shareAcc).div(1e12);

        emit Withdraw(pid, depositor, withdrawAmount);
    }

    function update(uint8 pid, address depositor, uint256 amount, string memory _bindAccount) external
    {
        uint256 prevAmount = openedPools[pid].stakingInfo[depositor].amount;

        if (prevAmount < amount) { // deposit
            deposit(pid, depositor, amount.sub(prevAmount), _bindAccount);
        } else {   // withdraw
            withdraw(pid, depositor, prevAmount.sub(amount));
        }
    }

    /**
     * @dev This function would withdraw siingle pool rewards that exist in the pool which available for user
     */    
    function withdrawPoolRewards(uint8 pid) external {
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
        availableRewards = openedPools[pid].stakingInfo[msg.sender].availableRewards;

        // transfer rewards to user
        ERC20AssetHandler(IRegistryHub(registryHub).getERC20AssetHandler()).unlockOrMintAsset(keccak256(abi.encodePacked(address(this), rewardAsset, bytes("admin"))),
        rewardAsset, msg.sender, availableRewards);

        // after tranfer successfully, update staking info
        openedPools[pid].stakingInfo[msg.sender].userDebt = openedPools[pid].stakingInfo[msg.sender].amount.mul(openedPools[pid].shareAcc).div(1e12);
        openedPools[pid].stakingInfo[msg.sender].availableRewards = 0;

        emit WithdrawRewards(msg.sender, availableRewards);
    }

    /**
     * @dev This function would withdraw all rewards that exist in all pools which available for user
     */
    function withdrawTotalRewards() external {

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
        ERC20AssetHandler(IRegistryHub(registryHub).getERC20AssetHandler()).unlockOrMintAsset(keccak256(abi.encodePacked(address(this), rewardAsset, bytes("admin"))),
        rewardAsset, msg.sender, totalAvailableRewards);

        // after tranfer successfully, update staking info
        for (uint8 pid = 0; pid < numberOfPools; pid++) {
            openedPools[pid].stakingInfo[msg.sender].userDebt = openedPools[pid].stakingInfo[msg.sender].amount.mul(openedPools[pid].shareAcc).div(1e12);
            openedPools[pid].stakingInfo[msg.sender].availableRewards = 0;
        }

        emit WithdrawRewards(msg.sender, totalAvailableRewards);
    }

    function getUserPendingRewards(uint8 pid, address user) public view returns(uint256) {
        uint256 currentBlock = block.number;
        // game has not started
        if (lastRewardBlock == 0) return 0;

        // our lastRewardBlock isn't up to date, as the result, the availableRewards isn't
        // the right amount that delegator can award
        uint256 _shareAcc = openedPools[pid].shareAcc;
        if (openedPools[pid].stakingInfo[user].amount == 0) return openedPools[pid].stakingInfo[user].availableRewards;
        if (!openedPools[pid].hasStopped){
            uint256 unmintedRewards = ICalculator(rewardCalculator).calculateReward(address(this), lastRewardBlock + 1, currentBlock).mul(10000 - devRewardRatio).div(10000);
            _shareAcc = _shareAcc.add(unmintedRewards.mul(1e12).mul(openedPools[pid].poolRatio).div(10000).div(openedPools[pid].totalStakedAmount));
        }
        uint256 pending = openedPools[pid].stakingInfo[user].amount.mul(_shareAcc).div(1e12).sub(openedPools[pid].stakingInfo[user].userDebt);
        return openedPools[pid].stakingInfo[user].availableRewards.add(pending);
    }

    function getUserTotalPendingRewards(address user) external view returns(uint256) {
        uint256 rewards = 0;
        for (uint8 pid = 0; pid < numberOfPools; pid++) {
            rewards = rewards.add(getUserPendingRewards(pid, user));
        }
        return rewards;
    }

    function getUserStakedAmount(uint8 pid, address user) external view returns(uint256) {
        return openedPools[pid].stakingInfo[user].amount;
    }

    function setAdmin(address _admin) external onlyAdmin {
        admin = _admin;
    }

    function getAdmin() external view returns(address) {
        return admin;
    }

    function setDev(address _dev) external onlyAdmin {
        dev = _dev;
    }

    function getDev() external view returns(address) {
        return dev;
    }

    function setDevRewardRatio(uint16 _ratio) external onlyAdmin {
        require(_ratio <= 10000, 'LPR'); // Pool ratio is exccedd 10000

        _updatePools();
        
        devRewardRatio = _ratio;
    }

    function getDevRewardRatio() external view returns(uint16) {
        return devRewardRatio;
    }

    function getUserDepositInfo(uint8 pid, address user) external view returns(UserStakingInfo memory) {
        return openedPools[pid].stakingInfo[user];
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
        rewardsReadyToMinted = ICalculator(rewardCalculator).calculateReward(address(this), lastRewardBlock + 1, currentBlock);

        // save all rewards to contract temporary
        if (rewardsReadyToMinted > 0) {
            if (devRewardRatio > 0) {
                // only send rewards belong to dev, reward belong to user would send when
                // they withdraw reward manually
                ERC20AssetHandler(IRegistryHub(registryHub).getERC20AssetHandler()).unlockOrMintAsset(keccak256(abi.encodePacked(address(this), rewardAsset, bytes("admin"))),
                rewardAsset,dev,rewardsReadyToMinted.mul(devRewardRatio).div(10000));

                // only rewards belong to pools can used to compute shareAcc
                rewardsReadyToMinted = rewardsReadyToMinted.mul(10000 - devRewardRatio).div(10000);
            }
        }

        // update shareAcc of all pools
        for (uint8 pid = 0; pid < numberOfPools; pid++) {
            if(openedPools[pid].totalStakedAmount == 0 || openedPools[pid].hasStopped || openedPools[pid].poolRatio == 0) continue;
            uint256 poolRewards = rewardsReadyToMinted.mul(1e12).mul(openedPools[pid].poolRatio).div(10000);
            openedPools[pid].shareAcc = openedPools[pid].shareAcc.add(poolRewards.div(openedPools[pid].totalStakedAmount));
        }

        lastRewardBlock = currentBlock;
    }

    function _checkRatioSum(uint16[] memory ratios) private view {
        uint16 ratioSum = 0;
        for(uint8 i = 0; i < ratios.length; i++) {
            if (openedPools[i].hasStopped) continue;
            ratioSum += ratios[i];
        }
        require(ratioSum == 10000, 'WPS');//Ratio summary not equal to 10000
    }

    /**
     * @dev Iterate every pool to update their ratio. 
     * Every ratio is an integer between [0, 10000], the summuary of all pool's ration should 
     * equal to 10000.
     * Because pools always less than 30, so the loop is in control
     */
    function _applyPoolsRatio(uint16[] memory ratios) private {
        // update pool ratio index
        for(uint8 i = 0; i < numberOfPools; i++) {
            openedPools[i].poolRatio = ratios[i];
        }
    }

    function _lockAsset(bytes32 source, bytes32 assetId, address depositor, uint256 amount) private {
         ERC20AssetHandler(IRegistryHub(registryHub).getERC20AssetHandler()).lockAsset(source,
            assetId,
            depositor,
            amount);
    }

    function _unlockAsset(bytes32 source, bytes32 assetId, address depositor, uint256 amount) private {
        ERC20AssetHandler(IRegistryHub(registryHub).getERC20AssetHandler()).unlockAsset(source,
            assetId,
            depositor,
            amount);
    }
}
