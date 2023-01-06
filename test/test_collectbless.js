require('dotenv').config();
const { ArgumentParser } = require('argparse');
const ethers = require('ethers');
const { getEnv, waitForTx } = require('../scripts/utils');

const CollectBless = require("../build/contracts/CollectBless.json");
const Random = require("../build/contracts/Random.json");
const Utils = require("../build/contracts/Utils.json");
const ERC20 = require("../build/contracts/ERC20PresetMinterPauser.json");
const ERC1155 = require("../build/contracts/ERC1155PresetMinterPauser.json");

let chainId = 1337;
let prizePoolToken;
let cCollectBless;
let cERC20;
let cERC721;
let cERC1155;

async function deployERC20(env) {
    let factory = new ethers.ContractFactory(ERC20.abi, ERC20.bytecode, env.wallet);
    let gasPrice = await env.provider.getGasPrice();
    cERC20 = await factory.deploy("test btc", "BTC", { gasPrice });
    console.log("cERC20: ", cERC20.address);
    await cERC20.mint(env.wallet.address, ethers.utils.parseEther("100000"));
}

async function createERC20(env) {
    cERC20 = new ethers.Contract("0xE22930196909457d6C9fbF0Ab0fD483B7A763901", ERC20.abi, env.wallet);
}

async function test_erc20(env) {
    await createERC20(env);

    await cERC20.approve(cCollectBless.address, ethers.constants.MaxUint256);

    await cCollectBless.mintBox(cERC20.address, 10, ethers.utils.parseEther("1000"));

    let amount = await cCollectBless.prizePoolAmount();
    console.log("prizePoolAmount: ", ethers.utils.formatEther(amount));

    let mintBoxCounts = await cCollectBless.mintBoxCounts(env.wallet.address);
    console.log("mintBoxCounts: ", mintBoxCounts.toString());

    let blindBox = await cCollectBless.blindBoxs(1);
    console.log("blindBox: ", blindBox);

}

async function test_collectBless(env) {
    cCollectBless = new ethers.Contract(CollectBless.networks[chainId].address, CollectBless.abi, env.wallet);

    await test_erc20(env);
}


async function main() {
    let env = await getEnv(false);
    if (args.deploy) {
        await deployERC20(env);
        return;
    }
    chainId = env.provider._network.chainId;
    prizePoolToken = new ethers.Contract(ERC20.networks[chainId].address, ERC20.abi, env.wallet);
    await prizePoolToken.mint(env.wallet.address, ethers.utils.parseEther("100000"));
    await prizePoolToken.approve(cCollectBless.address, ethers.constants.MaxUint256);

    await test_collectBless(env);
}

const parser = new ArgumentParser({
    description: 'Argparse example'
});
parser.add_argument('-D', '--deploy', { help: 'deploy', action: 'store_true' });
const args = parser.parse_args();

main()
    .catch(console.error)
    .finally(() => process.exit());