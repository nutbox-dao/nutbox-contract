// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
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
    mapping (address => bool) public createdCommunity;

    event CommunityCreated(address indexed creator, address indexed community, address communityToken);
    event ERC20TokenCreated(address indexed token, address indexed owner, TokenProperties properties);

    constructor(address _committee) {
        require(_committee != address(0), "Invalid committee");
        committee = _committee;
    }

    // If communityToken == address(0), we would create a mintable token for cummunity,
    // thus caller should give arguments: name, symbol, initialSupply, owner
    function createCommunity (
        address communityToken,
        TokenProperties memory properties,
        address rewardCalculator,
        bytes calldata distributionPolicy
    ) external {
        require(ICommittee(committee).verifyContract(rewardCalculator), 'UC'); // Unsupported calculator
        bool isMintable = false;

        // we would create a new mintable token for community
        if (communityToken == address(0)){
            isMintable = true;
            MintableERC20 mintableERC20 = new MintableERC20(properties.name, properties.symbol, properties.supply, properties.owner);
            communityToken = address(mintableERC20);
            emit ERC20TokenCreated(communityToken, msg.sender, properties);
        }

        Community community = new Community(msg.sender, committee, communityToken, rewardCalculator, isMintable);
        if (isMintable){
            MintableERC20(communityToken).transferOwnership(address(community));
        }

        if(ICommittee(committee).getFee('COMMUNITY') > 0){
            require(ERC20(ICommittee(committee).getNut()).allowance(msg.sender, address(this)) >= ICommittee(committee).getFee('COMMUNITY'), "need");
            lockERC20(ICommittee(committee).getNut(), msg.sender, ICommittee(committee).getTreasury(), ICommittee(committee).getFee('COMMUNITY'));
            ICommittee(committee).updateLedger('COMMUNITY', address(community), address(0), msg.sender);
        }

        // set staking feast rewarad distribution distributionPolicy
        ICalculator(rewardCalculator).setDistributionEra(address(community), distributionPolicy);

        // add community to fee payment whitelist
        ICommittee(committee).setFeePayer(address(community));

        createdCommunity[address(community)] = true;

        emit CommunityCreated(msg.sender, address(community), communityToken);
    }
}
