# Nutbox Contract

This is a new version of Nutbox contract. Added new Social Curation feature. Upgrade distribution calculator.

## Local Development

### Prerequirements

with ```node```/```hardhat``` installed.

### Install Dependencies

`yarn` or `npm install`

### Compile Contracts

`npx hardhat compile`

### Deploy contract

使用 Hardhat Ignition 部署到 BSC：

```sh
npm run deploy:bsc:no-verify
# 或带链上验证：npm run deploy:bsc
```

### Deployed contracts on BSC (mainnet, chainId 56)

```json
{
  "Committee": "0xe10F967DD356504EDB731612789D0D0f0ba2929f",
  "MintableERC20Factory": "0x9979989709cE98715f2cA831C4FDb73b22d0408c",
  "CommunityFactory": "0x5597e814399906095ecaA5769A40394F58E5E0Cf",
  "ERC1155StakingFactory": "0x398eA6Db014595F23d0C9Cb1390a10472cdD43BA",
  "ERC20LockingFactory": "0x8189a03Cfa3d8919a2eb8f08E4f88c21Cf78cA01",
  "ERC20StakingFactory": "0xDc3f940ac6Da516d5C9cc59c8AFE0F85A576E2A4",
  "LinearCalculator": "0x5114966657Bd6209B47aa16eaa4EAfbbC9595ec0",
  "LinearTimeCalculator": "0xc76e00e150e13EC95514E9a52Ab0314c7faE8207",
  "SPStakingFactory": "0x47738e3420Be8ceD8a9476cf4dAf84c549835D44",
  "SocialCurationFactory": "0xc4674D3fBbD201Ea401a8B7e7285F956178593D8",
  // templates
  "communityTokenTemplate": "0xE3249CcD0555AD47aF63F7D9Caa4cD38011ECC71",
  "communityTemplate": "0xA16a34B8996737489b014be951352B9542A466dB",
  "erc1155StakingTemplate": "0x9ef60E4d0FE0c54a4F7CA4eC6c90A9fE52E91a3C",
  "erc20LockingTemplate": "0x4d17B8d34FB52Aef2de3cb48563b2D35F52B2bFF",
  "erc20StakingTemplate": "0x29beeE04fAE28BB9901A7C1c63e9a868F70a035f",
  "spStakingTemplate": "0xC57522bC1d6b584B13aF2031eA631C3f9e76EDAf",
  "socialCurationTemplate": "0x80F604a65fc475062ae782F43ab3fe9424B66B55 ",
}
```
### Deployed contracts on BSC (testnet, chainId 97)



#### Test

with ```hardhat``` installed.

```bash
yarn
npx hardhat test
```
