const ethers = require('ethers');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const waitForTx = async (provider, hash) => {
    console.log(`\tWaiting for tx: ${hash} ...`)
    while (!await provider.getTransactionReceipt(hash)) {
        sleep(3000)
    }
}

function utf8ToHex(str) {
    return Array.from(str).map(c =>
        c.charCodeAt(0) < 128 ? c.charCodeAt(0).toString(16) :
            encodeURIComponent(c).replace(/\%/g, '').toLowerCase()
    ).join('');
}

async function getEnv() {
    let env = {};
    env.url = process.env.LOCAL_RPC || process.env.TEST_RPC || process.env.MAIN_RPC;
    env.privateKey = process.env.LOCAL_KEY || process.env.TEST_KEY || process.env.MAIN_KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    // env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();
    // console.log(`url: ${env.url}, gasLimit: ${process.env.GASLIMIT}, gasPrice: ${env.gasPrice}`);
    console.log(`url: ${env.url}, address: ${env.wallet.address}, gasPrice: ${env.gasPrice}`);
    return env;
}

async function advanceTime(env, second) {
    let time = parseInt(new Date().getTime() / 1000) + second;
    // console.log("time: ", time);
    if (env.url == process.env.LOCAL_RPC) {
        let result = await env.provider.send("evm_setTime", [time]);
        result = await env.provider.send("evm_mine");
    } else {
        await sleep(second * 1000);
    }
}

module.exports = {
    sleep,
    waitForTx,
    utf8ToHex,
    getEnv,
    advanceTime
}
