require('dotenv').config();
const fs = require('fs')
const { ArgumentParser } = require('argparse');
const ethers = require('ethers');
const { getEnv, getGasPrice, sleep } = require('./utils');

const BlessCard = require("../build/contracts/BlessCard.json");

let env;

let cBlessCard;

let sended = [];

let ignore = [
    "0x125a7a6ddf7504fe97698ca717a51125f53817b3",
    "0x58278882433feb428031a12c2517f32377332c42",
    "0x7a2d7696e07d868fdc250616d4af9e186ce7112b",
    "0x787e36e1cafa19f47a6253a84758f43a04dc3b17",
    "0x4d12c40e9c095b910eb597d16939ed5493ea77c3",
    "0x1b02ca1e76870da2755fa080f69fd14d0f7ae37a",
    "0xea324758383977be9355372e7be3e10f2c6d943f",
    "0x2e90bb9061e368d0ae757009692915471dbc3949",
    "0x44e2ab6d9203593942054cc23248fff1ea16593e",
    "0xcb4abe454ea81404bcd43d6b67e8892a5c2405a6",
    "0x97c23135a36d5ba18ac7878859be0936585c4746",
    "0x1a4f00a3637d8717e18c9a2585c5cdaf4224d471",
    "0x202bde5450105e332600a84ab555b8dd9e1d469d",
    "0xe4fe1e8ba05e482a86c1c5664fb08f1523e0181b",
    "0xa4f818423c2b41be30d1b9905bbe5d9d601f7799",
    "0x74d4d5546972e2622b588185a34095b6973b8bb1",
    "0xf42737a9d722a6b2f8b68e1359fff32afe3d5e8f",
    "0x063b31d67dd95b376cd6de4cac4b9808f5dbd49d",
    "0xe1abe2a3189b9ab53120aa209cc1b1c041e64eeb"
];

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
        fs.readFile("./sended.json", "utf8", (err, data) => {
            if (err) {
                reject(err);
            } else {
                sended = JSON.parse(data);
                resolve();
            }
        });
    });
}

async function sendNFT(contract, from, to, id, amount) {
    try {
        if (sended.includes(to) == false) {
            let gasPrice = await getGasPrice(env);
            let tx = await contract.safeTransferFrom(from, to, id, amount, '0x00', { gasPrice });
            sended.push(to);
            console.log(`\t${sended.length}\t| 已经发送: [${to},${id},${amount}] hash:${tx.hash}`);
        } else {
            console.log(`\t${sended.length}\t| `,to, "...");
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
                let id = args.id ?? 5;
                let amount = args.amount ?? 1;
                if (ignore.includes(addr) == false)
                    await sendNFT(cBlessCard, env.wallet.address, addr, id, amount);
                else
                    console.log(addr, "...");
            }
            await sleep(2000);
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