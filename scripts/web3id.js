require('dotenv').config();
const ethers = require('ethers');

const Web3IdJson = require('../build/contracts/Web3Id.json');

const web3id = '0xd500368843318aD3c144a844276D867856799c3b'


async function main () {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();

    const pool = new ethers.Contract(web3id, Web3IdJson.abi, env.wallet)
    const tx = await pool.adminSetAccount('1429998452444827649', 'caylachen')
    console.log('asdress', tx.hash);
}

main()
