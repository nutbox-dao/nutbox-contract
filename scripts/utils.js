const ethers = require('ethers');
const fs = require('fs')
const path = require('path')

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

async function getEnv(expand = true) {
    let env = {};
    env.url = process.env.LOCAL_RPC || process.env.TEST_RPC || process.env.MAIN_RPC;
    env.privateKey = process.env.LOCAL_KEY || process.env.TEST_KEY || process.env.MAIN_KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);

    // env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();
    if (expand)
        env.gasPrice = (env.gasPrice * 1.2).toFixed(0);
    // console.log(`url: ${env.url}, gasLimit: ${process.env.GASLIMIT}, gasPrice: ${env.gasPrice}`);
    let balance = await env.wallet.getBalance();
    env.chainId = env.provider._network.chainId;
    console.log(`url: ${env.url}, address: ${env.wallet.address}, balance:${ethers.utils.formatEther(balance)}, gasPrice: ${env.gasPrice}, chainId: ${env.chainId}`);
    return env;
}

async function getGasPrice(env) {
    let gasPrice = await env.provider.getGasPrice();
    if (env.chainId == 137) {
        gasPrice = (gasPrice * 1.2).toFixed(0);
    }
    return gasPrice;
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

function link(bytecode, libraryName, libraryAddress) {
    const regex = new RegExp(`__${libraryName}_+`, "g");
    // console.log("bytecode: ", ethers.utils.keccak256(ethers.utils.toUtf8Bytes(bytecode)));
    let linkedBytecode = bytecode.replace(regex, libraryAddress.replace("0x", ""));
    // console.log("linkedBytecode: ", ethers.utils.keccak256(ethers.utils.toUtf8Bytes(linkedBytecode)));
    return linkedBytecode;
}

function saveJson(buildJson, chainId, address, transactionHash) {
    if (chainId in buildJson.networks) {
        buildJson.networks[chainId]['address'] = address;
        buildJson.networks[chainId]['transactionHash'] = transactionHash;
    } else {
        buildJson.networks[chainId] = { address, transactionHash };
    }
    let dir = path.join(__dirname, `../build/contracts/${buildJson.contractName}.json`);
    let obj = JSON.stringify(buildJson, null, 2);
    fs.writeFileSync(dir, obj, 'utf8');
}

async function deployContract(env, buildJson, params = [], links = [], force = false, nosave = false) {
    let chainId = env.chainId;
    let contract;
    let needDeploy = false;
    if (!force && chainId in buildJson.networks) {
        let address = buildJson.networks[chainId].address;
        contract = new ethers.Contract(address, buildJson.abi, env.wallet);
        try {
            await contract.deployed();
            console.log("\n=====================================");
            console.log(`${buildJson.contractName} Contract: `, contract.address);
            console.log("TransactionHash: ", buildJson.networks[chainId].transactionHash);
            return;
        } catch (e) {
            if (e.message.startsWith("contract not deployed ")) {
                needDeploy = true;
            } else {
                throw e;
            }
        }
    } else {
        needDeploy = true;
    }

    let bytecode = buildJson.bytecode;
    for (let lib of links) {
        bytecode = link(bytecode, lib.contractName, lib.networks[chainId].address);
    }
    let factory = new ethers.ContractFactory(buildJson.abi, bytecode, env.wallet);
    let gasPrice = await getGasPrice(env);
    if (params instanceof Array && params.length > 0) {
        contract = await factory.deploy(...params, { gasPrice });
    } else {
        contract = await factory.deploy({ gasPrice });
    }

    await contract.deployed();
    if (!nosave) {
        saveJson(buildJson, chainId, contract.address, contract.deployTransaction.hash);
    }
    console.log("\n=====================================");
    console.log(`${buildJson.contractName} Contract: `, contract.address);
    console.log("TransactionHash: ", contract.deployTransaction.hash);
}

async function deployContractForce(env, buildJson, params = [], links = [], nosave = true) {
    await deployContract(env, buildJson, params, links, true, nosave)
}

module.exports = {
    sleep,
    waitForTx,
    utf8ToHex,
    getEnv,
    advanceTime,
    getGasPrice,
    deployContract,
    deployContractForce
}
