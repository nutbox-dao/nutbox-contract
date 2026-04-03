# 数据读取查询大全

本文件汇总所有 Nutbox 合约的数据读取方法，包括合约状态查询、用户数据读取和事件监听。

## Committee 数据读取

```javascript
const committee = new ethers.Contract(committeeAddress, CommitteeABI, provider);

// 费用信息
const tier1Fee = await committee.getCreateCommunityFee();
const tier2Fee = await committee.getCommunitySettingsFee();
const tier3Fee = await committee.getPoolOperationFee();
const feeRecipient = await committee.getFeeRecipient();

// 合约/地址状态
const isWhitelisted = await committee.verifyContract(contractAddress);
const isFree = await committee.getFeeFree(userAddress);
```

## 社区（Community）数据读取

```javascript
const community = new ethers.Contract(communityAddress, CommunityABI, provider);

// 基础配置
const communityToken = await community.communityToken();
const isMintable = await community.isMintableCommunityToken();
const rewardCalculator = await community.rewardCalculator();
const committeeAddr = await community.getCommittee();
const feeRatio = await community.feeRatio(); // DAO 抽成，除以 10000 得百分比

// 池子列表
async function getAllActivePools(community) {
  const pools = [];
  let i = 0;
  while (true) {
    try {
      const pool = await community.activedPools(i);
      pools.push(pool);
      i++;
    } catch { break; }
  }
  return pools;
}

// 创建过的所有池子（包括已关闭）
async function getAllCreatedPools(community) {
  const pools = [];
  let i = 0;
  while (true) {
    try {
      pools.push(await community.createdPools(i));
      i++;
    } catch { break; }
  }
  return pools;
}

// 池子状态
const isPoolActive = await community.poolActived(poolAddress);
const shareAcc = await community.getShareAcc(poolAddress);          // 累积分红值（原始）
const userDebt = await community.getUserDebt(poolAddress, userAddress);

// 用户奖励
const pendingFromPool = await community.getPoolPendingRewards(poolAddress, userAddress);
const totalPending = await community.getTotalPendingRewards(userAddress);
```

## 奖励计算器（LinearCalculator）数据读取

```javascript
const calculator = new ethers.Contract(calculatorAddress, LinearCalculatorABI, provider);

// 当前奖励信息
const rewardRate = await calculator.getCurrentRewardRate(communityAddress);
const startCursor = await calculator.getStartCursor(communityAddress);
const currentEra = await calculator.getCurrentDistributionEra(communityAddress);
// currentEra: { amount, startCursor, stopCursor }

// 区间 (lastCursor, head] 上的奖励总量（与链上 Community 使用的语义一致）
const reward = await calculator.calculateReward(communityAddress, lastCursor, head);

// 所有分配时期（需要通过 distributionErasMap 查询）
// 注意：distributionErasMap 是 public mapping(address => Distribution[])
// 通过索引逐个查询
async function getAllDistributionEras(calculator, communityAddress) {
  const eras = [];
  const count = await calculator.distributionCountMap(communityAddress);
  for (let i = 0; i < count; i++) {
    const era = await calculator.distributionErasMap(communityAddress, i);
    eras.push({
      startCursor: era.startCursor.toNumber(),
      stopCursor: era.stopCursor.toNumber(),
      amount: era.amount
    });
  }
  return eras;
}
```

## 池子数据读取

### 通用查询（所有池子）

```javascript
// 基础信息（通过 IPool 接口）
const factory = await pool.getFactory();
const community = await pool.getCommunity();
const userStaked = await pool.getUserStakedAmount(userAddress);
const totalStaked = await pool.getTotalStakedAmount();
```

### ERC20Staking / ERC1155Staking

```javascript
const pool = new ethers.Contract(poolAddress, ERC20StakingABI, provider);

const name = await pool.name();
const stakeToken = await pool.stakeToken();
const totalStakedAmount = await pool.totalStakedAmount();

// 用户详情
const info = await pool.getUserDepositInfo(userAddress);
// info: { hasDeposited: bool, amount: BigNumber }
```

### ERC20Locking

```javascript
const pool = new ethers.Contract(poolAddress, ERC20LockingABI, provider);

const lockDuration = await pool.lockDuration(); // 锁定时长（秒）
const name = await pool.name();
const stakeToken = await pool.stakeToken();

// 用户活跃质押（不含锁定中的）
const activeStaked = await pool.getUserStakedAmount(userAddress);

// 用户赎回请求
const requestCount = await pool.redeemRequestCount(userAddress);
const allRequests = await pool.redeemRequests(userAddress);
// allRequests: [{ erc20Amount, claimed, startTime, endTime }, ...]

// 当前可领取金额
const claimable = await pool.claimableAmount(userAddress);

// 计算锁定中的总金额
const lockedAmount = allRequests.reduce((sum, req) => {
  return sum.add(req.erc20Amount.sub(req.claimed));
}, ethers.BigNumber.from(0));
```

### SPStaking

```javascript
const pool = new ethers.Contract(poolAddress, SPStakingABI, provider);

const delegatee = await pool.delegatee();
const chainId = await pool.chainId();
const delegateeStr = ethers.utils.toUtf8String(delegatee.replace(/0+$/, ''));

// 用户信息（含绑定的外链账户）
const info = await pool.getUserDepositInfo(userAddress);
const bindAccountStr = ethers.utils.toUtf8String(
  info.bindAccount.replace(/0+$/, '')
);

// 根据外链账户查询 ETH 地址
const ethAddress = await pool.accountBindMap(bindAccountBytes32);
```

## 综合数据读取示例

### 读取社区完整信息

```javascript
async function getCommunityFullInfo(communityAddress, userAddress, provider) {
  const community = new ethers.Contract(communityAddress, CommunityABI, provider);

  // 基础配置
  const [communityToken, isMintable, feeRatio, committeeAddr, rewardCalc] = await Promise.all([
    community.communityToken(),
    community.isMintableCommunityToken(),
    community.feeRatio(),
    community.getCommittee(),
    community.rewardCalculator(),
  ]);

  // 活跃池子
  const activePools = await getAllActivePools(community);

  // 用户奖励
  const totalPending = userAddress
    ? await community.getTotalPendingRewards(userAddress)
    : null;

  // 各池子用户质押
  const poolInfos = userAddress
    ? await Promise.all(activePools.map(async (poolAddr) => {
        const pool = new ethers.Contract(poolAddr, IPoolABI, provider);
        const [userStaked, totalStaked, pendingReward] = await Promise.all([
          pool.getUserStakedAmount(userAddress),
          pool.getTotalStakedAmount(),
          community.getPoolPendingRewards(poolAddr, userAddress),
        ]);
        return { poolAddr, userStaked, totalStaked, pendingReward };
      }))
    : [];

  return {
    communityToken,
    isMintable,
    feeRatio: feeRatio / 10000,       // 转换为百分比
    committeeAddr,
    rewardCalc,
    activePools,
    userTotalPendingReward: totalPending,
    poolInfos,
  };
}
```

### 读取奖励分配政策信息

```javascript
async function getRewardPolicyInfo(calculatorAddress, communityAddress, provider) {
  const calculator = new ethers.Contract(calculatorAddress, LinearCalculatorABI, provider);

  const [rewardRate, startCursor, currentEra] = await Promise.all([
    calculator.getCurrentRewardRate(communityAddress),
    calculator.getStartCursor(communityAddress),
    calculator.getCurrentDistributionEra(communityAddress),
  ]);

  const allEras = await getAllDistributionEras(calculator, communityAddress);

  return {
    currentRewardRate: ethers.utils.formatEther(rewardRate),
    startCursor: startCursor.toNumber(),
    currentEra: {
      startCursor: currentEra.startCursor.toNumber(),
      stopCursor: currentEra.stopCursor.toNumber(),
      amountPerStep: ethers.utils.formatEther(currentEra.amount),
    },
    allEras,
  };
}
```

## 事件监听

```javascript
// 监听社区创建
communityFactory.on('CommunityCreated', (creator, community, communityToken, event) => {
  console.log(`新社区创建: ${community}，代币: ${communityToken}，创建者: ${creator}`);
});

// 监听池子比例变化
community.on('AdminSetPoolRatio', (pools, ratios, event) => {
  console.log('池子比例更新:', pools.map((p, i) => `${p}: ${ratios[i]/100}%`));
});

// 监听奖励提取
community.on('WithdrawRewards', (pools, who, amount, event) => {
  console.log(`${who} 提取了 ${ethers.utils.formatEther(amount)} 代币`);
});

// 监听存入事件
erc20Pool.on('Deposited', (community, who, amount, event) => {
  console.log(`${who} 存入 ${ethers.utils.formatEther(amount)}`);
});

// 查询历史事件
async function getDepositHistory(pool, userAddress, fromBlock = 0) {
  const filter = pool.filters.Deposited(null, userAddress);
  const events = await pool.queryFilter(filter, fromBlock);
  return events.map(e => ({
    block: e.blockNumber,
    amount: e.args.amount,
    txHash: e.transactionHash,
  }));
}
```
