// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import './access/Ownable.sol';
import './libraries/SafeMath.sol';
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
        // Rewards that to be withdraw
        uint256 pendingRewards;
        // User's debt that should be removed when calculating their final rewards.
        uint256 userDebt;
    }

    struct Pool {
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


    address admin;
    uint8 constant MAX_POOLS = 10;
    uint8 currentPools;
    Pool[MAX_POOLS] openedPools;

    event Deposit(string externalAccountId, address user, uint256 amount);
    event Withdraw(string externalAccountId, address user, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Account is not the admin");
        _;
    }

    /**
     * @dev Create staking template contract instance.
     * The admin is the account who use StakingFactory contract deploy this template.
     * currentPools is set to zero, which would be increased one by one when pool was added.
     */
    constructor (address _admin) {
        admin = _admin;
        currentPools = 0;
    }

    function addPool(NutboxERC20 pair, uint8[] memory ratios) public onlyAdmin returns (uint8) {
        require(currentPools < MAX_POOLS, 'Can not add pool');
        require(pair.hasDeployed(), 'Contract has not been deployed');

        openedPools[currentPools].hasActived = true;
        openedPools[currentPools].stakingPair = pair;
        openedPools[currentPools].shareAcc = 0;
        openedPools[currentPools].totalStakedAmount = 0;
        currentPools += 1;
        _applyPoolsRatio(ratios);

        return currentPools;
    }

    function setPoolRatios(uint8[] memory ratios) public onlyAdmin {
        _applyPoolsRatio(ratios);
    }

    function getPoolRatios() public view returns (uint8[MAX_POOLS] memory) {
        uint8[MAX_POOLS] memory ratios;
        for(uint8 i = 0; i < currentPools; i++) {
            ratios[i] = openedPools[i].poolRatio;
        }
        return ratios;
    }

    function getSinglePoolRatio(uint8 index) public view returns (uint8) {
        require(index < MAX_POOLS, 'Invalid ratio query index');
        return openedPools[index].poolRatio;
    }

    /**
     * @dev Iterate every pool to update their ratio. 
     * Every ratio is an integer between [0, 100], the summuary of all pool's ration should 
     * equal to 100.
     * Because pools always less than MAX_POOLS, so the loop is in control
     */
    function _applyPoolsRatio(uint8[] memory ratios) private {
        require(currentPools == ratios.length, 'Wrong ratio count');

        // precheck ratios summary
        uint8 ratioSum = 0;
        for(uint8 i = 0; i < currentPools; i++) {
            ratioSum += ratios[i];
        }
        require(ratioSum == 100, 'Ratio summary not equal to 100');

        // update pool ratio index
        for(uint8 i = 0; i < currentPools; i++) {
            openedPools[i].poolRatio = ratios[i];
        }
    }
}
