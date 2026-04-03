---
name: nutbox-contract
description: >
  Expert skill for interacting with Nutbox/Walnut staking platform contracts.
  Activate this skill when the user needs to:
  - Create communities (createCommunity) or manage staking pools
  - Set/adjust pool reward ratios, close pools
  - Configure DAO fee ratio (feeRatio/devFund)
  - Deposit/withdraw from ERC20, ERC1155, ERC20Locking, or SPStaking pools
  - Read community data, pool data, or user reward data
  - Write scripts or code to interact with Nutbox contracts
  - Debug Nutbox contract interaction issues
  Activate whenever any of these contracts are involved: nutbox-contract project,
  Community.sol, CommunityFactory.sol, ERC20Staking, ERC1155Staking, ERC20Locking, SPStaking.
---

# Nutbox Contract Operations Guide

## Architecture Overview

```
Committee (fee management & whitelist)
    │
    ├── CommunityFactory → Community (community instances, created via Clone)
    │       ├── ERC20Staking Pool
    │       ├── ERC1155Staking Pool (NFT staking)
    │       ├── ERC20Locking Pool (time-locked staking)
    │       └── SPStaking Pool (Social Power / HP staking)
    │
    ├── LinearCalculator (reward distribution calculation)
    └── MintableERC20Factory (community token creation)
```

## Three-Tier Fee Structure

| Tier | Triggered by | Recipient |
|------|-------------|-----------|
| Tier 1 | `createCommunity()` | CommunityFactory → Committee.feeRecipient |
| Tier 2 | `adminAddPool()`, `adminClosePool()`, `adminSetPoolRatios()`, `adminSetFeeRatio()` | Community → Committee.feeRecipient |
| Tier 3 | `deposit()`, `withdraw()`, `withdrawPoolsRewards()` | Pool/Community → Committee.feeRecipient |

**Notes**:
- Excess ETH sent is automatically refunded
- Addresses in `Committee.feeFreeList` are exempt from Tier 3 fees (e.g., bridge contracts)
- Always query the current fee with `Committee.getXxxFee()` before calling

---

## 1. Create a Community

### Steps
1. Query Tier 1 fee
2. Prepare distribution policy
3. Call `CommunityFactory.createCommunity()`

### Distribution Policy Encoding

Format for the `policy` parameter passed to `LinearCalculator` (block cursors) or `LinearTimeCalculator` (unix second cursors):
```
[uint8 erasLength][era1.startCursor(32)][era1.stopCursor(32)][era1.amount(32)]...
Total bytes = 1 + erasLength * 96
```

**Constraints**:
- First era: `startCursor` must be greater than `rewardHead()` at creation (`block.number` or `block.timestamp`)
- Each subsequent era's `startCursor` must be greater than the previous era's `stopCursor`
- For each era: `startCursor < stopCursor` and `amount > 0`

### Code Examples

```javascript
// Using ethers.js v5
const ethers = require('ethers');

// Encode distribution policy
function encodeDistributionPolicy(eras) {
  // eras: [{ startCursor, stopCursor, amount }, ...]
  const buf = Buffer.alloc(1 + eras.length * 96);
  buf.writeUInt8(eras.length, 0);
  let offset = 1;
  for (const era of eras) {
    const startBuf = ethers.utils.zeroPad(ethers.BigNumber.from(era.startCursor).toHexString(), 32);
    const stopBuf = ethers.utils.zeroPad(ethers.BigNumber.from(era.stopCursor).toHexString(), 32);
    const amountBuf = ethers.utils.zeroPad(ethers.BigNumber.from(era.amount).toHexString(), 32);
    Buffer.from(startBuf).copy(buf, offset); offset += 32;
    Buffer.from(stopBuf).copy(buf, offset); offset += 32;
    Buffer.from(amountBuf).copy(buf, offset); offset += 32;
  }
  return '0x' + buf.toString('hex');
}

// Create community with an existing token
async function createCommunityWithExistingToken(
  communityFactory,
  existingTokenAddress,
  rewardCalculatorAddress,
  distributionEras,
  signer
) {
  const committeeAddr = await communityFactory.committee();
  const committee = ICommittee__factory.connect(committeeAddr, signer);
  const tier1Fee = await committee.getCreateCommunityFee();
  const policy = encodeDistributionPolicy(distributionEras);

  const tx = await communityFactory.createCommunity(
    false,                         // isMintable: use existing token
    existingTokenAddress,          // communityToken
    ethers.constants.AddressZero,  // communityTokenFactory: not needed
    '0x',                          // tokenMeta: empty
    rewardCalculatorAddress,
    policy,
    { value: tier1Fee }
  );
  const receipt = await tx.wait();
  const event = receipt.events.find(e => e.event === 'CommunityCreated');
  return event.args.community;
}

// Create community with a new mintable token
async function createCommunityWithNewToken(
  communityFactory,
  mintableERC20FactoryAddress,
  tokenName, tokenSymbol, initialSupply, tokenOwner,
  rewardCalculatorAddress,
  distributionEras,
  signer
) {
  const committeeAddr = await communityFactory.committee();
  const committee = ICommittee__factory.connect(committeeAddr, signer);
  const tier1Fee = await committee.getCreateCommunityFee();

  const tokenMeta = encodeTokenMeta(tokenName, tokenSymbol, initialSupply, tokenOwner);
  const policy = encodeDistributionPolicy(distributionEras);

  const tx = await communityFactory.createCommunity(
    true,                          // isMintable: create new mintable token
    ethers.constants.AddressZero,  // communityToken: zero address triggers creation
    mintableERC20FactoryAddress,
    tokenMeta,
    rewardCalculatorAddress,
    policy,
    { value: tier1Fee }
  );
  const receipt = await tx.wait();
  const event = receipt.events.find(e => e.event === 'CommunityCreated');
  return { community: event.args.community, token: event.args.communityToken };
}
```

See `references/community-factory.md` for detailed parameter encoding.

---

## 2. Add a Pool (adminAddPool)

### Pool Types and meta Encoding

| Pool Type | Factory | meta Format |
|-----------|---------|-------------|
| ERC20Staking | ERC20StakingFactory | `[address stakeToken (20 bytes)]` |
| ERC1155Staking | ERC1155StakingFactory | `[address stakeToken (20 bytes)][uint256 tokenId (32 bytes)]` |
| ERC20Locking | ERC20LockingFactory | `[address stakeToken (20 bytes)][uint256 lockDuration (32 bytes)]` |
| SPStaking | SPStakingFactory | `[uint8 chainId (1 byte)][bytes32 delegatee (32 bytes)]` |

**Key Constraints**:
- `ratios` array length = existing active pool count + 1
- `ratios` must sum to exactly 10000 (representing 100%)
- Maximum 255 active pools

### Code Examples

```javascript
// Add an ERC20 staking pool
async function addERC20StakingPool(
  community, poolName, stakeTokenAddress, erc20StakingFactoryAddress, newRatios, signer
) {
  const committeeAddr = await community.getCommittee();
  const committee = ICommittee__factory.connect(committeeAddr, signer);
  const tier2Fee = await committee.getCommunitySettingsFee();

  // meta = stakeToken address (20 bytes)
  const meta = ethers.utils.hexZeroPad(stakeTokenAddress, 20);

  const tx = await community.adminAddPool(
    poolName, newRatios, erc20StakingFactoryAddress, meta,
    { value: tier2Fee }
  );
  return await tx.wait();
}

// Encode meta for ERC1155 staking pool
function encodeERC1155Meta(stakeToken, tokenId) {
  return ethers.utils.hexConcat([
    ethers.utils.zeroPad(stakeToken, 20),
    ethers.utils.zeroPad(ethers.BigNumber.from(tokenId).toHexString(), 32)
  ]);
}

// Encode meta for ERC20Locking pool (with time lock)
function encodeERC20LockingMeta(stakeToken, lockDurationSeconds) {
  return ethers.utils.hexConcat([
    ethers.utils.zeroPad(stakeToken, 20),
    ethers.utils.zeroPad(ethers.BigNumber.from(lockDurationSeconds).toHexString(), 32)
  ]);
}

// Encode meta for SPStaking pool
function encodeSPMeta(chainId, delegateeString) {
  const chainBuf = Buffer.alloc(1);
  chainBuf.writeUInt8(chainId, 0);
  const delegateeBuf = Buffer.from(
    ethers.utils.zeroPad(ethers.utils.toUtf8Bytes(delegateeString), 32).slice(2), 'hex'
  );
  return '0x' + Buffer.concat([chainBuf, delegateeBuf]).toString('hex');
}
```

---

## 3. Adjust Pool Ratios (adminSetPoolRatios)

```javascript
async function setPoolRatios(community, newRatios, signer) {
  // newRatios.length must equal the number of active pools
  // sum must equal 10000
  const committeeAddr = await community.getCommittee();
  const committee = ICommittee__factory.connect(committeeAddr, signer);
  const tier2Fee = await committee.getCommunitySettingsFee();

  if (newRatios.reduce((a, b) => a + b, 0) !== 10000) {
    throw new Error('Ratios must sum to 10000');
  }

  const tx = await community.adminSetPoolRatios(newRatios, { value: tier2Fee });
  return await tx.wait();
}
```

---

## 4. Close a Pool (adminClosePool)

```javascript
async function closePool(community, poolAddress, remainingRatios, signer) {
  // Find pool index in activedPools array
  const activePools = await getActivePools(community);
  const poolIndex = activePools.indexOf(poolAddress);
  if (poolIndex === -1) throw new Error('Pool not found in active pools');

  // remainingRatios.length = active pool count - 1, sum = 10000
  const committeeAddr = await community.getCommittee();
  const committee = ICommittee__factory.connect(committeeAddr, signer);
  const tier2Fee = await committee.getCommunitySettingsFee();

  const tx = await community.adminClosePool(poolIndex, remainingRatios, { value: tier2Fee });
  return await tx.wait();
}
```

---

## 5. Set DAO Fee (adminSetFeeRatio)

```javascript
async function setDAOFeeRatio(community, ratio, signer) {
  // ratio: 0 ~ 10000 (e.g., 500 = 5%)
  const committeeAddr = await community.getCommittee();
  const committee = ICommittee__factory.connect(committeeAddr, signer);
  const tier2Fee = await committee.getCommunitySettingsFee();

  const tx = await community.adminSetFeeRatio(ratio, { value: tier2Fee });
  return await tx.wait();
}

// Withdraw accumulated DAO revenue
async function withdrawDAORevenue(community) {
  return await (await community.adminWithdrawRevenue()).wait();
}

// Update DAO fund address
async function setDevFund(community, newDevAddress) {
  return await (await community.adminSetDev(newDevAddress)).wait();
}
```

---

## 6. Pool Operations

### 6.1 ERC20Staking / ERC1155Staking

```javascript
// Deposit
async function deposit(pool, amount, signer) {
  const communityAddr = await pool.getCommunity();
  const community = ICommunity__factory.connect(communityAddr, signer);
  const committeeAddr = await community.getCommittee();
  const committee = ICommittee__factory.connect(committeeAddr, signer);
  const fee = await committee.getPoolOperationFee();
  const isFree = await committee.getFeeFree(signer.address);

  // For ERC20: approve first
  // await stakeToken.approve(pool.address, amount);
  // For ERC1155: setApprovalForAll first
  // await nftToken.setApprovalForAll(pool.address, true);

  const tx = await pool.deposit(amount, { value: isFree ? 0 : fee });
  return await tx.wait();
}

// Withdraw (immediate token return)
async function withdraw(pool, amount, signer) {
  const fee = await getPoolOperationFee(pool, signer);
  return await (await pool.withdraw(amount, { value: fee })).wait();
}
```

### 6.2 ERC20Locking (time-locked staking)

```javascript
// Deposit (same as ERC20Staking)

// Request withdrawal — tokens enter the lock queue, NOT returned immediately
async function withdrawLocking(pool, amount, signer) {
  const fee = await getPoolOperationFee(pool, signer);
  return await (await pool.withdraw(amount, { value: fee })).wait();
}

// Claim unlocked tokens (no Tier 3 fee required)
async function redeemLocked(pool, signer) {
  const claimable = await pool.claimableAmount(signer.address);
  if (claimable.eq(0)) {
    console.log('Nothing to claim yet — lock period not elapsed');
    return;
  }
  return await (await pool.redeem()).wait();
}

// Check redeem requests
async function getRedeemRequests(pool, userAddress) {
  const requests = await pool.redeemRequests(userAddress);
  const claimable = await pool.claimableAmount(userAddress);
  return { requests, claimable };
}
```

### 6.3 SPStaking (Social Power — bridge-updated)

```javascript
// SPStaking has no direct deposit/withdraw — staking is updated by the bridge
// Read user staking info
async function getSPStakingInfo(pool, userAddress) {
  const info = await pool.getUserDepositInfo(userAddress);
  return {
    hasDeposited: info.hasDeposited,
    amount: info.amount,
    bindAccount: ethers.utils.toUtf8String(info.bindAccount.replace(/0+$/, ''))
  };
}
```

### 6.4 Withdraw Rewards

```javascript
// Withdraw rewards from multiple pools in one call
async function withdrawRewards(community, poolAddresses, signer) {
  const committeeAddr = await community.getCommittee();
  const committee = ICommittee__factory.connect(committeeAddr, signer);
  const fee = await committee.getPoolOperationFee();
  const isFree = await committee.getFeeFree(signer.address);

  const tx = await community.withdrawPoolsRewards(
    poolAddresses,
    { value: isFree ? 0 : fee }
  );
  return await tx.wait();
}
```

---

## 7. Data Reading

See `references/data-reading.md` for the full reference.

### Community Basic Info

```javascript
async function getCommunityInfo(community) {
  return {
    communityToken: await community.communityToken(),
    isMintable: await community.isMintableCommunityToken(),
    rewardCalculator: await community.rewardCalculator(),
    committee: await community.getCommittee(),
    feeRatio: await community.feeRatio(),   // divide by 10000 for percentage
    activePools: await getActivePools(community),
  };
}

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
```

### Reward Info

```javascript
// Pending rewards from a single pool
const pending = await community.getPoolPendingRewards(poolAddress, userAddress);

// Total pending rewards across all pools
const total = await community.getTotalPendingRewards(userAddress);
```

### Calculator Info

```javascript
async function getCalculatorInfo(calculator, communityAddress) {
  return {
    currentRewardRate: await calculator.getCurrentRewardRate(communityAddress),
    startCursor: await calculator.getStartCursor(communityAddress),
    currentEra: await calculator.getCurrentDistributionEra(communityAddress),
  };
}
```

---

## Common Troubleshooting

1. **`execution reverted` with no reason** → Usually insufficient fee; check `msg.value >= fee`
2. **`ratios sum must be 10000`** → Fix the ratios array; sum must be exactly 10000
3. **`pool is not actived`** → Pool has been closed; deposits are no longer accepted
4. **`poolIndex out of bounds`** → Wrong index for `adminClosePool`; re-query `activedPools`
5. **First `withdrawPoolsRewards` reverts** → `lastRewardBlock` is 0; need at least one deposit to initialize the reward state

## Reference Files

- `references/committee.md` — All Committee contract functions
- `references/community-factory.md` — Community creation parameters in detail
- `references/community.md` — Complete Community contract interface
- `references/pool-operations.md` — Detailed pool operations for all pool types
- `references/data-reading.md` — Full data reading and query reference
