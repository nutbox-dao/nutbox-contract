require('dotenv').config();
const ethers = require('ethers');
const { waitForTx, sleep } = require('./utils')

const Web3IdJson = require('../build/contracts/Web3Id.json');

const web3id = '0xc19100159c7f6C723152842d00f9F01487Ab85aA'

const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6'
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000'
const TRANSFER_ROLE = '0x8502233096d909befbda0999bb8ea2f3a6be3c138b9fbf003752a4c8bce86f6c'
const BURN_ROLE = '0xe97b137254058bd94f28d2f3eb79e2d34074ffb488d042e3bc958e0a57d2fa22'

async function main () {
    let env = {};
    env.url = process.env.TESTENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();
    console.log(2354, env.gasPrice.toString());

    const pool = new ethers.Contract(web3id, Web3IdJson.abi, env.wallet)
    const tx = await pool.transferOwnership('0x4978f4B200Eed8C47A8174F95444Ae653C48c05F', {
        gasPrice: 50000000000
    })
    await waitForTx(env.provider, tx.hash)
    console.log('asdress', tx.hash);
}

main()
