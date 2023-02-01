require('dotenv').config();
const fs = require('fs')
const { ArgumentParser } = require('argparse');
const ethers = require('ethers');
const { getEnv, getGasPrice, sleep } = require('./utils');

const BlessCard = require("../build/contracts/BlessCard.json");

let env;

let cBlessCard;

let sended = [];

let ignore = [];

async function readAddress() {
    return new Promise((resolve, reject) => {
        fs.readFile("./address.txt", "utf8", (err, data) => {
            if (!!err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function saveSend() {
    return new Promise((resolve, reject) => {
        fs.writeFile("./sended.json", JSON.stringify(sended, null, 2), "utf8", (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

async function readSend() {
    return new Promise((resolve, reject) => {
        let f = "./sended.json";
        if (fs.existsSync(f)) {
            fs.readFile("./sended.json", "utf8", (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    sended = JSON.parse(data);
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}

async function sendNFT(contract, from, to, id, amount) {
    try {
        if (sended.includes(to) == false) {
            let gasPrice = await getGasPrice(env);
            let tx = await contract.safeTransferFrom(from, to, id, amount, '0x00', { gasPrice });
            sended.push(to);
            console.log(`\t${sended.length}\t| 已经发送: [${to},${id},${amount}] hash:${tx.hash}`);
            await sleep(2000);
        } else {
            console.log(`\t${sended.length}\t| `, to, "...");
        }
    } catch (e) {
        console.log(`\tsendNFT to [${to}] error: ${e}`);
    }

    // if (sended.includes(to) == false)
    //     sended.push(to);

    // console.log(`\t${sended.length} | sendNFT to [${to}] ${id} ${amount}`);
}

async function main() {
    let data = await readAddress();
    let addrs = data.split("\n");

    env = await getEnv(false);
    await readSend();
    cBlessCard = new ethers.Contract(BlessCard.networks[env.chainId].address, BlessCard.abi, env.wallet);
    if (addrs.length > 0) {
        console.log("start sending...");
        for (let addr of addrs) {
            let d = addr.split(",");
            if (d.length == 3) {
                if (ignore.includes(d[0]) == false)
                    await sendNFT(cBlessCard, env.wallet.address, d[0], d[1], d[2]);
                else
                    console.log(addr, "...");
            } else if (d.length == 1) {
                addr = addr.replaceAll("\"","");
                let id = args.id ?? 5;
                let amount = args.amount ?? 1;
                if (ignore.includes(addr) == false)
                    await sendNFT(cBlessCard, env.wallet.address, addr, id, amount);
                else
                    console.log(addr, "...");
            }
        }
        await saveSend();
    }
}

const parser = new ArgumentParser({
    description: 'Argparse example'
});
parser.add_argument('-I', '--id', { help: 'NFT id' });
parser.add_argument('-A', '--amount', { help: 'send amount' });
const args = parser.parse_args();

main()
    .catch(console.error)
    .finally(() => process.exit());