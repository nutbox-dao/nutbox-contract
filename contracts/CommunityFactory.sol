// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./MintableERC20.sol";
import './Community.sol';
import './interfaces/ICalculator.sol';
import './interfaces/ICommittee.sol';

/**
 * @dev Factory contract to create an StakingTemplate entity
 *
 * This is the entry contract that user start to create their own staking economy.
 */
contract CommunityFactory {
    struct TokenProperties {
        string name;
        string symbol;
        uint256 supply;
        address owner;
    }

    address committee;
    uint64 public communityCount;
    address[] public communities;
    mapping (address => bool) public calculators;

    event CommunityCreated(address indexed creater, address indexed community, address communityToken);
    event ERC20TokenCreated(address indexed token, address indexed owner, TokenProperties properties);

    constructor(address _committee) {
        committee = _committee;
    }

    // If communityToken == 0, we would create a mintable token for cummunity,
    // thus caller should give arguments: name, symbol, initialSupply, owner
    function createCommunity (
        address communityToken,
        TokenProperties memory properties,
        address rewardCalculator,
        bytes calldata distributionPolicy
    ) external {
        require(ICommittee(committee).verifyContract(rewardCalculator), 'Unsupported calculator');

        Community community = new Community(committee);

        // we would create a new mintable token for community
        if (communityToken == address(0)){
            MintableERC20 mintableERC20 = new MintableERC20(properties.name, properties.symbol, properties.supply, properties.owner);

            bytes32 MINTER_ROLE = mintableERC20.MINTER_ROLE();
            (bool success, ) = address(mintableERC20).call(
                abi.encodeWithSignature("grantRole(bytes32,address)", MINTER_ROLE, address(community))
            );
            require(success, 'Failed to grant mint role for community');
            communityToken = address(mintableERC20);
            emit ERC20TokenCreated(communityToken, properties.owner, properties);
        }

        community.initialize(
            msg.sender,
            communityToken,
            rewardCalculator
        );

        // set staking feast rewarad distribution distributionPolicy
        ICalculator(rewardCalculator).setDistributionEra(address(community), distributionPolicy);

        // save record
        communities.push(address(community));
        communityCount += 1;

        // add community to fee payment whitelist
        ICommittee(committee).setFeePayer(address(community));

        emit CommunityCreated(msg.sender, address(community), communityToken);
    }
}
