require('dotenv').config();
const { ArgumentParser } = require('argparse');
const ethers = require('ethers');
const { getEnv, waitForTx } = require('../scripts/utils');

const CollectBless = require("../build/contracts/CollectBless.json");
const BlessCard = require("../build/contracts/BlessCard.json");
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
    cERC20 = new ethers.Contract("0x8357560Abff2d3f12D3E9E8A9873DeE8D2862750", ERC20.abi, env.wallet);
    await cERC20.mint(env.wallet.address, ethers.utils.parseEther("1000"));
}

async function createERC721(env) {
    cERC721 = new ethers.Contract(ERC721.networks[chainId].address, ERC721.abi, env.wallet);
    await cERC721.mint(env.wallet.address);
}

async function createERC1155(env) {
    cERC1155 = new ethers.Contract("0x4Cf2F9A229234397CE6209EdAA9dac1Ee8a31c91", ERC1155.abi, env.wallet);
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
    console.log("\tblindBoxCount: ", blindBoxCount.toString());

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
    console.log("\tblindBoxCount: ", blindBoxCount.toString());

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
    console.log("\tblindBoxCount: ", blindBoxCount.toString());

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

    await showCollectBless(env);
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

    // let uob = await cCollectBless.getUserOpenBoxs(env.wallet.address);
    let uob = await cCollectBless.getUserOpendBox(env.wallet.address, 0, 10);
    // let userOpenBoxs = [];
    // for (let i = 0; i < uob.length; i++) {
    //     userOpenBoxs.push(uob[i].toNumber());
    // }
    console.log("\tuserOpenBoxs: ", uob);
}

async function test_cashPrize(env) {
    await showCollectBless(env);
    console.log("\n\ntest_cashPrize......");

    // generate block, end event
    let d1 = new Date();
    d1.setUTCDate(d1.getUTCDate() + 3);
    await env.provider.send("evm_setTime", [parseInt(d1.getTime())]);
    await env.provider.send("evm_mine");

    let balance = await prizePoolToken.balanceOf(env.wallet.address);
    console.log("\tbalance: ", ethers.utils.formatEther(balance));

    await cCollectBless.cashPrize();

    let balance2 = await prizePoolToken.balanceOf(env.wallet.address);
    console.log("\tbalance2: ", ethers.utils.formatEther(balance2));
}

async function test_claimBlindBox(env) {
    await showCollectBless(env);
    console.log("\n\ntest_claimBlindBox......");

    await cCollectBless.claimBlindBox(300);

    await showCollectBless(env);
}

async function test_mintWhitelistNFT(env) {
    console.log("\n\ntest_mintWhitelistNFT......");
    await cCollectBless.mintWhitelistNFT(10);

    let amount = await cCollectBless.prizePoolAmount();
    console.log("\tprizePoolAmount: ", ethers.utils.formatEther(amount));

    let mintBoxCounts = await cCollectBless.mintBoxCounts(env.wallet.address);
    console.log("\tmintBoxCounts: ", mintBoxCounts.toString());

    let blindBoxCount = await cCollectBless.blindBoxCount();
    console.log("\tblindBoxCount: ", blindBoxCount.toString());

    let balance = await prizePoolToken.balanceOf(env.wallet.address);
    console.log("\tbalance: ", ethers.utils.formatEther(balance));
}

async function test_collectBless(env) {
    await test_erc20(env);
    await test_erc721(env);
    await test_erc1155(env);
    await test_mintWhitelistNFT(env);
    await test_mintCrad(env);
    await test_openBox(env);
    await test_cashPrize(env);
    await test_claimBlindBox(env);
}

async function showCollectBless(env) {
    console.log("\n\nShow CollectBless contract info......");

    let random = await cCollectBless.random();
    console.log("\trandom: ", random);

    let blessCard = await cCollectBless.blessCard();
    console.log("\tblessCard: ", blessCard);

    let ppt = await cCollectBless.prizePoolToken();
    console.log("\tprizePoolToken: ", ppt);

    let amount = await cCollectBless.prizePoolAmount();
    let claimedAmount = await cCollectBless.claimedAmount();
    if (env.provider._network.chainId == 137) {
        console.log("\tprizePoolAmount: ", ethers.utils.formatUnits(amount, 6));
        console.log("\tclaimedAmount: ", ethers.utils.formatUnits(claimedAmount, 6));
    } else {
        console.log("\tprizePoolAmount: ", ethers.utils.formatEther(amount));
        console.log("\tclaimedAmount: ", ethers.utils.formatEther(claimedAmount));
    }

    let blindBoxCount = await cCollectBless.blindBoxCount();
    console.log("\tblindBoxCount: ", blindBoxCount.toString());

    let totalWeights = await cCollectBless.totalWeights();
    console.log("\ttotalWeights: ", totalWeights.toString());

    let mintBoxCounts = await cCollectBless.mintBoxCounts(env.wallet.address);
    console.log("\tmintBoxCounts: ", mintBoxCounts.toString());

    let openBoxCounts = await cCollectBless.openBoxCounts(env.wallet.address);
    console.log("\topenBoxCounts: ", openBoxCounts.toString());

    let rareCardPrice = await cCollectBless.rareCardPrice();
    console.log("\trareCardPrice: ", ethers.utils.formatEther(rareCardPrice));

    let blindBoxPrice = await cCollectBless.blindBoxPrice();
    console.log("\tblindBoxPrice: ", ethers.utils.formatEther(blindBoxPrice));

    let rareCardCount = await cCollectBless.rareCardCount();
    console.log("\trareCardCount: ", rareCardCount.toString());

    let whitelistIdCount = await cCollectBless.whitelistIdCount();
    console.log("\twhitelistIdCount: ", whitelistIdCount.toString());

    let eventEndTime = await cCollectBless.eventEndTime();
    console.log("\teventEndTime: ", new Date(eventEndTime.toNumber() * 1000));

    let balance = await prizePoolToken.balanceOf(cCollectBless.address);
    if (env.provider._network.chainId == 137) {
        console.log("\tbalance: ", ethers.utils.formatUnits(balance, 6));
    } else {
        console.log("\tbalance: ", ethers.utils.formatEther(balance));
    }
}


async function main() {
    let env = await getEnv(false);
    chainId = env.provider._network.chainId;

    if (args.deploy) {
        await deployERC20(env);
        await deployERC1155(env);
        return;
    }

    let erc20Address = null;
    if (chainId == 137) {
        erc20Address = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
    } else {
        erc20Address = ERC20.networks[chainId].address;
    }

    cCollectBless = new ethers.Contract(CollectBless.networks[chainId].address, CollectBless.abi, env.wallet);
    prizePoolToken = new ethers.Contract(erc20Address, ERC20.abi, env.wallet);
    blessCardNFT = new ethers.Contract(BlessCard.networks[chainId].address, BlessCard.abi, env.wallet);

    if (args.show) {
        await showCollectBless(env);
        return;
    }

    // approve USDT to CollectBless contract
    await prizePoolToken.mint(env.wallet.address, ethers.utils.parseEther("100000"));
    await prizePoolToken.approve(CollectBless.networks[chainId].address, ethers.constants.MaxUint256);

    // approve to CollectBless contract
    await blessCardNFT.setApprovalForAll(CollectBless.networks[chainId].address, true);

    await test_collectBless(env);
}

const parser = new ArgumentParser({
    description: 'Argparse example'
});
parser.add_argument('-D', '--deploy', { help: 'deploy', action: 'store_true' });
parser.add_argument('-S', '--show', { help: 'show info', action: 'store_true' });
const args = parser.parse_args();

main()
    .catch(console.error)
    .finally(() => process.exit());