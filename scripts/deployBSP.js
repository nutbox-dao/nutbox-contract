require('dotenv').config();
const ethers = require('ethers');

const erc20Json = require('../build/contracts/MintableERC20.json')
const BSPJson = require('../build/contracts/BSP.json');

async function deployTokenContract(env) {
    let factory = new ethers.ContractFactory(BSPJson.abi, BSPJson.bytecode, env.wallet);
    let contract = await factory.deploy(
    );
    await contract.deployed();
    console.log("✓ Token deployed:", contract.address);
    return contract.address;
}
async function main() {
    let env = {};
    env.url = process.env.TESTENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();

    let tx = await deployTokenContract(env);
    // await deployTokenContract(env, 'Ethereum Token', 'ETH');
    // await deployTokenContract(env, 'BEP STEEM', 'STEEM');
    // await deployTokenContract(env, 'BTCB Token', 'BTCB')
}

main()
  .catch(console.error)
  .finally(() => process.exit());