// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/ICalculator.sol";
import "./interfaces/ICommunity.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IPoolFactory.sol";
import "./interfaces/ICommittee.sol";
import "./ERC20Helper.sol";

/**
 * @dev Template contract of Nutbox staking based communnity.
 *
 * Community Contract always returns an entity of this contract.
 * Support add serial staking pool into it.
 */
contract Community is ICommunity, ERC20Helper, Ownable {

    using SafeMath for uint256;

    address committee;
    uint16 public feeRatio;    // actually fee is reward.mult(feeRatio).div(10000)
    // pool => hasOpened
    mapping(address => bool) public openedPools;
    // pool => shareAcc
    mapping(address => uint256) public poolAcc;
    // pool => user => amount
    mapping(address => mapping(address => uint256)) public userRewards;
    // pool => user => amount
    mapping(address => mapping(address => uint256)) public userDebts;
    // pool => canUpdate
    mapping(address => bool) public whitelists;
    address[] public activedPools;
    address[] public createdPools;
    uint16[] public poolRatios;
    uint256 public lastRewardBlock;
    address public communityToken;
    bool public isMintableCommunityToken;
    address public factory;
    address public rewardCalculator;

    // events triggered by community admin
    event AdminSetFeeRatio(uint16 ratio);
    event AdminDepositeReward(address indexed token, uint256 amount);
    event AdminWithdrawReward(address indexed token, uint256 amount);
    event AdminAddPool(address indexed pool, string name);
    event AdminClosePool(address indexed pool);
    event AdminOpenPool(address indexed pool);
    event AdminSetPoolRatio(address[] pools, uint16[] ratios);

    // events triggered by user
    event WithdrawRewards(address who, uint256 amount);

    constructor(address _committee) {
        committee = _committee;
        factory = msg.sender;
        feeRatio = 0;
    }

    function getOwner() external view override returns (address) {
        return owner();
    }

    /**
     * @dev Create staking template contract instance.
     * The admin is the account who use Community contract deploy this template.
     *
     * Notice:
     * Here we use Struct as function parameter, which supported in ABI-Encode-V2
     */
    function initialize (
        address _admin,
        address _communityToken,
        address _rewardCalculator
    ) public {
        require(msg.sender == factory, 'Call is not factory');

        // tranfer ownership from factory to community owner
        transferOwnership(_admin);

        // pay fee for community creating
        lockERC20(ICommittee(committee).getNut(), _admin, ICommittee(committee).getTreasury(), ICommittee(committee).getFee('CREATING_COMMUNITY'));
        ICommittee(committee).updateLedger('CREATING_COMMUNITY', address(this), _admin);

        lastRewardBlock = 0;
        communityToken = _communityToken;
        rewardCalculator = _rewardCalculator;
    }

    function adminSetFeeRatio(uint16 _ratio) external onlyOwner {
        require(_ratio <= 10000, 'Pool ratio is exccedd 10000');

        _updatePoolsWithFee(owner());
        
        feeRatio = _ratio;
        emit AdminSetFeeRatio(_ratio);
    }

    function adminDepositReward(uint256 amount) external onlyOwner {
        lockERC20(communityToken, msg.sender, address(this), amount);
        emit AdminDepositeReward(communityToken, amount);
    }

    function adminWithdrawReward(uint256 amount) external onlyOwner {
        releaseERC20(communityToken, msg.sender, amount);
        emit AdminWithdrawReward(communityToken, amount);
    }

    function adminAddPool(string memory poolName, uint16[] memory ratios, address poolFactory, bytes calldata meta) external onlyOwner {
        require((activedPools.length + 1) == ratios.length, 'Wrong Pool ratio count');
        require(ICommittee(committee).verifyContract(poolFactory) == true, 'Unsupported pool factory');
        _checkRatioSum(ratios);

        // create pool imstance
        address pool = IPoolFactory(poolFactory).createPool(address(this), meta);
        openedPools[pool] = true;
        whitelists[pool] = true;
        poolAcc[pool] = 0;
        activedPools.push(pool);
        createdPools.push(pool);
        poolRatios = ratios;

        _updatePoolsWithFee(owner());

        lockERC20(ICommittee(committee).getNut(), msg.sender, ICommittee(committee).getTreasury(), ICommittee(committee).getFee('CREATING_POOL'));
        ICommittee(committee).updateLedger('CREATING_POOL', address(this), msg.sender);

        emit AdminAddPool(pool, poolName);
    }

    function adminClosePool(address poolAddress, address[] memory _activedPools, uint16[] memory ratios) external onlyOwner {
        require(openedPools[poolAddress] == true, 'Pool is already inactived');
        require(_activedPools.length == ratios.length, 'Length of pools and ratios dismatch');
        _checkRatioSum(ratios);

        _updatePoolsWithFee(owner());

        // mark as inactived
        openedPools[poolAddress] = false;
        activedPools = _activedPools;
        poolRatios = ratios;

        emit AdminSetPoolRatio(activedPools, ratios);
        emit AdminClosePool(poolAddress);
    }

    function adminOpenPool(address poolAddress, address[] memory _activedPools, uint16[] memory ratios) external onlyOwner {
        require(openedPools[poolAddress] == false, 'Pool is actived');
        require(_activedPools.length == ratios.length, 'Length of pools and ratios dismatch');
        // check whether pool is exist in given active pool list
        bool canOpen = false;
        for (uint16 i = 0; i < _activedPools.length; i++) {
            if (_activedPools[i] == poolAddress) canOpen = true;
        }
        require(canOpen, 'Wrong pool address or active pool list');
        _checkRatioSum(ratios);

        _updatePoolsWithFee(owner());

        // mark as actived
        openedPools[poolAddress] = true;
        activedPools = _activedPools;
        poolRatios = ratios;

        emit AdminSetPoolRatio(activedPools, ratios);
        emit AdminOpenPool(poolAddress);
    }

    function adminSetPoolRatios(uint16[] memory ratios) external onlyOwner {
        require(activedPools.length == ratios.length, 'Wrong ratio list length');
        _checkRatioSum(ratios);

        _updatePoolsWithFee(owner());

        poolRatios = ratios;

        emit AdminSetPoolRatio(activedPools, ratios);
    }

    /**
     * @dev This function would withdraw siingle pool rewards that exist in the pool which available for user
     */
    function withdrawPoolRewards(address poolAddress) external {
        // game has not started
        if (lastRewardBlock == 0) return;

        // There are new blocks created after last updating, so update pools before withdraw
        if(block.number > lastRewardBlock) {
            _updatePoolsWithFee(msg.sender);
        }

        uint256 stakedAmount = IPool(poolAddress).getUserStakedAmount(msg.sender);
        uint256 availableRewards = 0;
        uint256 pending = stakedAmount.mul(poolAcc[poolAddress]).div(1e12).sub(userDebts[poolAddress][msg.sender]);
        if(pending > 0) {
            userRewards[poolAddress][msg.sender] = userRewards[poolAddress][msg.sender].add(pending);
        }
        availableRewards = userRewards[poolAddress][msg.sender];
        // transfer rewards to user
        _unlockOrMintAsset(communityToken, msg.sender, availableRewards);

        // after tranfer successfully, update staking info
        userDebts[poolAddress][msg.sender] = stakedAmount.mul(poolAcc[poolAddress]).div(1e12);
        userRewards[poolAddress][msg.sender] = 0;

        emit WithdrawRewards(msg.sender, availableRewards);
    }

    /**
     * @dev This function would withdraw all rewards that exist in all pools which available for user
     * This function will not only travel actived pools, but also closed pools
     */
    function withdrawTotalRewards() external {

        // game has not started
        if (lastRewardBlock == 0) return;

        // There are new blocks created after last updating, so update pools before withdraw
        if(block.number > lastRewardBlock) {
            _updatePoolsWithFee(msg.sender);
        }

        uint256 totalAvailableRewards = 0;
        for (uint8 i = 0; i < createdPools.length; i++) {
            address poolAddress = createdPools[i];
            uint256 stakedAmount = IPool(poolAddress).getUserStakedAmount(msg.sender);

            uint256 pending = stakedAmount.mul(poolAcc[poolAddress]).div(1e12).sub(userDebts[poolAddress][msg.sender]);
            if(pending > 0) {
                userRewards[poolAddress][msg.sender] = userRewards[poolAddress][msg.sender].add(pending);
            }
            // add all pools available rewards
            totalAvailableRewards = totalAvailableRewards.add(userRewards[poolAddress][msg.sender]);
        }

        // transfer rewards to user
        _unlockOrMintAsset(communityToken, msg.sender, totalAvailableRewards);

        // after tranfer successfully, update staking info
        for (uint8 i = 0; i < createdPools.length; i++) {
            address poolAddress = createdPools[i];
            uint256 stakedAmount = IPool(poolAddress).getUserStakedAmount(msg.sender);
            userDebts[poolAddress][msg.sender] = stakedAmount.mul(poolAcc[poolAddress]).div(1e12);
            userRewards[poolAddress][msg.sender] = 0;
        }

        emit WithdrawRewards(msg.sender, totalAvailableRewards);
    }

    function getPoolPendingRewards(address poolAddress, address user) public view returns(uint256) {
        // game has not started
        if (lastRewardBlock == 0) return 0;

        // our lastRewardBlock isn't up to date, as the result, the availableRewards isn't
        // the right amount that delegator can award
        uint256 _shareAcc = poolAcc[poolAddress];
        uint256 stakedAmount = IPool(poolAddress).getUserStakedAmount(msg.sender);
        if (stakedAmount == 0) return userRewards[poolAddress][user];
        uint256 pending = stakedAmount.mul(_shareAcc).div(1e12).sub(userRewards[poolAddress][user]);
        return userRewards[poolAddress][user].add(pending);
    }

    function getTotalPendingRewards(address user) external view returns(uint256) {
        uint256 rewards = 0;
        for (uint16 i = 0; i < createdPools.length; i++) {
            rewards = rewards.add(getPoolPendingRewards(createdPools[i], user));
        }
        return rewards;
    }

    function poolActived(address pool) external view override returns(bool) {
        return openedPools[pool];
    }

    function getShareAcc(address pool) external view override returns (uint256) {
        return poolAcc[pool];
    }

    function getUserDebt(address pool, address user)
        external
        view
        override returns (uint256) {
        return userDebts[pool][user];
    }

    function appendUserReward(address pool, address user, uint256 amount) external override {
        require(whitelists[msg.sender], 'Perssion denied: pool not in whitelist');
        userRewards[pool][user] = userRewards[pool][user].add(amount);
    }

    function setUserDebt(address pool, address user, uint256 debt) external override {
        require(whitelists[msg.sender], 'Perssion denied: pool not in whitelist');
        userDebts[pool][user] = debt;
    }

    function updatePools(address feePayer) external override {
        require(whitelists[msg.sender], 'Perssion denied: pool not in whitelist');
        _updatePoolsWithFee(feePayer);
    }

    function _updatePoolsWithFee(address feePayer) private {

        // need pay staking fee whenever update pools
        
        lockERC20(ICommittee(committee).getNut(), feePayer, ICommittee(committee).getTreasury(), ICommittee(committee).getFee('STAKING'));
        ICommittee(committee).updateLedger('STAKING', address(this), feePayer);

        uint256 rewardsReadyToMinted = 0;
        uint256 currentBlock = block.number;

        if (lastRewardBlock == 0) {
            lastRewardBlock = currentBlock;
        }

        // make sure one block can only be calculated one time.
        // think about this situation that more than one deposit/withdraw/withdrowRewards transactions 
        // were exist in the same block, delegator.amout should be updated after _updateRewardInfo being 
        // invoked and it's award Rewards should be calculated next time
        if (currentBlock <= lastRewardBlock) return;

        // calculate reward Rewards under current blocks
        rewardsReadyToMinted = ICalculator(rewardCalculator).calculateReward(address(this), lastRewardBlock + 1, currentBlock);

        // save all rewards to contract temporary
        if (rewardsReadyToMinted > 0) {
            if (feeRatio > 0) {
                // only send rewards belong to community, reward belong to user would send when
                // they withdraw reward manually
                _unlockOrMintAsset(communityToken, owner(), rewardsReadyToMinted.mul(feeRatio).div(10000));

                // only rewards belong to pools can used to compute shareAcc
                rewardsReadyToMinted = rewardsReadyToMinted.mul(10000 - feeRatio).div(10000);
            }
        }

        for (uint16 i = 0; i < activedPools.length; i++) {
            address poolAddress = activedPools[i];
            uint256 totalStakedAmount = IPool(poolAddress).getTotalStakedAmount();
            if(totalStakedAmount == 0 || poolRatios[i] == 0) continue;
            uint256 poolRewards = rewardsReadyToMinted.mul(1e12).mul(poolRatios[i]).div(10000);
            poolAcc[poolAddress] = poolAcc[poolAddress].add(poolRewards.div(totalStakedAmount));
        }

        lastRewardBlock = currentBlock;
    }

    function _checkRatioSum(uint16[] memory ratios) private pure {
        uint16 ratioSum = 0;
        for(uint8 i = 0; i < ratios.length; i++) {
            ratioSum += ratios[i];
        }
        require(ratioSum == 10000, 'Ratio summary not equal to 10000');
    }

    function _unlockOrMintAsset(address token, address recipient, uint256 amount) private {
        if (isMintableCommunityToken) {
            mintERC20(token, address(recipient), amount);
        } else {
            releaseERC20(token, address(recipient), amount);
        }
    }
}
