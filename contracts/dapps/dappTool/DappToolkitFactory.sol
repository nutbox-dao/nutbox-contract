// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../../interfaces/IPool.sol";
import "./DappToolkit.sol";

interface Community {
    function communityToken() view (address);
}

interface CommunityFactory {
    function createdCommunity(address) view (bool);
}

contract DappToolkitFactory is Ownable{
    // We set this parameter by committ
    // this is used by any community
    // when user harvest c-tokens dappToolsRatio / 10000 ctoken will transfer to dapp tools contract
    // These ctoken will be mined by user who vote with vNUT
    uint256 public revenueRatio;
    // pool address => ctoken address
    mapping (address => address) public poolToCtoken;

    // pool address => total revenue of ctokn from user
    mapping (address => uint256) public poolRevenue;
    // user address => total revenue of ctoken from user
    mapping (address => uint256) public userRevenue;
    // pool factory address => total revenue of ctoken from pool factory
    mapping (address => uint256) public poolFacotryRevenue;
    // community address => total revenue of ctoken from community
    mapping (address => uint256) public communityRevenue;

    // pool address => total revenue of ctokn from user
    mapping (address => uint256) public lastPoolRevenue;
    // user address => total revenue of ctoken from user
    mapping (address => uint256) public lastUserRevenue;
    // pool factory address => total revenue of ctoken from pool factory
    mapping (address => uint256) public lastPoolFacotryRevenue;
    // community address => total revenue of ctoken from community
    mapping (address => uint256) public lastCommunityRevenue;

    // whitelist contains all community contract
    // harvest method of community will call addNewPool method
    mapping (address => bool) public whiteList;

    event AdminSetDappToolsRatio(uint256 revenueRatio);
    event CreateNewToolkit(address indexed toolkit, address indexed pool);

    constructor(uint256 _revenueRatio) {
        revenueRatio = _revenueRatio;
        emit AdminSetDappToolsRatio(_revenueRatio);
    }

    function adminSetDappToolsRatio(uint256 _revenueRatio) external onlyOwner {
        revenueRatio = _revenueRatio;
        emit AdminSetDappToolkitRatio(_revenueRatio);
    }

    function appropriate(address, user, uint256) external {
        require(poolToCtoken[msg.sender] != address(0), "Not verified pool");
        address community = IPool(msg.sender).getCommunity();
        address factory = IPool(msg.sender).getFactory();
        address ctoken = Community(community).communityToken;

    }

    function addNewToolkit(address community, address pool) external {
        require(Ownable(community).owner() == msg.sender, "Only community owner can call");
        require(CommunityFactory(community), "Invalid community");
        require(poolToCtoken[pool] == address(0), "Pool has added");
        address ctoken = Community(community).communityToken;
        poolToCtoken[pool] = ctoken;
        DappToolkit toolkit = new DappToolkit(address community, address pool);

    }
}


