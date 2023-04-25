// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AutoCuration.sol";

contract CommunityCuration is Ownable {
    mapping(uint256 => address) public communities;

    function createCommunity(uint256 cid, address signAddr, address prizeToken) public {
        require(communities[cid] != address(0), "community already exists");

        AutoCuration ac = new AutoCuration();
        ac.init(cid, signAddr, prizeToken, msg.sender, address(0));
        communities[cid] = address(ac);
    }

    function getCommunityInfo(uint256 cid) public view returns (address communityAddr, address prizeToken, uint256 balance, address signAddr, address creator) {
        communityAddr = communities[cid];
        balance = AutoCuration(communityAddr).getBalance();
        signAddr = AutoCuration(communityAddr).signAddress();
        prizeToken = AutoCuration(communityAddr).prizeToken();
        creator = AutoCuration(communityAddr).creator();
    }

    function upgrade(uint256 cid, address newCommunity) public onlyOwner {
        address oldAddr = communities[cid];
        require(oldAddr != address(0), "invalid cid");
        AutoCuration ac = AutoCuration(oldAddr);
        ac.transferOwnership(newCommunity);
    }

    function alreadyClaimed(uint256 twitterId, uint256 curationId) public view returns (bool) {
        uint256 cid = curationId >> 48;
        address communityAddr = communities[cid];
        return AutoCuration(communityAddr).alreadyClaimed(twitterId, curationId);
    }
}
