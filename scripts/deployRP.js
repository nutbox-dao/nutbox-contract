require('dotenv').config();
const ethers = require('ethers');

const ReputationJson = require('../build/contracts/Reputation.json');

async function deployRPContract(env) {
    let factory = new ethers.ContractFactory(ReputationJson.abi, ReputationJson.bytecode, env.wallet);
    let contract = await factory.deploy('https://test.web3id.pro', {
        gasPrice: env.gasPrice
    });
    await contract.deployed();
    console.log("✓ Reputation contract deployed", contract.address);
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

    const tx = await deployRPContract(env)
    
    console.log(tx.hash);
}

main()
  .catch(console.error)
  .finally(() => process.exit());