
require('dotenv').config();
const ethers = require('ethers');
const { getEnv, deployContract } = require('../scripts/utils');
const web3idABI = require("../build/contracts/Web3Id.json");


async function main(){
    let env = await getEnv(false);
    await deployContract(env, web3idABI);

    const web3id = new ethers.Contract(web3idABI.networks[env.chainId].address, web3idABI.abi, env.wallet);

    await web3id.adminSetAccount(123,"0xb63f4319C3c837775A12B274232C72Ca64e28998","123s");

    await web3id.adminSetAccount(123,"0xa5cFD7b0191C2375fD83D6a2B4bB7BF838439fdA","124s");

    let a = await web3id.twitterMap(123);
    let b = await web3id.getSteemMap("123s");
    console.log(a,b);
}

main();