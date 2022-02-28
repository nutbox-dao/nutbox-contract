// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IGauge.sol";
import "./CommunityFactory.sol";
import "./interfaces/ICommunity.sol";
import "./ERC20Helper.sol";
import "./NUTToken.sol";
import "./NutPower.sol";

contract Gauge is IGauge, Ownable, ERC20Helper, ReentrancyGuard {

    using SafeMath for uint256;
    using SafeMath for uint16;

    uint16 constant CONSTANT_10000 = 10000;

    struct User {
        bool hasDeposited;
        uint256 amount;
        uint256 nutAvailable;
        uint256 nutDebt;
        uint256 cTokenAvailable;
        uint256 cTokenDebt;
    }

    struct GaugeMeta {
        bool hasCreated;
        address community;
        address factory;
        address cToken;
        uint256 cTokenAcc;
        uint256 cTokenRevenue;
        uint256 lastCTokenRevenue;
        uint256 totalStakedNP;
        mapping (address => User) users;
    }

    // define the NUT distribution to 3 parts
    struct DistributionRatio {
        uint16 community;
        uint16 poolFactory;
        uint16 user;
    }
    
    // Nutbox Power addresss
    address immutable NP;
    // NUT address
    address immutable NUT;
    // Only Nutbox committee can set this. Communities which enabled this function in their pools,
    // part of the cToken rewards(dappToolsRatio / 10000 of total rewards) will be transfered
    // to gauge contract when user harvest their rewards, those rewards and NUTs would be
    // distributed based on the NP staked by user.
    uint16 public gaugeRatio;
    // total reward nut per block, can be reset by Nutbox DAO
    uint256 public rewardNUTPerBlock;
    // last nut reward block
    uint256 private lastRewardBlock;

    // nutAcc means how many nut will 1 NP staked earn, it departed by community/poolFactory/user
    uint256 private userNutAcc;
    uint256 private poolFactoryNutAcc;
    uint256 private communityNutAcc;

    uint256 public totalNPStaked;

    // can be rest by Nutbox DAO, total of the ratios should be 10000
    DistributionRatio public distributionRatio;

    // communityFactory
    address immutable communityFactory;
    // all created gauges by community owner
    // pool address => gauge
    mapping (address => GaugeMeta) private gauges;

    // reward nut distribute to community and tool dev
    mapping (address => uint256) public communityTotalStakedNP;
    mapping (address => uint256) public poolFactoryTotalStakedNP;
    mapping (address => uint256) private communityAvailable;
    mapping (address => uint256) private poolFactoryAvailable;
    mapping (address => uint256) private communityDebt;
    mapping (address => uint256) private poolFactoryDebt;

    event AdminSetDappGaugeRatio(uint16 indexed gaugeRatio);
    event AdminSetNutRewardPerBlock(uint256 indexed nutRewardPerBlock);
    event AdminSetNutDistributionRatio(uint16 community, uint16 poolFactory, uint16 user);
    event CreateNewGauge(address indexed community, address indexed factory, address indexed pool);
    event UpdateLedger(address indexed community, address indexed factory, address indexed pool, uint256 amount);

    event Deposited(address indexed community, address indexed factory, address indexed pool, address user, uint256 amount);
    event Withdrawn(address indexed community, address indexed factory, address indexed pool, address user, uint256 amount);

    event CTokenWithdrawn(address indexed pool, address indexed recipient, uint256 amount);
    event UserWithdrewNut(address indexed pool, address indexed recipient, uint256 amount);
    event CommunityWithdrewNut(address indexed community, address indexed recipient, uint256 amount);
    event PoolFactoryWithdrewNut(address indexed poolFactory, address indexed recipient, uint256 amount);

    constructor(address _communityFactory, uint16 _gaugeRatio, DistributionRatio memory ratios, address _NP, address _nut) {
        require(ratios.community + ratios.poolFactory + ratios.user == CONSTANT_10000, "Sum of ratios should be 10000");
        distributionRatio.community = ratios.community;
        distributionRatio.poolFactory = ratios.poolFactory;
        distributionRatio.user = ratios.user;
        communityFactory = _communityFactory;
        gaugeRatio = _gaugeRatio;
        NP = _NP;
        NUT = _nut;
        emit AdminSetDappGaugeRatio(_gaugeRatio);
        emit AdminSetNutDistributionRatio(ratios.community, ratios.poolFactory, ratios.user);
    }

    function hasGaugeEnabled(address pool) external override returns (bool) {
        return gauges[pool].hasCreated;
    }

    // set the ratio of user harvest cToken
    function adminSetGaugeRatio(uint16 _gaugeRatio) external onlyOwner {
        require(_gaugeRatio <= CONSTANT_10000, "Ratio must less or equal than 10000");
        gaugeRatio = _gaugeRatio;
        emit AdminSetDappGaugeRatio(_gaugeRatio);
    }

    function getGaugeRatio() external view override returns (uint16) {
        return gaugeRatio;
    }

    function adminSetNutDistributionRatio(DistributionRatio memory ratios) external onlyOwner {
        require(ratios.community + ratios.poolFactory + ratios.user == CONSTANT_10000, "Sum of ratios should be 10000");
        // update accs before reset the ratios
        _updateNutAcc();
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
        require(gauges[pool].hasCreated, "Gauge has not added");

        address factory = IPool(pool).getFactory();
        
        gauges[pool].cTokenRevenue = gauges[pool].cTokenRevenue.add(amount);

        emit UpdateLedger(community, factory, pool, amount);
    }

    function addNewGauge(address community, address pool) external {
        require(Ownable(community).owner() == msg.sender, "Only community owner can call");
        require(CommunityFactory(communityFactory).createdCommunity(community), "Invalid community");
        require(ICommunity(community).poolActived(pool), "Pool is not exist or closed");
        require(!gauges[pool].hasCreated, "Gauge has added");

        address cToken = ICommunity(community).getCommunityToken();
        address factory = IPool(pool).getFactory();

        gauges[pool].hasCreated = true;
        gauges[pool].community = community;
        gauges[pool].factory = factory;
        gauges[pool].cToken = cToken;

        emit CreateNewGauge(community, factory, pool);
    }

    function deposit(address pool, uint256 amount) external nonReentrant {
        require(gauges[pool].hasCreated, "Gauge not created");
        if (amount == 0) return;
        if (!gauges[pool].users[msg.sender].hasDeposited) {
            gauges[pool].users[msg.sender].hasDeposited = true;
        }

        _updateNutAcc();
        _updatePoolAcc(pool);

        address community = gauges[pool].community;
        address factory = gauges[pool].factory;

        if(gauges[pool].users[msg.sender].amount > 0) {
            // update user's reward include nut and ctoken
            uint256 pendingNut = gauges[pool].users[msg.sender].amount.mul(userNutAcc).div(1e12).sub(gauges[pool].users[msg.sender].nutDebt);
            uint256 pendingCToken = gauges[pool].users[msg.sender].amount.mul(gauges[pool].cTokenAcc).div(1e12).sub(gauges[pool].users[msg.sender].cTokenDebt);
            gauges[pool].users[msg.sender].nutAvailable = gauges[pool].users[msg.sender].nutAvailable.add(pendingNut);
            gauges[pool].users[msg.sender].cTokenAvailable = gauges[pool].users[msg.sender].cTokenAvailable.add(pendingCToken);
        }
        if (communityTotalStakedNP[community] > 0) {
            // update community's reward only nut
            uint256 commmunityPending = communityTotalStakedNP[community].mul(communityNutAcc).div(1e12).sub(communityDebt[community]);
            communityAvailable[community] = communityAvailable[community].add(commmunityPending);
        }
        if (poolFactoryTotalStakedNP[factory] > 0) {
            // update tool dev's reward only nut
            uint256 poolFactoryPending = poolFactoryTotalStakedNP[factory].mul(poolFactoryNutAcc).div(1e12).sub(poolFactoryDebt[factory]);
            poolFactoryAvailable[factory] = poolFactoryAvailable[factory].add(poolFactoryPending);
        }

        // using lock method, NP is not transferable
        NutPower(NP).lock(msg.sender, amount);

        // update amount
        gauges[pool].users[msg.sender].amount = gauges[pool].users[msg.sender].amount.add(amount);
        gauges[pool].totalStakedNP = gauges[pool].totalStakedNP.add(amount);
        communityTotalStakedNP[community] = communityTotalStakedNP[community].add(amount);
        poolFactoryTotalStakedNP[factory] = poolFactoryTotalStakedNP[factory].add(amount);
        totalNPStaked = totalNPStaked.add(amount);

        // update debt
        gauges[pool].users[msg.sender].nutDebt = gauges[pool].users[msg.sender].amount.mul(userNutAcc).div(1e12);
        gauges[pool].users[msg.sender].cTokenDebt = gauges[pool].users[msg.sender].amount.mul(gauges[pool].cTokenAcc).div(1e12);
        communityDebt[community] = communityTotalStakedNP[community].mul(communityNutAcc).div(1e12);
        poolFactoryDebt[factory] = poolFactoryTotalStakedNP[factory].mul(poolFactoryNutAcc).div(1e12);

        emit Deposited(community, factory, pool, msg.sender, amount);
    }

    function withdraw(address pool, uint256 amount) external nonReentrant {
        require(gauges[pool].users[msg.sender].hasDeposited, "Caller not a depositor");
        if (amount == 0) return;

        _updateNutAcc();
        _updatePoolAcc(pool);

        address community = gauges[pool].community;
        address factory = gauges[pool].factory;

        amount = gauges[pool].users[msg.sender].amount > amount ? amount : gauges[pool].users[msg.sender].amount;

        if(gauges[pool].users[msg.sender].amount > 0) {
            // update user's reward include nut and ctoken
            uint256 pendingNut = gauges[pool].users[msg.sender].amount.mul(userNutAcc).div(1e16).sub(gauges[pool].users[msg.sender].nutDebt);
            uint256 pendingCToken = gauges[pool].users[msg.sender].amount.mul(gauges[pool].cTokenAcc).div(1e12).sub(gauges[pool].users[msg.sender].cTokenDebt);
            gauges[pool].users[msg.sender].nutAvailable = gauges[pool].users[msg.sender].nutAvailable.add(pendingNut);
            gauges[pool].users[msg.sender].cTokenAvailable = gauges[pool].users[msg.sender].cTokenAvailable.add(pendingCToken);
        }
        if (communityTotalStakedNP[community] > 0) {
            // update community's reward only nut
            uint256 commmunityPending = communityTotalStakedNP[community].mul(communityNutAcc).div(1e12).sub(communityDebt[community]);
            communityAvailable[community] = communityAvailable[community].add(commmunityPending);
        }
        if (poolFactoryTotalStakedNP[factory] > 0) {
            // update tool dev's reward only nut
            uint256 poolFactoryPending = poolFactoryTotalStakedNP[factory].mul(poolFactoryNutAcc).div(1e12).sub(poolFactoryDebt[factory]);
            poolFactoryAvailable[factory] = poolFactoryAvailable[factory].add(poolFactoryPending);
        }

        NutPower(NP).unlock(msg.sender, amount);

        // update amount
        gauges[pool].users[msg.sender].amount = gauges[pool].users[msg.sender].amount.sub(amount);
        gauges[pool].totalStakedNP = gauges[pool].totalStakedNP.sub(amount);
        communityTotalStakedNP[community] = communityTotalStakedNP[community].sub(amount);
        poolFactoryTotalStakedNP[factory] = poolFactoryTotalStakedNP[factory].sub(amount);
        totalNPStaked = totalNPStaked.sub(amount);

        // update debt
        gauges[pool].users[msg.sender].nutDebt = gauges[pool].users[msg.sender].amount.mul(userNutAcc).div(1e12);
        gauges[pool].users[msg.sender].cTokenDebt = gauges[pool].users[msg.sender].amount.mul(gauges[pool].cTokenAcc).div(1e12);
        communityDebt[community] = communityTotalStakedNP[community].mul(communityNutAcc).div(1e12);
        poolFactoryDebt[factory] = poolFactoryTotalStakedNP[factory].mul(poolFactoryNutAcc).div(1e12);

        emit Withdrawn(community, factory, pool, msg.sender, amount);
    }

    function userWithdrawReward(address pool) external nonReentrant {
        require(gauges[pool].users[msg.sender].hasDeposited, "Caller not a depositor");

        _updateNutAcc();
        _updatePoolAcc(pool);

        // calculate reward
        uint256 pendingNut = gauges[pool].users[msg.sender].amount.mul(userNutAcc).div(1e12).sub(gauges[pool].users[msg.sender].nutDebt);
        uint256 pendingCToken = gauges[pool].users[msg.sender].amount.mul(gauges[pool].cTokenAcc).div(1e12).sub(gauges[pool].users[msg.sender].cTokenDebt);
        uint256 rewardNut = gauges[pool].users[msg.sender].nutAvailable.add(pendingNut);
        uint256 rewardCToken = gauges[pool].users[msg.sender].cTokenAvailable.add(pendingCToken);

        // transfer reward
        if (rewardNut > 0) 
            releaseERC20(NUT, msg.sender, rewardNut);
        
        if (rewardCToken > 0)
            releaseERC20(gauges[pool].cToken, msg.sender, rewardCToken);

        // update user data
        gauges[pool].users[msg.sender].nutAvailable = 0;
        gauges[pool].users[msg.sender].cTokenAvailable = 0;
        gauges[pool].users[msg.sender].nutDebt = gauges[pool].users[msg.sender].amount.mul(userNutAcc).div(1e12);
        gauges[pool].users[msg.sender].cTokenDebt = gauges[pool].users[msg.sender].amount.mul(gauges[pool].cTokenAcc).div(1e12);
        
        emit UserWithdrewNut(pool, msg.sender, rewardNut);
        emit CTokenWithdrawn(pool, msg.sender, rewardCToken);
    }

    function communityWithdrawNut(address community) external nonReentrant {
        require(Ownable(community).owner() == msg.sender, "Only community owner can withdraw");
    
        _updateNutAcc();

        // calculate reward
        uint256 pendingNut = communityTotalStakedNP[community].mul(communityNutAcc).div(1e12).sub(communityDebt[community]);
        uint256 rewardNut = communityAvailable[community].add(pendingNut);

        // transfer nut
        if (rewardNut > 0) 
            releaseERC20(NUT, msg.sender, rewardNut);

        //update community data
        communityAvailable[community] = 0;
        communityDebt[community] = communityTotalStakedNP[community].mul(communityNutAcc).div(1e12);

        emit CommunityWithdrewNut(community, msg.sender, rewardNut); 
    }

    function poolFactoryWithdrawNut(address factory) external nonReentrant {
        require(Ownable(factory).owner() == msg.sender, "Only poolFactory owner can withdraw");
    
        _updateNutAcc();

        // calculate reward
        uint256 pendingNut = poolFactoryTotalStakedNP[factory].mul(poolFactoryNutAcc).div(1e12).sub(poolFactoryDebt[factory]);
        uint256 rewardNut = poolFactoryAvailable[factory].add(pendingNut);

        // transfer nut
        if (rewardNut > 0) 
            releaseERC20(NUT, msg.sender, rewardNut);

        //update poolFactory data
        poolFactoryAvailable[factory] = 0;
        poolFactoryDebt[factory] = poolFactoryTotalStakedNP[factory].mul(poolFactoryNutAcc).div(1e12);

        emit PoolFactoryWithdrewNut(factory, msg.sender, rewardNut); 
    }

    function getUserPendingReward(address pool, address user) external view 
        returns (uint256 rewardNut, uint256  rewardCToken) 
    {
        if (!gauges[pool].users[user].hasDeposited) {
            rewardNut = 0;
            rewardCToken = 0;
        }else {
            if (totalNPStaked == 0)
                rewardNut = gauges[pool].users[user].nutAvailable;
            else {
                (,,uint256 _userNutAcc) = _cuclateNutAcc();
                rewardNut = gauges[pool].users[user].amount.mul(_userNutAcc).div(1e12).sub(gauges[pool].users[user].nutDebt).add(gauges[pool].users[user].nutAvailable);
            }

            if (gauges[pool].totalStakedNP == 0) 
                rewardCToken = gauges[pool].users[user].cTokenAvailable;
            else {
                uint256 _cTokenAcc = gauges[pool].cTokenAcc.add(gauges[pool].cTokenRevenue.sub(gauges[pool].lastCTokenRevenue).mul(1e12).div(gauges[pool].totalStakedNP));
                rewardCToken = gauges[pool].users[user].amount.mul(_cTokenAcc).div(1e12).sub(gauges[pool].users[user].cTokenDebt).add(gauges[pool].users[user].cTokenAvailable);
            }
        }
    }

    function getCommunityPendingRewardNut(address community) external view
        returns (uint256 rewardNut)
    {
        uint256 communityStakedNP = communityTotalStakedNP[community];
        if (communityStakedNP == 0)
            rewardNut = communityAvailable[community];
        else {
            (uint256 _communityNutAcc,,) = _cuclateNutAcc();
            rewardNut = communityStakedNP.mul(_communityNutAcc).div(1e12).sub(communityDebt[community]).add(communityAvailable[community]);
        }
    }

    function getPoolFactoryPendingRewardNut(address factory) external view
        returns (uint256 rewardNut) 
    {
        uint256 poolFactoryStakedNP = poolFactoryTotalStakedNP[factory];
        if (poolFactoryStakedNP == 0)
            rewardNut = poolFactoryAvailable[factory];
        else {
            (,uint256 _poolFactoryAcc,) = _cuclateNutAcc();
            rewardNut = poolFactoryStakedNP.mul(_poolFactoryAcc).div(1e12).sub(poolFactoryDebt[factory]).add(poolFactoryAvailable[factory]);
        }
    }

    function _updateNutAcc() private {
        // start game when the first operation
        if (0 == lastRewardBlock) {
            lastRewardBlock = block.number;
        }

        if (block.number <= lastRewardBlock) return;

        (communityNutAcc, poolFactoryNutAcc, userNutAcc) = _cuclateNutAcc();

        lastRewardBlock = block.number;
    }

    function _updatePoolAcc(address pool) private {
        if (!gauges[pool].hasCreated) return;
        if (gauges[pool].lastCTokenRevenue == 0) 
            gauges[pool].lastCTokenRevenue = gauges[pool].cTokenRevenue;
        
        if (gauges[pool].lastCTokenRevenue == gauges[pool].cTokenRevenue) return;

        gauges[pool].cTokenAcc = gauges[pool].cTokenAcc.add(gauges[pool].cTokenRevenue.sub(gauges[pool].lastCTokenRevenue).mul(1e12).div(gauges[pool].totalStakedNP));

        gauges[pool].lastCTokenRevenue = gauges[pool].cTokenRevenue;
    }

    function _cuclateNutAcc() private view returns (uint256 _communityNutAcc, uint256 _poolFactoryNutAcc, uint256 _userNutAcc) {
        if (totalNPStaked == 0) {
            _communityNutAcc = communityNutAcc;
            _poolFactoryNutAcc = poolFactoryNutAcc;
            _userNutAcc = userNutAcc;
        }else {
            (uint256 communityReadyToMint, uint256 poolFactoryReadyToMint, uint256 userReadyToMint) = _cuclateNutReadyToMint();
            _communityNutAcc = communityNutAcc.add(communityReadyToMint.mul(1e12).div(totalNPStaked));
            _poolFactoryNutAcc = poolFactoryNutAcc.add(poolFactoryReadyToMint.mul(1e12).div(totalNPStaked));
            _userNutAcc = userNutAcc.add(userReadyToMint.mul(1e12).div(totalNPStaked));
        }
    }

    function _cuclateNutReadyToMint() private view returns (uint256 communityReadyToMint, uint256 poolFactoryReadyToMint, uint256 userReadyToMint) {
        uint256 readyToMint = (block.number - lastRewardBlock).mul(rewardNUTPerBlock);
        communityReadyToMint = readyToMint.mul(distributionRatio.community).div(CONSTANT_10000);
        poolFactoryReadyToMint = readyToMint.mul(distributionRatio.poolFactory).div(CONSTANT_10000);
        userReadyToMint = readyToMint.mul(distributionRatio.user).div(CONSTANT_10000);
    }
}


