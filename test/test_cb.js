require('dotenv').config();
const ethers = require('ethers');
const { getEnv } = require('../scripts/utils');
const BlessCard = require("../build/contracts/BlessCard.json");



async function main() {
    let env = await getEnv();
    chainId = env.provider._network.chainId;
    let blessCardNFT = new ethers.Contract(BlessCard.networks[chainId].address, BlessCard.abi, env.wallet);
    await blessCardNFT.mint("0x69d9da0132aB74b38D286bDCB0Cb490bAd67baF9", 2, 10, "0x00", { gasPrice: env.gasPrice });
}

main().catch(console.log)