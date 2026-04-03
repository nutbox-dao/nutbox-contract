# 各类池子操作详解

## 通用接口（IPool）

所有池子都实现了以下接口：

```solidity
getFactory() → address               // 创建该池子的 Factory 地址
getCommunity() → address             // 所属 Community 地址
getUserStakedAmount(address user) → uint256   // 用户当前质押金额
getTotalStakedAmount() → uint256     // 全池总质押金额
```

## ERC20Staking

### 状态变量
```solidity
string public name;               // 池子名称
address public stakeToken;        // 质押的 ERC20 代币
address public community;
uint256 public totalStakedAmount;
```

### 函数

```solidity
// 存入质押
deposit(uint256 amount) external payable nonReentrant
  // 前提：池子活跃，需 ERC20 approve，需 Tier 3 费用

// 提取（立即返回代币）
withdraw(uint256 amount) external payable nonReentrant
  // 前提：需 Tier 3 费用，实际提取不超过持有量

// 查询
getUserDepositInfo(address user) → StakingInfo { hasDeposited, amount }
```

### 事件
```
Deposited(address indexed community, address indexed who, uint256 amount)
Withdrawn(address indexed community, address indexed who, uint256 amount)
```

### 操作示例
```javascript
// 需要先 approve
const stakeToken = new ethers.Contract(stakeTokenAddress, ERC20ABI, signer);
await stakeToken.approve(pool.address, depositAmount);

// 存入
const fee = await committee.getPoolOperationFee();
await pool.deposit(depositAmount, { value: fee });

// 提取
await pool.withdraw(withdrawAmount, { value: fee });
```

---

## ERC1155Staking

### 额外状态变量
```solidity
address public stakeToken;        // ERC1155 合约地址
uint256 public tokenId;           // 该池子对应的 token ID（固定）
```

### 函数
```solidity
deposit(uint256 amount) external payable nonReentrant
  // 转入 tokenId 对应的 amount 个 NFT（需 setApprovalForAll）

withdraw(uint256 amount) external payable nonReentrant
  // 返回 NFT
```

### 操作示例
```javascript
// 需要先授权
const nftToken = new ethers.Contract(nftAddress, ERC1155ABI, signer);
await nftToken.setApprovalForAll(pool.address, true);

const fee = await committee.getPoolOperationFee();
await pool.deposit(nftAmount, { value: fee });
```

---

## ERC20Locking（时间锁质押）

### 额外状态变量
```solidity
uint256 public lockDuration;   // 锁定时长（秒）
```

### 数据结构
```solidity
struct RedeemRequest {
  uint256 erc20Amount;   // 赎回总额
  uint256 claimed;       // 已领取额
  uint256 startTime;     // 锁定开始时间戳
  uint256 endTime;       // 锁定结束时间戳（startTime + lockDuration）
}
```

### 函数
```solidity
// 存入（同 ERC20Staking，需 approve）
deposit(uint256 amount) external payable nonReentrant

// 申请提取（不立即返回，创建赎回请求进入锁定队列）
withdraw(uint256 amount) external payable nonReentrant

// 领取已解锁的代币（线性解锁，无 Tier 3 费用）
redeem() external nonReentrant

// 查询
redeemRequestCount(address _who) → uint256           // 未完成请求数量
redeemRequests(address _who) → RedeemRequest[]       // 未完成的所有请求
claimableAmount(address _who) → uint256              // 当前可领取金额
getUserDepositInfo(address user) → StakingInfo { hasDeposited, amount }
  // 注意：amount 仅为活跃质押额，不含锁定中的金额
```

### 事件
```
Locked(address indexed who, uint256 amount)
Unlocked(address indexed who, uint256 amount)   // withdraw 申请成功
Redeemed(address indexed who, uint256 amount)   // redeem 领取成功
```

### 操作示例
```javascript
// 存入
const stakeToken = new ethers.Contract(stakeTokenAddress, ERC20ABI, signer);
await stakeToken.approve(pool.address, amount);
const fee = await committee.getPoolOperationFee();
await pool.deposit(amount, { value: fee });

// 申请提取（进入锁定队列）
await pool.withdraw(amount, { value: fee });

// 等待 lockDuration 秒后，查询可领取金额
const claimable = await pool.claimableAmount(userAddress);

// 领取（不需要费用）
if (claimable.gt(0)) {
  await pool.redeem();
}

// 查看所有赎回请求详情
const requests = await pool.redeemRequests(userAddress);
for (const req of requests) {
  const progress = req.endTime <= Date.now() / 1000
    ? '已完全解锁'
    : `已过 ${(Date.now()/1000 - req.startTime.toNumber())} 秒，共 ${req.endTime.sub(req.startTime).toNumber()} 秒`;
  console.log(`请求：${ethers.utils.formatEther(req.erc20Amount)} 代币，${progress}`);
}
```

---

## SPStaking（社交权力质押）

**特殊说明**：SPStaking 不支持直接 deposit/withdraw，质押通过跨链桥接更新。

### 额外状态变量
```solidity
bytes32 public delegatee;         // 委托目标账户（外链，如 Steem/Hive 账户名）
uint8 public chainId;             // 外链 ID
mapping(bytes32 => address) public accountBindMap;  // 外链账户 => ETH 地址
```

### 桥接函数（仅桥接合约可调用）
```solidity
update(
  uint8 _chainId,       // 必须匹配 pool.chainId
  bytes32 _delegatee,   // 必须匹配 pool.delegatee
  address depositor,    // 存款人 ETH 地址
  uint256 amount,       // 新质押金额（全量更新，非增量）
  bytes32 _bindAccount  // 外链账户名（bytes32 编码）
) external
```

### 查询函数
```solidity
getUserDepositInfo(address user) → StakingInfo {
  hasDeposited,
  amount,
  bindAccount  // bytes32 格式的外链账户名
}
```

### 事件
```
UpdateStaking(address indexed community, address indexed who, uint256 previousAmount, uint256 newAmount)
```

### 数据读取示例
```javascript
const info = await spPool.getUserDepositInfo(userAddress);
const bindAccount = ethers.utils.toUtf8String(
  info.bindAccount.replace(/0+$/, '')  // 去除尾部零字节
);
console.log(`绑定账户: ${bindAccount}，质押金额: ${info.amount}`);

// 读取 delegatee
const delegatee = await spPool.delegatee();
const delegateeStr = ethers.utils.toUtf8String(delegatee.replace(/0+$/, ''));
```

---

## Pool Factory 接口

每个池子类型对应一个 Factory，Factory 需在 Committee 白名单中。

### ERC20StakingFactory meta 编码
```javascript
// meta = stakeToken 地址（20 bytes）
const meta = ethers.utils.hexZeroPad(stakeTokenAddress, 20);
// 或者
const meta = ethers.utils.defaultAbiCoder.encode(['address'], [stakeTokenAddress]).slice(0, 42);
// 更正：直接用 bytes 截取前20字节
```

### ERC1155StakingFactory meta 编码
```javascript
// meta = [stakeToken (20 bytes)][tokenId (32 bytes)]
function encodeERC1155Meta(stakeToken, tokenId) {
  return ethers.utils.hexConcat([
    ethers.utils.zeroPad(stakeToken, 20),
    ethers.utils.zeroPad(ethers.BigNumber.from(tokenId).toHexString(), 32)
  ]);
}
```

### ERC20LockingFactory meta 编码
```javascript
// meta = [stakeToken (20 bytes)][lockDuration in seconds (32 bytes)]
function encodeERC20LockingMeta(stakeToken, lockDurationSeconds) {
  return ethers.utils.hexConcat([
    ethers.utils.zeroPad(stakeToken, 20),
    ethers.utils.zeroPad(ethers.BigNumber.from(lockDurationSeconds).toHexString(), 32)
  ]);
}
// 示例：30天锁定
const thirtyDaysInSeconds = 30 * 24 * 3600;
const meta = encodeERC20LockingMeta(tokenAddress, thirtyDaysInSeconds);
```

### SPStakingFactory meta 编码
```javascript
// meta = [chainId (1 byte)][delegatee in bytes32 (32 bytes)]
function encodeSPMeta(chainId, delegateeString) {
  const chainByte = ethers.utils.hexlify(chainId).padEnd(4, '0');
  const delegateeBytes32 = ethers.utils.formatBytes32String(delegateeString);
  return ethers.utils.hexConcat([
    chainByte,
    delegateeBytes32
  ]);
}
// 示例：Steem 链 (chainId=1)，委托给 nutbox.mine
const meta = encodeSPMeta(1, 'nutbox.mine');
```
