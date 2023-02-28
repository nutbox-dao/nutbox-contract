require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx, sleep,getGasPrice } = require('../scripts/utils');

const ERC20 = require("../build/contracts/ERC20PresetMinterPauser.json");
const Curation = require("../build/contracts/Curation.json");

var cERC20;
var cCuration;

const id1 = '208975624545445';
const id2 = '208975624545446';

async function createNewTask(provider, contract, id, endTime, token, amount) {
    console.log("createNewTask: ", id, endTime, token, amount)
    const tx = await contract.newTask(id, endTime, token, amount, 10);
    await waitForTx(provider, tx.hash)
}

async function genInfo(env) {
    let twitterId = 123;
    let curationIds = [id1, id2];
    let amounts = [ethers.utils.parseEther("10"), ethers.utils.parseEther("20")];

    let data = ethers.utils.solidityKeccak256(["uint256", "uint256", "address", "uint256[]", "uint256[]"], [twitterId, env.chainId, env.wallet.address, curationIds, amounts]);
    data = ethers.utils.arrayify(data);
    let sig = await env.wallet.signMessage(data);
    return {
        chainId: env.chainId,
        address: env.wallet.address,
        twitterId,
        curationIds,
        amounts,
        sig
    };
}

async function main() {
    let env = await getEnv();

    let curationAddress = Curation.networks[env.chainId].address;
    let erc20Address = ERC20.networks[env.chainId].address;

    cCuration = new ethers.Contract(curationAddress, Curation.abi, env.wallet);
    cERC20 = new ethers.Contract(erc20Address, ERC20.abi, env.wallet);

    console.log("approve to %s...", curationAddress);
    let tx = await cERC20.approve(curationAddress, ethers.constants.MaxUint256);
    await waitForTx(env.provider, tx.hash);

    console.log("transfer to %s...", env.wallet.address);
    let amount = ethers.utils.parseEther("100");
    tx = await cERC20.mint(env.wallet.address, ethers.utils.parseEther("200"));
    await waitForTx(env.provider, tx.hash);

    // curation1
    await createNewTask(env.provider, cCuration, id1, parseInt(new Date().getTime() / 1000 + 5), erc20Address, amount)
    let taskInfo = await cCuration.taskInfo(id1);
    console.log("curation1: ", taskInfo);

    // curation2
    await createNewTask(env.provider, cCuration, id2, parseInt(new Date().getTime() / 1000 + 5), erc20Address, amount)
    taskInfo = await cCuration.taskInfo(id2);
    console.log("curation2: ", taskInfo);

    // generate block, end event
    if (env.chainId == 1337) {
        let d1 = new Date();
        d1.setUTCSeconds(d1.getUTCSeconds() + 6);
        await env.provider.send("evm_setTime", [parseInt(d1.getTime())]);
        await env.provider.send("evm_mine");
    } else {
        await sleep(6000);
    }

    // claim prize
    let { chainId, address, twitterId, curationIds, amounts, sig } = await genInfo(env);
    tx = await cCuration.claimPrize(twitterId, address, curationIds, amounts, sig); //gas used 217504,249236
    await waitForTx(env.provider, tx.hash);

    let balance = await cERC20.balanceOf(address);
    console.log("balance: ", ethers.utils.formatEther(balance));

    taskInfo = await cCuration.taskInfo(id1);
    console.log("curation1: ", taskInfo);

    taskInfo = await cCuration.taskInfo(id2);
    console.log("curation2: ", taskInfo);

    // error claim prize
    tx = await cCuration.claimPrize(twitterId, address, curationIds, amounts, sig); // gas used 41596,44184
    await waitForTx(env.provider, tx.hash);

    balance = await cERC20.balanceOf(address);
    console.log("balance: ", ethers.utils.formatEther(balance));

    // let gasPrice = await getGasPrice(env);
    // await cCuration.setSignAddress("0x4A584E33Dec216a124E36Aceb0B06Bc37642027B", { gasPrice });

}


main()
    .catch(console.error)
    .finally(() => process.exit());