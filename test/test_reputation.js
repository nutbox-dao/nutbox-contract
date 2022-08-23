require('dotenv').config();
const ethers = require('ethers');

const ReputationJson = require('../build/contracts/Reputation.json');
const account = "0x145F356161c7F698f13d7d4C9f4395176a4fC4AA";

async function main() {
    let env = {};
    env.privateKey = "0xe8855ef01333d86172855f84038a7d23c19425ff5e9b3816da5ac1bb1e30cebb";
    env.provider = new ethers.providers.JsonRpcProvider("https://bsctestapi.terminet.io/rpc");
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);

    let contract = new ethers.Contract("0xBbCf128A39c0cA8a6355F3cD1EF75aaa657B16B2", ReputationJson.abi, env.wallet);

    let nftId = 1000;
    let supplys = await contract.supplysOf(nftId);
    console.log("supplys: ", supplys.toString());
    // let hash = await contract.mint(account, nftId, 5, "0x00");
    // console.log("hash: ", hash);
    // supplys = await contract.supplysOf(nftId);
    // console.log("supplys: ", supplys.toString());

    let balance = await contract.balanceOf(account, nftId);
    console.log("balance: ", balance.toNumber());
}

main();