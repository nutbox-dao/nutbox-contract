// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./Treasury.sol";
import "../CommunityFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract TreasuryFactory is Ownable {

    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private rewardsList;

    address immutable communityFactory;

    // community => created treasury
    mapping(address => address) communityCreatedTreasury;

    address[] private createdTreasury;

    event AdminAddNewReward(address indexed newReward);
    event AdminRemoveReward(address indexed reward);
    event NewTreasuryCreated(address indexed community, address indexed treasury);

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
    }

    function adminAddReward(address _newReward) external onlyOwner {
        require(_newReward != address(0), "Invalid address");
        require(!rewardsList.contains(_newReward), "Reward has been added");
        rewardsList.add(_newReward);
        emit AdminAddNewReward(_newReward);
    }

    function adminRemoveReward(address _reward) external onlyOwner {
        require(rewardsList.contains(_reward), "Reward not added");
        rewardsList.remove(_reward);
        emit AdminRemoveReward(_reward);
    }

    function getRewardList() public view returns (address[] memory) {
        return rewardsList.values();
    }

    function createTreasury(address community) external {
        require(communityCreatedTreasury[community] == address(0), "Community has created treasury");
        require(CommunityFactory(communityFactory).createdCommunity(community), "Community not exist");
        require(Ownable(community).owner() == msg.sender, "Caller not community admin");
        Treasury t = new Treasury(community);
        communityCreatedTreasury[community] = address(t);
        createdTreasury.push(address(t));
        emit NewTreasuryCreated(community, address(t));
    }

    function treasuryOfCommunity(address community) public view returns (address) {
        return communityCreatedTreasury[community];
    }


}