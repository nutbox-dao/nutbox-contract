// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/IPool.sol";
import "./DappToolkit.sol";
import "../../CommunityFactory.sol";
import "../../interfaces/ICommunity.sol";
import "../../ERC20Helper.sol";
import "../../NUTToken.sol";

contract DappToolkit is Ownable, ERC20Helper, ReentrancyGuard {

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
        uint256 lastRewardRecord;
        mapping (address => User) users;
    }

    // define the NUT distribution to 3 part
    struct DistributionRatio {
        uint16 community;
        uint16 toolDev;
        uint16 user;
    }

    enum WithdrawnType{
        Community,
        ToolDev,
        User
    }
    // evNUT addresss
    address immutable evNUT;
    // We set this parameter by committ
    // this is used by any community
    // when user harvest c-tokens dappToolsRatio / 10000 cToken will transfer to dapp tools contract
    // These cToken will be mined by user who vote with vNUT
    uint256 public revenueRatio;
    // total reward nut per block, can be reset by Nutbox DAO
    uint256 public rewardNUTPerBlock;
    // nutAcc means how many nut will 1 evNUT staked earn, it contains all nut that mined by rewardNUTPerBlock
    uint256 private nutAcc;

    uint256 public totalEvNUTStaked;

    // can be rest by Nutbox DAO, total of the ratios should be 10000
    DistributionRatio public distributionRatio;

    // communityFactory
    address immutable communityFactory;
    // all created toolkits by community owner
    // pool address => toolkit
    mapping (address => Toolkit) private toolkits;

    // pool address => total revenue of ctokn from user
    mapping (address => uint256) public poolRevenue;
    mapping (address => uint256) public lastPoolRevenue;

    // reward nut distribute to community and tool dev
    mapping (address => uint256) public communityTotalStakedNut;
    mapping (address => uint256) public poolFactoryTotalStakedNut;
    mapping (address => uint256) private communityAvailable;
    mapping (address => uint256) private poolFactoryAvailable;
    mapping (address => uint256) private communityDebt;
    mapping (address => uint256) private poolFactoryDebt;
    

    event AdminSetDappToolkitRatio(uint256 indexed revenueRatio);
    event AdminSetNutRewardPerBlock(uint256 indexed nutRewardPerBlock);
    event AdminSetNutDistributionRatio(uint16 communit, uint16 toolDev, uint16 user);
    event CreateNewToolkit(address indexed community, address indexed factory, address indexed pool);
    event UpdateLedger(address indexed community, address indexed factory, address indexed pool, uint256 amount);

    event Deposited(address indexed community, address indexed factory, address indexed pool, address user, uint256 amount);
    event Withdrawn(address indexed community, address indexed factory, address indexed pool, address user, uint256 amount);
    event WithdrawnCToken(address indexed community, address indexed factory, address indexed pool, address user, uint256 amount);
    event WithdrawnNut(WithdrawnType from, address indexed community, address indexed factory, address indexed pool, address user, uint256 amount);

    constructor(address _communityFactory, uint256 _revenueRatio, DistributionRatio memory ratios, address _evNut) {require(ratios.community + ratios.toolDev + ratios.user == 10000, "Sum of ratios should be 10000");
        distributionRatio.community = ratios.community;
        distributionRatio.toolDev = ratios.toolDev;
        distributionRatio.user = ratios.user;
        communityFactory = _communityFactory;
        revenueRatio = _revenueRatio;
        evNUT = _evNut;
        emit AdminSetDappToolkitRatio(_revenueRatio);
        emit AdminSetNutDistributionRatio(ratios.community, ratios.toolDev, ratios.user);
    }

    // set the ratio of user harvest cToken
    function adminSetDappToolsRatio(uint256 _revenueRatio) external onlyOwner {
        revenueRatio = _revenueRatio;
        emit AdminSetDappToolkitRatio(_revenueRatio);
    }

    function adminSetNutDistributionRatio(DistributionRatio memory ratios) external onlyOwner {
        require(ratios.community + ratios.toolDev + ratios.user == 10000, "Sum of ratios should be 10000");
        distributionRatio.community = ratios.community;
        distributionRatio.toolDev = ratios.toolDev;
        distributionRatio.user = ratios.user;
        emit AdminSetNutDistributionRatio(ratios.community, ratios.toolDev, ratios.user);
    }

    // only called by community contract, from some user of community call harvestReward
    function updateLedger(address community, address pool, uint256 amount) external {
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        require(community == msg.sender, "Only called by community");
        require(ICommunity(community).poolActived(pool), "Pool is not exist or closed");
        require(toolkits[pool].hasCreated, "Toolkit has not added");

        address factory = IPool(pool).getFactory();
        
        poolRevenue[pool] = poolRevenue[pool].add(amount);

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
        toolkits[pool].cTokenAcc = 0;
        toolkits[pool].lastRewardRecord = 0;
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
            uint256 nutPending = toolkits[pool].users[msg.sender].amount.mul(nutAcc).mul(distributionRatio.user).div(1e16).sub(toolkits[pool].users[msg.sender].nutDebt);
            uint256 cTokenPending = toolkits[pool].users[msg.sender].amount.mul(toolkits[pool].cTokenAcc).div(1e12).sub(toolkits[pool].users[msg.sender].cTokenDebt);
            toolkits[pool].users[msg.sender].nutAvailable = toolkits[pool].users[msg.sender].nutAvailable.add(nutPending);
            toolkits[pool].users[msg.sender].cTokenAvailable = toolkits[pool].users[msg.sender].cTokenAvailable.add(cTokenPending);
        }
        if (communityTotalStakedNut[community] > 0) {
            // update community's reward only nut
            uint256 commmunityPending = communityTotalStakedNut[community].mul(nutAcc).mul(distributionRatio.community).div(1e16).sub(communityDebt[community]);
            communityAvailable[community] = communityAvailable[community].add(commmunityPending);
        }
        if (poolFactoryTotalStakedNut[factory] > 0) {
            // update tool dev's reward only nut
            uint256 poolFactoryPending = poolFactoryTotalStakedNut[factory].mul(nutAcc).mul(distributionRatio.toolDev).div(1e16).sub(poolFactoryDebt[factory]);
            poolFactoryAvailable[factory] = poolFactoryAvailable[factory].add(poolFactoryPending);
        }

        // discussion: using transfer or just amount record. evNUT is not transferable
        lockERC20(evNUT, msg.sender, address(this), amount);

        // update amount
        toolkits[pool].users[msg.sender].amount = toolkits[pool].users[msg.sender].amount.add(amount);
        communityTotalStakedNut[community] = communityTotalStakedNut[community].add(amount);
        poolFactoryTotalStakedNut[factory] = poolFactoryTotalStakedNut[factory].add(amount);
        totalEvNUTStaked = totalEvNUTStaked.add(amount);

        // update debt
        toolkits[pool].users[msg.sender].nutDebt = toolkits[pool].users[msg.sender].amount.mul(nutAcc).mul(distributionRatio.user).div(1e16);
        toolkits[pool].users[msg.sender].cTokenDebt = toolkits[pool].users[msg.sender].amount.mul(toolkits[pool].cTokenAcc).div(1e12);
        communityDebt[community] = communityTotalStakedNut[community].mul(nutAcc).mul(distributionRatio.community).div(1e16);
        poolFactoryDebt[factory] = poolFactoryTotalStakedNut[factory].mul(nutAcc).mul(distributionRatio.toolDev).div(1e16);

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
            uint256 nutPending = toolkits[pool].users[msg.sender].amount.mul(nutAcc).mul(distributionRatio.user).div(1e16).sub(toolkits[pool].users[msg.sender].nutDebt);
            uint256 cTokenPending = toolkits[pool].users[msg.sender].amount.mul(toolkits[pool].cTokenAcc).div(1e12).sub(toolkits[pool].users[msg.sender].cTokenDebt);
            toolkits[pool].users[msg.sender].nutAvailable = toolkits[pool].users[msg.sender].nutAvailable.add(nutPending);
            toolkits[pool].users[msg.sender].cTokenAvailable = toolkits[pool].users[msg.sender].cTokenAvailable.add(cTokenPending);
        }
        if (communityTotalStakedNut[community] > 0) {
            // update community's reward only nut
            uint256 commmunityPending = communityTotalStakedNut[community].mul(nutAcc).mul(distributionRatio.community).div(1e16).sub(communityDebt[community]);
            communityAvailable[community] = communityAvailable[community].add(commmunityPending);
        }
        if (poolFactoryTotalStakedNut[factory] > 0) {
            // update tool dev's reward only nut
            uint256 poolFactoryPending = poolFactoryTotalStakedNut[factory].mul(nutAcc).mul(distributionRatio.toolDev).div(1e16).sub(poolFactoryDebt[factory]);
            poolFactoryAvailable[factory] = poolFactoryAvailable[factory].add(poolFactoryPending);
        }

        releaseERC20(evNUT, address(msg.sender), amount);

        // update amount
        toolkits[pool].users[msg.sender].amount = toolkits[pool].users[msg.sender].amount.sub(amount);
        communityTotalStakedNut[community] = communityTotalStakedNut[community].sub(amount);
        poolFactoryTotalStakedNut[factory] = poolFactoryTotalStakedNut[factory].sub(amount);
        totalEvNUTStaked = totalEvNUTStaked.sub(amount);

        // update debt
        toolkits[pool].users[msg.sender].nutDebt = toolkits[pool].users[msg.sender].amount.mul(nutAcc).mul(distributionRatio.user).div(1e16);
        toolkits[pool].users[msg.sender].cTokenDebt = toolkits[pool].users[msg.sender].amount.mul(toolkits[pool].cTokenAcc).div(1e12);
        communityDebt[community] = communityTotalStakedNut[community].mul(nutAcc).mul(distributionRatio.community).div(1e16);
        poolFactoryDebt[factory] = poolFactoryTotalStakedNut[factory].mul(nutAcc).mul(distributionRatio.toolDev).div(1e16);

        emit Withdrawn(community, factory, pool, msg.sender, amount);
    }

    function withdrawReward(address pool) external nonReentrant {

    }

    function _updateToolkit() private {

    }
}


