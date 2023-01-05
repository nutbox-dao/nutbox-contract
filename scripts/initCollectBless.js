require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx } = require('./utils');

const CollectBless = require("../build/contracts/CollectBless.json");
const Random = require("../build/contracts/Random.json");
const Utils = require("../build/contracts/Utils.json");
const ERC20 = require("../build/contracts/ERC20PresetMinterPauser.json");
const ERC1155 = require("../build/contracts/ERC1155PresetMinterPauser.json");


async function init_collectBless(env) {
    let chainId = env.provider._network.chainId;
    let blessCardAddress = ERC1155.networks[chainId].address;
    let randomAddress = Random.networks[chainId].address;
    let utilsAddress = Utils.networks[chainId].address;
    let collectBlessAddress = CollectBless.networks[chainId].address;
    let erc20Address = ERC20.networks[chainId].address;
    const collectBlessContract = new ethers.Contract(collectBlessAddress, CollectBless.abi, env.wallet);
    let d1 = new Date();
    d1.setUTCDate(d1.getUTCDate() + 1);
    let endTime = parseInt(d1.getTime() / 1000);
    await collectBlessContract.init(blessCardAddress, erc20Address, randomAddress, endTime);
}

async function main() {
    let env = await getEnv(false);
    await init_collectBless(env);
}

main()
    .catch(console.error)
    .finally(() => process.exit());