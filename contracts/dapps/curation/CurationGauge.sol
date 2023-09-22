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
    bool public poolStarted;

    // community that pool belongs to
    address public community;
    address public recipient;
    uint256 deposit;

    event ChangeRecipient(address indexed oldRecipent, address indexed newRecipient);
    event WithdrawRewardsToRecipient(uint256 indexed amount);
    event PoolStarted();

    constructor(address _community, string memory _name, address _recipient) {
        factory = msg.sender;
        community = _community;
        name = _name;
        recipient = _recipient;
        emit ChangeRecipient(address(0), _recipient);
    }

    function startPool() public {
        require(deposit == 0, "Pool has started");
        Community(community).updatePools("USER", address(this));
        deposit = 1;
        emit PoolStarted();
    }

    function adminSetRecipient(address _recipient) public {
        require(Ownable(community).owner() == msg.sender, "Only the community owner can change recipient");
        address oldRecipient = recipient;
        recipient = _recipient;
        emit ChangeRecipient(oldRecipient, _recipient);
    }

    // diffrient with other pools in community, this community reward can't be called from community contract
    // because the depositor is this pool itself, so user call this function and this pool call the community withdraw method
    // then transfer the received reward to recipient
    function withdrawRewardsToRecipient() public {
        address[] memory pools = new address[](1);
        pools[0] = address(this);
        Community(community).withdrawPoolsRewards(pools);
        address rewardToken = Community(community).getCommunityToken();
        uint256 balance = ERC20(rewardToken).balanceOf(address(this));
        releaseERC20(rewardToken, recipient, balance);
        emit WithdrawRewardsToRecipient(balance);
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
            return deposit;
        }else {
            return 0;
        }
    }

    function getTotalStakedAmount()
        external
        view
        override returns (uint256)
    {
        return deposit;
    }
}
