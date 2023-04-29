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
        ---------------------------------------------------------------
        ERC1155StakingFactory:  0x76303Be21ef601e68639B541B035ca33d247b5FE
        ===============================================================
```
### Deployed Contract On BSC
```
  "Committee": "0x4801C5D106445446a10011b8b06CcC35d8b895C6",
  "MintableERC20Factory": "0xCebC421C209D1c4E7F3061e9ea3384bca14C5761",
  "NutPower": "0x673CD0a416E544DBdEBec9004FFe4d8D26c1CB6c",
  "CommunityFactory": "0xb54c72f79677a3bb6A9Cd50319EE56C8B1828753",
  "LinearCalculator": "0xb035C2bD1F0D2f36d78B9161Ca8F04aA81DCD20E",
  "SPStakingFactory": "0xAEF7648Dac07CD8Fe997F9740d3ac2e2983154cc",
  "ERC20StakingFactory": "0xb71A12De824B837eCD30D41384e80C8CDFb5D694",
  "ERC1155StakingFactory": "0xC4f7E12435a9760D5470e7c059Cd997A56636e6a",
  "CosmosStakingFactory": "0xECB3d70B557609C9F86295A167601aCBfBFA4C70",
  "Gauge": "0x01a686E3B17C97E6209a1A7B25D49F9D36ad6Ab1",
  "TreasuryFactory": "0x4a9ADE2cbC664a93A71283332b739308d7a3E887"
```
### Register chains

- 1: steem(sp delegation)
- 2: hive
- 3: atom
- 4: osmosis
- 5: juno
- 6: steem(sp witness proxy)