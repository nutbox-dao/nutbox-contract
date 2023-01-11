// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Curation is Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.UintSet;

    // task status:
    // Openning: when user create a new task;
    // Pending: when we fill the user list;
    // Closed: The task finished, token distribute to the users;
    // Clean: clear the list of rewardList
    enum TaskState {
        Openning,
        Pending,
        Closed,
        Clean
    }

    struct TaskInfo {
        uint256 endTime; // after this timestamp, the owner can change the state
        address owner; // who create this task
        address token; // the reward token
        uint256 amount; // reward amount
        TaskState taskState;
        uint256 id; // task id
        uint256 currentIndex; // user tags that are currently distributed
        uint256 topCount; // Define the number of top
        uint256 maxCount; // Maximum number of rewards
        uint256 userCount; // The number of users who have claim.
    }

    event NewTask(address indexed owner, address indexed token, uint256 amount, uint256 endTime);
    event AddReward(uint256 indexed taskId, address indexed contributor, uint256 amount);
    event TaskStateChange(uint256 indexed id, uint8 state);
    event RewardInfo(uint256 indexed twitterId, address indexed user, address[] tokens, uint256[] amounts);

    // all tasks list
    mapping(uint256 => TaskInfo) private taskList;

    // all tasks id
    uint256[] public taskIds;
    EnumerableSet.UintSet private openningTaskIds;
    EnumerableSet.UintSet private pendingTaskIds;

    // Flag claimed users
    // twitterid => task id => bool
    mapping(uint256 => mapping(uint256 => bool)) alreadyClaimed;

    // create a new task
    // every one can create a task
    function newTask(
        uint256 id,
        uint256 endTime,
        address token,
        uint256 amount,
        uint256 topCount,
        uint256 maxCount
    ) public {
        require(taskList[id].endTime == 0, "Task has been created");
        require(IERC20(token).balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(endTime > block.timestamp, "Wrong end time");
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        taskList[id].endTime = endTime;
        taskList[id].owner = msg.sender;
        taskList[id].token = token;
        taskList[id].amount = amount;
        taskList[id].taskState = TaskState.Openning;
        taskList[id].id = id;
        taskList[id].topCount = topCount;
        taskList[id].maxCount = maxCount;

        taskIds.push(id);
        openningTaskIds.add(id);

        emit NewTask(msg.sender, token, amount, endTime);
    }

    function appendReward(uint256 id, uint256 amount) public {
        require(taskList[id].endTime > 0, "Task has not been created");
        require(IERC20(taskList[id].token).balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(taskList[id].taskState == TaskState.Openning, "Wrong task state");
        IERC20(taskList[id].token).transferFrom(msg.sender, address(this), amount);
        taskList[id].amount += amount;
        emit AddReward(id, msg.sender, amount);
    }

    function redeem(uint256 id) public nonReentrant onlyOwner {
        require(taskList[id].endTime > 0, "Task has not been created");
        require(taskList[id].endTime < block.timestamp, "Task has not finish");
        require(taskList[id].taskState == TaskState.Openning, "Task is not opening");
        taskList[id].taskState = TaskState.Closed;
        openningTaskIds.remove(id);
        if (taskList[id].amount > 0) {
            IERC20(taskList[id].token).transfer(taskList[id].owner, taskList[id].amount);
        }
        emit TaskStateChange(id, uint8(TaskState.Closed));
    }

    function claimPrize(
        uint256 twitterId,
        uint256[] calldata curationIds,
        uint256[] calldata amounts,
        bytes calldata sign
    ) public nonReentrant {
        require(curationIds.length > 0, "get at least one");
        require(curationIds.length == amounts.length, "invalid data");
        require(sign.length == 65, "invalid sign");
    }

    // Get task's head info
    function taskInfo(uint256 id) public view returns (TaskInfo memory task) {
        task = taskList[id];
    }

    function openningTasks() public view returns (uint256[] memory ids) {
        ids = openningTaskIds.values();
    }

    function pendingTasks() public view returns (uint256[] memory ids) {
        ids = pendingTaskIds.values();
    }
}
