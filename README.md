# Nutbox Contract

## Local Development

### Prerequirements

with ```node```/```truffle```/```ganache``` installed.

### Install Dependencies

`yarn`

### Compile Contracts

`truffle compile`

### Run Tests

`truffle test`

### Deploy contract

Run script ```scripts/deploy.js```:

```sh
ENDPOINT=http://localhost:8545 KEY=<private key> GASLIMIT=10000000 GASPRICE=50000000000 node deploy.js
```

You should see the output like below:

```sh
 ===============================================================
        Url:            https://bsc-dataseed.binance.org
        Deployer:       0x281c93162FB45F06e9d8C1688075640E86bf01ec
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
        ===============================================================
```
### Deployed Contract On BSC
```
  "Committee": "0xd10e4C1e301A13A9B874bd1757c135Eda075769D",
  "MintableERC20Factory": "0xa183D96a7e84BF77Fb7825026fA8b9BF6894cfa8",
  "NutPower": "0x5De2a9993eCcbFab4d83a5dCc0911c0e80A08AbA",
  "CommunityFactory": "0x1A4EeE210Bc54a75D25989546F648474EdF1C0A3",
  "LinearCalculator": "0x6ab448C1C6e1870602d3FB867F167029bbFb3181",
  "SPStakingFactory": "0xF7Fa41BF814eDC767691DDB1864a334D83f4acf7",
  "ERC20StakingFactory": "0xf870724476912057C807056b29c1161f5Fe0199a",
  "CosmosStakingFactory": "0xAD6a0c0017559d051264e1657d627107d6b12f0d",
  "Gauge": "0x6F2686B34D23dCbf79a33A2EEA5e92d84b942d91"
```
### Register chains

- 1: steem(sp delegation)
- 2: hive
- 3: atom
- 4: osmosis
- 5: juno
- 6: steem(sp witness proxy)