// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AutoCuration.sol";

contract CommunityCuration is Ownable {
    event Upgrade(address indexed oldContract, address indexed newContract);

    // cid => community contract
    mapping(uint256 => address) public communities;

    function createCommunity(uint256 cid, address signAddr, address prizeToken) public {
        require(communities[cid] == address(0), "community already exists");

        AutoCuration ac = new AutoCuration();
        ac.init(cid, signAddr, prizeToken, msg.sender, address(0));
        communities[cid] = address(ac);
    }

    function getCommunityInfo(uint256 cid) public view returns (address communityAddr, address prizeToken, uint256 balance, address signAddr, address creator, address storageAddr) {
        communityAddr = communities[cid];
        balance = AutoCuration(payable(communityAddr)).getBalance();
        signAddr = AutoCuration(payable(communityAddr)).signAddress();
        prizeToken = AutoCuration(payable(communityAddr)).prizeToken();
        creator = AutoCuration(payable(communityAddr)).creator();
        storageAddr = address(AutoCuration(payable(communityAddr)).cStorage());
    }

    function upgrade(uint256 cid, address newCommunity) public onlyOwner {
        address oldAddr = communities[cid];
        require(oldAddr != address(0), "invalid cid");
        AutoCuration ac = AutoCuration(payable(oldAddr));
        ac.upgrade(newCommunity);
        communities[cid] = newCommunity;
        emit Upgrade(oldAddr, newCommunity);
    }

    function alreadyClaimed(uint256 twitterId, uint256 curationId) public view returns (bool) {
        uint256 cid = curationId >> 48;
        address communityAddr = communities[cid];
        return AutoCuration(payable(communityAddr)).alreadyClaimed(twitterId, curationId);
    }
}
