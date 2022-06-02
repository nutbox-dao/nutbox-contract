// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "solidity-bytes-utils/contracts/BytesLib.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IPoolFactory.sol";
import "./AstarDappStaking.sol";
import "../../CommunityFactory.sol";
import "./IAstarFactory.sol";

/**
 * @dev Factory contract of Astar Dapp staking pool.
 *x
 */
contract AstarDappStakingFactory is IPoolFactory, Ownable, IAstarFactory {
    using BytesLib for bytes;

    address public immutable communityFactory;
    address public override delegateDappsStakingContract;

    uint256 public override minimumActiveAmount = 1 ether;

    event DelegateContractChange(address indexed oldContract, address indexed newContract);
    event AStarDappStakingCreated(address indexed pool, address indexed community, string name, address dapp);
    event MinimumActiveAmountChange(uint256 old, uint256 minimumActiveAmount);

    constructor(address _communityFactory, address _delegateDappsStakingContract) {
        require(_communityFactory != address(0), "Invalid argument");
        require(_delegateDappsStakingContract != address(0), "Invalid argument");

        communityFactory = _communityFactory;
        delegateDappsStakingContract = _delegateDappsStakingContract;
    }

    function adminSetDelegateContract(address _delegateDappsStakingContract) external onlyOwner {
        require(_delegateDappsStakingContract != address(0), "Invalid argument");
        address old = delegateDappsStakingContract;
        delegateDappsStakingContract = _delegateDappsStakingContract;
        emit DelegateContractChange(old, _delegateDappsStakingContract);
    }

    function adminSetDelegateContract(uint256 _minimumActiveAmount) external onlyOwner {
        uint256 old = minimumActiveAmount;
        minimumActiveAmount = _minimumActiveAmount;
        emit MinimumActiveAmountChange(old, minimumActiveAmount);
    }

    function createPool(
        address community,
        string memory name,
        bytes calldata meta
    ) external override returns (address) {
        require(community == msg.sender, "Permission denied: caller is not community");
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        address dapp = meta.toAddress(0);

        AstarDappStaking pool = new AstarDappStaking(community, name, address(dapp));
        emit AStarDappStakingCreated(address(pool), community, name, address(dapp));
        return address(pool);
    }
}
