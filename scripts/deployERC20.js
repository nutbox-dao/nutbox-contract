require('dotenv').config();
const ethers = require('ethers');
const { getEnv, deployContractForce, getGasPrice } = require('./utils');

const ERC20PresetMinterPauser = require('../build/contracts/ERC20PresetMinterPauser.json');

async function main() {
    let env = await getEnv(false);
    await deployContractForce(env, ERC20PresetMinterPauser, ["Cyber Coin","CC"]);

    //Cyber Coin: 0x7132b7eafAC0400b2498F7004f9AAbe68dDaA8B0

    // 0xBd0bd2a7A2755cEb8f5c663b4568eD162B4669e9

    // const cc = new ethers.Contract("0x7132b7eafAC0400b2498F7004f9AAbe68dDaA8B0", ERC20PresetMinterPauser.abi, env.wallet);
    // let gasPrice = await getGasPrice(env);
    // await cc.mint("0xBd0bd2a7A2755cEb8f5c663b4568eD162B4669e9", ethers.utils.parseEther("100000"), { gasPrice });
}

main()
    .catch(console.error)
    .finally(() => process.exit());