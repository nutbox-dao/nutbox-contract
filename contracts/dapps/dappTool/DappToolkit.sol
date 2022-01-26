// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../../interfaces/IPool.sol";
import "./DappToolkit.sol";
import "../../CommunityFactory.sol";
import "../../interfaces/ICommunity.sol";
import "../../ERC20Helper.sol";

contract DappToolkit is Ownable, ERC20Helper{

    using SafeMath for uint256;

    struct User{
        bool hasDeposited;
        uint256 stakedEvNUT;
        uint256 availabeReward;
        uint256 debt;
    }
    struct Toolkit {
        bool hasCreated;
        address community;
        address factory;
        address ctoken;
        uint256 shareAcc;
        uint256 lastRewardRecord;
        mapping (address => User) users;
    }
    // define the NUT distribution to 3 part
    struct DistributionRatio {
        uint16 community;
        uint16 toolDev;
        uint16 user;
    }
    // We set this parameter by committ
    // this is used by any community
    // when user harvest c-tokens dappToolsRatio / 10000 ctoken will transfer to dapp tools contract
    // These ctoken will be mined by user who vote with vNUT
    uint256 public revenueRatio;
    // total reward nut per block, can be reset by Nutbox DAO
    uint256 public rewardNUTPerBlock;
    // nutAcc means how many nut will 1 evNUT staked earn
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

    // pool factory address => total revenue of ctoken from pool factory
    mapping (address => uint256) public poolFacotryRevenue;
    // community address => total revenue of ctoken from community
    mapping (address => uint256) public communityRevenue;

    // pool factory address => last revenue of ctoken from pool factory
    mapping (address => uint256) private lastPoolFacotryRevenue;
    // community address => last revenue of ctoken from community
    mapping (address => uint256) private lastCommunityRevenue;

    // retained nut reward, need specify owner to harvest
    mapping (address => uint256) public communityRetainedReward;
    mapping (address => uint256) public factoryRetainedReward;

    event AdminSetDappToolkitRatio(uint256 indexed revenueRatio);
    event AdminSetNutRewardPerBlock(uint256 indexed nutRewardPerBlock);
    event AdminSetNutDistributionRatio(uint16 communit, uint16 toolDev, uint16 user);
    event CreateNewToolkit(address indexed community, address indexed factory, address indexed pool);
    event UpdateLedger(address indexed community, address indexed factory, address indexed pool, uint256 amount);

    constructor(address _communityFactory, uint256 _revenueRatio, DistributionRatio memory ratios) {require(ratios.community + ratios.toolDev + ratios.user == 10000, "Sum of ratios should be 10000");
        distributionRatio.community = ratios.community;
        distributionRatio.toolDev = ratios.toolDev;
        distributionRatio.user = ratios.user;
        communityFactory = _communityFactory;
        revenueRatio = _revenueRatio;
        emit AdminSetDappToolkitRatio(_revenueRatio);
        emit AdminSetNutDistributionRatio(ratios.community, ratios.toolDev, ratios.user);
    }

    // set the ratio of user harvest ctoken
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
        poolFacotryRevenue[factory] = poolFacotryRevenue[factory].add(amount);
        communityRevenue[community] = communityRevenue[community].add(amount);

        emit UpdateLedger(community, factory, pool, amount);
    }

    function addNewToolkit(address community, address pool) external {
        require(Ownable(community).owner() == msg.sender, "Only community owner can call");
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        require(ICommunity(community).poolActived(pool), "Pool is not exist or closed");
        require(!toolkits[pool].hasCreated, "Toolkit has added");

        address ctoken = ICommunity(community).getCommunityToken();
        address factory = IPool(pool).getFactory();

        toolkits[pool].hasCreated = true;
        toolkits[pool].community = community;
        toolkits[pool].shareAcc = 0;
        toolkits[pool].lastRewardRecord = 0;
        toolkits[pool].factory = factory;
        toolkits[pool].ctoken = ctoken;

        emit CreateNewToolkit(community, factory, pool);
    }

    function deposit(address pool, uint256 amount) external {
        require(toolkits[pool].hasCreated, "Toolkit not created");
        if (!toolkits[pool].users[msg.sender].hasDeposited) {

        }
    }

    function withdraw(address pool, uint256 amount) external {

    }

    function withdrawReward(address pool) external {

    }
}


