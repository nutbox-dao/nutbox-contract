// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PeanutBiz is Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.UintSet;

    struct Payment {
        // When did 
        uint256 handleTime;
        // Can used judge the sequence of payment create times
        uint256 id;
        uint256 amount;
        // How many peanut for 10% upvote, this is filled by owner
        uint256 pnutForVote;
        uint256 payBlock;
        address payer;
        string cancelReason;
        string author;
        string permlink;
    }

    address immutable public pnut;
    // min pay threshold, can be set by owner
    // this is set to avoid lower paymaent attack
    uint256 public payThreshold;
    uint256 public totalRevenue;
    uint256 public totalBurned;
    uint32  public closedCount; 

    // all transfer user commited
    Payment[] private allPayment;

    // Record the canceled payment, transfer back therir pnut
    EnumerableSet.UintSet private canceled;
    // Record the new pending payment
    EnumerableSet.UintSet private pending;

    // Cache the post wheather in pending list
    mapping(bytes32 => bool) isPending;

    event AdminUpdatePayThreshold(uint256 payThreshold);
    event NewBuy(address indexed payer, string author, string permlink, uint256 amount);
    event AdminClosePayment(uint256 indexed id, uint256 pnutForVote);
    event AdminCancelPayment(uint256 indexed id, string cancelReason);
    event AdminBurnPnut(uint256 amount);

    constructor (address _pnut) {
        pnut = _pnut;
        // set payThreshold to 100 pnut as default
        payThreshold = 1e20;
    }

    function adminSetPayThreshold(uint256 _payThreshold) external onlyOwner {
        payThreshold = _payThreshold;
        emit AdminUpdatePayThreshold(_payThreshold);
    }

    function addNewPayment(string memory author, string memory permlink, uint256 amount) external nonReentrant {
        require(amount >= payThreshold, "Lower payment");
        // one author only one order per day
        bytes32 a = keccak256(abi.encodePacked(author));
        require(!isPending[a], "Post is pending.");

        require(ERC20Burnable(pnut).transferFrom(msg.sender, address(this), amount), "Transfer pnut fail.");

        uint256 newId = allPayment.length;
        require(pending.add(newId), "Add new payment to pending fail.");

        Payment memory _new = Payment(0, newId, amount, 0, block.number, msg.sender, "", author, permlink);
        allPayment.push(_new);

        isPending[a] = true;

        emit NewBuy(msg.sender, author, permlink, amount);
    }

    // Admin close the payment in pending list
    function closePayment(uint256 id, uint256 _peanutForVote) external onlyOwner nonReentrant {
        require(pending.contains(id), "Payment not exsit or has been handled.");
        Payment storage _payment = allPayment[id];
        _payment.handleTime = block.timestamp;
        _payment.pnutForVote = _peanutForVote;
        string memory author = _payment.author;
        bytes32 a = keccak256(abi.encodePacked(author));

        totalRevenue += _payment.amount;
        closedCount += 1;
        isPending[a] = false;

        require(pending.remove(id), "Nothing to remove.");
        emit AdminClosePayment(id, _peanutForVote);
    }

    function cancelPayment(uint256 id, string memory reason) external onlyOwner nonReentrant {
        require(pending.contains(id), "Payment not exsit or has been handled.");
        Payment storage _payment = allPayment[id];
        _payment.handleTime = block.timestamp;
        _payment.cancelReason = reason;
        string memory author = _payment.author;
        bytes32 a = keccak256(abi.encodePacked(author));
        isPending[a] = false;

        require(ERC20Burnable(pnut).transfer(_payment.payer, _payment.amount), "Refund pnut fail.");

        require(pending.remove(id), "Remove pending fail.");
        require(canceled.add(id), "Add to cancel fail.");
        emit AdminCancelPayment(id, reason);
    }

    function burnPnut(uint256 amount) public onlyOwner {
        require(amount <= totalRevenue - totalBurned, "Burn out of limit.");
        ERC20Burnable(pnut).burn(amount);
        totalBurned += amount;

        emit AdminBurnPnut(amount);
    }

    function getPendingIds() public view returns (uint256[] memory) {
        return pending.values();
    }

    function getCanceledCount() public view returns (uint32 count) {
        count = uint32(canceled.length());
    }

    function getPaymentById(uint256 id) public view returns (Payment memory payment) {
        require(id < allPayment.length, "Payment not exist.");
        payment = allPayment[id]; 
    }

    function getTotalPaymentCount() public view returns (uint32 count) {
        count = uint32(allPayment.length);
    }

}