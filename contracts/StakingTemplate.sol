// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import './access/Ownable.sol';
import './libraries/SafeMath.sol';
import './interfaces/IERC20.sol';
import './NutboxERC20.sol';

/**
 * @dev Template contract of Nutbox staking module.
 *
 * StakingFactory Contract always returns an entity of this contract.
 * Support add serial StakingPair into it.
 */
contract StakingTemplate is Ownable {

    using SafeMath for uint256;

    struct UserStakingInfo {
        // External accountId, e.g. a Polkadot acccount or a Steem account
        string externalAccountId;
        // User staked amount
        uint256 amount;
        // Rewards that can be withdraw
        uint256 availableRewards;
        // User's debt that should be removed when calculating their final rewards.
        uint256 userDebt;
    }

    struct Pool {
        // Pool id
        uint8 pid;

        // stakingInfo used to save every user's staking information, 
        // including how many they deposited and its external chain account 
        // ( we support crosschain asset staking). With every staking event 
        // happened including deposit and withdraw asset this field should be updated. 
        // It also be used to calculate the reward user can get.
        mapping (address => UserStakingInfo) stakingInfo;

        // When pool was added, we treat it actived.
        bool hasActived;

        // poolRatio is a configuration argument that the staking pool deployer give.
        // Case NutboxStakingTemplate contract support mult-pool staking, every pool's
        // reward of current block are distributed by this options.
        uint8 poolRatio;

        // stakingPair actually is a NutboxERC20Token entity (e.g. a contract address),
        // it represents the asset user stake of this pool. Bascially, it should be a 
        // normal ERC20 token and a lptoken of a specific token exchange pair.
        NutboxERC20 stakingPair;

        // Pool accumulation factor, updated when user deposit and withdraw staking asset.
        // Used to calculate rewards of every user rewards with a giving formula.
        uint256 shareAcc;

        // Total staked amount
        uint256 totalStakedAmount;
    }

    struct Distribution {
        // if current block height > stopHeight, this distribution passed.
        bool hasPassed;
        // rewards per block of this distribution.
        uint256 amount;
        // when current block height > startHeight, distribution was enabled.
        uint256 startHeight;
        // when curent block height > stopHeight, distribution was disabled
        uint256 stopHeight;
    }

    uint8 constant MAX_POOLS = 10;
    uint8 constant MAX_DISTRIBUTIONS = 6;

    address admin;
    uint8 numberOfPools;
    uint8 numberOfDistributionEras;
    Pool[MAX_POOLS] openedPools;
    Distribution[MAX_DISTRIBUTIONS] distributionEras;

    event Deposit(uint8 pid, string externalAccountId, address user, uint256 amount);
    event Withdraw(uint8 pid, string externalAccountId, address user, uint256 amount);
    event NewDistributionEra(uint256 amount, uint256 startHeight, uint256 stopHeight);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Account is not the admin");
        _;
    }

    /**
     * @dev Create staking template contract instance.
     * The admin is the account who use StakingFactory contract deploy this template.
     * numberOfPools is set to zero, which would be increased one by one when pool was added.
     *
     * Notice:
     * Here we use Struct as function parameter, which supported in ABI-Encode-V2
     */
    constructor (address _admin, Distribution[] memory _distributionEras) {
        admin = _admin;
        numberOfPools = 0;
        numberOfDistributionEras = 0;
        _applyDistributionEras(_distributionEras);
    }

    function addPool(NutboxERC20 pair, uint8[] memory ratios) public onlyAdmin returns (uint8) {
        require(numberOfPools < MAX_POOLS, 'Can not add pool');
        require(pair.hasDeployed(), 'Contract has not been deployed');
        require((numberOfPools + 1) == ratios.length, 'Wrong ratio count');

        openedPools[numberOfPools].pid = numberOfPools;
        openedPools[numberOfPools].hasActived = true;
        openedPools[numberOfPools].stakingPair = pair;
        openedPools[numberOfPools].shareAcc = 0;
        openedPools[numberOfPools].totalStakedAmount = 0;
        numberOfPools += 1;
        _applyPoolsRatio(ratios);

        return numberOfPools;
    }

    function setPoolRatios(uint8[] memory ratios) public onlyAdmin {
        _applyPoolsRatio(ratios);
    }

    function getPoolRatios() public view returns (uint8[MAX_POOLS] memory) {
        uint8[MAX_POOLS] memory ratios;
        for(uint8 i = 0; i < numberOfPools; i++) {
            ratios[i] = openedPools[i].poolRatio;
        }
        return ratios;
    }

    function getSinglePoolRatio(uint8 pid) public view returns (uint8) {
        require(pid < MAX_POOLS, 'Invalid pid');
        return openedPools[pid].poolRatio;
    }

    function getCurrentDistributionEra() public view returns (Distribution memory) {
        for(uint8 i = 0; i < numberOfDistributionEras; i++) {
            if (block.number >= distributionEras[i].startHeight && block.number <= distributionEras[i].stopHeight) {
                return distributionEras[i];
            }
        }
    }

    /**
     * @dev Iterate every pool to update their ratio. 
     * Every ratio is an integer between [0, 100], the summuary of all pool's ration should 
     * equal to 100.
     * Because pools always less than MAX_POOLS, so the loop is in control
     */
    function _applyPoolsRatio(uint8[] memory ratios) private {
        require(numberOfPools == ratios.length, 'Wrong ratio count');

        // precheck ratios summary
        uint8 ratioSum = 0;
        for(uint8 i = 0; i < numberOfPools; i++) {
            ratioSum += ratios[i];
        }
        require(ratioSum == 100, 'Ratio summary not equal to 100');

        // update pool ratio index
        for(uint8 i = 0; i < numberOfPools; i++) {
            openedPools[i].poolRatio = ratios[i];
        }
    }

    /**
     * @dev Check and set distribution policy
     * _distributionEras must less than or equal to MAX_DISTRIBUTIONS and all distribution should meet following condidtion: 
     * 1) hasPassed should be false
     * 2) amount should greater than 0
     * 3) first distrubtion startHeight should greater than current block height
     * 4) startHeight shold less than stopHeight
     */
    function _applyDistributionEras(Distribution[] memory _distributionEras) private {
        require(_distributionEras.length <= MAX_DISTRIBUTIONS, 'Too many distribution policy');

        // prechek
        for(uint8 i = 0; i < _distributionEras.length; i++) {
            // check 1)
            require(_distributionEras[i].hasPassed == false, 'Invlalid initial state of distribution');
            // check 2)
            require(_distributionEras[i].amount > 0, 'Invalid reward amount of distribution, consider giving a positive integer');
            // check 3)
            if (i == 0) {
                require(_distributionEras[i].startHeight > block.number, 'Invalid start height of distribution');
            }
            // check 4)
            require(_distributionEras[i].startHeight < _distributionEras[i].stopHeight, 'Invalid stop height of distribution');
        }

        // set distribution policy
        for(uint8 i = 0; i < _distributionEras.length; i++) {
            distributionEras[i] = _distributionEras[i];
            numberOfDistributionEras++;
        }
    }
}
