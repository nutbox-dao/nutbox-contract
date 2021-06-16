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
================================================================
Url:        http://localhost:8545
Deployer:   0x03bAb49C10c93f123eeE13b82adc55d1B07C9fb2
Gas Limit:   10000000
Gas Price:   50000000000
Deploy Cost: 0.8435647

Options
=======
Bridge Fee:     0
Bridge Expiry:  10
Fee Addr:       0x03bAb49C10c93f123eeE13b82adc55d1B07C9fb2

Contract Addresses
================================================================
RegistryHub:                        0x30E0b89a526f33395c2b560724b071B3AF158E2c
----------------------------------------------------------------
HomeChainAssetRegistry:             0xecF6B570C569dB9858422d1a9E5C93FDb94D937f
----------------------------------------------------------------
SteemHiveDelegateAssetRegistry:     0x8fCD5AD701b7c1c60dc8548e1492b4Bf0E686758
----------------------------------------------------------------
SubstrateCrowdloanAssetRegistry:    0x51F6a8ef4237b45E771328e6E9E0C977EF295EC0
----------------------------------------------------------------
SubstrateNominateAssetRegistry:     0x7FEBAc047CF3d2538F1Ea5Cd932E4ee66A914536
----------------------------------------------------------------
ERC20AssetHandler:                  0x53212181581FCa0f65Db352a15775486dF338F3C
----------------------------------------------------------------
ERC721AssetHandler:                 Not Deployed
----------------------------------------------------------------
TrustlessAssetHandler:              0xF3746ef2cF02f291da86649B87e773232319f089
----------------------------------------------------------------
Executor:                           0x41a6bE22D454Aa8252c34a511F2Cd2891172eF23
----------------------------------------------------------------
Bridge:                             0xf697A0E388f0b3322eC454a15E8FD828851b7073
----------------------------------------------------------------
StakingFactory:                     0xd679D28925bFD2BBD162d94193FAA87e3C15eC74
================================================================
```