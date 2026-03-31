// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import './Community.sol';
import './interfaces/ICalculator.sol';
import './interfaces/ICommittee.sol';
import "./interfaces/ICommunityTokenFactory.sol";
import "./community-token/MintableERC20.sol";

/**
 * @dev Factory contract to create a Community entity
 *
 * This is the entry contract that user start to create their own staking economy.
 */
contract CommunityFactory {

    address immutable committee;
    mapping (address => bool) public createdCommunity;

    event CommunityCreated(address indexed creator, address indexed community, address communityToken);

    constructor(address _committee) {
        require(_committee != address(0), "Invalid committee");
        committee = _committee;
    }

    // If communityToken == address(0), we would create a mintable token for community by token factory,
    // thus caller should give arguments bytes
    function createCommunity (
        bool isMintable,
        address communityToken,
        address communityTokenFactory,
        bytes calldata tokenMeta,
        address rewardCalculator,
        bytes calldata distributionPolicy
    ) external payable {
        // Charge Tier 1 fee: create community
        uint256 fee = ICommittee(committee).getCreateCommunityFee();
        if (fee > 0) {
            require(msg.value >= fee, "Insufficient fee");
            address payable recipient = ICommittee(committee).getFeeRecipient();
            (bool ok, ) = recipient.call{value: fee}("");
            require(ok, "Fee transfer failed");
            if (msg.value > fee) {
                (bool ok2, ) = msg.sender.call{value: msg.value - fee}("");
                require(ok2, "Refund failed");
            }
        }

        require(ICommittee(committee).verifyContract(rewardCalculator), 'UC'); // Unsupported calculator

        // we would create a new mintable token for community
        bool needGrantRole = false;
        if (communityToken == address(0)){
            needGrantRole = true;
            isMintable = true;
            require(ICommittee(committee).verifyContract(communityTokenFactory), 'UTC'); // Unsupported token factory
            communityToken = ICommunityTokenFactory(communityTokenFactory).createCommunityToken(tokenMeta);
        }

        Community community = new Community(msg.sender, committee, communityToken, rewardCalculator, isMintable);
       
        if (needGrantRole){
            // Token deployed by walnut need to grant mint role from community factory to specify community.
            MintableERC20(communityToken).grantRole(MintableERC20(communityToken).MINTER_ROLE(), address(community));
        }

        // set staking feast reward distribution distributionPolicy
        ICalculator(rewardCalculator).setDistributionEra(address(community), distributionPolicy);

        createdCommunity[address(community)] = true;

        emit CommunityCreated(msg.sender, address(community), communityToken);
    }

    // Allow contract to receive native BNB (for fee refunds)
    receive() external payable {}
}
