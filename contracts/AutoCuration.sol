// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AutoCuration is Ownable, ReentrancyGuard {
    event RewardInfo(uint256 indexed twitterId, address indexed user, uint256[] taskIds, uint256 amount);

    // Flag claimed users
    // twitterid => curation id => bool
    mapping(uint256 => mapping(uint256 => bool)) public alreadyClaimed;

    address public prizeToken;
    address public signAddress;
    uint256 public chainId = 137;

    constructor(uint256 _chainId, address addr, address _prizeToken) {
        chainId = _chainId;
        signAddress = addr;
        prizeToken = _prizeToken;
    }

    function setSignAddress(address addr) public onlyOwner {
        signAddress = addr;
    }

    function setPrizeToken(address addr) public onlyOwner {
        prizeToken = addr;
    }

    function withdraw() public onlyOwner {
        uint256 balance = IERC20(prizeToken).balanceOf(address(this));
        if (balance > 0) {
            IERC20(prizeToken).transfer(msg.sender, balance);
        }
    }

    function checkClaim(uint256 twitterId, uint256[] calldata curationIds) public view returns (bool[] memory) {
        bool[] memory result = new bool[](curationIds.length);
        for (uint256 i = 0; i < curationIds.length; i++) {
            result[i] = alreadyClaimed[twitterId][curationIds[i]];
        }
        return result;
    }

    function claimPrize(uint256 twitterId, address addr, uint256[] calldata curationIds, uint256 amount, bytes calldata sign) public nonReentrant {
        require(curationIds.length > 0, "get at least one");
        require(sign.length == 65, "invalid sign length");
        require(addr == msg.sender, "invalid addr");
        require(prizeToken != address(0), "prize token not set");

        bytes32 data = keccak256(abi.encodePacked(twitterId, chainId, addr, curationIds, amount));
        require(_check(data, sign), "invalid sign");

        for (uint256 i = 0; i < curationIds.length; i++) {
            if (alreadyClaimed[twitterId][curationIds[i]] == false) {
                alreadyClaimed[twitterId][curationIds[i]] = true;
            } else {
                require(false, "already claimed");
            }
        }
        IERC20(prizeToken).transfer(msg.sender, amount);
        emit RewardInfo(twitterId, msg.sender, curationIds, amount);
    }

    function _check(bytes32 data, bytes calldata sign) internal view returns (bool) {
        bytes32 r = abi.decode(sign[:32], (bytes32));
        bytes32 s = abi.decode(sign[32:64], (bytes32));
        uint8 v = uint8(sign[64]);
        if (v < 27) {
            if (v == 0 || v == 1) v += 27;
        }
        bytes memory profix = "\x19Ethereum Signed Message:\n32";
        bytes32 info = keccak256(abi.encodePacked(profix, data));
        address addr = ecrecover(info, v, r, s);
        return addr == signAddress;
    }
}
