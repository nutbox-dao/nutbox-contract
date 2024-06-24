const ethers = require('ethers')
const CommunityCuration = require('../build/contracts/CommunityCuration.json');
const AutoCuration = require('../build/contracts/AutoCuration.json')
require('dotenv').config();
const { getEnv } = require('./utils')

let chains = {
    "56": process.env.BSC,
    "119": process.env.ENULS,
    "137": process.env.PLOYGON,
    "8453": process.env.BASE,
    "42161": process.env.ARBITRUM,
    "59144": process.env.LINEA,
    "200901": process.env.BITLAYER
}

let communities = {
    "56": {
        "address": "0x6534b7A5a4dbF65b6DE92fF60dfB25f4Fdb7636B",
        "transactionHash": "0x253c94736a5f24e3b5007feb62629ba47b7e252a62ad922a79e87951daebc1cc"
    },
    "119": {
        "address": "0x1Ac88fa4ec4923835b25b21cE2061b25e0A4b05d",
        "transactionHash": "0x5fcfde15cd674e8b989656e72a2d5aa48ffbdac8c48ed6f1c5f4d8e0d8098d69"
    },
    "137": {
        "address": "0x90D0Ec60906f444567980E4688aC4525b7B63411",
        "transactionHash": "0x33c317a1030c7ca802479644c60997e4cb31624c613b86a70bc9ef766b64ff62"
    },
    "8453": {
        "address": "0x3686218f11c58ca46479acc5DdEE7e41374dF73A",
        "transactionHash": "0x118f31c9076f6ad29638f117d9b9ed3a94902c03c6dc8bbc09cbae0a18b6f860"
    },
    "42161": {
        "address": "0xDda7947F795B4636C68a14bC590fEb08cA69eef3",
        "transactionHash": "0xd98be385c9012facc5220678f0ef9cd091b3f14151f08501f97d0386f3d3d2e5"
    },
    "59144": {
        "address": "0xdf74187fe7de3C6F6b2f01fF76E021e3b470eDb0",
        "transactionHash": "0x66540de10dfac079226815700364993fb593570e0b312b5ea7e71765938fcbbf"
    },
    "200901": {
        "address": "0x39ab47b7F6D2B6874157750440b4948786066283",
        "transactionHash": "0x257c5b13e861dd760e03101a7e4ee03059921015f5165f0e805d22c4941afd79"
    }
}

async function getCommuntiyCurationOwners() {
    let table = []
    console.log(Object.keys(communities))
    for (let chainId of Object.keys(communities)) {
        console.log(4, chainId, chains[chainId])
        if (chains[chainId]) {
            const provider = new ethers.providers.JsonRpcProvider(chains[chainId])
            let cCommunityCuration = new ethers.Contract(communities[chainId].address, CommunityCuration.abi, provider);
            const owner = await cCommunityCuration.owner();
            table.push({
                chainId,
                contract: communities[chainId].address,
                owner
            })
        }
    }
    console.table(table)
}

async function upgradeAutoCuration() {
    const env = await getEnv()
    let factory = new ethers.ContractFactory(AutoCuration.abi, AutoCuration.bytecode, env.wallet);
    let contract = await factory.deploy();
    console.log('deployed', contract.address)
    const cid = '0xfab4a1932ab4'
    const newContract = contract.address;
    // uint256 cid, address signAddr, address prize, address _creator, address storageAddr
    await contract.init(cid, 
        '0x4A584E33Dec216a124E36Aceb0B06Bc37642027B', 
        '0x321ec7BeA5d359B539830C0C19CC995C1Db1Dce7', 
        '0x2DaE3A44D3C6e9Ab402f6e616ce1d02c1836A6Ac',
        '0x595F1B05ef8b160B4955F960e151ba123296fAEe'
    )
    console.log('inited')
    await contract.transferOwnership('0x6534b7A5a4dbF65b6DE92fF60dfB25f4Fdb7636B')
    console.log('transfer owner to community curation')
    let community = new ethers.Contract('0x6534b7A5a4dbF65b6DE92fF60dfB25f4Fdb7636B', CommunityCuration.abi, env.wallet)
    await community.upgrade(cid, newContract)
    console.log('updaded', newContract)
}

upgradeAutoCuration().catch(console.log)