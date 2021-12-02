require('dotenv').config();
const ethers = require('ethers');
const fs = require("fs");

const CommunityJson = require("../build/contracts/Community.json");
const CommunityFactoryJson = require("../build/contracts/CommunityFactory.json");
const SPStakingFactoryJson = require("../build/contracts/SPStakingFactory.json");
const ERC20StakingFactoryJson = require("../build/contracts/ERC20StakingFactory.json")
const Addresses = require("./contracts.json");
const { waitForTx } = require('./utils');

const CommitteeAddress = Addresses.Committee;
const CommunityFactoryAddress = Addresses.CommunityFactory;
const LinearCalculatorAddress = Addresses.LinearCalculator;
const SPStakingFactoryAddress = Addresses.SPStakingFactory;
const ERC20StakingFactoryAddress = Addresses.ERC20StakingFactory;

const NutAddress = '0x926E99b548e5D48Ca4C6215878b954ABd0f5D1f6'

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
                resolve({ community, communityToken });
            })
            const tx = await contract.createCommunity(NutAddress, {
                name: '',
                symbol: '',
                supply: ethers.utils.parseUnits('0', 18),
                owner: env.wallet.address
            }, LinearCalculatorAddress, policy, 
                {
                    gasLimit: process.env.GASLIMIT,
                    gasPrice: await env.provider.getGasPrice()
                });
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
                resolve({ community, communityToken });
            })
            console.log(await contract.communityCount());
            const tx = await contract.createCommunity('0x0000000000000000000000000000000000000000', {
                name: 'Nutbox',
                symbol: 'NUT', 
                supply: ethers.utils.parseUnits('100000', 18),
                owner: env.wallet.address
            }, LinearCalculatorAddress, policy, 
                {
                    gasLimit: process.env.GASLIMIT,
                    gasPrice: await env.provider.getGasPrice()
                });
        } catch (e) {
            console.log('Create simple community fail:', e);
        }
    }) 
}

async function createERC20Pool(community, env) {
    return new Promise(async (resolve) => {
        try{
            const communityContract = new ethers.Contract(community, CommunityJson.abi, env.wallet);
            const ERC20StakingFactoryContract = new ethers.Contract(ERC20StakingFactoryAddress, ERC20StakingFactoryJson.abi, env.wallet);
            ERC20StakingFactoryContract.on('ERC20StakingCreated', (pool, community, token) => {
                console.log(`Create new pool: ${pool}, community:${community}, token: ${token}`);
                resolve(pool);
                ERC20StakingFactoryContract.removeAllListeners('ERC20StakingCreated');
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
    return new Promise(async (resolve) => {
        try{
            const communityContract = new ethers.Contract(community, CommunityJson.abi, env.wallet);
            const SPStakingFactoryContract = new ethers.Contract(SPStakingFactoryAddress, SPStakingFactoryJson.abi, env.wallet);
            SPStakingFactoryContract.on('SPStakingCreated', (pool, community, chainId, delegatee) => {
                console.log(`Create new pool: ${pool}, community:${community}, chainId: ${chainId}, delegatee: ${ethers.utils.parseBytes32String(delegatee)}`);
                resolve(pool);
                SPStakingFactoryContract.removeAllListeners('SPStakingCreated');
            })
            const delegatee = ethers.utils.formatBytes32String('nutbox.mine');
            const tx = await communityContract.adminAddPool("Delegate sp for nut", [4000, 6000],
            SPStakingFactoryAddress,
            '0x01' + delegatee.substr(2),
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

    // const { community, communityToken } = await createSimpleCommunity(env);
    const { community, communityToken } = await createMintableCommunity(env);
    
    const poolAddress = await createERC20Pool(community, env);
    const spPool = await createSpPool(community, env);
}

main()