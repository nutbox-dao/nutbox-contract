// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./MintableERC20.sol";
import './Community.sol';
import './interfaces/ICalculator.sol';
import './interfaces/ICommittee.sol';
import "./ERC20Helper.sol";

/**
 * @dev Factory contract to create an StakingTemplate entity
 *
 * This is the entry contract that user start to create their own staking economy.
 */
contract CommunityFactory is ERC20Helper {
    struct TokenProperties {
        string name;
        string symbol;
        uint256 supply;
        address owner;
    }

    address immutable committee;
    uint64 public communityCount;
    address[] public communities;
    mapping (address => bool) public calculators;
    // owner  =>  community address, can only create one community from an account
    mapping (address => address) public ownerCommunity;

    event CommunityCreated(address indexed creator, address indexed community, address communityToken);
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
        require(ICommittee(committee).verifyContract(rewardCalculator), 'UC'); // Unsupported calculator
        require(ownerCommunity[msg.sender] == address(0), "HC"); // Have created a community


        // we would create a new mintable token for community
        if (communityToken == address(0)){
            MintableERC20 mintableERC20 = new MintableERC20(properties.name, properties.symbol, properties.supply, properties.owner);
            communityToken = address(mintableERC20);
            emit ERC20TokenCreated(communityToken, msg.sender, properties);
        }

        Community community = new Community(msg.sender, committee, communityToken, rewardCalculator, communityToken == address(0));

        if(ICommittee(committee).getFee('CREATING_COMMUNITY') > 0){
            lockERC20(ICommittee(committee).getNut(), msg.sender, ICommittee(committee).getTreasury(), ICommittee(committee).getFee('CREATING_COMMUNITY'));
            ICommittee(committee).updateLedger('CREATING_COMMUNITY', address(this), address(0), msg.sender);
        }

        // set staking feast rewarad distribution distributionPolicy
        ICalculator(rewardCalculator).setDistributionEra(address(community), distributionPolicy);

        ownerCommunity[msg.sender] = address(community);
        // save record
        communities.push(address(community));
        communityCount += 1;

        // add community to fee payment whitelist
        ICommittee(committee).setFeePayer(address(community));

        emit CommunityCreated(msg.sender, address(community), communityToken);
    }
}
