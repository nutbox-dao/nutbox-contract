# Nutbox Contract

## Local Development

### Prerequirements

with ```node```/```truffle```/```ganache``` installed.

### Install Dependencies

`yarn`

### Compile Contracts

`truffle compile`

### Deploy contract

Run script ```scripts/deploy.js```:

```sh
ENDPOINT=http://localhost:8545 KEY=<private key> GASLIMIT=10000000 GASPRICE=50000000000 node deploy.js
```

You should see the output like below:

```sh
 ===============================================================
        Url:            https://arb1.arbitrum.io/rpc
        Deployer:       0x2DaE3A44D3C6e9Ab402f6e616ce1d02c1836A6Ac
        Depoly Cost:    0.069551005
        Depoly block number: 15414978

        Contract Addresses:
        ===============================================================
        Committee:              0xd10e4C1e301A13A9B874bd1757c135Eda075769D
        ---------------------------------------------------------------
        MintableERC20Factory: 0xa183D96a7e84BF77Fb7825026fA8b9BF6894cfa8
        ---------------------------------------------------------------
        CommunityFactory:       0x1A4EeE210Bc54a75D25989546F648474EdF1C0A3
        ---------------------------------------------------------------
        LinearCalculator:       0x6ab448C1C6e1870602d3FB867F167029bbFb3181
        ---------------------------------------------------------------
        SPStakingFactory:       0xF7Fa41BF814eDC767691DDB1864a334D83f4acf7
        ---------------------------------------------------------------
        ERC20StakingFactory:     0xf870724476912057C807056b29c1161f5Fe0199a
        ---------------------------------------------------------------
        ERC1155StakingFactory:  0x76303Be21ef601e68639B541B035ca33d247b5FE
        ===============================================================
```
### Deployed Contract On Arbitrum
```
  "Committee": "0x4C5e687CE5a365ce7bE9E536cf617D3D08Aadde3",
  "MintableERC20Factory": "0x1320A00303435250c23F06E3a2383a6c1174C9FB",
  "NutPower": "0x7e109A3a696367c0527E15eDb815F549E637C39b",
  "CommunityFactory": "0xDB1d3a43B19d0E95EE4fA16486350434A15e8c86",
  "LinearCalculator": "0xa3e53F30C9cc6d174a98b311676e026535326f42",
  "SPStakingFactory": "0x37921DB31E88e80AC43fD285AE60230065b9E87C",
  "ERC20StakingFactory": "0x7Be1085298446c041f72db9f50cd3953638B023a",
  "ERC1155StakingFactory": "0xBab99d73D20DE32D0f674dA58390b4C904654C19",
  "CosmosStakingFactory": "0x8Ea8870001216429f72CEA80fEE576dfe883E5bD",
  "Gauge": "0x57A9D7630CC5Fd5000EE93D66b1Db121B9785832",
  "TreasuryFactory": "0x4e00a9ab92876B8F5AdB07D607aE2B8b257CF856",
  "NutAddress": "0xED4D88303973615cC3D61D5F4D06A809055a07b8"
```

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
