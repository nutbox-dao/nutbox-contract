// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/ICommittee.sol";
import "./ERC20Helper.sol";

contract Committee is ICommittee, ERC20Helper, Ownable {
    using SafeMath for uint256;

    // treasury account that reserve all revenues
    address public treasury;
    // NUT address
    address public nut;
    // feeType => amount
    mapping(bytes32 => uint256) private fees;
    // feeType => amount
    mapping(bytes32 => uint256) private revenues;
    // community => amount, all fees come from the community
    mapping(address => uint256) private communityFees;
    // caller => canCall, whitlist of all caller
    mapping(address => bool) private whitelist;
    // caller => canCall, can add or remove address from whitelist
    mapping(address => bool) private whitelistManager;
    // contract => isWhilistContract
    mapping(address => bool) private whitelistContracts;

    // some address no need to pay fee. eg: steem brigde
    mapping(address => bool) private feeIgnoreList;

    event FeeSet(string indexed feeType, uint256 amount);
    event NewRevenue(string feeType, address indexed community, address indexed pool, address indexed who, uint256 amount);
    event NewAppropriation(address recipient, uint256 amount);

    event AdminAddWhitelistManager(address indexed wm);
    event AdminRemoveWhitelistManager(address indexed wm);
    event AdminAddContract(address indexed c);
    event AdminRemoveContract(address indexed c);
    event AdminAddFeeIgnoreAddress(address indexed feeIgnore);
    event AdminRemoveFeeIgnoreAddress(address indexed feeIgnore);
    event AdminSetTreasury(address indexed treasury);
    event AdminSetNut(address indexed nut);

    constructor(address _treasury, address _nut) {
        require(_treasury != address(0), "Invalid treasury");
        require(_nut != address(0), "Invalid nut");
        treasury = _treasury;
        nut = _nut;
    }

    function adminAddWhitelistManager(address _m) external onlyOwner {
        whitelistManager[_m] = true;
        emit AdminAddWhitelistManager(_m);
    }

    function adminRemoveWhitelistManager(address _m) external onlyOwner {
        whitelistManager[_m] = false;
        emit AdminRemoveWhitelistManager(_m);
    }

    function adminAddContract(address _c) external onlyOwner {
        whitelistContracts[_c] = true;
        emit AdminAddContract(_c);
    }

    function adminRemoveContract(address _c) external onlyOwner {
        whitelistContracts[_c] = false;
        emit AdminRemoveContract(_c);
    }

    function adminAddFeeIgnoreAddress(address _f) external onlyOwner {
        feeIgnoreList[_f] = true;
        emit AdminAddFeeIgnoreAddress(_f);
    }

    function adminRemoveFeeIgnoreAddress(address _f) external onlyOwner {
        feeIgnoreList[_f] = false;
        emit AdminRemoveFeeIgnoreAddress(_f);
    }

    function adminSetTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit AdminSetTreasury(_treasury);
    }

    function adminSetNut(address _nut) external onlyOwner {
        require(_nut != address(0), "Invalide address");
        nut = _nut;
        emit AdminSetNut(_nut);
    }

    function adminAppropriate(address recipient, uint256 amount) external onlyOwner {
        releaseERC20(nut, recipient, amount);
        emit NewAppropriation(recipient, amount);
    }

    function adminSetFee(string memory feeType, uint256 amount) external onlyOwner {
        fees[keccak256(abi.encodePacked(feeType))] = amount;
        emit FeeSet(feeType, amount);
    }

    function setFeePayer(address payer) override external {
        require(whitelistManager[msg.sender], 'Permission denied: caller is not in whitelist');
        whitelist[payer] = true;
    }

    function getNut() external view override returns (address) {
        return nut;
    }

    function getTreasury() external view override returns (address) {
        return treasury;
    }

    function getFee(string memory feeType) external view override returns (uint256) {
        return fees[keccak256(abi.encodePacked(feeType))];
    }

    function updateLedger(string memory feeType, address community, address pool, address who) external override {
        if(feeIgnoreList[who]) return;
        require(whitelistManager[msg.sender] || whitelist[msg.sender], 'Permission denied: caller is not in whitelist');
        bytes32 ft = keccak256(abi.encodePacked(feeType));
        uint256 amount = fees[ft];
        if (amount == 0) return;
        revenues[ft] = revenues[ft].add(amount);
        communityFees[community] = communityFees[community].add(amount);
        emit NewRevenue(feeType, community, pool, who, amount);
    }

    function getRevenue(string memory feeType) external view override returns (uint256) {
        return revenues[keccak256(abi.encodePacked(feeType))];
    }

    function verifyContract(address c) external view override returns (bool) {
        return whitelistContracts[c];
    }

    function getFeeIgnore(address ignoreAddress) external view override returns (bool) {
        return feeIgnoreList[ignoreAddress];
    }
}
