// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/ICommittee.sol";
import "../../interfaces/IPool.sol";
import "../../interfaces/IDFXStarScoreStaking.sol";
import "../../ERC20Helper.sol";

interface ICommunityViews is ICommunity {
    function getPoolPendingRewards(
        address poolAddress,
        address user
    ) external view returns (uint256);
}

interface ICommunityOwnable {
    function owner() external view returns (address);
}

contract DFXStarScoreStaking is
    IPool,
    IDFXStarScoreStaking,
    ERC20Helper,
    ReentrancyGuard,
    Initializable
{
    error NotGameOperator();
    error NotCommunityOwner();
    error InvalidAddress();
    error ZeroAmount();

    address public factory;
    address public community;
    string public name;
    address public gameOperator;

    mapping(address => uint256) public stakedScore;
    uint256 public totalStakedScore;

    uint256 public externalAccPerShare;
    uint256 public externalRewardsHeld;
    mapping(address => uint256) public externalUserRewards;
    mapping(address => uint256) public externalUserDebts;

    event ScoreDeposited(address indexed user, uint256 amount);
    event RewardsInjected(address indexed injector, uint256 amount);
    event ExternalRewardsClaimed(address indexed user, uint256 amount);
    event GameOperatorUpdated(
        address indexed oldOperator,
        address indexed newOperator
    );

    modifier onlyGameOperator() {
        if (msg.sender != gameOperator) revert NotGameOperator();
        _;
    }

    modifier onlyCommunityOwner() {
        if (msg.sender != ICommunityOwnable(community).owner()) {
            revert NotCommunityOwner();
        }
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _community,
        string memory _name,
        address _gameOperator
    ) external initializer {
        if (_community == address(0) || _gameOperator == address(0)) {
            revert InvalidAddress();
        }
        factory = msg.sender;
        community = _community;
        name = _name;
        gameOperator = _gameOperator;
    }

    function adminSetGameOperator(
        address newGameOperator
    ) external onlyCommunityOwner {
        if (newGameOperator == address(0)) revert InvalidAddress();
        address oldOperator = gameOperator;
        gameOperator = newGameOperator;
        emit GameOperatorUpdated(oldOperator, newGameOperator);
    }

    function depositFromGame(
        address user,
        uint256 amount
    ) external payable override nonReentrant onlyGameOperator {
        if (user == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        require(
            ICommunity(community).poolActived(address(this)),
            "Can not deposit to a closed pool."
        );

        _chargeTier3Fee();
        ICommunity(community).updatePools();

        _settleCommunityPending(user);
        _settleExternalPending(user);

        uint256 oldTotal = totalStakedScore;
        uint256 newUserStake = stakedScore[user] + amount;
        stakedScore[user] = newUserStake;
        totalStakedScore = oldTotal + amount;
        externalUserDebts[user] = _accShareOf(newUserStake);

        ICommunity(community).setUserDebt(
            user,
            _communityShareAccMul(newUserStake)
        );

        // Inject held rewards only after the first stake appears.
        if (oldTotal == 0 && externalRewardsHeld > 0) {
            externalAccPerShare =
                externalAccPerShare +
                ((externalRewardsHeld * 1e12) / totalStakedScore);
            externalRewardsHeld = 0;
        }

        emit ScoreDeposited(user, amount);
    }

    function injectRewards(
        uint256 amount
    ) external payable override nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _chargeTier3Fee();

        address rewardToken = ICommunity(community).getCommunityToken();
        lockERC20(rewardToken, msg.sender, address(this), amount);

        if (totalStakedScore == 0) {
            externalRewardsHeld = externalRewardsHeld + amount;
        } else {
            externalAccPerShare =
                externalAccPerShare +
                ((amount * 1e12) / totalStakedScore);
        }
        emit RewardsInjected(msg.sender, amount);
    }

    function claimExternalRewards() external payable override nonReentrant {
        _settleExternalPending(msg.sender);

        uint256 rewards = externalUserRewards[msg.sender];
        if (rewards == 0) {
            // no-op by design for multicall-friendly UX
            return;
        }

        _chargeTier3Fee();

        externalUserRewards[msg.sender] = 0;
        externalUserDebts[msg.sender] = _accShareOf(stakedScore[msg.sender]);
        releaseERC20(
            ICommunity(community).getCommunityToken(),
            msg.sender,
            rewards
        );
        emit ExternalRewardsClaimed(msg.sender, rewards);
    }

    function getPendingExternalRewards(
        address user
    ) public view override returns (uint256) {
        return externalUserRewards[user] + _externalPending(user);
    }

    function getPendingCommunityRewards(
        address user
    ) public view override returns (uint256) {
        return
            ICommunityViews(community).getPoolPendingRewards(address(this), user);
    }

    function getPendingAllRewards(
        address user
    ) external view override returns (uint256, uint256) {
        return (getPendingCommunityRewards(user), getPendingExternalRewards(user));
    }

    function getFactory() external view override returns (address) {
        return factory;
    }

    function getCommunity() external view override returns (address) {
        return community;
    }

    function getUserStakedAmount(
        address user
    ) external view override returns (uint256) {
        return stakedScore[user];
    }

    function getTotalStakedAmount() external view override returns (uint256) {
        return totalStakedScore;
    }

    function _settleCommunityPending(address user) private {
        uint256 userStake = stakedScore[user];
        if (userStake == 0) return;

        uint256 pending = _communityShareAccMul(userStake) -
            ICommunity(community).getUserDebt(address(this), user);
        if (pending > 0) {
            ICommunity(community).appendUserReward(user, pending);
        }
    }

    function _settleExternalPending(address user) private {
        uint256 pending = _externalPending(user);
        if (pending > 0) {
            externalUserRewards[user] = externalUserRewards[user] + pending;
        }
    }

    function _externalPending(address user) private view returns (uint256) {
        return _accShareOf(stakedScore[user]) - externalUserDebts[user];
    }

    function _accShareOf(uint256 stake) private view returns (uint256) {
        return (stake * externalAccPerShare) / 1e12;
    }

    function _communityShareAccMul(
        uint256 stake
    ) private view returns (uint256) {
        return (stake * ICommunity(community).getShareAcc(address(this))) / 1e12;
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
}
