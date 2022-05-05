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

    constructor(address _community) {
        // we only admit the caller is TreasuryFactory registered by committee
        factory = msg.sender;
        community = _community;
    }

    redeem(uint256 amount) {
        ERC20Burnable ctoken = ERC20Burnable(ICommunity(community).getCommunityToken());
        require(ctoken.balaceOf(msg.sender) >= amount, "Insufficient balance");
        uint256 supply = ctoken.totalSupply();
        ctoken.transferFrom(msg.sender, address(this), amount);
        ctoken.burn(amount);
    }
    



}