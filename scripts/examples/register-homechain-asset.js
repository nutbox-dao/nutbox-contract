// USAGE: 
//  ENDPOINT=http://localhost:8545 KEY=<private key> GASLIMIT=10000000 GASPRICE=50000000000 node deploy.js

require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('../utils.js');
const RegistryHubJson = require('../../build/contracts/RegistryHub.json');
const HomeChainAssetRegistryJson = require('../../build/contracts/HomeChainAssetRegistry.json');
const SimpleERC20Json = require('../../build/contracts/SimpleERC20.json');

const RegistryHubAddress = '0x30E0b89a526f33395c2b560724b071B3AF158E2c';
const HomeChainAssetRegistryAddress = '0xecF6B570C569dB9858422d1a9E5C93FDb94D937f';

async function deployERC20(env) {
    const factory = new ethers.ContractFactory(SimpleERC20Json.abi, SimpleERC20Json.bytecode, env.wallet);
    const contract = await factory.deploy(
        "TestCoin", "TC", ethers.BigNumber.from('1000000000'), env.wallet.address,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    env.simpleERC20Contract = contract.address;
    console.log("✓ Simple ERC20 contract deployed");
}

async function setWhitelist(env) {
    const RegistryHub = new ethers.Contract(RegistryHubAddress, RegistryHubJson.abi, env.wallet);
    const tx = await RegistryHub.setWhiteList(
        HomeChainAssetRegistryAddress,
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx.hash);
}

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = ethers.utils.hexlify(Number(process.env.GASPRICE));

    // deploy erc20 contract
    await deployERC20(env);

    await setWhitelist(env);

    const HomeChainAssetRegistry = new ethers.Contract(
        HomeChainAssetRegistryAddress, HomeChainAssetRegistryJson.abi, env.wallet
    );
    const tx = await HomeChainAssetRegistry.registerAsset(
        '0x', env.simpleERC20Contract, '0x',
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await waitForTx(env.provider, tx.hash);
}

main()
  .catch(console.error)
  .finally(() => process.exit());
