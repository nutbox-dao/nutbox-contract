// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/ICommunity.sol";
import "../../interfaces/IPool.sol";
import "../../ERC20Helper.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../Community.sol";

/**
 * @dev Template curation contract of Nutbox.
 * Every community can only deploy one curation pool
 * The community DAO can reset the pool ratio from token mint and reset the recipient address(always be another contract)
 * Everyone can claim reward from curation pool, the reward will mint to the recipient address
 *x
 */
contract CurationGauge is IPool, ERC20Helper, ReentrancyGuard {
    using SafeMath for uint256;

    address immutable factory;

    string public name;

    // community that pool belongs to
    address immutable community;
    address public recipient;
    address public rewardToken;

    event ChangeRecipient(address indexed oldRecipent, address indexed newRecipient);
    event WithdrawRewardsToRecipient(uint256 indexed amount);

    constructor(address _community, string memory _name, address _recipient) {
        factory = msg.sender;
        community = _community;
        name = _name;
        recipient = _recipient;
        emit ChangeRecipient(address(0), _recipient);
    }

    function adminSetRecipient(address _recipient) public {
        require(Ownable(community).owner() == msg.sender, "Only the community owner can change recipient");
        address oldRecipient = recipient;
        recipient = _recipient;
        emit ChangeRecipient(oldRecipient, _recipient);
    }

    function withdrawRewardsToRecipient() public {
        address[] memory pools;
        pools[0] = address(this);
        Community(community).withdrawPoolsRewards(pools);
        uint256 balance = ERC20(rewardToken).balanceOf(address(this));
        releaseERC20(rewardToken, recipient, balance);
    }

    function getFactory() external view override returns (address) {
        return factory;
    }

    function getCommunity() external view override returns (address) {
        return community;
    }

    function getUserStakedAmount(address user)
        external
        view
        override returns (uint256)
    {
        if (user == address(this)) {
            return 0;
        }else {
            return 1;
        }
    }

    function getTotalStakedAmount()
        external
        view
        override returns (uint256)
    {
        return 1;
    }
}
