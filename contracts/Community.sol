// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/ICalculator.sol";
import "./interfaces/ICommunity.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IPoolFactory.sol";
import "./interfaces/ICommittee.sol";
import "./ERC20Helper.sol";
import "./CommunityFactory.sol";

/**
 * @dev Template contract of Nutbox staking based communnity.
 *
 * Community Contract always returns an entity of this contract.
 * Support add serial staking pool into it.
 */
contract Community is ICommunity, ERC20Helper, Ownable {

    using SafeMath for uint256;

    address immutable committee;
    uint16 public feeRatio;    // actually fee is reward.mult(feeRatio).div(10000)
    // pool => hasOpened
    mapping(address => bool) private openedPools;
    // pool => shareAcc
    mapping(address => uint256) private poolAcc;
    // pool => user => amount
    mapping(address => mapping(address => uint256)) private userRewards;
    // pool => user => amount
    mapping(address => mapping(address => uint256)) private userDebts;
    // pool => canUpdate, all added pools
    mapping(address => bool) private whitelists;
    address[] public activedPools;
    address[] public createdPools;
    mapping(address => uint16) private poolRatios;
    uint256 private lastRewardBlock;
    address immutable public communityToken;
    bool immutable public isMintableCommunityToken;
    address immutable public rewardCalculator;
    // DAO fund address
    address private devFund;
    // DAO fund balance that havent harvest by admin
    uint256 private fundBalance; 
    address private communityFactory;

    // events triggered by community admin
    event AdminSetFeeRatio(uint16 ratio);
    event AdminClosePool(address indexed pool);
    event AdminSetPoolRatio(address[] pools, uint16[] ratios);
    // events triggered by user
    event WithdrawRewards(address[] pool, address indexed who, uint256 amount);
    // when user update pool, there may be some fee charge to owner's account
    event PoolUpdated(address indexed who, uint256 amount);
    event DevChanged(address indexed devFund, address indexed _dev);
    event HarvestDev(uint256 amount);

    constructor(address _admin, address _committee, address _communityFactory, address _communityToken, address _rewardCalculator, bool _isMintableCommunityToken) {
        transferOwnership(_admin);
        devFund = _admin;
        committee = _committee;
        communityFactory = _communityFactory;
        communityToken = _communityToken;
        rewardCalculator = _rewardCalculator;
        isMintableCommunityToken = _isMintableCommunityToken;
        emit DevChanged(address(0), _admin);
    }
    function transferOwnership(address newOwner) public onlyOwner override {
        CommunityFactory(communityFactory).updateOwner(msg.sender, newOwner);
        super.transferOwnership(newOwner);
    }
    function resetDev(address _dev) external onlyOwner {
        require(_dev != address(0), "IA"); // Invalid address
        emit DevChanged(devFund, _dev);
        devFund = _dev;
    }
    function harvestDev() external onlyOwner {
        require(fundBalance > 0);
        uint256 harvestAmount = fundBalance;
        if (!isMintableCommunityToken){
            uint256 balance = ERC20(communityToken).balanceOf(address(this));
            harvestAmount = balance < fundBalance ? balance : fundBalance;
        }
        _unlockOrMintAsset(devFund, harvestAmount);
        fundBalance = fundBalance.sub(harvestAmount);

        emit HarvestDev(harvestAmount);
    }
    
    function adminSetFeeRatio(uint16 _ratio) external onlyOwner {
        require(_ratio <= 10000, 'PR>1w');//Pool ratio is exccedd 10000
        require(isMintableCommunityToken, "CCNF");// Cant change non-mintable fee ratio

        _updatePoolsWithFee("ADMIN_SET_FEE_RATIO", owner(), address(0));
        
        feeRatio = _ratio;
        emit AdminSetFeeRatio(_ratio);
    }
    
    function adminWithdrawReward(uint256 amount) external onlyOwner {
        releaseERC20(communityToken, msg.sender, amount);
    }
    
    function adminAddPool(string memory poolName, uint16[] memory ratios, address poolFactory, bytes calldata meta) external onlyOwner {
        require((activedPools.length + 1) == ratios.length, 'WPC');//Wrong Pool ratio count
        require(ICommittee(committee).verifyContract(poolFactory), 'UPF');//Unsupported pool factory
        _checkRatioSum(ratios);

        // create pool imstance
        address pool = IPoolFactory(poolFactory).createPool(address(this), poolName, meta);
        _updatePoolsWithFee("CREATING_POOL", owner(), pool);
        openedPools[pool] = true;
        whitelists[pool] = true;
        poolAcc[pool] = 0;
        activedPools.push(pool);
        createdPools.push(pool);
        _updatePoolRatios(ratios);
    }
    
    function adminClosePool(address poolAddress, address[] memory _activedPools, uint16[] memory ratios) external onlyOwner {
        require(openedPools[poolAddress], 'PIA');// Pool is already inactived
        require(_activedPools.length == activedPools.length - 1, "WAPL");//Wrong activedPools length
        require(_activedPools.length == ratios.length, 'LDM');//Length of pools and ratios dismatch
        // check received actived pools array right
        for (uint256 i = 0; i < _activedPools.length; i ++) {
            require(openedPools[_activedPools[i]], "WP"); // Wrong active pool address
        }
        _checkRatioSum(ratios);

        _updatePoolsWithFee("CLOSING_POOL", owner(), poolAddress);

        // mark as inactived
        openedPools[poolAddress] = false;
        activedPools = _activedPools;
        _updatePoolRatios(ratios);

        emit AdminClosePool(poolAddress);
    }
    
    function adminSetPoolRatios(uint16[] memory ratios) external onlyOwner {
        require(activedPools.length == ratios.length, 'WL');//Wrong ratio list length
        _checkRatioSum(ratios);

        _updatePoolsWithFee("SET_POOL_RATIO", owner(), address(0));

        _updatePoolRatios(ratios);
    }

    /**
     * @dev This function would withdraw all rewards that exist in all pools which available for user
     * This function will not only travel actived pools, but also closed pools
     */
    function withdrawPoolsRewards(address[] memory poolAddresses) external {
        // game has not started
        if (lastRewardBlock == 0) return;
        require(poolAddresses.length > 0, "MHO1"); // Must harvest at least one pool

        // There are new blocks created after last updating, so update pools before withdraw
        if(block.number > lastRewardBlock) {
            _updatePoolsWithFee("WITHDRAW_REWARDS", msg.sender, poolAddresses[0]);
        }

        uint256 totalAvailableRewards = 0;
        for (uint8 i = 0; i < poolAddresses.length; i++) {
            address poolAddress = poolAddresses[i];
            require(whitelists[poolAddress], "IP"); // Illegal pool
            uint256 stakedAmount = IPool(poolAddress).getUserStakedAmount(msg.sender);

            uint256 pending = stakedAmount.mul(poolAcc[poolAddress]).div(1e12).sub(userDebts[poolAddress][msg.sender]);
            if(pending > 0) {
                userRewards[poolAddress][msg.sender] = userRewards[poolAddress][msg.sender].add(pending);
            }
            // add all pools available rewards
            totalAvailableRewards = totalAvailableRewards.add(userRewards[poolAddress][msg.sender]);
            userDebts[poolAddress][msg.sender] = stakedAmount.mul(poolAcc[poolAddress]).div(1e12);
            userRewards[poolAddress][msg.sender] = 0;
        }

        // transfer rewards to user
        _unlockOrMintAsset(msg.sender, totalAvailableRewards);
        emit WithdrawRewards(poolAddresses, msg.sender, totalAvailableRewards);
    }

    function getPoolPendingRewards(address poolAddress, address user) public view returns(uint256) {
        // game has not started
        if (lastRewardBlock == 0) return 0;

        uint256 rewardsReadyToMintedToPools = ICalculator(rewardCalculator).calculateReward(address(this), lastRewardBlock + 1, block.number).mul(10000 - feeRatio).div(10000);
        // our lastRewardBlock isn't up to date, as the result, the availableRewards isn't
        // the right amount that delegator can award
        uint256 stakedAmount = IPool(poolAddress).getUserStakedAmount(user);
        if (stakedAmount == 0) return userRewards[poolAddress][user];
        uint256 totalStakedAmount = IPool(poolAddress).getTotalStakedAmount();
        uint256 _shareAcc = poolAcc[poolAddress].add(rewardsReadyToMintedToPools.mul(poolRatios[poolAddress]).mul(1e8).div(totalStakedAmount));
        uint256 pending = stakedAmount.mul(_shareAcc).div(1e12).sub(userDebts[poolAddress][user]);
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

    function appendUserReward(address user, uint256 amount) external override {
        require(whitelists[msg.sender], 'PNIW');// Perssion denied: pool not in whitelist
        userRewards[msg.sender][user] = userRewards[msg.sender][user].add(amount);
    }

    function setUserDebt(address user, uint256 debt) external override {
        require(whitelists[msg.sender], 'PNIW'); // Perssion denied: pool not in whitelist
        userDebts[msg.sender][user] = debt;
    }

    function updatePools(string memory feeType, address feePayer) external override {
        require(whitelists[msg.sender], 'PNIW'); // Perssion denied: pool not in whitelist
        _updatePoolsWithFee(feeType, feePayer, msg.sender);
    }

    function _updatePoolsWithFee(string memory feeType, address feePayer, address pool) private {

        // need pay staking fee whenever update pools
        if (!ICommittee(committee).getFeeIgnore(feePayer) && ICommittee(committee).getFee(feeType) > 0){
            lockERC20(ICommittee(committee).getNut(), feePayer, ICommittee(committee).getTreasury(), ICommittee(committee).getFee(feeType));
            ICommittee(committee).updateLedger(feeType, address(this), pool, feePayer);
        }

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
                uint256 feeAmount = rewardsReadyToMinted.mul(feeRatio).div(10000);
                fundBalance = fundBalance.add(feeAmount);

                // only rewards belong to pools can used to compute shareAcc
                rewardsReadyToMinted = rewardsReadyToMinted.mul(10000 - feeRatio).div(10000);
                emit PoolUpdated(feePayer, feeAmount);
            }
        }

        for (uint16 i = 0; i < activedPools.length; i++) {
            address poolAddress = activedPools[i];
            uint256 totalStakedAmount = IPool(poolAddress).getTotalStakedAmount();
            if(totalStakedAmount == 0 || poolRatios[poolAddress] == 0) continue;
            uint256 poolRewards = rewardsReadyToMinted.mul(1e12).mul(poolRatios[poolAddress]).div(10000);
            poolAcc[poolAddress] = poolAcc[poolAddress].add(poolRewards.div(totalStakedAmount));
        }

        lastRewardBlock = currentBlock;
    }

    function _checkRatioSum(uint16[] memory ratios) private pure {
        uint16 ratioSum = 0;
        for(uint8 i = 0; i < ratios.length; i++) {
            ratioSum += ratios[i];
        }
        require(ratioSum == 10000 || ratioSum == 0, 'RS!=1w');//Ratio summary not equal to 10000
    }

    function _updatePoolRatios(uint16[] memory ratios) private {
        for (uint16 i = 0; i < activedPools.length; i++) {
            poolRatios[activedPools[i]] = ratios[i];
        }
        emit AdminSetPoolRatio(activedPools, ratios);
    }

    function _unlockOrMintAsset(address recipient, uint256 amount) private {
        if (isMintableCommunityToken) {
            mintERC20(communityToken, address(recipient), amount);
        } else {
            releaseERC20(communityToken, address(recipient), amount);
        }
    }
}
