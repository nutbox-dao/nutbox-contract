// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Curation is Ownable, ReentrancyGuard {
    struct TaskInfo {
        uint256 endTime; // after this timestamp, the owner can change the state
        address owner; // who create this task
        address token; // the reward token
        uint256 amount; // reward amount
        uint256 claimedAmount;
        uint256 maxCount; // Maximum number of rewards
        uint256 userCount; // The number of users who have claim.
    }

    event NewTask(address indexed owner, address indexed token, uint256 amount, uint256 endTime);
    event AddReward(uint256 indexed taskId, address indexed contributor, uint256 amount);
    event Redeem(uint256 indexed id);
    event RewardInfo(uint256 indexed twitterId, address indexed user, uint256[] taskIds, uint256[] amounts);

    // all tasks list
    // curation id => TaskInfo
    mapping(uint256 => TaskInfo) private taskList;

    // Flag claimed users
    // twitterid => task id => bool
    mapping(uint256 => mapping(uint256 => bool)) public alreadyClaimed;

    address public signAddress;
    uint256 public chainId = 137;

    constructor(uint256 _chainId, address addr) {
        chainId = _chainId;
        signAddress = addr;
    }

    function setSignAddress(address addr) public onlyOwner {
        signAddress = addr;
    }

    function checkClaim(uint256 twitterId, uint256[] calldata curationIds) public view returns (bool[] memory) {
        bool[] memory result = new bool[](curationIds.length);
        for (uint256 i = 0; i < curationIds.length; i++) {
            result[i] = alreadyClaimed[twitterId][curationIds[i]];
        }
        return result;
    }

    // create a new task
    // every one can create a task
    function newTask(
        uint256 id,
        uint256 endTime,
        address token,
        uint256 amount,
        uint256 maxCount
    ) public {
        require(taskList[id].endTime == 0, "Task has been created");
        require(endTime > block.timestamp, "Wrong end time");

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        taskList[id].endTime = endTime;
        taskList[id].owner = msg.sender;
        taskList[id].token = token;
        taskList[id].amount = amount;
        taskList[id].maxCount = maxCount;

        emit NewTask(msg.sender, token, amount, endTime);
    }

    function appendReward(uint256 id, uint256 amount) public {
        require(taskList[id].endTime > 0, "Task has not been created");
        require(block.timestamp < taskList[id].endTime, "task is over");
        IERC20(taskList[id].token).transferFrom(msg.sender, address(this), amount);
        taskList[id].amount += amount;
        emit AddReward(id, msg.sender, amount);
    }

    function redeem(uint256 id) public nonReentrant onlyOwner {
        require(taskList[id].endTime > 0, "Task has not been created");
        require(taskList[id].endTime < block.timestamp, "Task has not finish");

        if (taskList[id].amount > 0) {
            IERC20(taskList[id].token).transfer(taskList[id].owner, taskList[id].amount);
        }
        emit Redeem(id);
    }

    function claimPrize(
        uint256 twitterId,
        address addr,
        uint256[] calldata curationIds,
        uint256[] calldata amounts,
        bytes calldata sign
    ) public nonReentrant {
        require(curationIds.length > 0, "get at least one");
        require(curationIds.length == amounts.length, "invalid data");
        require(sign.length == 65, "invalid sign length");
        require(addr == msg.sender, "invalid addr");

        bytes32 data = keccak256(abi.encodePacked(twitterId, chainId, addr, curationIds, amounts));
        require(_check(data, sign), "invalid sign");

        for (uint256 i = 0; i < curationIds.length; i++) {
            if (alreadyClaimed[twitterId][curationIds[i]] == false) {
                TaskInfo storage curation = taskList[curationIds[i]];
                require(curation.endTime < block.timestamp, "curation is not over.");
                require(amounts[i] <= curation.amount - curation.claimedAmount, "invalid amount");
                require(curation.userCount + 1 <= curation.maxCount, "participation limit exceeded");

                alreadyClaimed[twitterId][curationIds[i]] = true;
                curation.userCount += 1;
                curation.claimedAmount += amounts[i];

                IERC20(curation.token).transfer(msg.sender, amounts[i]);
            }
        }
        emit RewardInfo(twitterId, msg.sender, curationIds, amounts);
    }

    function _check(bytes32 data, bytes calldata sign) internal view returns (bool) {
        bytes32 r = bytes32(sign[:32]);
        bytes32 s = bytes32(sign[32:64]);
        uint8 v = uint8(bytes1(sign[64:]));
        if (v < 27) {
            if (v == 0 || v == 1) v += 27;
        }
        bytes memory profix = "\x19Ethereum Signed Message:\n32";
        bytes32 info = keccak256(abi.encodePacked(profix, data));
        address addr = ecrecover(info, v, r, s);
        return addr == signAddress;
    }

    // Get task's info
    function taskInfo(uint256 id) public view returns (TaskInfo memory task) {
        task = taskList[id];
    }
}
