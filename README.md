# Nutbox Contract

## Local Development

### Prerequirements

with ```node```/```hardhat``` installed.

### Install Dependencies

`yarn`

### Compile Contracts

`npx hardhat compile`

#### Test

with ```hardhat``` installed.

```bash
yarn
npx hardhat test
```

#### Verify NUT token

```bash
npx hardhat verify --network base [Nutaddress] [params]
```

### Deploy contract

```npx hardhat run --network base scripts/deploy.js```:


You should see the output like below:

```sh
 ===============================================================
        Url:            https://mainnet.base.org/
        Deployer:       0x2DaE3A44D3C6e9Ab402f6e616ce1d02c1836A6Ac
        Depoly Cost:    0.000115310151086478
        Depoly block number: 20270840

        Contract Addresses:
        ===============================================================
        Committee:              0xBab99d73D20DE32D0f674dA58390b4C904654C19
        ---------------------------------------------------------------
        MintableERC20Factory:   0xa3e53F30C9cc6d174a98b311676e026535326f42
        ---------------------------------------------------------------
        NutPower:               0x57A9D7630CC5Fd5000EE93D66b1Db121B9785832
        ---------------------------------------------------------------
        CommunityFactory:       0x4e00a9ab92876B8F5AdB07D607aE2B8b257CF856
        ---------------------------------------------------------------
        LinearCalculator:       0xe2999e0d2976e2A5c41ae38202Df98f82cb87f7f
        ---------------------------------------------------------------
        SPStakingFactory:       0xDFEDa0D7bddcFBB7Ba70a463fAa355A9f07c7c10
        ---------------------------------------------------------------
        ERC20StakingFactory:    0x88505421EAA5A4542154bCcEe935f3E6afFe3BfD
        ---------------------------------------------------------------
        ERC1155StakingFactory:  0xd9Ee5A42C75Cc07f27Df9F4EE12D462715475A4f
        ---------------------------------------------------------------
        CosmosStakingFactory:   Not Deployed
        ---------------------------------------------------------------
        Gauge:                  0x238f82F5384f0d01300F857438237F2E150305A0
        ---------------------------------------------------------------
        TreasuryFactory:        0xda1b043B758cB8563cD612074513dD5c684882fC
        ===============================================================
```
### Deployed Contract On Base
```
  "Committee": "0xBab99d73D20DE32D0f674dA58390b4C904654C19",
  "MintableERC20Factory": "0xa3e53F30C9cc6d174a98b311676e026535326f42",
  "NutPower": "0x57A9D7630CC5Fd5000EE93D66b1Db121B9785832",
  "CommunityFactory": "0x4e00a9ab92876B8F5AdB07D607aE2B8b257CF856",
  "LinearCalculator": "0xe2999e0d2976e2A5c41ae38202Df98f82cb87f7f",
  "SPStakingFactory": "0xDFEDa0D7bddcFBB7Ba70a463fAa355A9f07c7c10",
  "ERC20StakingFactory": "0x88505421EAA5A4542154bCcEe935f3E6afFe3BfD",
  "ERC1155StakingFactory": "0xd9Ee5A42C75Cc07f27Df9F4EE12D462715475A4f",
  "CosmosStakingFactory": "Not Deployed",
  "Gauge": "0x238f82F5384f0d01300F857438237F2E150305A0",
  "TreasuryFactory": "0xda1b043B758cB8563cD612074513dD5c684882fC",
  "deployer": "0x2DaE3A44D3C6e9Ab402f6e616ce1d02c1836A6Ac",
  "feeAddress": "0x06Deb72b2e156Ddd383651aC3d2dAb5892d9c048",
  "NUT": "0xA643e598364A9dFB3328aD2E70AF6f9E3C477A42"

```
### Register chains

- 1: steem(sp delegation)
- 2: curation gauge
