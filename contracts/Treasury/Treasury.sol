// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TreasuryFactory.sol";
import "../interfaces/ICommunity.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract Treasury is ReentrancyGuard {
    using SafeMath for uint256;
    address immutable factory;
    address immutable community;

    event Redeem(address indexed user, uint256 indexed amount);

    constructor(address _community) {
        // we only admit the caller is TreasuryFactory registered by committee
        factory = msg.sender;
        community = _community;
    }

    function redeem(uint256 amount) external nonReentrant {
        ERC20Burnable ctoken = ERC20Burnable(ICommunity(community).getCommunityToken());
        require(ctoken.balanceOf(msg.sender) >= amount, "Insufficient balance");
        uint256 supply = ctoken.totalSupply();
        ctoken.transferFrom(msg.sender, address(this), amount);
        ctoken.burn(amount);
        address[] memory rewardList = TreasuryFactory(factory).getRewardList();
        for (uint256 i = 0; i < rewardList.length; i++) {
            ERC20Burnable token = ERC20Burnable(rewardList[i]);
            uint256 balance = token.balanceOf(address(this));
            token.transfer(msg.sender, amount.mul(balance).div(supply));
        }

        emit Redeem(msg.sender, amount);
    }
    



}