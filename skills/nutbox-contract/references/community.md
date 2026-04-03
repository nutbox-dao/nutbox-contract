# Community Contract Complete Interface

Community is the core staking economy contract created via the Clone pattern. It manages multiple staking pools, reward distribution, and DAO revenue.

## Public State Variables

```solidity
uint256 public constant MAX_ACTIVE_POOLS = 255; // hard limit on active pools
address public committee;                        // Committee contract address
uint16 public feeRatio;                          // DAO fee ratio (basis 10000)
address[] public activedPools;                   // currently active pools (enumerable by index)
address[] public createdPools;                   // all pools ever created (including closed)
address public communityToken;                   // community reward token
bool public isMintableCommunityToken;            // whether the token is mintable
address public rewardCalculator;                 // reward calculator contract
```

## Initialization (called by CommunityFactory)

```solidity
initialize(
  address _admin,                    // community owner/admin
  address _committee,                // Committee address
  address _communityToken,           // community token
  address _rewardCalculator,         // reward calculator
  bool _isMintableCommunityToken     // whether token is mintable
)
```

## Admin Functions (onlyOwner, payable — Tier 2 fee required)

### Pool Management

```solidity
// Add a new pool
adminAddPool(
  string memory poolName,     // pool display name
  uint16[] memory ratios,     // ratios for all active pools INCLUDING the new one
                              // length = old active pool count + 1, sum = 10000
  address poolFactory,        // pool factory address (must be whitelisted in Committee)
  bytes calldata meta         // pool-type-specific metadata
) external payable onlyOwner

// Close an existing pool
adminClosePool(
  uint256 poolIndex,          // index in the activedPools array
  uint16[] memory ratios      // ratios for remaining pools after removal
                              // length = old active pool count - 1, sum = 10000
) external payable onlyOwner

// Adjust ratios without changing pool count
adminSetPoolRatios(
  uint16[] memory ratios      // ratios for all active pools, length = pool count, sum = 10000
) external payable onlyOwner
```

### DAO Configuration

```solidity
adminSetFeeRatio(uint16 _ratio) external payable onlyOwner  // 0-10000, requires Tier 2 fee
adminSetDev(address _dev) external onlyOwner                // update DAO fund address
adminWithdrawRevenue() external onlyOwner nonReentrant      // withdraw accumulated DAO revenue
adminWithdrawReward(uint256 amount) external onlyOwner      // emergency withdraw (safety-checked)
```

## User Functions (payable — Tier 3 fee required)

```solidity
// Withdraw rewards from one or more pools in a single call
withdrawPoolsRewards(
  address[] memory poolAddresses  // list of pool addresses to claim rewards from
) external payable nonReentrant
```

## View Functions

```solidity
getPoolPendingRewards(address poolAddress, address user) → uint256  // pending reward from a single pool
getTotalPendingRewards(address user) → uint256                       // total pending across all pools
poolActived(address pool) → bool                                     // whether pool is still active
getShareAcc(address pool) → uint256                                  // pool's accumulated shareAcc value
getCommunityToken() → address                                        // community token address
getCommittee() → address                                             // Committee address
getUserDebt(address pool, address user) → uint256                    // user's debt value in a pool
```

## Events

```
AdminSetFeeRatio(uint16 ratio)
AdminClosePool(address indexed pool)
AdminSetPoolRatio(address[] pools, uint16[] ratios)
WithdrawRewards(address[] pool, address indexed who, uint256 amount)
PoolUpdated(address indexed who, uint256 amount)  // emitted when DAO fee is collected
DevChanged(address indexed oldDev, address indexed newDev)
RevenueWithdrawn(address indexed devFund, uint256 amount)
```

## Key Logic Explanations

### Reward Calculation (Accumulator Pattern)

- `poolAcc[pool]` tracks cumulative reward per unit of stake
- User reward = `stakedAmount * poolAcc / 1e12 - userDebt`
- `updatePools()` is triggered before every state-changing operation to refresh `poolAcc`

### DAO Fee

- On each reward update, `feeRatio/10000` of total rewards is redirected to `retainedRevenue`
- The DAO fund withdraws via `adminWithdrawRevenue()`

### User Fund Protection

- `totalUserPendingRewards` tracks total user pending rewards
- `adminWithdrawReward` cannot drain user-owed rewards for non-mintable tokens

## Usage Examples

```javascript
const community = new ethers.Contract(communityAddress, CommunityABI, signer);

// Get active pool list
async function getActivePools(community) {
  const pools = [];
  let i = 0;
  while (true) {
    try {
      pools.push(await community.activedPools(i));
      i++;
    } catch { break; }
  }
  return pools;
}

// Query total pending rewards for a user
const totalPending = await community.getTotalPendingRewards(userAddress);

// Withdraw rewards from all active pools
const activePools = await getActivePools(community);
const tier3Fee = await committee.getPoolOperationFee();
const tx = await community.withdrawPoolsRewards(activePools, { value: tier3Fee });
await tx.wait();
```
