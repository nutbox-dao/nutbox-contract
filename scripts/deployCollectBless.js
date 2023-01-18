require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx, getGasPrice, deployContract } = require('./utils');

const Random = require('../build/contracts/Random.json');
const Utils = require('../build/contracts/Utils.json');

const CollectBless = require('../build/contracts/CollectBless.json');
const BlessCard = require('../build/contracts/BlessCard.json');

const ERC20PresetMinterPauser = require('../build/contracts/ERC20PresetMinterPauser.json');
const ERC1155PresetMinterPauser = require('../build/contracts/ERC1155PresetMinterPauser.json');
const ERC721PresetMinterPauserAutoId = require('../build/contracts/ERC721PresetMinterPauserAutoId.json');



async function main() {
    let env = await getEnv(false);
    await deployContract(env, Random);
    await deployContract(env, Utils);
    await deployContract(env, CollectBless, null, [Utils]);
    await deployContract(env, BlessCard, ["https://gateway.nutbox.app/ipns/k51qzi5uqu5dk7p615riqdzb88rxk0ghes2xl4uablyuomg4v7p2bokzqtjrku/"]);

    if (env.chainId == 1337 || env.chainId == 97) {
        await deployContract(env, ERC20PresetMinterPauser, ["Test USDT", "USDT"]);
        await deployContract(env, ERC1155PresetMinterPauser, [""]);
        await deployContract(env, ERC721PresetMinterPauserAutoId, ["test 721", "T721", ""]);
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit());