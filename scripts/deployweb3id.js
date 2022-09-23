require('dotenv').config();
const ethers = require('ethers');

const Web3IdJson = require('../build/contracts/Web3Id.json');

async function deployWeb3IdContract(env) {
    let factory = new ethers.ContractFactory(Web3IdJson.abi, Web3IdJson.bytecode, env.wallet);
    let contract = await factory.deploy({
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ Web3Id contract deployed", contract.address);
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

    const tx = await deployWeb3IdContract(env)
    
    console.log(tx.hash);
}

main()
  .catch(console.error)
  .finally(() => process.exit());