// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CommunityStorage.sol";

contract AutoCuration is Ownable, ReentrancyGuard {
    event RewardInfo(uint256 indexed twitterId, address indexed user, uint256[] taskIds, uint256 amount);

    CommunityStorage public cStorage;
    address public creator;
    address public wh3 = 0x06Deb72b2e156Ddd383651aC3d2dAb5892d9c048;

    // claim fees
    // btc: 0.000005, eth: 0.00008, bnb: 0.0005, matic: 0.5, nuls: 1
    uint256 private claimFee = 1 ether;

    bool isInit = false;

    modifier onlyCreator() {
        require(creator == msg.sender, "Ownable: caller is not the creator");
        _;
    }

    modifier onlyWh3() {
        require(wh3 == msg.sender, "Ownable: caller is not wh3");
        _;
    }

    receive() external payable {}

    function init(uint256 cid, address signAddr, address prize, address _creator, address storageAddr) public onlyOwner {
        if (!isInit) {
            if (storageAddr == address(0)) {
                cStorage = new CommunityStorage(cid, address(this), prize, signAddr);
            } else {
                cStorage = CommunityStorage(storageAddr);
            }
            isInit = true;
            creator = _creator;
        }
    }

    function setSignAddress(address addr) public onlyCreator {
        cStorage.setSignAddress(addr);
    }

    function setPrizeToken(address addr) public onlyCreator {
        cStorage.setPrizeToken(addr);
    }

    function setClaimFee(uint256 _claimFee) public onlyWh3 {
        claimFee = _claimFee;
    }

    function setWh3(address _wh3) public onlyWh3 {
        wh3 = _wh3;
    }

    function withdraw() public onlyCreator {
        cStorage.withdraw(msg.sender);
    }

    function checkClaim(uint256 twitterId, uint256[] calldata curationIds) public view returns (bool[] memory) {
        bool[] memory result = new bool[](curationIds.length);
        for (uint256 i = 0; i < curationIds.length; i++) {
            result[i] = cStorage.alreadyClaimed(twitterId, curationIds[i]);
        }
        return result;
    }

    function claimPrize(uint256 twitterId, address addr, uint256[] calldata curationIds, uint256 amount, bytes calldata sign) public payable nonReentrant {
        require(curationIds.length > 0, "get at least one");
        require(sign.length == 65, "invalid sign length");
        require(addr == msg.sender, "invalid addr");
        require(cStorage.prizeToken() != address(0), "prize token not set");
        require(msg.value >= claimFee, "Insufficient fee");

        if (msg.value > claimFee) {
            (bool success, ) = msg.sender.call{value: msg.value - claimFee}("");
            require(success, "refund fail");
        }else {
            (bool success, ) = wh3.call{value: claimFee}("");
            require(success, "cost fee fail");
        }

        bytes32 data = keccak256(abi.encodePacked(twitterId, block.chainid, addr, curationIds, amount));
        require(_check(data, sign), "invalid sign");

        for (uint256 i = 0; i < curationIds.length; i++) {
            cStorage.saveAlreadyClaimed(twitterId, curationIds[i]);
        }
        cStorage.transfer(msg.sender, amount);
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
        return addr == cStorage.signAddress();
    }

    function alreadyClaimed(uint256 twitterId, uint256 curationId) public view returns (bool) {
        return cStorage.alreadyClaimed(twitterId, curationId);
    }

    function getBalance() public view returns (uint256) {
        return cStorage.getBalance();
    }

    function signAddress() public view returns (address) {
        return cStorage.signAddress();
    }

    function prizeToken() public view returns (address) {
        return cStorage.prizeToken();
    }

    function upgrade(address newCommunity) public onlyOwner {
        require(newCommunity != address(0), "invalid newCommunity");
        cStorage.transferOwnership(newCommunity);
    }
}
