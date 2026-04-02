// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/ICommittee.sol";
import "../../interfaces/IPool.sol";
import "../../ERC20Helper.sol";

/**
 * @dev Template contract of Nutbox ERC20 staking pool.
 *
 * Every pool saves a user staking ledger of a specific staking asset.
 * The only place that user can deposit and withdraw their staked asset.
 * Also only user themself can withdraw their staked asset
 */
contract ERC20Staking is IPool, ERC20Helper, ReentrancyGuard, Initializable {


    struct StakingInfo {
        // First time when user staking, we need set options like userDebt to zero
        bool hasDeposited;
        // User staked amount
        uint256 amount;
    }
    address public factory;

    // stakingInfo used to save every user's staking information,
    // including how many they deposited and its external chain account
    // ( we support crosschain asset staking). With every staking event
    // happened including deposit and withdraw asset this field should be updated.
    mapping(address => StakingInfo) stakingInfo;

    string public name;

    // stakeToken actually is a asset contract entity, it represents the asset user stake of this pool.
    // Basically, it should be a normal ERC20 token or a lptoken of a specific token exchange pair
    address public stakeToken;
    // community that pool belongs to
    address public community;

    // Total staked amount
    uint256 public totalStakedAmount;

    event Deposited(
        address indexed community,
        address indexed who,
        uint256 amount
    );
    event Withdrawn(
        address indexed community,
        address indexed who,
        uint256 amount
    );

    function initialize(address _community, string memory _name, address _stakeToken) external initializer {
        factory = msg.sender;
        community = _community;
        name = _name;
        stakeToken = _stakeToken;
    }

    /// @dev Lock the template so it cannot be initialized directly.
    constructor() {
        _disableInitializers();
    }

    function _chargeTier3Fee() private {
        address committeeAddr = ICommunity(community).getCommittee();
        uint256 fee = ICommittee(committeeAddr).getPoolOperationFee();
        if (fee == 0) return;
        // Check fee-free list (e.g. bridge addresses)
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

    function deposit(
        uint256 amount
    ) external payable nonReentrant {
        require(ICommunity(community).poolActived(address(this)), 'Can not deposit to a closed pool.');
        if (amount == 0) return;

        _chargeTier3Fee();

        // Add to staking list if account hasn't deposited before
        if (!stakingInfo[msg.sender].hasDeposited) {
            stakingInfo[msg.sender].hasDeposited = true;
            stakingInfo[msg.sender].amount = 0;
        }

        // trigger community update all pool staking info
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

        emit Deposited(community, msg.sender, amount);
    }

    function withdraw(
        uint256 amount
    ) external payable nonReentrant {
        if (amount == 0) return;
        if (stakingInfo[msg.sender].amount == 0) return;

        _chargeTier3Fee();

        // trigger community update all pool staking info
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

        stakingInfo[msg.sender].amount = stakingInfo[msg.sender].amount - withdrawAmount;
        totalStakedAmount = totalStakedAmount - withdrawAmount;

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender].amount * ICommunity(community).getShareAcc(address(this)) / 1e12
        );

        releaseERC20(stakeToken, address(msg.sender), withdrawAmount);

        emit Withdrawn(community, msg.sender, withdrawAmount);
    }

    function getFactory() external view override returns (address) {
        return factory;
    }

    function getCommunity() external view override returns (address) {
        return community;
    }

    function getUserStakedAmount(address user)
        external
        view
        override returns (uint256)
    {
        return stakingInfo[user].amount;
    }

    function getTotalStakedAmount()
        external
        view
        override returns (uint256)
    {
        return totalStakedAmount;
    }

    function getUserDepositInfo(address user)
        external
        view
        returns (StakingInfo memory)
    {
        return stakingInfo[user];
    }
}
