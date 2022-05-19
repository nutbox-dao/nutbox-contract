const CosmosStakingJson = require('../build/contracts/CosmosStaking.json')
const CosmosStakingFactoryJson = require('../build/contracts/CosmosStakingFactory.json')
const SPStakingJson = require('../build/contracts/SPStaking.json')
const SPStakingFactoryJson = require('../build/contracts/SPStakingFactory.json')
const ethers = require('ethers');
const { waitForTx } = require('./utils');
require('dotenv').config();

const pools = ['0x6dc7d11fe619ff8a32d77f8da8c1a7b5caa669ae', '0xbee279d178b18eb3db60fd39a61dd4e1d34ebb8a', '0x2a5ee922d367934fee5ad0137985dd8e5a5be28e']
const steemPools = ['0xcb08c32d03976ad8f865fca4ea3cb651ae4732b9', '0xbb06de18630ef1eeedcbbeea050f9ebafc68d586']
async function main() {
    let env = {}
    env.url = process.env.TESTENDPOINT;
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasPrice = await env.provider.getGasPrice();

    let tx;
    // const factory = new ethers.Contract('0xbe1709B3D175aaecA132BEA8630063E99f090D68', CosmosStakingFactoryJson.abi, env.wallet)
    // tx = await factory.adminAddBridge(3, env.wallet.address)
    // await waitForTx(env.provider, tx.hash)

    // return;

    // const p1 = new ethers.Contract(pools[0], CosmosStakingJson.abi, env.wallet)
    // tx =await p1.update(3, '0x8df9fcbcc63a18290d10582585bece22137f59af', '0x8df9fcbcc63a18290d10582585bece22137f59af', 1e8, env.wallet.address)
    // await waitForTx(env.provider, tx.hash)

    // const p2 = new ethers.Contract(pools[1], CosmosStakingJson.abi, env.wallet)
    // tx = await p2.update(3, '0x8df9fcbcc63a18290d10582585bece22137f59af', '0x8df9fcbcc63a18290d10582585bece22137f59af', 1e8, env.wallet.address)
    // await waitForTx(env.provider, tx.hash)

    // const p3 = new ethers.Contract(pools[2], CosmosStakingJson.abi, env.wallet)
    // tx = await p3.update(3, '0x8df9fcbcc63a18290d10582585bece22137f59af', '0x8df9fcbcc63a18290d10582585bece22137f59af', 1e8, env.wallet.address)
    // await waitForTx(env.provider, tx.hash)

    // const spFactory = new ethers.Contract('0x9Df9D7412E4462AA863A35B54142d1D35F07b214', SPStakingFactoryJson.abi, env.wallet)
    // tx = await spFactory.adminSetBridge(env.wallet.address)
    // await waitForTx(env.provider, tx.hash)

    const p4 = new ethers.Contract(steemPools[0], SPStakingJson.abi, env.wallet)
    tx = await p4.update(1, '0x7465727279337400000000000000000000000000000000000000000000000000', '0x8B877223BCBF178dF8f34Fe07511be46F7b76EB1', 1e10, '0x7465727279347400000000000000000000000000000000000000000000000000')
    await waitForTx(env.provider, tx.hash)

    const p5 = new ethers.Contract(steemPools[1], SPStakingJson.abi, env.wallet)
    tx = await p5.update(1, '0x7465727279337400000000000000000000000000000000000000000000000000', '0x8B877223BCBF178dF8f34Fe07511be46F7b76EB1', 1e10, '0x7465727279347400000000000000000000000000000000000000000000000000')
    await waitForTx(env.provider, tx.hash)


}

main()