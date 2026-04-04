// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ICalculator.sol";
import "./interfaces/ICommunity.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IPoolFactory.sol";
import "./interfaces/ICommittee.sol";
import "./ERC20Helper.sol";

/**
 * @dev Template contract of Nutbox staking based community.
 *
 * Community Contract always returns an entity of this contract.
 * Support add serial staking pool into it.
 */
contract Community is
    ICommunity,
    ERC20Helper,
    Initializable,
    Ownable,
    ReentrancyGuard
{
    uint16 constant CONSTANTS_10000 = 10000;
    // Maximum number of active pools allowed in a community
    uint256 public constant MAX_ACTIVE_POOLS = 255;

    address public committee;
    // DAO fund ratio
    uint16 public feeRatio;
    // DAO fund address
    address private devFund;
    // Revenue can be withdrawn by community so far
    uint256 private retainedRevenue;
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
    // pool => ratios
    mapping(address => uint16) private poolRatios;
    // actived pools right now
    address[] public activedPools;
    // all created pools include closed pools
    address[] public createdPools;
    /// @dev Last settled reward head (block, second, etc.) — must match the community's `rewardCalculator` clock.
    uint256 private lastRewardCursor;
    address public communityToken;
    bool public isMintableCommunityToken;
    address public rewardCalculator;
    // Total rewards distributed to users but not yet withdrawn (conservative upper bound for safety).
    uint256 private totalUserPendingRewards;

    // events triggered by community admin
    event AdminSetFeeRatio(uint16 ratio);
    event AdminClosePool(address indexed pool);
    event AdminSetPoolRatio(address[] pools, uint16[] ratios);
    // events triggered by user
    event WithdrawRewards(address[] pool, address indexed who, uint256 amount);
    // when user update pool, there may be some fee charge to owner's account
    event PoolUpdated(address indexed who, uint256 amount);
    event DevChanged(address indexed oldDev, address indexed newDev);
    event RevenueWithdrawn(address indexed devFund, uint256 amount);

    modifier onlyPool() {
        require(whitelists[msg.sender], "PNIW"); // Pool is not in white list
        _;
    }

    /// @dev Lock the template itself so it can never be initialized directly.
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _committee,
        address _communityToken,
        address _rewardCalculator,
        bool _isMintableCommunityToken
    ) external initializer {
        require(_admin != address(0), "Invalid admin");
        require(_committee != address(0), "Invalid committee");
        require(_communityToken != address(0), "Invalid token");
        require(_rewardCalculator != address(0), "Invalid calculator");
        _transferOwnership(_admin);
        devFund = _admin;
        committee = _committee;
        communityToken = _communityToken;
        rewardCalculator = _rewardCalculator;
        isMintableCommunityToken = _isMintableCommunityToken;
        emit DevChanged(address(0), _admin);
    }

    // ──────── Internal: charge Tier 2 (community settings) fee ────────

    function _chargeTier2Fee() private {
        uint256 fee = ICommittee(committee).getCommunitySettingsFee();
        if (fee == 0) return;
        require(msg.value >= fee, "Insufficient fee");
        address payable recipient = ICommittee(committee).getFeeRecipient();
        (bool ok, ) = recipient.call{value: fee}("");
        require(ok, "Fee transfer failed");
        if (msg.value > fee) {
            (bool ok2, ) = msg.sender.call{value: msg.value - fee}("");
            require(ok2, "Refund failed");
        }
    }

    function _chargeTier3Fee() private {
        uint256 fee = ICommittee(committee).getPoolOperationFee();
        if (fee == 0) return;
        require(msg.value >= fee, "Insufficient fee");
        address payable recipient = ICommittee(committee).getFeeRecipient();
        (bool ok, ) = recipient.call{value: fee}("");
        require(ok, "Fee transfer failed");
        if (msg.value > fee) {
            (bool ok2, ) = msg.sender.call{value: msg.value - fee}("");
            require(ok2, "Refund failed");
        }
    }

    // ──────── Admin Functions ────────

    function adminSetDev(address _dev) external onlyOwner {
        require(_dev != address(0), "IA"); // Invalid address
        emit DevChanged(devFund, _dev);
        devFund = _dev;
    }

    /// @notice Anyone may call; proceeds always go to `devFund` (set by owner). No arbitrary recipient.
    function adminWithdrawRevenue() public nonReentrant {
        require(retainedRevenue > 0);
        uint256 harvestAmount = retainedRevenue;
        if (!isMintableCommunityToken) {
            uint256 balance = IERC20(communityToken).balanceOf(address(this));
            harvestAmount = balance < retainedRevenue
                ? balance
                : retainedRevenue;
        }
        retainedRevenue = retainedRevenue - harvestAmount; // Effects before Interactions
        _unlockOrMintAsset(devFund, harvestAmount);

        emit RevenueWithdrawn(devFund, harvestAmount);
    }

    function adminSetFeeRatio(uint16 _ratio) external payable onlyOwner {
        require(_ratio <= CONSTANTS_10000, "PR>1w"); //Pool ratio exceeds 10000
        _chargeTier2Fee();
        _updatePoolsInternal();

        feeRatio = _ratio;
        emit AdminSetFeeRatio(_ratio);
    }

    function adminAddPool(
        string memory poolName,
        uint16[] memory ratios,
        address poolFactory,
        bytes calldata meta
    ) external payable onlyOwner {
        require(activedPools.length < MAX_ACTIVE_POOLS, "MPR"); // Max active pools reached
        require((activedPools.length + 1) == ratios.length, "WPC"); //Wrong Pool ratio count
        require(ICommittee(committee).verifyContract(poolFactory), "UPF"); //Unsupported pool factory
        _checkRatioSum(ratios);
        _chargeTier2Fee();

        // create pool instance
        address pool = IPoolFactory(poolFactory).createPool(
            address(this),
            poolName,
            meta
        );
        _updatePoolsInternal();
        openedPools[pool] = true;
        whitelists[pool] = true;
        poolAcc[pool] = 0;
        activedPools.push(pool);
        createdPools.push(pool);
        _updatePoolRatios(ratios);
    }

    /**
     * @dev Close an active pool by its index in the activedPools array.
     * Uses array shifting to remove the pool while preserving the order of remaining pools.
     * @param poolIndex  Index of the pool to close in activedPools[]
     * @param ratios     New reward ratios for the remaining active pools (length == activedPools.length - 1)
     */
    function adminClosePool(
        uint256 poolIndex,
        uint16[] memory ratios
    ) external payable onlyOwner {
        require(poolIndex < activedPools.length, "OOB"); // Index out of bounds
        address poolAddress = activedPools[poolIndex];
        require(openedPools[poolAddress], "PIA"); // Pool is already inactived
        require(ratios.length == activedPools.length - 1, "WRL"); // Wrong ratios length
        _checkRatioSum(ratios);
        _chargeTier2Fee();

        _updatePoolsInternal();

        // Mark pool as closed
        openedPools[poolAddress] = false;

        // Maintain array order by shifting elements left to prevent ratio mismatch
        for (uint256 i = poolIndex; i < activedPools.length - 1; i++) {
            activedPools[i] = activedPools[i + 1];
        }
        activedPools.pop();

        _updatePoolRatios(ratios);
        emit AdminClosePool(poolAddress);
    }

    function adminSetPoolRatios(
        uint16[] memory ratios
    ) external payable onlyOwner {
        require(activedPools.length == ratios.length, "WL"); //Wrong ratio list length
        _checkRatioSum(ratios);
        _chargeTier2Fee();

        _updatePoolsInternal();

        _updatePoolRatios(ratios);
    }

    /**
     * @dev This function would withdraw all rewards that exist in all pools which available for user
     * This function will not only travel actived pools, but also closed pools
     */
    function withdrawPoolsRewards(
        address[] memory poolAddresses
    ) external payable nonReentrant {
        // game has not started
        if (lastRewardCursor == 0) return;
        require(poolAddresses.length > 0, "MHO1"); // Must harvest at least one pool

        // Charge Tier 3 fee for withdrawing rewards
        _chargeTier3Fee();

        // Advance accrual if the calculator's head has moved since last update
        if (ICalculator(rewardCalculator).rewardHead() > lastRewardCursor) {
            _updatePoolsInternal();
        }

        // ── Checks & Effects: accumulate rewards and clear state before transfer ──
        uint256 totalAvailableRewards = 0;
        for (uint256 i = 0; i < poolAddresses.length; i++) {
            address poolAddress = poolAddresses[i];
            require(whitelists[poolAddress], "IP"); // Illegal pool
            uint256 stakedAmount = IPool(poolAddress).getUserStakedAmount(
                msg.sender
            );

            uint256 pending = (stakedAmount * poolAcc[poolAddress]) /
                1e12 -
                userDebts[poolAddress][msg.sender];

            if (pending > 0) {
                userRewards[poolAddress][msg.sender] =
                    userRewards[poolAddress][msg.sender] +
                    pending;
            }
            totalAvailableRewards =
                totalAvailableRewards +
                userRewards[poolAddress][msg.sender];
            userDebts[poolAddress][msg.sender] =
                (stakedAmount * poolAcc[poolAddress]) /
                1e12;
            userRewards[poolAddress][msg.sender] = 0; // Zero before transfer (CEI)
        }

        // Update pending rewards tracker
        if (totalUserPendingRewards >= totalAvailableRewards) {
            totalUserPendingRewards -= totalAvailableRewards;
        } else {
            totalUserPendingRewards = 0;
        }

        // ── Interactions: transfer rewards to user ──
        _unlockOrMintAsset(msg.sender, totalAvailableRewards);
        emit WithdrawRewards(poolAddresses, msg.sender, totalAvailableRewards);
    }

    function getPoolPendingRewards(
        address poolAddress,
        address user
    ) public view returns (uint256) {
        // game has not started
        if (lastRewardCursor == 0) return 0;

        uint256 head = ICalculator(rewardCalculator).rewardHead();
        uint256 rewardsReadyToMintedToPools = (ICalculator(rewardCalculator)
            .calculateReward(address(this), lastRewardCursor, head) *
            (10000 - feeRatio)) / 10000;
        // our lastRewardCursor isn't up to date, as the result, the availableRewards isn't
        // the right amount that delegator can award
        uint256 stakedAmount = IPool(poolAddress).getUserStakedAmount(user);
        if (stakedAmount == 0) return userRewards[poolAddress][user];
        uint256 totalStakedAmount = IPool(poolAddress).getTotalStakedAmount();
        // M-03: formula aligned with _updatePoolsInternal to avoid integer-division discrepancy
        uint256 pendingPoolRewards = (rewardsReadyToMintedToPools *
            1e12 *
            poolRatios[poolAddress]) / CONSTANTS_10000;
        uint256 _shareAcc = poolAcc[poolAddress] +
            (pendingPoolRewards / totalStakedAmount);
        uint256 pending = (stakedAmount * _shareAcc) /
            1e12 -
            userDebts[poolAddress][user];
        return userRewards[poolAddress][user] + pending;
    }

    function getTotalPendingRewards(
        address user
    ) external view returns (uint256) {
        uint256 rewards = 0;
        for (uint256 i = 0; i < createdPools.length; i++) {
            rewards = rewards + getPoolPendingRewards(createdPools[i], user);
        }
        return rewards;
    }

    function poolActived(address pool) external view override returns (bool) {
        return openedPools[pool];
    }

    function getShareAcc(
        address pool
    ) external view override returns (uint256) {
        return poolAcc[pool];
    }

    function getCommunityToken() external view override returns (address) {
        return communityToken;
    }

    function getCommittee() external view override returns (address) {
        return committee;
    }

    /// @notice Last value of `rewardHead()` fully applied in `_updatePoolsInternal` (0 = not initialized).
    function getLastRewardCursor() external view returns (uint256) {
        return lastRewardCursor;
    }

    function getUserDebt(
        address pool,
        address user
    ) external view override returns (uint256) {
        return userDebts[pool][user];
    }

    // Pool callable only
    function appendUserReward(
        address user,
        uint256 amount
    ) external override onlyPool {
        userRewards[msg.sender][user] = userRewards[msg.sender][user] + amount;
    }

    // Pool callable only
    function setUserDebt(
        address user,
        uint256 debt
    ) external override onlyPool {
        userDebts[msg.sender][user] = debt;
    }

    // Pool callable only — no fee charged here (pool already charged Tier 3)
    function updatePools() external override onlyPool {
        _updatePoolsInternal();
    }

    function _updatePoolsInternal() private {
        uint256 rewardsReadyToMinted = 0;
        uint256 head = ICalculator(rewardCalculator).rewardHead();

        if (lastRewardCursor == 0) {
            lastRewardCursor = head;
            return;
        }

        // Same head (same block or same second): only the first pool/user op in that tick accrues;
        // later calls in the same tick see head <= lastRewardCursor and return.
        if (head <= lastRewardCursor) return;

        rewardsReadyToMinted = ICalculator(rewardCalculator).calculateReward(
            address(this),
            lastRewardCursor,
            head
        );

        // save all rewards to contract temporary
        if (rewardsReadyToMinted > 0) {
            if (feeRatio > 0) {
                // only send rewards belong to community, reward belong to user would send when
                // they withdraw reward manually
                uint256 feeAmount = (rewardsReadyToMinted * feeRatio) /
                    CONSTANTS_10000;
                retainedRevenue = retainedRevenue + feeAmount;
                // M-02: use subtraction to ensure fee + user rewards == total (no precision loss)
                rewardsReadyToMinted = rewardsReadyToMinted - feeAmount;
                emit PoolUpdated(msg.sender, feeAmount);
            }
            // Track rewards allocated to users (conservative: before empty-pool filtering)
            totalUserPendingRewards += rewardsReadyToMinted;
        }

        for (uint256 i = 0; i < activedPools.length; i++) {
            address poolAddress = activedPools[i];
            uint256 totalStakedAmount = IPool(poolAddress)
                .getTotalStakedAmount();
            if (totalStakedAmount == 0 || poolRatios[poolAddress] == 0)
                continue;
            // M-03: formula aligned with getPoolPendingRewards view function
            uint256 poolRewards = (rewardsReadyToMinted *
                1e12 *
                poolRatios[poolAddress]) / CONSTANTS_10000;
            poolAcc[poolAddress] =
                poolAcc[poolAddress] +
                (poolRewards / totalStakedAmount);
        }

        lastRewardCursor = head;
    }

    function _checkRatioSum(uint16[] memory ratios) private pure {
        uint256 ratioSum = 0;
        for (uint256 i = 0; i < ratios.length; i++) {
            ratioSum += ratios[i];
        }
        require(
            ratioSum == uint256(CONSTANTS_10000) || ratioSum == 0,
            "RS!=1w"
        ); //Ratio summary not equal to 10000
    }

    function _updatePoolRatios(uint16[] memory ratios) private {
        for (uint256 i = 0; i < activedPools.length; i++) {
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
