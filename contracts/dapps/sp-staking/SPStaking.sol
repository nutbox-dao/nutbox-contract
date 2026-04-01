// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/ICommittee.sol";
import "../../interfaces/IPool.sol";
import "./SPStakingFactory.sol";

/**
 * @dev Template contract of SP/HP staking pool.
 * Delegation only can be updated through update().
 *
 */
contract SPStaking is IPool, Initializable {


    struct StakingInfo {
        bool hasDeposited;
        uint256 amount;
        bytes32 bindAccount;
    }

    // fetch address use bound account
    mapping(bytes32 => address) public accountBindMap;

    mapping(address => StakingInfo) stakingInfo;

    address public factory;
    string public name;
    address public community;
    bytes32 public delegatee;
    uint8 public chainId;

    uint256 public totalStakedAmount;

    event UpdateStaking(
        address indexed community,
        address indexed who,
        uint256 previousAmount,
        uint256 newAmount
    );

    function initialize(address _community, string memory _name, uint8 _chainId, bytes32 _delegatee) external initializer {
        factory = msg.sender;
        community = _community;
        name = _name;
        delegatee = _delegatee;
        chainId = _chainId;
    }

    /// @dev Lock the template so it cannot be initialized directly.
    constructor() {
        _disableInitializers();
    }

    function update(
        uint8 _chainId,
        bytes32 _delegatee,
        address depositor,
        uint256 amount,
        bytes32 _bindAccount
    ) external {
        require(msg.sender == SPStakingFactory(factory).bridge(), "Only verified bridge can call");
        require(chainId == _chainId, "Wrong chain id");
        require(delegatee == _delegatee, "Wrong delegatee account");
        require(accountBindMap[_bindAccount] == address(0) || accountBindMap[_bindAccount] == depositor, "Bound bsc account dismatch");

        uint256 prevAmount = stakingInfo[depositor].amount;
        if (prevAmount == amount) return;
        if (prevAmount < amount) {
            require(ICommunity(community).poolActived(address(this)), 'Can not deposit to a closed pool.');
        }

        if (!stakingInfo[depositor].hasDeposited) {
            stakingInfo[depositor].hasDeposited = true;
            stakingInfo[depositor].amount = 0;
            stakingInfo[depositor].bindAccount = _bindAccount;
            accountBindMap[_bindAccount] = depositor;
        } else {
            require(
                keccak256(abi.encodePacked(stakingInfo[depositor].bindAccount)) == keccak256(abi.encodePacked(_bindAccount)),
                "Bound steem account dismatch"
            );
        }

        // trigger community update — bridge is fee-free (Tier 3 exempt)
        ICommunity(community).updatePools();

        if (stakingInfo[depositor].amount > 0) {
            uint256 pending = stakingInfo[depositor]
                .amount * ICommunity(community).getShareAcc(address(this)) / 1e12
                - ICommunity(community).getUserDebt(address(this), depositor);
            if (pending > 0) {
                ICommunity(community).appendUserReward(depositor, pending);
            }
        }

        // H-03: use explicit branches to avoid arithmetic order issues
        if (amount >= prevAmount) {
            totalStakedAmount = totalStakedAmount + (amount - prevAmount);
        } else {
            totalStakedAmount = totalStakedAmount - (prevAmount - amount);
        }
        stakingInfo[depositor].amount = amount;

        ICommunity(community).setUserDebt(
            depositor,
            stakingInfo[depositor].amount * ICommunity(community).getShareAcc(address(this)) / 1e12
        );
        
        emit UpdateStaking(community, depositor, prevAmount, amount);
    }

    function getFactory() external view override returns (address) { return factory; }
    function getCommunity() external view override returns (address) { return community; }
    function getUserStakedAmount(address user) external view override returns (uint256) { return stakingInfo[user].amount; }
    function getTotalStakedAmount() external view override returns (uint256) { return totalStakedAmount; }
    function getUserDepositInfo(address user) external view returns (StakingInfo memory) { return stakingInfo[user]; }
}
