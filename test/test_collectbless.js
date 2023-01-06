require('dotenv').config();
const { ArgumentParser } = require('argparse');
const ethers = require('ethers');
const { getEnv, waitForTx } = require('../scripts/utils');

const CollectBless = require("../build/contracts/CollectBless.json");
const Random = require("../build/contracts/Random.json");
const Utils = require("../build/contracts/Utils.json");
const ERC20 = require("../build/contracts/ERC20PresetMinterPauser.json");
const ERC721 = require("../build/contracts/ERC721PresetMinterPauserAutoId.json");
const ERC1155 = require("../build/contracts/ERC1155PresetMinterPauser.json");

let chainId = 1337;
let blessCardNFT;
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
}

async function deployERC1155(env) {
    let factory = new ethers.ContractFactory(ERC1155.abi, ERC1155.bytecode, env.wallet);
    let gasPrice = await env.provider.getGasPrice();
    cERC1155 = await factory.deploy("test 1155", { gasPrice });
    console.log("cERC1155: ", cERC1155.address);
}

async function createERC20(env) {
    cERC20 = new ethers.Contract("0x07093De36d8087Acd62F42cb429C2cd9D3d463FA", ERC20.abi, env.wallet);
    await cERC20.mint(env.wallet.address, ethers.utils.parseEther("1000"));
}

async function createERC721(env) {
    cERC721 = new ethers.Contract(ERC721.networks[chainId].address, ERC721.abi, env.wallet);
    await cERC721.mint(env.wallet.address);
}

async function createERC1155(env) {
    cERC1155 = new ethers.Contract("0x1Ee9B9fDF756c89441D77F47E1F309f8CdD51545", ERC1155.abi, env.wallet);
    await cERC1155.mint(env.wallet.address, 1, 10, "0x00");
}

async function test_erc20(env) {
    console.log("\n\ntest_erc20......");
    await createERC20(env);

    await cERC20.approve(cCollectBless.address, ethers.constants.MaxUint256);

    await cCollectBless.mintBox(cERC20.address, 10, ethers.utils.parseEther("1000"));

    let amount = await cCollectBless.prizePoolAmount();
    console.log("\tprizePoolAmount: ", ethers.utils.formatEther(amount));

    let mintBoxCounts = await cCollectBless.mintBoxCounts(env.wallet.address);
    console.log("\tmintBoxCounts: ", mintBoxCounts.toString());

    let blindBoxCount = await cCollectBless.blindBoxCount();
    let blindBox = await cCollectBless.blindBoxs(blindBoxCount);
    console.log("\tblindBox: ", blindBox);
    console.log("\tBlind Box token amount: ", ethers.utils.formatEther(blindBox.amount));

    let balance = await prizePoolToken.balanceOf(env.wallet.address);
    console.log("\tbalance: ", ethers.utils.formatEther(balance));
}

async function test_erc721(env) {
    console.log("\n\ntest_erc721......");
    await createERC721(env);

    await cERC721.setApprovalForAll(cCollectBless.address, true);

    let nftId = 0;
    while (true) {
        let addr = await cERC721.ownerOf(nftId);
        // console.log("addr: ", addr);
        if (addr == env.wallet.address) {
            break;
        }
        nftId++;
    }
    // console.log("nftId: ", nftId);
    await cCollectBless.mintBoxNFT721(cERC721.address, nftId);

    let amount = await cCollectBless.prizePoolAmount();
    console.log("\tprizePoolAmount: ", ethers.utils.formatEther(amount));

    let mintBoxCounts = await cCollectBless.mintBoxCounts(env.wallet.address);
    console.log("\tmintBoxCounts: ", mintBoxCounts.toString());

    let blindBoxCount = await cCollectBless.blindBoxCount();
    let blindBox = await cCollectBless.blindBoxs(blindBoxCount);
    console.log("\tblindBox: ", blindBox);

    let balance = await prizePoolToken.balanceOf(env.wallet.address);
    console.log("\tbalance: ", ethers.utils.formatEther(balance));
}

async function test_erc1155(env) {
    console.log("\n\ntest_erc1155......");
    await createERC1155(env);

    await cERC1155.setApprovalForAll(cCollectBless.address, true);

    await cCollectBless.mintBoxNFT1155(cERC1155.address, 1, 10);

    let amount = await cCollectBless.prizePoolAmount();
    console.log("\tprizePoolAmount: ", ethers.utils.formatEther(amount));

    let mintBoxCounts = await cCollectBless.mintBoxCounts(env.wallet.address);
    console.log("\tmintBoxCounts: ", mintBoxCounts.toString());

    let blindBoxCount = await cCollectBless.blindBoxCount();
    let blindBox = await cCollectBless.blindBoxs(blindBoxCount);
    console.log("\tblindBox: ", blindBox);

    let balance = await prizePoolToken.balanceOf(env.wallet.address);
    console.log("\tbalance: ", ethers.utils.formatEther(balance));
}

async function test_mintCrad(env) {
    console.log("\n\ntest_mintCrad......");
    // Costs 0.2 U
    await cCollectBless.mintRareCard(5, env.wallet.address);
    await cCollectBless.mintCard(
        [env.wallet.address, env.wallet.address, env.wallet.address, env.wallet.address],
        [1, 2, 3, 4],
        [5, 5, 5, 5]
    );

    for (let i = 1; i <= 5; i++) {
        let balance = await blessCardNFT.balanceOf(env.wallet.address, i);
        console.log(`\tNFT ID: ${i} balance: ${balance.toString()}`);
    }

    let balance = await prizePoolToken.balanceOf(env.wallet.address);
    console.log("\tbalance: ", ethers.utils.formatEther(balance));
}

async function test_openBox(env) {
    console.log("\n\ntest_openBox......");

    // open blind box
    await cCollectBless.openBox(5);

    // display nft balance
    for (let i = 1; i <= 5; i++) {
        let balance = await blessCardNFT.balanceOf(env.wallet.address, i);
        console.log(`\tNFT ID: ${i} balance: ${balance.toString()}`);
    }

    let mintBoxCounts = await cCollectBless.mintBoxCounts(env.wallet.address);
    console.log("\tmintBoxCounts: ", mintBoxCounts.toString());

    let openBoxCounts = await cCollectBless.openBoxCounts(env.wallet.address);
    console.log("\topenBoxCounts: ", openBoxCounts.toString());

    let userWeights = await cCollectBless.userWeights(env.wallet.address);
    console.log("\tuserWeights: ", userWeights.toString());

    let uob = await cCollectBless.getUserOpenBoxs(env.wallet.address);
    let userOpenBoxs = [];
    for (let i = 0; i < uob.length; i++) {
        userOpenBoxs.push(uob[i].toNumber());
    }
    console.log("\tuserOpenBoxs: ", userOpenBoxs);
}

async function test_collectBless(env) {
    cCollectBless = new ethers.Contract(CollectBless.networks[chainId].address, CollectBless.abi, env.wallet);

    await test_erc20(env);
    await test_erc721(env);
    await test_erc1155(env);
    await test_mintCrad(env);
    await test_openBox(env);
}


async function main() {
    let env = await getEnv(false);
    chainId = env.provider._network.chainId;

    if (args.deploy) {
        await deployERC20(env);
        await deployERC1155(env);
        return;
    }

    // approve USDT to CollectBless contract
    prizePoolToken = new ethers.Contract(ERC20.networks[chainId].address, ERC20.abi, env.wallet);
    await prizePoolToken.mint(env.wallet.address, ethers.utils.parseEther("100000"));
    await prizePoolToken.approve(CollectBless.networks[chainId].address, ethers.constants.MaxUint256);

    blessCardNFT = new ethers.Contract(ERC1155.networks[chainId].address, ERC1155.abi, env.wallet);
    // approve to CollectBless contract
    await blessCardNFT.setApprovalForAll(CollectBless.networks[chainId].address, true);

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