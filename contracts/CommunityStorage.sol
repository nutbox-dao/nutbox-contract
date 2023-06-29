// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CommunityStorage is Ownable {
    // Flag claimed users
    // twitterid => curation id => bool
    mapping(uint256 => mapping(uint256 => bool)) public alreadyClaimed;

    // communityId
    uint256 public communityId;
    address public prizeToken;
    address public signAddress;

    constructor(uint256 cid, address owner, address token, address signAddr) {
        communityId = cid;
        prizeToken = token;
        signAddress = signAddr;
        transferOwnership(owner);
    }

    function setSignAddress(address addr) public onlyOwner {
        signAddress = addr;
    }

    function setPrizeToken(address addr) public onlyOwner {
        prizeToken = addr;
    }

    function withdraw(address to) public onlyOwner {
        uint256 balance = IERC20(prizeToken).balanceOf(address(this));
        if (balance > 0) {
            IERC20(prizeToken).transfer(to, balance);
        }
    }

    function transfer(address to, uint256 amount) public onlyOwner {
        IERC20(prizeToken).transfer(to, amount);
    }

    function saveAlreadyClaimed(uint256 twitterId, uint256 curationId) public onlyOwner {
        require(communityId == curationId >> 48, "invalid community");
        require(alreadyClaimed[twitterId][curationId] == false, "already claimed");
        alreadyClaimed[twitterId][curationId] = true;
    }

    function getBalance() public view returns (uint256) {
        return IERC20(prizeToken).balanceOf(address(this));
    }
}
