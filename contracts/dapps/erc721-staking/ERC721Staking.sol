// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/IPool.sol";

contract ERC721Staking is IPool, ReentrancyGuard, IERC721Receiver, IERC165 {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.UintSet;

    struct StakingInfo {
        // First time when user staking, we need set options like userDebt to zero
        bool hasDeposited;
        // User staked amount
        uint256 amount;
        EnumerableSet.UintSet ids;
    }
    address immutable factory;

    // stakingInfo used to save every user's staking information,
    // including how many they deposited and its external chain account
    // ( we support crosschain asset staking). With every staking event
    // happened including deposit and withdraw asset this field should be updated.
    mapping(address => StakingInfo) stakingInfo;

    string public name;

    // stakeToken actually is a asset contract entity, it represents the asset user stake of this pool.
    // Bascially, it should be a normal ERC721
    address immutable public stakeToken;
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

    constructor(address _community, string memory _name, address _stakeToken) {
        factory = msg.sender;
        community = _community;
        name = _name;
        stakeToken = _stakeToken;
    }

    function deposit(
        uint256[] memory ids
    ) external nonReentrant {
        require(ICommunity(community).poolActived(address(this)), 'Can not deposit to a closed pool.');
        if (ids.length == 0) return;
        uint256 amount = ids.length;

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

        for (uint256 i = 0; i < amount; i ++) {
            uint256 id = ids[i];
            IERC721(stakeToken).transferFrom(msg.sender, address(this), id);
            stakingInfo[msg.sender].ids.add(id);
        }
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
        uint256[] memory ids
    ) external nonReentrant {
        uint256 amount = ids.length;
        if (amount == 0) return;
        if (stakingInfo[msg.sender].amount < amount) return;

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

        for (uint256 i = 0; i < amount; i++) {
            uint256 id = ids[i];
            require(stakingInfo[msg.sender].ids.contains(id), "User not staked id");
            IERC721(stakeToken).transferFrom(address(this), msg.sender, id);
            stakingInfo[msg.sender].ids.remove(id);
        }

        stakingInfo[msg.sender].amount = stakingInfo[msg.sender]
            .amount
            .sub(amount);
        totalStakedAmount = totalStakedAmount
            .sub(amount);

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));

        emit Withdrawn(community, msg.sender, amount);
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
        returns (uint256 amount, uint256[] memory ids)
    {
        return (stakingInfo[user].amount, stakingInfo[user].ids.values());
    }

     function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function supportsInterface(bytes4 interfaceId) external override pure returns (bool) {
        return false;
    }
}
