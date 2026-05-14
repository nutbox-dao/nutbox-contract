// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "../../interfaces/IPoolFactory.sol";
import "../../CommunityFactory.sol";
import "./DFXStarScoreStaking.sol";

contract DFXStarScoreStakingFactory is IPoolFactory {
    address public immutable communityFactory;
    address public immutable poolTemplate;

    event DFXStarScoreStakingCreated(
        address indexed pool,
        address indexed community,
        string name,
        address gameOperator
    );

    constructor(address _communityFactory) {
        require(_communityFactory != address(0), "Invalid address");
        communityFactory = _communityFactory;
        poolTemplate = address(new DFXStarScoreStaking());
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
        require(meta.length >= 20, "Invalid meta length");

        address gameOperator;
        assembly ("memory-safe") {
            gameOperator := shr(96, calldataload(meta.offset))
        }
        require(gameOperator != address(0), "Invalid address");

        address clone = Clones.clone(poolTemplate);
        DFXStarScoreStaking pool = DFXStarScoreStaking(payable(clone));
        pool.initialize(community, name, gameOperator);

        emit DFXStarScoreStakingCreated(
            address(pool),
            community,
            name,
            gameOperator
        );
        return address(pool);
    }
}
