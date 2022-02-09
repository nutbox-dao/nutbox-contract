require('dotenv').config();
const ethers = require('ethers');
const fs = require("fs");
const { utf8ToHex } = require('./utils')

const CommunityJson = require("../build/contracts/Community.json");
const CommunityFactoryJson = require("../build/contracts/CommunityFactory.json");
const SPStakingFactoryJson = require("../build/contracts/SPStakingFactory.json");
const ERC20StakingFactoryJson = require("../build/contracts/ERC20StakingFactory.json")
const NUTTokenJson = require("../build/contracts/NUTToken.json")
const Addresses = require("./contracts.json");
const { waitForTx } = require('./utils');

const CommitteeAddress = Addresses.Committee;
const CommunityFactoryAddress = Addresses.CommunityFactory;
const LinearCalculatorAddress = Addresses.LinearCalculator;
const SPStakingFactoryAddress = Addresses.SPStakingFactory;
const ERC20StakingFactoryAddress = Addresses.ERC20StakingFactory;
const MintableERC20FactoryAddress = Addresses.MintableERC20Factory;

const NutAddress = '0x3a51Ac476B2505F386546450822F1bF9d881bEa4'  // local
// const NUTAddress = '0xc821eC39fd35E6c8414A6C7B32674D51aD0c2468' // goerli
// const NutAddress = '0x871AD5aAA75C297EB22A6349871ce4588E3c0306' // bsc test

async function approveFactory(env) {
    const contract = new ethers.Contract(NutAddress, NUTTokenJson.abi, env.wallet);
    console.log('Approve factory');
    const tx = await contract.approve(CommunityFactoryAddress, ethers.constants.MaxUint256);
    console.log('Approve community factory tx:', tx.hash);
}

async function approveCommunity(community, env) {
    const contract = new ethers.Contract(NutAddress, NUTTokenJson.abi, env.wallet);
    console.log('Approve community');
    const tx = await contract.approve(community, ethers.constants.MaxUint256);
    console.log('Approve community tx:', tx.hash);
}
 
// create non-mintable community
// use nut as ctoken
async function createSimpleCommunity(env) {
    return new Promise(async (resolve) => {
        try {
            const contract = new ethers.Contract(CommunityFactoryAddress, CommunityFactoryJson.abi, env.wallet);
            const block = await env.provider.getBlockNumber();
            console.log('Current block number', block);
            const policyArray = [
                {
                    startHeight: block + 15,
                    stopHeight: block + 100,
                    reward: ethers.utils.parseUnits("10", 18)
                },
                {
                    startHeight: block + 101,
                    stopHeight: block + 200,
                    reward: ethers.utils.parseUnits("5", 18)
                }
            ]
            let policy = ethers.utils.hexZeroPad(ethers.utils.hexlify(policyArray.length), 1)
            for (let p of policyArray) {
                policy += ethers.utils.hexZeroPad(ethers.BigNumber.from(p.startHeight).toHexString(), 32).substr(2)
                + ethers.utils.hexZeroPad(ethers.BigNumber.from(p.stopHeight).toHexString(), 32).substr(2)
                + ethers.utils.hexZeroPad(p.reward, 32).substr(2);
            }
            contract.on('CommunityCreated', async (creator, community, communityToken) => {
                console.log(`New community created by: ${creator}, community: ${community}, c-token: ${communityToken}`);
                contract.removeAllListeners('CommunityCreated');
                await approveCommunity(community, env);
                await createERC20Pool(community, env);
                await createSpPool(community, env);
                resolve({ community, communityToken });
            })
            const tx = await contract.createCommunity(false, NutAddress, 
                ethers.constants.AddressZero, '0x', LinearCalculatorAddress, policy, 
                {
                    gasLimit: process.env.GASLIMIT,
                    gasPrice: await env.provider.getGasPrice()
                });
            console.log('Create community tx:', tx.hash);
        } catch (e) {
            console.log('Create simple community fail:', e);
        }
    }) 
} 

// create mintable community
// create new token as ctoken
async function createMintableCommunity(env) {
    return new Promise(async (resolve) => {
        try {
            const contract = new ethers.Contract(CommunityFactoryAddress, CommunityFactoryJson.abi, env.wallet);
            const block = await env.provider.getBlockNumber();
            console.log('Current block number', block);
            const policyArray = [
                {
                    startHeight: block + 5,
                    stopHeight: block + 100,
                    reward: ethers.utils.parseUnits("10", 18)
                },
                {
                    startHeight: block + 101,
                    stopHeight: block + 200,
                    reward: ethers.utils.parseUnits("5", 18)
                }
            ]
            let policy = ethers.utils.hexZeroPad(ethers.utils.hexlify(policyArray.length), 1)
            for (let p of policyArray) {
                policy += ethers.utils.hexZeroPad(ethers.BigNumber.from(p.startHeight).toHexString(), 32).substr(2)
                + ethers.utils.hexZeroPad(ethers.BigNumber.from(p.stopHeight).toHexString(), 32).substr(2)
                + ethers.utils.hexZeroPad(p.reward, 32).substr(2);
            }

            contract.on('CommunityCreated', async (creator, community, communityToken) => {
                console.log(`New community created by: ${creator}, community: ${community}, c-token: ${communityToken}`);
                contract.removeAllListeners('CommunityCreated');
                const erc20 = new ethers.Contract(communityToken, NUTTokenJson.abi, env.wallet);
                const [name, symbol, supply, balance] = await Promise.all([erc20.name(), erc20.symbol(), erc20.totalSupply(), erc20.balanceOf(env.wallet.address)])
                console.log(`C-Token infos, name:${name}, symbol: ${symbol}, supply: ${supply.toString() / 1e18}, balance: ${balance.toString() / 1e18}`);
                await approveCommunity(community, env);
                await createERC20Pool(community, env);
                await createSpPool(community, env);
                resolve({ community, communityToken });
            })

            const tx = await contract.createCommunity(true, '0x0000000000000000000000000000000000000000', 
            MintableERC20FactoryAddress,
            makeSimpleMintableERC20Metadata('Mintable', 'MINT', 10000, env.wallet.address), 
            LinearCalculatorAddress, policy, 
                {
                    gasLimit: process.env.GASLIMIT,
                    gasPrice: await env.provider.getGasPrice()
                });
        } catch (e) {
            console.log('Create mintable community fail:', e);
        }
    }) 
}

function makeSimpleMintableERC20Metadata(name, symbol, supply, recipient) {
    const meta = '0x' + ethers.utils.hexZeroPad(ethers.utils.hexlify(name.length), 1).substring(2)
     + utf8ToHex(name)
     + ethers.utils.hexZeroPad(ethers.utils.hexlify(symbol.length), 1).substring(2)
     + utf8ToHex(symbol)
     + ethers.utils.hexZeroPad(ethers.utils.parseUnits(supply.toString(), 18), 32).substring(2)
     + recipient.substring(2)
     return meta
}

async function createERC20Pool(community, env) {
    return new Promise(async (resolve) => {
        try{
            const communityContract = new ethers.Contract(community, CommunityJson.abi, env.wallet);
            const ERC20StakingFactoryContract = new ethers.Contract(ERC20StakingFactoryAddress, ERC20StakingFactoryJson.abi, env.wallet);
            ERC20StakingFactoryContract.on('ERC20StakingCreated', (pool, community, name, token) => {
                console.log(`Create new pool: ${pool}, community:${community}, name:${name}, token: ${token}`);
                resolve(pool);
                ERC20StakingFactoryContract.removeAllListeners('ERC20StakingCreated');
            })
            communityContract.on('AdminSetPoolRatio', (pools, ratios) => {
                console.log("Admin set pool ratios: ", pools, ratios);
                communityContract.removeAllListeners('AdminSetPoolRatio')
            })
            const tx = await communityContract.adminAddPool("Stake nut for nut", [10000],
            ERC20StakingFactoryAddress,
            NutAddress,
            {
                gasLimit: process.env.GASLIMIT,
                gasPrice: await env.provider.getGasPrice()
            }
            );
            console.log('Create pool tx', tx.hash);
        }catch(e) {
            console.log('Create ERC20 pool fail', e);
            reject(e);
        }
    })
}

async function createSpPool(community, env) {
    return new Promise(async (resolve, reject) => {
        try{
            const communityContract = new ethers.Contract(community, CommunityJson.abi, env.wallet);
            const SPStakingFactoryContract = new ethers.Contract(SPStakingFactoryAddress, SPStakingFactoryJson.abi, env.wallet);
            SPStakingFactoryContract.on('SPStakingCreated', (pool, community, name, chainId, delegatee) => {
                console.log(`Create new pool: ${pool}, community:${community}, name:${name}, chainId: ${chainId}, delegatee: ${ethers.utils.parseBytes32String(delegatee)}`);
                resolve(pool);
                SPStakingFactoryContract.removeAllListeners('SPStakingCreated');
            })
            const delegatee = ethers.utils.formatBytes32String('nutbox.mine');
            const tx = await communityContract.adminAddPool("Delegate sp for nut", [4000, 6000],
            SPStakingFactoryAddress,
            '0x01' + delegatee.substring(2),
            {
                gasLimit: process.env.GASLIMIT,
                gasPrice: await env.provider.getGasPrice()
            }
            );
            console.log('Create pool tx', tx.hash);
        }catch(err) {
            console.log('Create sp pool fail', err);
            reject(err);
        }
    })
}

async function main() {
    let env = {}
    env.url = process.env.TESTENDPOINT;
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);

    // const tx = await env.provider.getTransaction('0xd80641c40a2304d0ebc6ff2738f55a5c5b19bb0e46cd24df3571d75f41994156')
    // console.log(tx);
    // console.log(await tx.wait());
    // return;
    await approveFactory(env);
    // return;
    // const { community, communityToken } = await createSimpleCommunity(env);
    const { c, ct } = await createMintableCommunity(env)
    // console.log(community);// 0x204b4d96E8C72bc30A1c544223FF43331222eeb7
    // const contract1 = new ethers.Contract('0x204b4d96E8C72bc30A1c544223FF43331222eeb7', CommunityJson.abi, env.wallet)
    // const tx1 = await contract1.adminSetFeeRatio(1000);
    // console.log(tx1.hash);

    // const { community2, communityToken2 } = await createMintableCommunity(env);
    // console.log(community2); // 0x8Fdd4f05D7fb2D72F0Fba5A5C3802aF2eBc6C309
    // communityToken2   0x6065225ACc9a4eaA591ea0688CEDc49807b316E8
    
    // const poolAddress = await createERC20Pool(community, env);
    // const spPool = await createSpPool('0xf234E84e9f1F83105A120351dFEa179AC4Ad8730', env);

    // const communityContract = new ethers.Contract('0x760f0abed50cda9f7711698192ff03b2faa5c942', CommunityJson.abi, env.wallet);
    // const tx = await communityContract.adminSetFeeRatio(2000);
    // console.log(tx.hash);
}

main()