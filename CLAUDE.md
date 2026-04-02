# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nutbox Contract is a Solidity-based staking platform for creating community staking economies. It allows users to create communities with custom staking pools (ERC20 staking, ERC1155 staking, SP staking, etc.) and distribute rewards through configurable reward calculators.

**Tech Stack:**
- Solidity ^0.8.20
- Hardhat (primary build/test framework)
- OpenZeppelin Contracts v4.4.1
- Ethers.js v5

## Common Development Commands

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile
# OR
npm run compile

# Run all tests
npx hardhat test
# OR
npm run test

# Run specific test file
npx hardhat test test/test-comprehensive.js

# Run tests with verbose output
npx hardhat test --verbose

# Start local Hardhat node for manual testing
npx hardhat node

# Deploy to local network (in another terminal)
ENDPOINT=http://localhost:8545 KEY=<private_key> GASLIMIT=10000000 GASPRICE=50000000000 node scripts/deploy.js

# Verify contract on Etherscan (after deployment)
npx hardhat verify --network bsc <CONTRACT_ADDRESS> [constructor_args]
```

## Architecture Overview

### Core Contract Hierarchy

```
Committee (Central governance and fee management)
    │
    ├── CommunityFactory (Creates Community instances via clones)
    │       └── Community (Individual staking community)
    │               ├── ERC20Staking (Pool for ERC20 token staking)
    │               ├── ERC20Locking (Pool for ERC20 token locking)
    │               ├── ERC1155Staking (Pool for ERC1155 NFT staking)
    │               └── SPStaking (Pool for Social Power staking)
    │
    ├── LinearCalculator (Reward calculation logic)
    └── MintableERC20Factory (Creates community tokens)
```

### Key Contract Responsibilities

**Committee.sol**
- Central configuration and governance
- Three-tier fee structure:
  - Tier 1: `createCommunityFee` - creating a new community
  - Tier 2: `communitySettingsFee` - admin operations (addPool, closePool, setRatios)
  - Tier 3: `poolOperationFee` - user operations (deposit, withdraw, withdrawRewards)
- Whitelist management for factories and calculators
- Fee-free address list for exemptions

**CommunityFactory.sol**
- Entry point for creating new communities
- Uses OpenZeppelin Clones for gas-efficient community deployment
- Handles both mintable and non-mintable community tokens
- Pays Tier 1 fee on community creation

**Community.sol**
- Core staking economy contract
- Manages multiple staking pools with configurable reward ratios
- Tracks user rewards and debts per pool
- Implements fee ratio (devFund revenue share)
- Key limits: `MAX_ACTIVE_POOLS = 255`
- Emergency functions: `adminWithdrawReward` with user reward protection

**Pool Contracts (ERC20Staking, ERC1155Staking, etc.)**
- Each pool handles a specific asset type
- Users deposit/withdraw staked assets
- Pools call Community.updatePools() to refresh reward state
- Implements Tier 3 fee charging on user operations

**LinearCalculator.sol**
- Defines multi-era reward distribution policies
- Each era: startHeight, stopHeight, amount (rewards per block)
- Only callable by CommunityFactory during community creation

### Security Patterns

**Reentrancy Protection**
- All pool contracts use `ReentrancyGuard` on deposit/withdraw functions
- Community.withdrawPoolsRewards uses `nonReentrant`

**Access Control**
- `Ownable` for admin functions
- `onlyPool` modifier in Community for pool-only operations
- `onlyFactory` in LinearCalculator

**Fee Handling**
- Excess fee refunds after Tier 2/3 charges
- Fee-free list for exempted addresses

**User Fund Protection**
- `totalUserPendingRewards` tracking prevents admin from draining user rewards in `adminWithdrawReward`
- `adminWithdrawRevenue` only withdraws from `retainedRevenue` (fee share, not user rewards)

### Testing Conventions

**Test File Organization**
- `test/test-comprehensive.js` - Full contract test suite (45k+ lines, comprehensive coverage)
- `test/test-cross-reentrancy.js` - Reentrancy attack simulations
- `test/create-community.js` - Test fixture for community deployment
- `test/deploy.js` - Contract deployment utilities for tests

**Running Tests**
```bash
# All tests (takes several minutes)
npx hardhat test

# Specific test file
npx hardhat test test/test-comprehensive.js

# With specific grep pattern
npx hardhat test --grep "Committee"
```

**Common Test Patterns**
- Uses `loadFixture` from `@nomicfoundation/hardhat-network-helpers` for test isolation
- Test accounts: `owner`, `communityOwner`, `alice`, `bob`
- Deployment helper: `deployCommunity()` in `create-community.js`

### Deployment Notes

**Environment Variables** (defined in `.env`):
- `TESTENDPOINT` / `TESTKEY` - Testnet RPC and deployer key
- `MAIN_RPC` / `MAIN_KEY` - Mainnet RPC and deployer key
- `ARB_KEY` - Arbiscan API key for verification
- Various chain RPCs (BSC, ARBITRUM, BASE, etc.)

**Deployment Script** (`scripts/deploy.js`):
- Uses Truffle-style contract artifacts from `build/contracts/` (legacy)
- Also supports Hardhat artifacts
- Deploys full protocol stack: Committee → Factories → Calculators → CommunityFactory
- Outputs deployed addresses in formatted table

**Verify on Arbiscan**:
```bash
npx hardhat verify --network arbitrum <CONTRACT_ADDRESS> [constructor_args]
```

### File Structure Reference

```
contracts/
├── Committee.sol              # Central governance & fee management
├── CommunityFactory.sol       # Creates Community instances
├── Community.sol              # Main staking economy contract
├── CommunityFactory.sol       # Factory for Community creation
├── ERC1155.sol                # Custom ERC1155 implementation
├── ERC20Helper.sol            # ERC20 utility functions
├── calculators/
│   └── LinearCalculator.sol   # Reward distribution logic
├── community-token/
│   ├── MintableERC20.sol      # Mintable community token
│   └── MintableERC20Factory.sol
├── dapps/
│   ├── erc20-staking/         # ERC20 staking pool
│   ├── erc1155-staking/       # ERC1155 NFT staking pool
│   ├── erc20-locking/         # ERC20 locking pool
│   └── sp-staking/            # Social Power staking pool
├── interfaces/                # All interface definitions
└── test/                      # Test helper contracts

test/
├── test-comprehensive.js      # Main test suite
├── test-cross-reentrancy.js   # Reentrancy tests
├── create-community.js        # Test deployment fixture
└── deploy.js                  # Deployment utilities

scripts/
└── deploy.js                  # Production deployment script
```

## Important Implementation Notes

1. **Fee Tier System**: All user operations charge fees based on three tiers. Be aware when modifying fee-related code.

2. **Clone Pattern**: Communities are created via `Clones.clone()` for gas efficiency. The `communityTemplate` is deployed once in `CommunityFactory.constructor()`.

3. **Reward Calculation**: Uses accumulator pattern (`poolAcc`) to efficiently distribute rewards proportional to stake and time.

4. **Reentrancy Guards**: Critical functions (deposit, withdraw, reward withdrawal) all use `nonReentrant` modifier.

5. **Max Pools**: `MAX_ACTIVE_POOLS = 255` is a hard limit due to gas constraints in ratio calculations.

6. **Emergency Withdrawals**: `adminWithdrawReward` has safety checks to prevent draining user pending rewards.
