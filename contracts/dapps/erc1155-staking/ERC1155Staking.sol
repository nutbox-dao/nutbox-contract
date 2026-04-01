// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/ICommittee.sol";
import "../../interfaces/IPool.sol";

/**
 * @dev Template contract of Nutbox ERC1155 staking pool.
 * One pool supports only one token id of an ERC1155 token
 */
contract ERC1155Staking is IPool, ReentrancyGuard, IERC1155Receiver, Initializable {


    struct StakingInfo {
        bool hasDeposited;
        uint256 amount;
    }
    address public factory;

    mapping(address => StakingInfo) stakingInfo;

    string public name;
    address public stakeToken;
    uint256 public tokenId;
    address public community;

    uint256 public totalStakedAmount;

    event Deposited(address indexed community, address indexed who, uint256 amount);
    event Withdrawn(address indexed community, address indexed who, uint256 amount);

    function initialize(address _community, string memory _name, address _stakeToken, uint256 _tokenId) external initializer {
        factory = msg.sender;
        community = _community;
        name = _name;
        stakeToken = _stakeToken;
        tokenId = _tokenId;
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

        // M-04: use empty bytes for safeTransferFrom data
        IERC1155(stakeToken).safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

        stakingInfo[msg.sender].amount = stakingInfo[msg.sender].amount + amount;
        totalStakedAmount = totalStakedAmount + amount;

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender].amount * ICommunity(community).getShareAcc(address(this)) / 1e12
        );

        emit Deposited(community, msg.sender, amount);
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

        // M-04: use empty bytes for safeTransferFrom data
        IERC1155(stakeToken).safeTransferFrom(address(this), address(msg.sender), tokenId, withdrawAmount, "");

        stakingInfo[msg.sender].amount = stakingInfo[msg.sender].amount - withdrawAmount;
        totalStakedAmount = totalStakedAmount - withdrawAmount;

        ICommunity(community).setUserDebt(
            msg.sender,
            stakingInfo[msg.sender].amount * ICommunity(community).getShareAcc(address(this)) / 1e12
        );

        emit Withdrawn(community, msg.sender, withdrawAmount);
    }

    function getFactory() external view override returns (address) { return factory; }
    function getCommunity() external view override returns (address) { return community; }
    function getUserStakedAmount(address user) external view override returns (uint256) { return stakingInfo[user].amount; }
    function getTotalStakedAmount() external view override returns (uint256) { return totalStakedAmount; }
    function getUserDepositInfo(address user) external view returns (StakingInfo memory) { return stakingInfo[user]; }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external override returns (bytes4) {
        return 0xf23a6e61;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external override returns (bytes4) {
        return 0xbc197c81;
    }

    function supportsInterface(bytes4 interfaceId) external override view returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }

    receive() external payable {}
}
