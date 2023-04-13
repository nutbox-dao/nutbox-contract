require('dotenv').config();
const ethers = require('ethers');
const { getEnv, deployContract } = require('./utils');

const AutoCurationJson = require('../build/contracts/AutoCuration.json');
const ERC20PresetMinterPauser = require('../build/contracts/ERC20PresetMinterPauser.json');


async function main() {
    let cAddr = '0x705931A83C9b22fB29985f28Aee3337Aa10EFE11';
    let sAddr = '0x4A584E33Dec216a124E36Aceb0B06Bc37642027B';
    let env = await getEnv(false);
    if (env.chainId == 1337) {
        cAddr = await deployContract(env, ERC20PresetMinterPauser, ["Test USDT", "USDT"]);
        sAddr = env.wallet.address;

    }
    // old 0x0A94b254600Db498e6d36866E6f3911c854671De
    let newc = await deployContract(env, AutoCurationJson, [env.chainId, sAddr, cAddr]);
    if (env.chainId == 1337) {
        const cc = new ethers.Contract(cAddr, ERC20PresetMinterPauser.abi, env.wallet);
        await cc.mint(newc, ethers.utils.parseEther("30000"));
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit());