// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/IPool.sol";

/**
 * @dev Template contract of Nutbox staking pool.
 *
 * Every pool saves a user staking ledger of a specific staking asset.
 * The only place that user can deposit and withdraw their staked asset.
 * Also only user themself than withdraw their staked asset
 * One pool surport only one token id of an ERC1155 token
 */
contract ERC1155Staking is IPool, ReentrancyGuard, IERC1155Receiver {
    using SafeMath for uint256;

    struct StakingInfo {
        // First time when user staking, we need set options like userDebt to zero
        bool hasDeposited;
        // User staked amount
        uint256 amount;
    }
    address immutable factory;

    // stakingInfo used to save every user's staking information,
    // including how many they deposited and its external chain account
    // ( we support crosschain asset staking). With every staking event
    // happened including deposit and withdraw asset this field should be updated.
    mapping(address => StakingInfo) stakingInfo;

    string public name;

    // stakeToken actually is a asset contract entity, it represents the asset user stake of this pool.
    // Bascially, it should be a normal ERC1155
    address immutable public stakeToken;
    // one pool for a single token id of ERC1155 token
    uint256 immutable public tokenId;
    // community that pool belongs to
    address immutable community;

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

    constructor(address _community, string memory _name, address _stakeToken, uint256 _tokenId) {
        factory = msg.sender;
        community = _community;
        name = _name;
        stakeToken = _stakeToken;
        tokenId = _tokenId;
    }

    function deposit(
        uint256 amount
    ) external nonReentrant {
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

        IERC1155(stakeToken).safeTransferFrom(msg.sender, address(this), tokenId, amount, "0x");

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

        emit Deposited(community, msg.sender, amount);
    }

    function withdraw(
        uint256 amount
    ) external nonReentrant {
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

        IERC1155(stakeToken).safeTransferFrom(address(this), address(msg.sender), tokenId, withdrawAmount, "0x00");

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

     function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override returns (bytes4) {
        return 0xf23a6e61;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override returns (bytes4) {
        return 0xbc197c81;
    }

    function supportsInterface(bytes4 interfaceId) external override view returns (bool) {
        return false;
    }
}
