// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TreasuryFactory.sol";
import "../interfaces/ICommunity.sol";

contract Treasury is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    address immutable factory;
    address immutable community;

    constructor() {
        // we only admit the caller is TreasuryFactory registered by committee
        factory = msg.sender;
    }


}