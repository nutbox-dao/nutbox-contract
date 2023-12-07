require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx } = require('../scripts/utils');

const Curation = require("../build/contracts/Curation.json");


async function main() {
    let env = await getEnv(false);

    let cCuration = new ethers.Contract(Curation.networks[env.chainId].address, Curation.abi, env.wallet);

    console.log("signer: ", env.wallet.address);

    let twitterId = 123;
    let curationIds = [123, 234, 345, 456];
    let amounts = [10, 100, 1000, 10000];

    let data = ethers.utils.solidityKeccak256(["uint256", "uint256", "address", "uint256[]", "uint256[]"], [twitterId, 137, env.wallet.address, curationIds, amounts]);

    console.log("data: ", data.length, data);

    data = ethers.utils.arrayify(data);
    console.log("hashmsg: ", ethers.utils.hashMessage(data));

    let sign = await env.wallet.signMessage(data);
    console.log("sign: ", sign.length, sign);

    let sig = ethers.utils.splitSignature(sign);
    console.log("sig: ", sig);

    await cCuration.claimPrize(twitterId, env.wallet.address, curationIds, amounts, sign);
}

async function main2() {
    let abi = [{ "type": "function", "name": "claimPrize", "inputs": [{ "name": "twitterId", "type": "uint256", "internalType": "uint256" }, { "name": "addr", "type": "address", "internalType": "address" }, { "name": "orderId", "type": "uint256", "internalType": "uint256" }, { "name": "amount", "type": "uint256", "internalType": "uint256" }, { "name": "sign", "type": "bytes", "internalType": "bytes" }], "outputs": [], "stateMutability": "nonpayable" }, { "type": "function", "name": "claimPrize2", "inputs": [{ "name": "twitterId", "type": "uint256", "internalType": "uint256" }, { "name": "addr", "type": "address", "internalType": "address" }, { "name": "orderId", "type": "uint256", "internalType": "uint256" }, { "name": "amount", "type": "uint256", "internalType": "uint256" }, { "name": "sign", "type": "bytes", "internalType": "bytes" }], "outputs": [], "stateMutability": "nonpayable" }, { "type": "function", "name": "claimPrize3", "inputs": [{ "name": "hash", "type": "bytes32", "internalType": "bytes32" }, { "name": "sign", "type": "bytes", "internalType": "bytes" }], "outputs": [], "stateMutability": "nonpayable" }, { "type": "function", "name": "count", "inputs": [], "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }], "stateMutability": "view" }, { "type": "function", "name": "signAddress", "inputs": [], "outputs": [{ "name": "", "type": "address", "internalType": "address" }], "stateMutability": "view" }];
    let env = await getEnv(false);

    let cCuration = new ethers.Contract("0x3Aa5ebB10DC797CAC828524e59A333d0A371443c", abi, env.wallet);

    console.log("signer: ", env.wallet.address);

    let twitterId = "123";
    let curationId = "123";
    let amount = "10000";

    let data = ethers.utils.solidityKeccak256(["uint256", "address", "uint256", "uint256"], [twitterId, env.wallet.address, curationId, amount]);
    data = ethers.utils.arrayify(data)

    console.log("data: ", data.length, data);

    data = ethers.utils.arrayify(data);
    console.log("hashmsg: ", ethers.utils.hashMessage(data));

    let sign = await env.wallet.signMessage(data);
    console.log("sign: ", sign.length, sign);

    let sig = ethers.utils.splitSignature(sign);
    console.log("sig: ", sig);

    // await cCuration.claimPrize2(twitterId, env.wallet.address, curationId, amount, sign);
    await cCuration.claimPrize3(ethers.utils.hashMessage(data), sign);
}


main2()
    .catch(console.error)
    .finally(() => process.exit());

