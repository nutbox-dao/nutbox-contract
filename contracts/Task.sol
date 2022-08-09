// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ERC20Helper.sol";

/**
 * Wormhole remote task Database
 * This is a simple task list, project manager can publish a task to remote one of his twitter
 * He need to depost some ERC20 token to this contract
 * Then we write into the reward list after the end time
 */
contract Task is Ownable, ReentrancyGuard, ERC20Helper {

    // task status: 
    // Openning: when user create a new task; 
    // Pending: when we fill the user list; 
    // Cancel: when the owner cancel and return back his token;
    // Closed: The task finished, token distribute to the users;
    enum TaskState {
        Openning, 
        Pending,
        Cancel,
        Closed
    }

    struct RewardInfo {
        address user;
        uint256 twiiterId;
        uint256 amount;
    }

    struct Task {
        uint256 endTime; // after this timestamp, the owner can change the state
        address owner;   // who create this task
        address token;   // the reward token
        uint256 amount;  // reward amount
        TaskState taskState; 
        uint256 id;       // task id
        RewardInfo[] rewardList; // filled by wormhole
    }

    uint256[] public taskIds;

    mapping(uint256 => Task) private taskList;

    constructor(){}

    // create a new task
    function newTask(uint256 id, uint256 endTime, address token, uint256 amount) public {
        require(taskList[id].endTime == 0, 'Task has been created');
        require(ERC20(token).balanceOf(msg.sender) >= amount, 'Insufficient balance');
        require(endTime > block.timestamp, 'Wrong end time');
        lockERC20(token, msg.sender, address(this), amount);

        taskList[id].endTime = endTime;
        taskList[id].owner = msg.sender;
        taskList[id].token = token;
        taskList[id].amount = amount;
        taskList[id].taskState = TaskState.Openning;
        taskList[id].id = id;

    }

}