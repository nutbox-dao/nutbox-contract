require('dotenv').config();
const ethers = require('ethers');
const { waitForTx } = require('./utils.js');

const BridgeJson= require('../build/contracts/Bridge.json');
const Contracts = require('./contracts.json');

const BridgeAddress = Contracts.Bridge;
const RELAYER = '0x86a6b23bfaa35e3605bda8c091d3ca52b7e985f8';

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = ethers.utils.hexlify(Number(process.env.GASPRICE));

    const Bridge = new ethers.Contract(BridgeAddress, BridgeJson.abi, env.wallet);
    const tx1 = await Bridge.adminAddRelayer(RELAYER, { gasPrice: env.gasPrice, gasLimit: env.gasLimit});
    await waitForTx(env.provider, tx1.hash);
    console.log(`Set ${RELAYER} as relayer successfully.`);
}

main()
  .catch(console.error)
  .finally(() => process.exit());
