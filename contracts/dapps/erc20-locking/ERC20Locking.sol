//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/IPool.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/ICommittee.sol";
import "../../ERC20Helper.sol";

/**
 * @dev ERC20 staking pool with a lock duration on withdrawals.
 *
 * Similar to ERC20Staking, but when user withdraws, the tokens enter a
 * time-locked redeem queue. User must call redeem() after the lock period
 * to actually receive their tokens back (linearly vesting).
 */
contract ERC20Locking is IPool, ERC20Helper, ReentrancyGuard, Initializable {


    uint256 public lockDuration; // in seconds

    struct RedeemRequest {
        uint256 erc20Amount;
        uint256 claimed;
        uint256 startTime;
        uint256 endTime;
    }

    struct RequestQueue {
        uint256 index; // pointer to first unfinished request
        RedeemRequest[] queue;
    }

    struct StakingInfo {
        bool hasDeposited;
        uint256 amount;
    }

    // total staked (actively staked, not counting tokens in redeem queue)
    uint256 public totalStakedAmount;
    string public name;
    address public factory;
    address public stakeToken;
    address public community;

    mapping (address => StakingInfo) private stakingInfo;
    mapping (address => RequestQueue) private requests;

    event Locked(address indexed who, uint256 amount);
    event Unlocked(address indexed who, uint256 amount);
    event Redeemed(address indexed who, uint256 amount);

    function initialize(address _community, string memory _name, address _stakeToken, uint256 _lockDuration) external initializer {
        factory = msg.sender;
        community = _community;
        name = _name;
        stakeToken = _stakeToken;
        lockDuration = _lockDuration;
    }

    /// @dev Lock the template so it cannot be initialized directly.
    constructor() {
        _disableInitializers();
    }

    function _chargeTier3Fee() private {
        address committeeAddr = ICommunity(community).getCommittee();
        uint256 fee = ICommittee(committeeAddr).getPoolOperationFee();
        if (fee == 0) return;
        if (ICommittee(committeeAddr).getFeeFree(msg.sender)) return;
        require(msg.value >= fee, "Insufficient fee");
        address payable recipient = ICommittee(committeeAddr).getFeeRecipient();
        (bool ok, ) = recipient.call{value: fee}("");
        require(ok, "Fee transfer failed");
        if (msg.value > fee) {
            (bool ok2, ) = msg.sender.call{value: msg.value - fee}("");
            require(ok2, "Refund failed");
        }
    }

    function deposit(uint256 amount) external payable nonReentrant {
        require(ICommunity(community).poolActived(address(this)), 'Can not deposit to a closed pool.');
        if (amount == 0) return;

        _chargeTier3Fee();

        if (!stakingInfo[msg.sender].hasDeposited) {
            stakingInfo[msg.sender].hasDeposited = true;
            stakingInfo[msg.sender].amount = 0;
        }

        ICommunity(community).updatePools();

        if (stakingInfo[msg.sender].amount > 0) {
            uint256 pending = stakingInfo[msg.sender]
                .amount * ICommunity(community).getShareAcc(address(this)) / 1e12
                - ICommunity(community).getUserDebt(address(this), msg.sender);
            if (pending > 0) {
                ICommunity(community).appendUserReward(msg.sender, pending);
            }
        }

        stakingInfo[msg.sender].amount = stakingInfo[msg.sender].amount + amount;
        totalStakedAmount = totalStakedAmount + amount;

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender].amount * ICommunity(community).getShareAcc(address(this)) / 1e12
        );

        lockERC20(stakeToken, msg.sender, address(this), amount);

        emit Locked(msg.sender, amount);
    }

    function withdraw(uint256 amount) external payable nonReentrant {
        if (amount == 0) return;
        if (stakingInfo[msg.sender].amount == 0) return;

        _chargeTier3Fee();

        ICommunity(community).updatePools();

        uint256 pending = stakingInfo[msg.sender]
            .amount * ICommunity(community).getShareAcc(address(this)) / 1e12
            - ICommunity(community).getUserDebt(address(this), msg.sender);
        if (pending > 0) {
            ICommunity(community).appendUserReward(msg.sender, pending);
        }

        uint256 withdrawAmount;
        if (amount >= stakingInfo[msg.sender].amount)
            withdrawAmount = stakingInfo[msg.sender].amount;
        else withdrawAmount = amount;

        // Tokens are NOT released immediately — they go into the redeem queue
        stakingInfo[msg.sender].amount = stakingInfo[msg.sender].amount - withdrawAmount;
        totalStakedAmount = totalStakedAmount - withdrawAmount;

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender].amount * ICommunity(community).getShareAcc(address(this)) / 1e12
        );

        // Add to redeem request queue
        requests[msg.sender].queue.push(RedeemRequest({
            erc20Amount: withdrawAmount,
            claimed: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + lockDuration
        }));

        emit Unlocked(msg.sender, withdrawAmount);
    }

    /**
     * @dev Claim all vested tokens from the redeem queue (no fee charged)
     */
    function redeem() external nonReentrant {
        uint256 availableRedeem = 0;
        RequestQueue storage rq = requests[msg.sender];
        for (uint256 idx = rq.index; idx < rq.queue.length; idx++) {
            uint256 claimable = _claimableAmount(rq.queue[idx]);
            rq.queue[idx].claimed = rq.queue[idx].claimed + claimable;
            // Advance index past fully claimed requests
            if (rq.queue[idx].claimed == rq.queue[idx].erc20Amount) {
                rq.index = idx + 1;
            }
            if (claimable > 0) {
                availableRedeem = availableRedeem + claimable;
            }
        }

        require(availableRedeem > 0, "Nothing to redeem");
        // H-02: use releaseERC20 (safe transfer) instead of bare IERC20.transfer
        releaseERC20(stakeToken, msg.sender, availableRedeem);
        emit Redeemed(msg.sender, availableRedeem);
    }

    // ──────── View Functions ────────

    function redeemRequestCount(address _who) external view returns (uint256) {
        return requests[_who].queue.length - requests[_who].index;
    }

    function redeemRequests(address _who) external view returns (RedeemRequest[] memory reqs) {
        RequestQueue storage rq = requests[_who];
        uint256 count = rq.queue.length - rq.index;
        reqs = new RedeemRequest[](count);
        for (uint256 i = 0; i < count; i++) {
            reqs[i] = rq.queue[rq.index + i];
        }
    }

    function claimableAmount(address _who) external view returns (uint256 amount) {
        RequestQueue storage rq = requests[_who];
        for (uint256 idx = rq.index; idx < rq.queue.length; idx++) {
            amount = amount + _claimableAmount(rq.queue[idx]);
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

    // ──────── Internal ────────

    function _claimableAmount(RedeemRequest memory _req) private view returns (uint256 amount) {
        if (block.timestamp >= _req.endTime) {
            amount = _req.erc20Amount - _req.claimed;
        } else {
            amount = _req.erc20Amount
                    * (block.timestamp - _req.startTime)
                    / (_req.endTime - _req.startTime)
                    - _req.claimed;
        }
    }
}
