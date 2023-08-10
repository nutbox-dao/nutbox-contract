# Nutbox Contract

## Local Development

### Prerequirements

with ```node```/```ganache```/```hardhat``` installed.

### Install Dependencies

`yarn`

### Compile Contracts

`npx hardhat compile`

### Deploy contract

```npx hardhat run --network linea scripts/deploy.js```:


You should see the output like below:

```sh
        ===============================================================
        Url:            https://arb1.arbitrum.io/rpc
        Deployer:       0x2DaE3A44D3C6e9Ab402f6e616ce1d02c1836A6Ac
        Depoly Cost:    0.0
        Depoly block number: 119874541

        Contract Addresses:
        ===============================================================
        Committee:              0x24B2c677575286993Be95147B4896d83cE02Dc4e
        ---------------------------------------------------------------
        MintableERC20Factory:   0x183434ba0726b244521cB1C46AE5C90538146db8
        ---------------------------------------------------------------
        NutPower:               0xFe992EF5f73Ac289052F1742B918278a62686fD1
        ---------------------------------------------------------------
        CommunityFactory:       0x420E3b63F2587702B0BCdc50aF948cF387515593
        ---------------------------------------------------------------
        LinearCalculator:       0xF21649D901A082772Bd7B5d5eD5039C7a43A5789
        ---------------------------------------------------------------
        SPStakingFactory:       0x20ABc409b7dc7a6DC8cC1309A5A7DBb5B1c0D014
        ---------------------------------------------------------------
        ERC20StakingFactory:    0x8d7F753D3b3862169d9eee500de3F7220103eAAd
        ---------------------------------------------------------------
        ERC1155StakingFactory:  0xf6DDd65295Ca7A672C34043aa62f32C01FBfb29D
        ---------------------------------------------------------------
        CosmosStakingFactory:   0x5A95D35579C3aaF7F1df86540286A9DD90506F00
        ---------------------------------------------------------------
        Gauge:                  0x97e9ca88Eb99bAA07d15B8aB846c53886FDB2f74
        ---------------------------------------------------------------
        TreasuryFactory:        0xb05C38625f7F8CCab519421E5263f164D8F431f2
        ===============================================================
```
### Deployed Contract On Linea
```
  "Committee": "0x24B2c677575286993Be95147B4896d83cE02Dc4e",
  "MintableERC20Factory": "0x183434ba0726b244521cB1C46AE5C90538146db8",
  "NutPower": "0xFe992EF5f73Ac289052F1742B918278a62686fD1",
  "CommunityFactory": "0x420E3b63F2587702B0BCdc50aF948cF387515593",
  "LinearCalculator": "0xF21649D901A082772Bd7B5d5eD5039C7a43A5789",
  "SPStakingFactory": "0x20ABc409b7dc7a6DC8cC1309A5A7DBb5B1c0D014",
  "ERC20StakingFactory": "0x8d7F753D3b3862169d9eee500de3F7220103eAAd",
  "ERC1155StakingFactory": "0xf6DDd65295Ca7A672C34043aa62f32C01FBfb29D",
  "CosmosStakingFactory": "0x5A95D35579C3aaF7F1df86540286A9DD90506F00",
  "Gauge": "0x97e9ca88Eb99bAA07d15B8aB846c53886FDB2f74",
  "TreasuryFactory": "0xb05C38625f7F8CCab519421E5263f164D8F431f2"
```
### Register chains

- 1: steem(sp delegation)
- 2: hive
- 3: atom
- 4: osmosis
- 5: juno
- 6: steem(sp witness proxy)
- 7: curation gauge

#### Test

with ```hardhat``` installed.

```bash
yarn
npx hardhat test
```