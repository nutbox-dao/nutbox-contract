# Committee Contract Interface

Committee is the central governance contract of the Nutbox protocol, managing fee configuration and contract whitelists.

## Constructor

```solidity
constructor(address payable _feeRecipient)
```

## Admin Functions (onlyOwner)

### Fee Configuration
```solidity
adminSetFeeRecipient(address payable _feeRecipient)
adminSetCreateCommunityFee(uint256 _fee)   // Tier 1, in wei
adminSetCommunitySettingsFee(uint256 _fee) // Tier 2
adminSetPoolOperationFee(uint256 _fee)     // Tier 3
```

### Contract Whitelist (Pool Factories and Calculators must be whitelisted to be used)
```solidity
adminAddContract(address _c)     // Add to whitelist
adminRemoveContract(address _c)  // Remove from whitelist
```

### Fee-Free Address List (Tier 3 exempt, e.g., bridge contracts)
```solidity
adminAddFeeFreeAddress(address _f)
adminRemoveFeeFreeAddress(address _f)
```

## View Functions

```solidity
getFeeRecipient() → address payable
getCreateCommunityFee() → uint256     // Tier 1 fee
getCommunitySettingsFee() → uint256   // Tier 2 fee
getPoolOperationFee() → uint256       // Tier 3 fee
verifyContract(address c) → bool      // Whether contract is whitelisted
getFeeFree(address freeAddress) → bool // Whether address is fee-free
```

## Events
```
AdminSetFeeRecipient(address indexed feeRecipient)
AdminSetCreateCommunityFee(uint256 fee)
AdminSetCommunitySettingsFee(uint256 fee)
AdminSetPoolOperationFee(uint256 fee)
AdminAddContract(address indexed c)
AdminRemoveContract(address indexed c)
AdminAddFeeFreeAddress(address indexed feeFree)
AdminRemoveFeeFreeAddress(address indexed feeFree)
```

## Usage Example

```javascript
const committee = new ethers.Contract(committeeAddress, CommitteeABI, signer);

// Read all fees
const [tier1, tier2, tier3] = await Promise.all([
  committee.getCreateCommunityFee(),
  committee.getCommunitySettingsFee(),
  committee.getPoolOperationFee(),
]);

// Check if a factory contract is whitelisted
const isWhitelisted = await committee.verifyContract(factoryAddress);

// Check if a user is fee-free
const isFree = await committee.getFeeFree(userAddress);
```
