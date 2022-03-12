require('dotenv').config();
const ethers = require('ethers');

const CosmosStaking = require('../build/contracts/CosmosStaking.json');

const cosmosPoolId = '0x10fe5a57fc5a4e314a1fbed4a0829c4c00fb5d13'

async function main () {
    let env = {};
    env.url = process.env.TESTENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();

    const pool = new ethers.Contract(cosmosPoolId, CosmosStaking.abi, env.wallet)
    const address = await pool.accountBindMap('0x6a86475c35d1a8faf550977a2503455a9a0c2a20')
    console.log('asdress', address);
}


main()
