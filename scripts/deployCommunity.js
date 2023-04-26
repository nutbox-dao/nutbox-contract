require('dotenv').config();
const ethers = require('ethers');
const { getEnv, deployContract } = require('./utils');

const CommunityCuration = require('../build/contracts/CommunityCuration.json');
const ERC20PresetMinterPauser = require('../build/contracts/ERC20PresetMinterPauser.json');


async function main() {
    let env = await getEnv(false);
    await deployContract(env, CommunityCuration);
    if (env.chainId == 1337) {
        await deployContract(env, ERC20PresetMinterPauser, ["Test USDT", "USDT"]);
    }
}


main()
    .catch(console.error)
    .finally(() => process.exit());