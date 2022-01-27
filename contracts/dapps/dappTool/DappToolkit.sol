// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/IPool.sol";
import "../../interfaces/IDappToolkit.sol";
import "./DappToolkit.sol";
import "../../CommunityFactory.sol";
import "../../interfaces/ICommunity.sol";
import "../../ERC20Helper.sol";
import "../../NUTToken.sol";

contract DappToolkit is IDappToolkit, Ownable, ERC20Helper, ReentrancyGuard {

    using SafeMath for uint256;

    struct User{
        bool hasDeposited;
        uint256 amount;
        uint256 nutAvailable;
        uint256 nutDebt;
        uint256 cTokenAvailable;
        uint256 cTokenDebt;
    }

    struct Toolkit {
        bool hasCreated;
        address community;
        address factory;
        address cToken;
        uint256 cTokenAcc;
        uint256 cTokenRevenue;
        uint256 lastCTokenRevenue;
        uint256 totalStakedEvNut;
        mapping (address => User) users;
    }

    // define the NUT distribution to 3 part
    struct DistributionRatio {
        uint16 community;
        uint16 poolFactory;
        uint16 user;
    }
    
    // evNUT addresss
    address immutable evNUT;
    // NUT address
    address immutable NUT;
    // We set this parameter by committ
    // this is used by any community
    // when user harvest c-tokens dappToolsRatio / 10000 cToken will transfer to dapp tools contract
    // These cToken will be mined by user who vote with vNUT
    uint256 public revenueRatio;
    // total reward nut per block, can be reset by Nutbox DAO
    uint256 public rewardNUTPerBlock;
    // last nut reward block
    uint256 private lastRewardBlock;

    // nutAcc means how many nut will 1 evNUT staked earn, it departed by community/poolFactory/user
    uint256 private userNutAcc;
    uint256 private poolFactoryNutAcc;
    uint256 private communityNutAcc;

    uint256 public totalEvNUTStaked;

    // can be rest by Nutbox DAO, total of the ratios should be 10000
    DistributionRatio public distributionRatio;

    // communityFactory
    address immutable communityFactory;
    // all created toolkits by community owner
    // pool address => toolkit
    mapping (address => Toolkit) private toolkits;

    // reward nut distribute to community and tool dev
    mapping (address => uint256) public communityTotalStakedNut;
    mapping (address => uint256) public poolFactoryTotalStakedNut;
    mapping (address => uint256) private communityAvailable;
    mapping (address => uint256) private poolFactoryAvailable;
    mapping (address => uint256) private communityDebt;
    mapping (address => uint256) private poolFactoryDebt;
    

    event AdminSetDappToolkitRatio(uint256 indexed revenueRatio);
    event AdminSetNutRewardPerBlock(uint256 indexed nutRewardPerBlock);
    event AdminSetNutDistributionRatio(uint16 communit, uint16 poolFactory, uint16 user);
    event CreateNewToolkit(address indexed community, address indexed factory, address indexed pool);
    event UpdateLedger(address indexed community, address indexed factory, address indexed pool, uint256 amount);

    event Deposited(address indexed community, address indexed factory, address indexed pool, address user, uint256 amount);
    event Withdrawn(address indexed community, address indexed factory, address indexed pool, address user, uint256 amount);

    event WithdrawnCToken(address indexed pool, address indexed recipient, uint256 amount);
    event UserWithdrawnNut(address indexed pool, address indexed recipient, uint256 amount);
    event CommunityWithdrawnNut(address indexed community, address indexed recipient, uint256 amount);
    event PoolFactoryWithdrawnNut(address indexed poolFactory, address indexed recipient, uint256 amount);

    constructor(address _communityFactory, uint256 _revenueRatio, DistributionRatio memory ratios, address _evNut, address _nut) {require(ratios.community + ratios.poolFactory + ratios.user == 10000, "Sum of ratios should be 10000");
        distributionRatio.community = ratios.community;
        distributionRatio.poolFactory = ratios.poolFactory;
        distributionRatio.user = ratios.user;
        communityFactory = _communityFactory;
        revenueRatio = _revenueRatio;
        evNUT = _evNut;
        NUT = _nut;
        emit AdminSetDappToolkitRatio(_revenueRatio);
        emit AdminSetNutDistributionRatio(ratios.community, ratios.poolFactory, ratios.user);
    }

    function toolCreated(address pool) external override returns (bool) {
        return toolkits[pool].hasCreated;
    }

    // set the ratio of user harvest cToken
    function adminSetDappToolsRatio(uint256 _revenueRatio) external onlyOwner {
        revenueRatio = _revenueRatio;
        emit AdminSetDappToolkitRatio(_revenueRatio);
    }

    function adminSetNutDistributionRatio(DistributionRatio memory ratios) external onlyOwner {
        require(ratios.community + ratios.poolFactory + ratios.user == 10000, "Sum of ratios should be 10000");
        distributionRatio.community = ratios.community;
        distributionRatio.poolFactory = ratios.poolFactory;
        distributionRatio.user = ratios.user;
        emit AdminSetNutDistributionRatio(ratios.community, ratios.poolFactory, ratios.user);
    }

    // only called by community contract, from some user of community call harvestReward
    function updateLedger(address community, address pool, uint256 amount) external override {
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        require(community == msg.sender, "Only called by community");
        require(ICommunity(community).poolActived(pool), "Pool is not exist or closed");
        require(toolkits[pool].hasCreated, "Toolkit has not added");

        address factory = IPool(pool).getFactory();
        
        toolkits[pool].cTokenRevenue = toolkits[pool].cTokenRevenue.add(amount);

        emit UpdateLedger(community, factory, pool, amount);
    }

    function addNewToolkit(address community, address pool) external {
        require(Ownable(community).owner() == msg.sender, "Only community owner can call");
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        require(ICommunity(community).poolActived(pool), "Pool is not exist or closed");
        require(!toolkits[pool].hasCreated, "Toolkit has added");

        address cToken = ICommunity(community).getCommunityToken();
        address factory = IPool(pool).getFactory();

        toolkits[pool].hasCreated = true;
        toolkits[pool].community = community;
        toolkits[pool].factory = factory;
        toolkits[pool].cToken = cToken;

        emit CreateNewToolkit(community, factory, pool);
    }

    function deposit(address pool, uint256 amount) external nonReentrant {
        require(toolkits[pool].hasCreated, "Toolkit not created");
        if (amount == 0) return;
        if (!toolkits[pool].users[msg.sender].hasDeposited) {
            toolkits[pool].users[msg.sender].hasDeposited = true;
        }

        _updateToolkit();

        address community = toolkits[pool].community;
        address factory = toolkits[pool].factory;

        if(toolkits[pool].users[msg.sender].amount > 0) {
            // update user's reward include nut and ctoken
            uint256 pendingNut = toolkits[pool].users[msg.sender].amount.mul(userNutAcc).div(1e12).sub(toolkits[pool].users[msg.sender].nutDebt);
            uint256 pendingCToken = toolkits[pool].users[msg.sender].amount.mul(toolkits[pool].cTokenAcc).div(1e12).sub(toolkits[pool].users[msg.sender].cTokenDebt);
            toolkits[pool].users[msg.sender].nutAvailable = toolkits[pool].users[msg.sender].nutAvailable.add(pendingNut);
            toolkits[pool].users[msg.sender].cTokenAvailable = toolkits[pool].users[msg.sender].cTokenAvailable.add(pendingCToken);
        }
        if (communityTotalStakedNut[community] > 0) {
            // update community's reward only nut
            uint256 commmunityPending = communityTotalStakedNut[community].mul(communityNutAcc).div(1e12).sub(communityDebt[community]);
            communityAvailable[community] = communityAvailable[community].add(commmunityPending);
        }
        if (poolFactoryTotalStakedNut[factory] > 0) {
            // update tool dev's reward only nut
            uint256 poolFactoryPending = poolFactoryTotalStakedNut[factory].mul(poolFactoryNutAcc).div(1e12).sub(poolFactoryDebt[factory]);
            poolFactoryAvailable[factory] = poolFactoryAvailable[factory].add(poolFactoryPending);
        }

        // discussion: using transfer or just amount record. evNUT is not transferable
        lockERC20(evNUT, msg.sender, address(this), amount);

        // update amount
        toolkits[pool].users[msg.sender].amount = toolkits[pool].users[msg.sender].amount.add(amount);
        toolkits[pool].totalStakedEvNut = toolkits[pool].totalStakedEvNut.add(amount);
        communityTotalStakedNut[community] = communityTotalStakedNut[community].add(amount);
        poolFactoryTotalStakedNut[factory] = poolFactoryTotalStakedNut[factory].add(amount);
        totalEvNUTStaked = totalEvNUTStaked.add(amount);

        // update debt
        toolkits[pool].users[msg.sender].nutDebt = toolkits[pool].users[msg.sender].amount.mul(userNutAcc).div(1e12);
        toolkits[pool].users[msg.sender].cTokenDebt = toolkits[pool].users[msg.sender].amount.mul(toolkits[pool].cTokenAcc).div(1e12);
        communityDebt[community] = communityTotalStakedNut[community].mul(communityNutAcc).div(1e12);
        poolFactoryDebt[factory] = poolFactoryTotalStakedNut[factory].mul(poolFactoryNutAcc).div(1e12);

        emit Deposited(community, factory, pool, msg.sender, amount);
    }

    function withdraw(address pool, uint256 amount) external nonReentrant {
        require(toolkits[pool].users[msg.sender].hasDeposited, "Caller not a depositor");
        if (amount == 0) return;

        _updateToolkit();

        address community = toolkits[pool].community;
        address factory = toolkits[pool].factory;

        amount = toolkits[pool].users[msg.sender].amount > amount ? amount : toolkits[pool].users[msg.sender].amount;

        if(toolkits[pool].users[msg.sender].amount > 0) {
            // update user's reward include nut and ctoken
            uint256 pendingNut = toolkits[pool].users[msg.sender].amount.mul(userNutAcc).div(1e16).sub(toolkits[pool].users[msg.sender].nutDebt);
            uint256 pendingCToken = toolkits[pool].users[msg.sender].amount.mul(toolkits[pool].cTokenAcc).div(1e12).sub(toolkits[pool].users[msg.sender].cTokenDebt);
            toolkits[pool].users[msg.sender].nutAvailable = toolkits[pool].users[msg.sender].nutAvailable.add(pendingNut);
            toolkits[pool].users[msg.sender].cTokenAvailable = toolkits[pool].users[msg.sender].cTokenAvailable.add(pendingCToken);
        }
        if (communityTotalStakedNut[community] > 0) {
            // update community's reward only nut
            uint256 commmunityPending = communityTotalStakedNut[community].mul(communityNutAcc).div(1e12).sub(communityDebt[community]);
            communityAvailable[community] = communityAvailable[community].add(commmunityPending);
        }
        if (poolFactoryTotalStakedNut[factory] > 0) {
            // update tool dev's reward only nut
            uint256 poolFactoryPending = poolFactoryTotalStakedNut[factory].mul(poolFactoryNutAcc).div(1e12).sub(poolFactoryDebt[factory]);
            poolFactoryAvailable[factory] = poolFactoryAvailable[factory].add(poolFactoryPending);
        }

        releaseERC20(evNUT, address(msg.sender), amount);

        // update amount
        toolkits[pool].users[msg.sender].amount = toolkits[pool].users[msg.sender].amount.sub(amount);
        toolkits[pool].totalStakedEvNut = toolkits[pool].totalStakedEvNut.sub(amount);
        communityTotalStakedNut[community] = communityTotalStakedNut[community].sub(amount);
        poolFactoryTotalStakedNut[factory] = poolFactoryTotalStakedNut[factory].sub(amount);
        totalEvNUTStaked = totalEvNUTStaked.sub(amount);

        // update debt
        toolkits[pool].users[msg.sender].nutDebt = toolkits[pool].users[msg.sender].amount.mul(userNutAcc).div(1e12);
        toolkits[pool].users[msg.sender].cTokenDebt = toolkits[pool].users[msg.sender].amount.mul(toolkits[pool].cTokenAcc).div(1e12);
        communityDebt[community] = communityTotalStakedNut[community].mul(communityNutAcc).div(1e12);
        poolFactoryDebt[factory] = poolFactoryTotalStakedNut[factory].mul(poolFactoryNutAcc).div(1e12);

        emit Withdrawn(community, factory, pool, msg.sender, amount);
    }

    function userWithdrawReward(address pool) external nonReentrant {
        require(toolkits[pool].users[msg.sender].hasDeposited, "Caller not a depositor");

        _updateToolkit();

        // calculate reward
        uint256 pendingNut = toolkits[pool].users[msg.sender].amount.mul(userNutAcc).div(1e12).sub(toolkits[pool].users[msg.sender].nutDebt);
        uint256 pendingCToken = toolkits[pool].users[msg.sender].amount.mul(toolkits[pool].cTokenAcc).div(1e12).sub(toolkits[pool].users[msg.sender].cTokenDebt);
        uint256 rewardNut = toolkits[pool].users[msg.sender].nutAvailable.add(pendingNut);
        uint256 rewardCToken = toolkits[pool].users[msg.sender].cTokenAvailable.add(pendingCToken);

        // transfer reward
        if (rewardNut > 0) 
            releaseERC20(NUT, msg.sender, rewardNut);
        
        if (rewardCToken > 0)
            releaseERC20(toolkits[pool].cToken, msg.sender, rewardCToken);

        // update user data
        toolkits[pool].users[msg.sender].nutAvailable = 0;
        toolkits[pool].users[msg.sender].cTokenAvailable = 0;
        toolkits[pool].users[msg.sender].nutDebt = toolkits[pool].users[msg.sender].amount.mul(userNutAcc).div(1e12);
        toolkits[pool].users[msg.sender].cTokenDebt = toolkits[pool].users[msg.sender].amount.mul(toolkits[pool].cTokenAcc).div(1e12);
        
        emit UserWithdrawnNut(pool, msg.sender, rewardNut);
        emit WithdrawnCToken(pool, msg.sender, rewardCToken);
    }

    function communityWithdrawNut(address community) external nonReentrant {
        require(Ownable(community).owner() == msg.sender, "Only community owner can withdraw");
    
        _updateToolkit();

        // calculate reward
        uint256 pendingNut = communityTotalStakedNut[community].mul(communityNutAcc).div(1e12).sub(communityDebt[community]);
        uint256 rewardNut = communityAvailable[community].add(pendingNut);

        // transfer nut
        if (rewardNut > 0) 
            releaseERC20(NUT, msg.sender, rewardNut);

        //update community data
        communityAvailable[community] = 0;
        communityDebt[community] = communityTotalStakedNut[community].mul(communityNutAcc).div(1e12);

        emit CommunityWithdrawnNut(community, msg.sender, rewardNut); 
    }

    function poolFactoryWithdrawNut(address factory) external nonReentrant {
        require(Ownable(factory).owner() == msg.sender, "Only poolFactory owner can withdraw");
    
        _updateToolkit();

        // calculate reward
        uint256 pendingNut = poolFactoryTotalStakedNut[factory].mul(poolFactoryNutAcc).div(1e12).sub(poolFactoryDebt[factory]);
        uint256 rewardNut = poolFactoryAvailable[factory].add(pendingNut);

        // transfer nut
        if (rewardNut > 0) 
            releaseERC20(NUT, msg.sender, rewardNut);

        //update poolFactory data
        poolFactoryAvailable[factory] = 0;
        poolFactoryDebt[factory] = poolFactoryTotalStakedNut[factory].mul(poolFactoryNutAcc).div(1e12);

        emit PoolFactoryWithdrawnNut(factory, msg.sender, rewardNut); 
    }

    function getUserPendingReward(address pool, address user) external view 
        returns (uint256 rewardNut, uint256  rewardCToken) 
    {
        if (!toolkits[pool].users[user].hasDeposited) {
            rewardNut = 0;
            rewardCToken = 0;
        }else {
            uint256 userReward;
            (,,userReward) = _cuclateNutReward();

            if (totalEvNUTStaked == 0)
                rewardNut = toolkits[pool].users[user].nutAvailable;
            else
                rewardNut = userReward.mul(toolkits[pool].users[user].amount).div(totalEvNUTStaked).add(toolkits[pool].users[user].nutAvailable);
            
            if (toolkits[pool].totalStakedEvNut == 0) 
                rewardCToken = toolkits[pool].users[user].cTokenAvailable;
            else {
                uint256 _cTokenAcc = toolkits[pool].cTokenAcc.add(toolkits[pool].cTokenRevenue.sub(toolkits[pool].lastCTokenRevenue).mul(1e12).div(toolkits[pool].totalStakedEvNut));
                rewardCToken = toolkits[pool].users[user].amount.mul(_cTokenAcc).div(1e12).add(toolkits[pool].users[user].cTokenAvailable);
            }
        }
    }

    function getCommunityPendingRewardNut(address community) external view
        returns (uint256 rewardNut) 
    {
        rewardNut = 0;
    }

    function getPoolFactoryPendingRewardNut(address factory) external view
        returns (uint256 rewardNut) 
    {
        rewardNut = 0;
    }

    function _updateToolkit() private {
        // start game when the first operation
        if (0 == lastRewardBlock) {
            lastRewardBlock = block.number;
        }
    }

    function _cuclateNutReward() private view returns (uint256 communityReward, uint256 poolFactoryReward, uint256 userReward) {
        uint256 readyToMint = (block.number - lastRewardBlock + 1).mul(rewardNUTPerBlock);
        communityReward = readyToMint.mul(distributionRatio.community).div(10000);
        poolFactoryReward = readyToMint.mul(distributionRatio.poolFactory).div(10000);
        userReward = readyToMint.mul(distributionRatio.user).div(10000);
    }
}


