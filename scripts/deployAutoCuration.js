require('dotenv').config();

const { getEnv, deployContract } = require('./utils');

const AutoCurationJson = require('../build/contracts/AutoCuration.json');


async function main() {
    let env = await getEnv(false);
    await deployContract(env, AutoCurationJson,
        [env.chainId, "0x4A584E33Dec216a124E36Aceb0B06Bc37642027B", "0x705931A83C9b22fB29985f28Aee3337Aa10EFE11"]);
}

main()
    .catch(console.error)
    .finally(() => process.exit());