require('dotenv').config();
const ethers = require('ethers');

const TaskJson = require('../build/contracts/Task.json');
const FundJson = require("../build/contracts/TaskWormholeFund.json");
const erc20Json = require('../build/contracts/ERC20PresetMinterPauser.json')

const taskAddress = "0x45ddC1a7D2d7eD36407f4CbB54d9D873FEE3629e";
const fundAddress = "0x5918741d9fC92b308617220F88b90D4F5D3482C1";
const erc20Address = "0xC46fEff28580524A8Bff8376fb8238d4e354fb58";

async function main() {

}

main()
    .catch(console.error)
    .finally(() => process.exit());