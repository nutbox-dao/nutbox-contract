// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
pragma experimental ABIEncoderV2;

import './Community.sol';
import './interfaces/ICalculator.sol';
import './interfaces/ICommittee.sol';
import "./interfaces/ICommunityTokenFactory.sol";
import "./ERC20Helper.sol";

/**
 * @dev Factory contract to create an StakingTemplate entity
 *
 * This is the entry contract that user start to create their own staking economy.
 */
contract CommunityFactory is ERC20Helper {

    address immutable committee;
    mapping (address => bool) public createdCommunity;

    event CommunityCreated(address indexed creator, address indexed community, address communityToken);

    constructor(address _committee) {
        require(_committee != address(0), "Invalid committee");
        committee = _committee;
    }

    // If communityToken == address(0), we would create a mintable token for cummunity by token factory,
    // thus caller should give arguments bytes
    function createCommunity (
        address communityToken,
        address communityTokenFactory,
        bytes calldata tokenMeta,
        address rewardCalculator,
        bytes calldata distributionPolicy
    ) external {
        require(ICommittee(committee).verifyContract(rewardCalculator), 'UC'); // Unsupported calculator
        bool isMintable = false;

        // we would create a new mintable token for community
        if (communityToken == address(0)){
            require(ICommittee(committee).verifyContract(communityTokenFactory), 'UTC'); // Unsupported token factory
            isMintable = true;
            address communityToken = ICommunityTokenFactory(communityTokenFactory).createCommunityToken(tokenMeta);
        }

        Community community = new Community(msg.sender, committee, communityToken, rewardCalculator, isMintable);
        if (isMintable){
            Ownable(communityToken).transferOwnership(address(community));
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
