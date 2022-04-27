// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/IPool.sol";
import "./CrowdloanFactory.sol";

/**
 * @dev Template contract of SP/HP staking pool.
 * Delegation only can be updated through update().
 *
 */
contract Crowdloan is IPool {
    using SafeMath for uint256;

    struct StakingInfo {
        // First time when user staking, we need set options like userDebt to zero
        bool hasDeposited;
        // User staked amount
        uint256 amount;
        // User's foreign account identity
        // substrate account is sr25519 form, it can be revert with byte32
        bytes32 bindAccount;
    }

    // fetch address use bound account
    mapping(bytes32 => address) public accountBindMap;

    // stakingInfo used to save every user's staking information,
    // including how many they deposited and its external chain account
    // ( we support crosschain asset staking). With every staking event
    // happened including deposit and withdraw asset this field should be updated.
    mapping(address => StakingInfo) stakingInfo;

    address immutable factory;
    string public name;

    // community that pool belongs to
    address immutable community;
    // crowdlaon paraId
    uint256 public immutable paraId;
    uint256 public immutable fundIndex;
    // chain id: polkadot : 0  kusama: 2
    uint8 immutable chainId;

    // Total staked amount
    uint256 public totalStakedAmount;

    event Contributed(
        address indexed community,
        address indexed who,
        uint256 newAmount,
        uint256 totalAmount
    );

    constructor(address _community, string memory _name, uint8 _chainId, uint256 _paraId, uint256 _fundIndex) {
        factory = msg.sender;
        community = _community;
        name = _name;
        chainId = _chainId;
        paraId = _paraId;
        fundIndex = _fundIndex;
    }

    // contribute to crowdloan, user can only add contribution during the crowdloan period
    function contribute(
        uint8 _chainId,
        uint256 _paraId,
        uint256 _fundIndex,
        address depositor,
        uint256 amount,
        bytes32 _bindAccount
    ) external {
        require(CrowdloanFactory(factory).isBridge(chainId, msg.sender), "Only verified bridge can call");
        require(chainId == _chainId, "Wrong chain id");
        require(paraId == _paraId, "Wrong paraId");
        require(fundIndex == _fundIndex, "Wrong fund index");
        require(accountBindMap[_bindAccount] == address(0) || accountBindMap[_bindAccount] == depositor, "Bound substrate account dismatch");

        require(ICommunity(community).poolActived(address(this)), 'Can not deposit to a closed pool.');

        // Add to staking list if account hasn't deposited before
        if (!stakingInfo[depositor].hasDeposited) {
            stakingInfo[depositor].hasDeposited = true;
            stakingInfo[depositor].amount = 0;
            stakingInfo[depositor].bindAccount = _bindAccount;
            accountBindMap[_bindAccount] = depositor;
        } else {
            require(
                stakingInfo[depositor].bindAccount == _bindAccount,
                "Bound substrate account dismatch"
            );
        }

        // trigger community update all pool staking info, send factory as fee payer to ignore fee payment.
        ICommunity(community).updatePools("USER", factory);

        if (stakingInfo[depositor].amount > 0) {
            uint256 pending = stakingInfo[depositor]
                .amount
                .mul(ICommunity(community).getShareAcc(address(this)))
                .div(1e12)
                .sub(ICommunity(community).getUserDebt(address(this), depositor));
            if (pending > 0) {
                ICommunity(community).appendUserReward(depositor, pending);
            }
        }

        totalStakedAmount = totalStakedAmount.add(amount);
        stakingInfo[depositor].amount = stakingInfo[depositor].amount.add(amount);

        ICommunity(community).setUserDebt(
            depositor,
            stakingInfo[depositor]
            .amount
            .mul(ICommunity(community).getShareAcc(address(this)))
            .div(1e12));
        
        emit Contributed(community, depositor, amount, stakingInfo[depositor].amount);
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
