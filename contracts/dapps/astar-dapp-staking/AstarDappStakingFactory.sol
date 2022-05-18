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

    address astarDAppStakingContract;
    address public immutable communityFactory;
    address public rewardCalcContract;

    event StakingContractChange(
        address indexed oldContract,
        address indexed newContract
    );
    event CalcContractChange(
        address indexed oldContract,
        address indexed newContract
    );
    event AStarDappStakingCreated(
        address indexed pool,
        address indexed community,
        string name,
        address dapp
    );

    constructor(
        address _astarDAppStakingContract,
        address _communityFactory,
        address _rewardCalcContract
    ) {
        require(_astarDAppStakingContract != address(0), "Invalid argument");
        require(_communityFactory != address(0), "Invalid argument");
        require(_rewardCalcContract != address(0), "Invalid argument");

        astarDAppStakingContract = _astarDAppStakingContract;
        communityFactory = _communityFactory;
        rewardCalcContract = _rewardCalcContract;
    }

    function adminSetStakingContract(address _astarDAppStakingContract)
        external
        onlyOwner
    {
        require(_astarDAppStakingContract != address(0), "Invalid argument");
        address old = astarDAppStakingContract;
        astarDAppStakingContract = _astarDAppStakingContract;
        emit StakingContractChange(old, _astarDAppStakingContract);
    }

    function adminSetCalcContract(address _rewardCalcContract)
        external
        onlyOwner
    {
        require(_rewardCalcContract != address(0), "Invalid argument");
        address old = rewardCalcContract;
        rewardCalcContract = _rewardCalcContract;
        emit CalcContractChange(old, _rewardCalcContract);
    }

    function createPool(
        address community,
        string memory name,
        bytes calldata meta
    ) external override returns (address) {
        require(
            community == msg.sender,
            "Permission denied: caller is not community"
        );
        require(
            CommunityFactory(communityFactory).createdCommunity(community),
            "Invalid community"
        );
        address dapp = meta.toAddress(0);

        AstarDappStaking pool = new AstarDappStaking(
            astarDAppStakingContract,
            community,
            name,
            address(dapp),
            owner()
        );
        emit AStarDappStakingCreated(
            address(pool),
            community,
            name,
            address(dapp)
        );
        return address(pool);
    }
}
