// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import "solidity-bytes-utils/contracts/BytesLib.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IPoolFactory.sol";
import "./AstarDappStaking.sol";
import "../../CommunityFactory.sol";

/**
 * @dev Factory contract of Astar Dapp staking pool.
 *x
 */
contract AstarDappStakingFactory is IPoolFactory, Ownable {
    using BytesLib for bytes;

    address astarDAppStakingContract;
    address public immutable communityFactory;

    event StakingContractChange(address indexed oldContract, address indexed newContract);
    event AStarDappStakingCreated(
        address indexed pool,
        address indexed community,
        string name,
        address dapp
    );

    constructor(address _astarDAppStakingContract, address _communityFactory) {
        require(_astarDAppStakingContract != address(0), 'Invalid argument');
        require(_communityFactory != address(0), 'Invalid argument');

        astarDAppStakingContract = _astarDAppStakingContract;
        communityFactory = _communityFactory;
    }

    function adminSetStakingContract(address _astarDAppStakingContract) external onlyOwner {
        require(_astarDAppStakingContract != address(0), 'Invalid argument');
        address old = astarDAppStakingContract;
        astarDAppStakingContract = _astarDAppStakingContract;
        emit StakingContractChange(old, _astarDAppStakingContract);
    }

    function createPool(address community, string memory name, bytes calldata meta) override external returns(address) {
        require(community == msg.sender, 'Permission denied: caller is not community');
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        address dapp = meta.toAddress(0);

        AstarDappStaking pool = new AstarDappStaking(astarDAppStakingContract, community, name, address(dapp), owner());
        emit AStarDappStakingCreated(address(pool), community, name, address(dapp));
        return address(pool);
    }
}
