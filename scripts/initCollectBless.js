require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx } = require('./utils');

const CollectBless = require("../build/contracts/CollectBless.json");
const BlessCard = require("../build/contracts/BlessCard.json");
const Random = require("../build/contracts/Random.json");
const Utils = require("../build/contracts/Utils.json");
const ERC20 = require("../build/contracts/ERC20PresetMinterPauser.json");
const ERC1155 = require("../build/contracts/ERC1155PresetMinterPauser.json");


async function init_collectBless(env) {
    let chainId = env.provider._network.chainId;
    let blessCardAddress = BlessCard.networks[chainId].address;
    let randomAddress = Random.networks[chainId].address;
    let utilsAddress = Utils.networks[chainId].address;
    let collectBlessAddress = CollectBless.networks[chainId].address;
    let erc20Address = ERC20.networks[chainId].address;
    if (chainId == 137) {
        erc20Address = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
    }
    const erc20Contract = new ethers.Contract(erc20Address, ERC20.abi, env.wallet);
    const collectBlessContract = new ethers.Contract(collectBlessAddress, CollectBless.abi, env.wallet);
    let d1 = new Date();
    d1.setUTCDate(d1.getUTCDate() + 3);
    let endTime = parseInt(d1.getTime() / 1000);

    console.log("init CollectBless contract......");
    await collectBlessContract.init(blessCardAddress, erc20Address, randomAddress, endTime);

    // set price
    if (chainId == 137) {
        await collectBlessContract.setRareCardPrice(ethers.utils.parseUnits("0.2", 6));
        await collectBlessContract.setBlindBoxPrice(ethers.utils.parseUnits("1", 6));
    }

    const blessCardContract = new ethers.Contract(blessCardAddress, BlessCard.abi, env.wallet);
    // mint role
    console.log(`grantRole MINTER_ROLE to ${collectBlessAddress} ......`);
    await blessCardContract.grantRole("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", collectBlessAddress);
    // burn role
    console.log(`grantRole BURN_ROLE to ${collectBlessAddress} ......`);
    await blessCardContract.grantRole("0xe97b137254058bd94f28d2f3eb79e2d34074ffb488d042e3bc958e0a57d2fa22", collectBlessAddress);

    if (chainId != 1337) {
        console.log("approve erc20......");
        await erc20Contract.approve(collectBlessAddress, ethers.constants.MaxUint256);

        // console.log('set Owner......');
        // await collectBlessContract.transferOwnership("0x31ea10e78F9F1e61861DE6bA10ad090904abC1d6");
    }
}

async function main() {
    let env = await getEnv(false);
    await init_collectBless(env);
}

main()
    .catch(console.error)
    .finally(() => process.exit());