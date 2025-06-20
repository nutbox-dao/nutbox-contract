//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/IPool.sol";
import "../../ERC20Helper.sol";

contract ERC20Locking is IPool, ERC20Helper, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 immutable public lockDuration;

    struct RedeemRequest {
        uint256 erc20Amount;
        uint256 claimed;
        uint256 startTime;
        uint256 endTime;
    }

    struct RequestsOfPeriod {
        uint256 index;
        RedeemRequest[] queue;
    }

    struct StakingInfo {
        // First time when user staking, we need set options like userDebt to zero
        bool hasDeposited;
        // User staked amount
        uint256 amount;
    }

    address public erc20;
    // total locked erc20
    uint256 public totalStakedAmount;
    string public name;
    address immutable factory;

    // stakeToken actually is a asset contract entity, it represents the asset user stake of this pool.
    // Bascially, it should be a normal ERC20 token or a lptoken of a specific token exchange pair
    address immutable public stakeToken;
    // community that pool belongs to
    address immutable community;

    mapping (address => StakingInfo) private stakingInfo;
    mapping (address => RequestsOfPeriod) private requests;

    event Locked(address indexed who, uint256 amount);
    event Unlocked(address indexed who, uint256 amount);
    event Redeemd(address indexed who, uint256 amount);

    constructor(address _community, string memory _name, address _stakeToken, uint256 _lockDuration) {
        factory = msg.sender;
        community = _community;
        name = _name;
        stakeToken = _stakeToken;
        lockDuration = _lockDuration;
    }

    function deposit(uint256 amount) external nonReentrant {
         require(ICommunity(community).poolActived(address(this)), 'Can not deposit to a closed pool.');
        if (amount == 0) return;

        // Add to staking list if account hasn't deposited before
        if (!stakingInfo[msg.sender].hasDeposited) {
            stakingInfo[msg.sender].hasDeposited = true;
            stakingInfo[msg.sender].amount = 0;
        }

        // trigger community update all pool staking info
        ICommunity(community).updatePools("USER", msg.sender);

        if (stakingInfo[msg.sender].amount > 0) {
            uint256 pending = stakingInfo[msg.sender]
                .amount
                .mul(ICommunity(community).getShareAcc(address(this)))
                .div(1e12)
                .sub(ICommunity(community).getUserDebt(address(this), msg.sender));
            if (pending > 0) {
                ICommunity(community).appendUserReward(msg.sender, pending);
            }
        }

        lockERC20(stakeToken, msg.sender, address(this), amount);

        stakingInfo[msg.sender].amount = stakingInfo[msg.sender]
            .amount
            .add(amount);
        totalStakedAmount = totalStakedAmount
            .add(amount);

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));

        emit Locked(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
         if (amount == 0) return;
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

        uint256 withdrawAmount;
        if (amount >= stakingInfo[msg.sender].amount)
            withdrawAmount = stakingInfo[msg.sender].amount;
        else withdrawAmount = amount;

        // releaseERC20(stakeToken, address(msg.sender), withdrawAmount);

        stakingInfo[msg.sender].amount = stakingInfo[msg.sender]
            .amount
            .sub(withdrawAmount);
        totalStakedAmount = totalStakedAmount
            .sub(withdrawAmount);

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));    

        // Add to redeem request queue
        requests[msg.sender].queue.push(RedeemRequest ({
            erc20Amount: withdrawAmount,
            claimed: 0,
            startTime: block.timestamp,
            endTime: block.timestamp.add(lockDuration)
        }));
        totalStakedAmount = totalStakedAmount.sub(withdrawAmount);
        emit Unlocked(msg.sender, withdrawAmount);
    }

    function redeem() external nonReentrant {
        uint256 avaliableRedeemErc20 = 0;
        for (uint256 idx = requests[msg.sender].index; idx < requests[msg.sender].queue.length; idx++) {
            uint256 claimable = _claimableNutOfRequest(requests[msg.sender].queue[idx]);
            requests[msg.sender].queue[idx].claimed = requests[msg.sender].queue[idx].claimed.add(claimable);
            // Ignore requests that has already claimed completely next time.
            if (requests[msg.sender].queue[idx].claimed == requests[msg.sender].queue[idx].erc20Amount) {
                requests[msg.sender].index = idx + 1;
            }

            if (claimable > 0) {
                avaliableRedeemErc20 = avaliableRedeemErc20.add(claimable);
            }
        }
        

        require(IERC20(stakeToken).balanceOf(address(this)) >= avaliableRedeemNut, "Inceficient balance of NUT");
        IERC20(stakeToken).transfer(msg.sender, avaliableRedeemNut);
        emit Redeemd(msg.sender, avaliableRedeemNut);
    }

    function redeemRequestCountOfPeriod(address _who, Period _period) external view returns (uint256 len) {
        len = requests[_who][_period].queue.length - requests[_who][_period].index;
    }

    function redeemRequestsOfPeriod(address _who, Period _period) external view returns (RedeemRequest[] memory reqs) {
        reqs = new RedeemRequest[](this.redeemRequestCountOfPeriod(_who, _period));
        for (uint i = requests[_who][_period].index; i < requests[_who][_period].queue.length; i++) {
            RedeemRequest storage req = requests[_who][_period].queue[i];
            reqs[i] = req;
        }
    }

    function firstRedeemRequest(address _who, Period _period) external view returns (RedeemRequest memory req) {
        if (requests[_who][_period].queue.length > 0) {
            req = requests[_who][_period].queue[requests[_who][_period].index];
        }
    }

    function lastRedeemRequest(address _who, Period _period) external view returns (RedeemRequest memory req) {
        if (requests[_who][_period].queue.length > 0) {
            req = requests[_who][_period].queue[requests[_who][_period].queue.length - 1];
        }
    }

    function claimableNut(address _who) external view returns (uint256 amount) {
        for (uint256 period = 0; period < PERIOD_COUNT; period++) {
            for (uint256 idx = requests[_who].index; idx < requests[_who].queue.length; idx++) {
                amount = amount.add(_claimableNutOfRequest(requests[_who].queue[idx]));
            }
        }
    }

    function lockedNutOfPeriod(address _who, Period _period) external view returns (uint256) {
        return depositInfos[_who][_period];
    }

    function _claimableNutOfRequest(RedeemRequest memory _req) private view returns (uint256 amount) {
        if (block.timestamp >= _req.endTime) {
            amount = _req.nutAmount.sub(_req.claimed);
        } else {
            amount = _req.nutAmount
                    .mul(block.timestamp.sub(_req.startTime))
                    .div(_req.endTime.sub(_req.startTime))
                    .sub(_req.claimed);
        }
    }
}