require('dotenv').config();
const CrowdloanJson = require('../build/contracts/Crowdloan.json')
const { waitForTx } = require('./utils')
const poolId = "0x1cdd0c680b6352944a8958bcb84e1adef73497f6"
const ethers = require('ethers')

async function main() {
    let env = {}
    env.url = process.env.TESTENDPOINT;
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);

    const contract = new ethers.Contract(poolId, CrowdloanJson.abi, env.wallet)

    const tx = await contract.contribute(0, 2030, 37, '0xFaaED960DC4Ec4dC2F3B908133c461692c2C7629',
    50000000000, '0xb4c2d85af77e08791bfda9ac64936e23ffa718b5e255e30c34f7c1cbc7350830')
    await waitForTx(env.provider, tx.hash)
}

main()