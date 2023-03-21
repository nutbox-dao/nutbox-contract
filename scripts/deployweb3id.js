require('dotenv').config();
const ethers = require('ethers');
const { getEnv, deployContract, getContract, waitForTx } = require('../scripts/utils');

const Web3IdJson = require('../build/contracts/Web3Id.json');

async function main() {
    let env = await getEnv();
    await deployContract(env, Web3IdJson);

    let contract = getContract(env, Web3IdJson);
    const tx = await contract.transferOwnership('0x4978f4B200Eed8C47A8174F95444Ae653C48c05F', {
        gasPrice: env.gasPrice
    })
    await waitForTx(env.provider, tx.hash)
}

main()
    .catch(console.error)
    .finally(() => process.exit());