# CommunityFactory & LinearCalculator Reference

## CommunityFactory

### State Variables
```solidity
address immutable committee;
address immutable communityTemplate;
mapping(address => bool) public createdCommunity; // verify if a community was created by this factory
```

### createCommunity — Detailed Parameters

```solidity
function createCommunity(
    bool isMintable,
    address communityToken,
    address communityTokenFactory,
    bytes calldata tokenMeta,
    address rewardCalculator,
    bytes calldata distributionPolicy
) external payable
```

**Option 1: Use an existing token**
```javascript
{
  isMintable: false,
  communityToken: "0xExistingTokenAddress",
  communityTokenFactory: ethers.constants.AddressZero,
  tokenMeta: "0x",
  rewardCalculator: calculatorAddress,
  distributionPolicy: encodedPolicy
}
```

**Option 2: Create a new mintable token**
```javascript
{
  isMintable: true,
  communityToken: ethers.constants.AddressZero,  // zero address triggers token creation
  communityTokenFactory: mintableERC20FactoryAddress,
  tokenMeta: encodeTokenMeta(name, symbol, initialSupply, ownerAddress),
  rewardCalculator: calculatorAddress,
  distributionPolicy: encodedPolicy
}
```

### tokenMeta Encoding Format

```
[uint8 nameLength][name bytes]
[uint8 symbolLength][symbol bytes]
[uint256 supply (32 bytes)]
[address owner (20 bytes)]
Minimum total length: 1+1+1+1+32+20 = 56 bytes
```

```javascript
function encodeTokenMeta(name, symbol, supply, owner) {
  const nameBytes = Buffer.from(name, 'utf8');
  const symbolBytes = Buffer.from(symbol, 'utf8');

  if (nameBytes.length > 255 || symbolBytes.length > 255) {
    throw new Error('Name or symbol too long');
  }

  const supplyHex = ethers.utils.zeroPad(
    ethers.BigNumber.from(supply).toHexString(), 32
  );
  const ownerHex = Buffer.from(owner.slice(2), 'hex'); // strip 0x prefix

  const buf = Buffer.alloc(
    1 + nameBytes.length + 1 + symbolBytes.length + 32 + 20
  );
  let offset = 0;
  buf.writeUInt8(nameBytes.length, offset++);
  nameBytes.copy(buf, offset); offset += nameBytes.length;
  buf.writeUInt8(symbolBytes.length, offset++);
  symbolBytes.copy(buf, offset); offset += symbolBytes.length;
  Buffer.from(supplyHex).copy(buf, offset); offset += 32;
  ownerHex.copy(buf, offset);

  return '0x' + buf.toString('hex');
}
```

### distributionPolicy (LinearCalculator / LinearTimeCalculator) Encoding Format

Block clock (`LinearCalculator`): cursors are block heights. Time clock (`LinearTimeCalculator`): cursors are unix seconds.

```
[uint8 erasLength (1 byte)]
[era1.startCursor (32 bytes)]
[era1.stopCursor (32 bytes)]
[era1.amount (32 bytes)]
...
[eraN.startCursor][eraN.stopCursor][eraN.amount]
Total bytes = 1 + erasLength * 96
```

**Constraints**:
- `erasLength >= 1`
- `amount > 0` for all eras
- First era: `startCursor > rewardHead()` at creation (`block.number` or `block.timestamp` per calculator)
- Subsequent eras: `startCursor > previous era's stopCursor`
- Each era: `startCursor < stopCursor`

```javascript
function encodeDistributionPolicy(eras) {
  // eras: [{ startCursor, stopCursor, amount }]
  if (!eras || eras.length === 0) throw new Error('At least one era is required');

  const buf = Buffer.alloc(1 + eras.length * 96);
  buf.writeUInt8(eras.length, 0);
  let offset = 1;

  for (const era of eras) {
    const start = Buffer.from(
      ethers.utils.zeroPad(ethers.BigNumber.from(era.startCursor).toHexString(), 32).slice(2), 'hex'
    );
    const stop = Buffer.from(
      ethers.utils.zeroPad(ethers.BigNumber.from(era.stopCursor).toHexString(), 32).slice(2), 'hex'
    );
    const amount = Buffer.from(
      ethers.utils.zeroPad(ethers.BigNumber.from(era.amount).toHexString(), 32).slice(2), 'hex'
    );
    start.copy(buf, offset); offset += 32;
    stop.copy(buf, offset); offset += 32;
    amount.copy(buf, offset); offset += 32;
  }
  return '0x' + buf.toString('hex');
}

// Example: two eras
// Era 1: blocks currentBlock+100 to currentBlock+100000, 10 tokens/block
// Era 2: blocks currentBlock+100001 to currentBlock+300000, 5 tokens/block
const currentBlock = await provider.getBlockNumber();
const policy = encodeDistributionPolicy([
  {
    startCursor: currentBlock + 100,
    stopCursor: currentBlock + 100000,
    amount: ethers.utils.parseEther('10')
  },
  {
    startCursor: currentBlock + 100001,
    stopCursor: currentBlock + 300000,
    amount: ethers.utils.parseEther('5')
  }
]);
```

### Events

```
CommunityCreated(address indexed creator, address indexed community, address communityToken)
```

### Verify a community was created by this factory

```javascript
const isCreatedByFactory = await communityFactory.createdCommunity(communityAddress);
```

---

## LinearCalculator

### Query All Distribution Eras

```javascript
const calculator = new ethers.Contract(calculatorAddress, LinearCalculatorABI, provider);

// Get total era count
const count = await calculator.distributionCountMap(communityAddress);

// Query each era
for (let i = 0; i < count.toNumber(); i++) {
  const era = await calculator.distributionErasMap(communityAddress, i);
  console.log({
    index: i,
    startCursor: era.startCursor.toNumber(),
    stopCursor: era.stopCursor.toNumber(),
    amountPerStep: ethers.utils.formatEther(era.amount)
  });
}
```

### Calculate reward for a cursor interval

```javascript
// Total over (lastCursor, head] in the calculator's native unit (blocks or seconds)
const reward = await calculator.calculateReward(
  communityAddress,
  lastCursor,
  head
);
console.log(`Reward: ${ethers.utils.formatEther(reward)} tokens`);
```

### Current Era Info

```javascript
const currentEra = await calculator.getCurrentDistributionEra(communityAddress);
if (currentEra.amount.gt(0)) {
  console.log(`Current era: cursors ${currentEra.startCursor}–${currentEra.stopCursor}, ${ethers.utils.formatEther(currentEra.amount)} per clock step`);
} else {
  console.log('Not currently in any reward era');
}

const rewardRate = await calculator.getCurrentRewardRate(communityAddress);
const startCursor = await calculator.getStartCursor(communityAddress);
```
