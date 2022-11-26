require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx } = require('../scripts/utils');

const ERC721Json = require('../build/contracts/Tradable721.json');



async function main() {
    // { gasPrice: env.gasPrice }

    let env = await getEnv();

    const ERC721 = new ethers.Contract("0x3724E11f09cF1D690f0Cfe9874108bC0F1DC7AbC", ERC721Json.abi, env.wallet);
    let tx = await ERC721.adminBurn(0, { gasPrice: env.gasPrice });
    await waitForTx(ERC721.provider, tx.hash);
}

main()
    .catch(console.error)
    .finally(() => process.exit());