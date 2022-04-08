require('dotenv').config();
const ethers = require('ethers');
const fs = require("fs");
const { utf8ToHex, sleep } = require('./utils')

const CommunityJson = require("../build/contracts/Community.json");
const CommunityFactoryJson = require("../build/contracts/CommunityFactory.json");
const SPStakingFactoryJson = require("../build/contracts/SPStakingFactory.json");
const ERC20StakingFactoryJson = require("../build/contracts/ERC20StakingFactory.json")
const ERC20StakingJson = require("../build/contracts/ERC20Staking.json")
const CosmosStakingFactoryJson = require('../build/contracts/CosmosStakingFactory.json')
const NUTTokenJson = require("../build/contracts/NUTToken.json")
const Addresses = require("./contracts.json");
const { waitForTx } = require('./utils');
const GaugeJson = require('../build/contracts/Gauge.json')
const ContractAddress = require('./contracts.json')
const NutPowerJson = require('../build/contracts/NutPower.json');
const { log } = require('console');

const CommitteeAddress = Addresses.Committee;
const CommunityFactoryAddress = Addresses.CommunityFactory;
const LinearCalculatorAddress = Addresses.LinearCalculator;
const SPStakingFactoryAddress = Addresses.SPStakingFactory;
const ERC20StakingFactoryAddress = Addresses.ERC20StakingFactory;
const CosmosStakingFactoryAddress = Addresses.CosmosStakingFactory;
const MintableERC20FactoryAddress = Addresses.MintableERC20Factory;
const GaugeAddress = Addresses['Gauge'];
const NutPowerAddress = Addresses.NutPower;

let communities = {}
let erc20Pools = {}
let steemPools = {}
let hivePools = {}
let atomPools = {}
let osmoPools = {}
let junoPools = {}

// const NutAddress = '0x223326a5F7565c5E6cEcf47D0220aa86922C37E9'  // local
const NutAddress = '0xc821eC39fd35E6c8414A6C7B32674D51aD0c2468' // goerli
// const NutAddress = '0x871AD5aAA75C297EB22A6349871ce4588E3c0306' // bsc test

async function approveFactory(env) {
    const contract = new ethers.Contract(NutAddress, NUTTokenJson.abi, env.wallet);
    console.log('Approve factory');
    const tx = await contract.approve(CommunityFactoryAddress, ethers.constants.MaxUint256,
        {
            gasPrice: env.gasPrice,
            gasLimit: env.gasLimit
        });
    console.log('Approve community factory tx:', tx.hash);
}

async function approveCommunity(community, env) {
    const contract = new ethers.Contract(NutAddress, NUTTokenJson.abi, env.wallet);
    console.log('Approve community');
    const tx = await contract.approve(community, ethers.constants.MaxUint256,
        {
            gasPrice: env.gasPrice,
            gasLimit: env.gasLimit
        });
    console.log('Approve community tx:', tx.hash);
}

const parseUint = (unit) => ethers.utils.parseUnits(unit.toString(), 18);
 
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
                    startHeight: block + 6,
                    stopHeight: block + 100,
                    reward: ethers.utils.parseUnits("2", 18)
                },
                {
                    startHeight: block + 101,
                    stopHeight: block + 200,
                    reward: ethers.utils.parseUnits("1", 18)
                }
            ]
            let policy = ethers.utils.hexZeroPad(ethers.utils.hexlify(policyArray.length), 1)
            for (let p of policyArray) {
                policy += ethers.utils.hexZeroPad(ethers.BigNumber.from(p.startHeight).toHexString(), 32).substring(2)
                + ethers.utils.hexZeroPad(ethers.BigNumber.from(p.stopHeight).toHexString(), 32).substring(2)
                + ethers.utils.hexZeroPad(p.reward, 32).substring(2);
            }
            let flag = true
            contract.on('CommunityCreated', async (creator, community, communityToken) => {
                if (creator === env.wallet.address && flag){
                    flag = false
                    communities[creator] = community
                    console.log(`New community created by: ${creator}, community: ${community}, c-token: ${communityToken}`);
                    contract.removeAllListeners('CommunityCreated');
                    await approveCommunity(community, env);
                    const erc20pool = await createERC20Pool(community, env);
                    await testErc20Pool(erc20pool, env)
                    erc20Pools[creator] = erc20pool
                    const steempool = await createSpPool(community, env);
                    steemPools[creator] = steempool
                    const atompool = await createAtomPool(community, env);
                    atomPools[creator] = atompool
                    const osmopool = await createOsmoPool(community, env);
                    osmoPools[creator] = osmopool
                    await chargeCommunity(community, env);
                    const junopool = await createJunoPool(community, env);
                    junoPools[creator] = junopool
                    await resetPoolRatio(community, env);
                    await adminClosePool(community, env, junopool, [erc20pool, steempool, atompool, osmopool], [1200,1200,1600,6000])
                    resolve({ community, communityToken });
                    return;
                }
            })
            const tx = await contract.createCommunity(false, NutAddress, 
                ethers.constants.AddressZero, '0x', LinearCalculatorAddress, policy, {gasLimit: env.gasLimit});
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
            let flag = true
            ERC20StakingFactoryContract.on('ERC20StakingCreated', (pool, _community, name, token) => {
                if (_community  === community && flag){
                    flag = false
                    console.log(`Create new erc20 pool: ${pool}, community:${community}, name:${name}, token: ${token}`);
                    resolve(pool);
                    ERC20StakingFactoryContract.removeAllListeners('ERC20StakingCreated');
                }
            })
            const tx = await communityContract.adminAddPool("Stake nut for nut", [10000],
            ERC20StakingFactoryAddress,
            NutAddress,
            {
                gasPrice: env.gasPrice,
                gasLimit: env.gasLimit
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
            let flag = true
            SPStakingFactoryContract.on('SPStakingCreated', (pool, _community, name, chainId, delegatee) => {
                if (community === _community && flag){
                    flag = false
                    console.log(`Create new pool: ${pool}, community:${_community}, name:${name}, chainId: ${chainId}, delegatee: ${ethers.utils.parseBytes32String(delegatee)}`);
                    resolve(pool);
                    SPStakingFactoryContract.removeAllListeners('SPStakingCreated');
                }
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

async function createAtomPool(community, env) {
    return new Promise(async (resolve, reject) => {
        try{
            const communityContract = new ethers.Contract(community, CommunityJson.abi, env.wallet);
            const CosmosStakingFactoryContract = new ethers.Contract(CosmosStakingFactoryAddress, CosmosStakingFactoryJson.abi, env.wallet);
            let flag = true
            CosmosStakingFactoryContract.on('CosmosStakingCreated', (pool, _community, name, chainId, delegatee) => {
                if (community === _community && chainId === 3 && flag){
                    flag = false
                    console.log(`Create new pool: ${pool}, community:${community}, name:${name}, chainId: ${chainId}, delegatee: ${delegatee}`);
                    resolve(pool);
                    CosmosStakingFactoryContract.removeAllListeners('CosmosStakingCreated')
                }
            })
            const delegatee = NutAddress;
            const tx = await communityContract.adminAddPool("Delegate atom for nut", [1000, 1000, 8000],
            CosmosStakingFactoryAddress,
            '0x03' + delegatee.substring(2),
            {
                gasPrice: env.gasPrice,
                gasLimit: env.gasLimit
            }
            );
            console.log('Create pool tx', tx.hash);
        }catch(err) {
            console.log('Create sp pool fail', err);
            reject(err);
        }
    })
}

async function createOsmoPool(community, env) {
    return new Promise(async (resolve, reject) => {
        try{
            const communityContract = new ethers.Contract(community, CommunityJson.abi, env.wallet);
            const CosmosStakingFactoryContract = new ethers.Contract(CosmosStakingFactoryAddress, CosmosStakingFactoryJson.abi, env.wallet);
            let flag = true
            CosmosStakingFactoryContract.on('CosmosStakingCreated', (pool, _community, name, chainId, delegatee) => {
                if (community === _community && chainId === 4 && flag){
                    flag = false
                    console.log(`Create new pool: ${pool}, community:${community}, name:${name}, chainId: ${chainId}, delegatee: ${delegatee}`);
                    resolve(pool);
                    CosmosStakingFactoryContract.removeAllListeners('CosmosStakingCreated')
                }
            })
            const delegatee = NutAddress;
            const tx = await communityContract.adminAddPool("Delegate osmo for nut", [1000, 1000, 1000, 7000],
            CosmosStakingFactoryAddress,
            '0x04' + delegatee.substring(2),
            {
                gasPrice: env.gasPrice,
                gasLimit: env.gasLimit
            }
            );
            console.log('Create pool tx', tx.hash);
        }catch(err) {
            console.log('Create sp pool fail', err);
            reject(err);
        }
    })
}

async function createJunoPool(community, env) {
    return new Promise(async (resolve, reject) => {
        try{
            const communityContract = new ethers.Contract(community, CommunityJson.abi, env.wallet);
            const CosmosStakingFactoryContract = new ethers.Contract(CosmosStakingFactoryAddress, CosmosStakingFactoryJson.abi, env.wallet);
            let flag = true
            CosmosStakingFactoryContract.on('CosmosStakingCreated', (pool, _community, name, chainId, delegatee) => {
                if (community === _community && chainId === 5 && flag){
                    flag = false
                    console.log(`Create new pool: ${pool}, community:${community}, name:${name}, chainId: ${chainId}, delegatee: ${delegatee}`);
                    resolve(pool);
                    CosmosStakingFactoryContract.removeAllListeners('CosmosStakingCreated')
                }
            })
            const delegatee = NutAddress;
            const tx = await communityContract.adminAddPool("Delegate osmo for nut", [1000, 1000, 1000, 1000, 6000],
            CosmosStakingFactoryAddress,
            '0x05' + delegatee.substring(2),
            {
                gasPrice: env.gasPrice,
                gasLimit: env.gasLimit
            }
            );
            console.log('Create pool tx', tx.hash);
        }catch(err) {
            console.log('Create sp pool fail', err);
            reject(err);
        }
    })
}

let isCharging = false
async function chargeCommunity(community, env) {
    while(isCharging) {
        await sleep(1000)
    }
    isCharging = true
    return new Promise(async (resolve, reject) => {
        try{
            const wallet = new ethers.Wallet(process.env.TESTKEY, env.provider)
            const nut = new ethers.Contract(NutAddress, NUTTokenJson.abi, wallet)
            const tx = await nut.transfer(community, ethers.utils.parseUnits('100000', 18),
            {
                gasPrice: env.gasPrice,
                gasLimit: env.gasLimit
            })
            await waitForTx(env.provider, tx.hash)
            isCharging = false
            resolve();
        }catch(e) {
            console.log('charge community fail', community, e);
            reject();
        }
    })
}

async function resetPoolRatio(community, env) {
    return new Promise(async (resolve, reject) => {
        try{
            const communityContract = new ethers.Contract(community, CommunityJson.abi, env.wallet);
            const tx = await communityContract.adminSetPoolRatios([0, 1500, 1500, 3000, 4000],
                {
                    gasPrice: env.gasPrice,
                    gasLimit: env.gasLimit
                })
            await waitForTx(env.provider, tx.hash)
            resolve();
        }catch(e){
            console.log('reset pool ratio fail', community, e);
            reject();
        }
    })
}

async function adminClosePool(community, env, pool, pools, ratios) {
    return new Promise(async (resolve, reject) => {
        try{
            const communityContract = new ethers.Contract(community, CommunityJson.abi, env.wallet);
            const tx = await communityContract.adminClosePool(pool, pools, ratios,
                {
                    gasPrice: env.gasPrice,
                    gasLimit: env.gasLimit
                })
            await waitForTx(env.provider, tx.hash)
            resolve();
        }catch(e) {
            reject()
        }
    })
}

async function testErc20Pool(pool, env) {
    return new Promise(async (resolve, reject) => {
        try{
            const contract = new ethers.Contract(pool, ERC20StakingJson.abi, env.wallet);
            const nut = new ethers.Contract(NutAddress, NUTTokenJson.abi, env.wallet);
            let tx = await nut.approve(pool, ethers.constants.MaxUint256);
            await waitForTx(env.provider, tx.hash);
            tx = await contract.deposit(ethers.utils.parseUnits('100', 18),
            {
                gasPrice: env.gasPrice,
                gasLimit: env.gasLimit
            })
            await waitForTx(env.provider, tx.hash)
            tx = await contract.withdraw(ethers.utils.parseUnits('10', 18),
            {
                gasPrice: env.gasPrice,
                gasLimit: env.gasLimit
            })
            await waitForTx(env.provider, tx.hash)
            tx = await contract.deposit(ethers.utils.parseUnits('10', 18),
            {
                gasPrice: env.gasPrice,
                gasLimit: env.gasLimit
            })
            await waitForTx(env.provider, tx.hash)
            tx = await contract.withdraw(ethers.utils.parseUnits('100', 18),
            {
                gasPrice: env.gasPrice,
                gasLimit: env.gasLimit
            })
            await waitForTx(env.provider, tx.hash)
            resolve();
        }catch(e) {
            console.log('Tesst erc fail', pool, e);
            reject()
        }
    })
}

const accounts = [
    '0xd0ba32cBB33dd58e55dBC2A243339A331145660B',
    '0xA54Ea35D869eb5A61228b5d252CC4da812837A0F',
    '0x5A052c31F05D391BD13270132c6be1018de84F05',
    '0x6CA444FA1066FBC0d73b982Fb7EeA6cc2a7C53aE',
    '0xcaa66d56c86Bc2d618d3920246CD1cac59580351'
]
const keys = [
    '0x3253bde4e17e6286f1be5ce66afe752eb5e8e41e472a46f8d362bb46feacce26',
    '0x6ec494f82a0988ff8acd8c762661c2ebe90ed54734c456e5f131091fcaef5396',
    '0xc7ad5555961cd493ab67911ec4e37716011eac4151aae6887420dd83426bed89',
    '0xb53d6df50834824bcd46b1217f79083c44c1ec70253737bbb3ade83fa6b9895c',
    '0x0fd9864e1e91d9116d7e67a8a488f701d4599b60fb988a27f47d8512bf92b390'
]
// const accounts = [
//     '0x9137567d8fA5531A2740105F4Fc17e07ded9bd37',
//     '0xe8D16d41F40115602E890A3Ce5d7aeC53565d6a0',
//     '0x06D06554dC963A06144076c926712b3425d7f7AB',
//     '0x8D1c79Ca420a6EECB6c713C0C97856970ceeBB2f',
//     '0x8c978D80ce60B406f5e5DC8e1d0221457fC92A32'
// ]
// const keys = [
//     '0x97177eea34f5278f823c2d731e6bd7a9ec846ad96496d141cbff5f5d24896428',
//     '0x3999b6d837a5b24698e1607a9fd760000e500c3c2268d368f475cbc63d8afc6b',
//     '0xba31669402c4246d496780a7655c676fcae94de10dfb5c506cd06b94c1ed1736',
//     '0xafd04c81dbd68025e8b4fdd992ee459c906cf01c8d6d189c0181c7043bb753c8',
//     '0x67a9c47405e6d2a7955f14c15969d8b61932b063d1d5bbe5753a388f56842c72'
// ]

async function test_create1(account, env) {
    let _env = {...env}
    _env.wallet = new ethers.Wallet(account, env.provider)
    await approveFactory(_env)
    const { community, communityToken } = await createSimpleCommunity(_env);
    return community
}

async function test_pool_erc20(account, env) {
    let _env = {...env}
    _env.wallet = new ethers.Wallet(account, env.provider)
    const pool = erc20Pools[_env.wallet.address]
    const contract = new ethers.Contract(pool, ERC20StakingJson.abi, _env.wallet)
    const community = new ethers.Contract(communities[_env.wallet.address], CommunityJson.abi, _env.wallet)
    let tx;
    const nut = new ethers.Contract(NutAddress, NUTTokenJson.abi, _env.wallet);
    for (let i = 0; i < 3 ; i++){
        tx = await contract.deposit(124556465,
            {
                gasPrice: env.gasPrice,
                gasLimit: env.gasLimit
            });
        await waitForTx(env.provider, tx.hash)
        tx = await contract.withdraw(5234345,
            {
                gasPrice: env.gasPrice,
                gasLimit: env.gasLimit
            });
        await waitForTx(env.provider, tx.hash);
        tx = await community.withdrawPoolsRewards([pool],
            {
                gasPrice: env.gasPrice,
                gasLimit: env.gasLimit
            });
        await waitForTx(env.provider, tx.hash)
    }
}

async function test_power_up(account, env) {
    const wallet = new ethers.Wallet(account, env.provider)
    const np = new ethers.Contract(NutPowerAddress, NutPowerJson.abi, wallet)
    const nut = new ethers.Contract(NutAddress, NUTTokenJson.abi, wallet)
    let tx = await nut.approve(NutPowerAddress, ethers.constants.MaxUint256, {gasLimit: env.gasLimit});
    await waitForTx(env.provider, tx.hash);
    const balance = await nut.balanceOf(wallet.address)
    console.log('approve nut power', tx.hash);
    tx = await np.powerUp(parseUint(1), 6,
    {
        gasPrice: env.gasPrice,
        gasLimit: env.gasLimit
    });
    await waitForTx(env.provider, tx.hash);
    console.log('power up');
}

async function test_create_gauge(account, env) {
    const wallet = new ethers.Wallet(account, env.provider)
    await test_power_up(account, env);
    const gaugeContract = new ethers.Contract(GaugeAddress, GaugeJson.abi, wallet)
    const pool = erc20Pools[wallet.address]
    const community = communities[wallet.address]
    let tx = await gaugeContract.addNewGauge(community, pool,
        {
            gasPrice: env.gasPrice,
            gasLimit: env.gasLimit
        })
    await waitForTx(env.provider, tx.hash)
}

async function test_gauge_vote(account, env) {
    const wallet = new ethers.Wallet(account, env.provider)
    const gaugeContract = new ethers.Contract(GaugeAddress, GaugeJson.abi, wallet)
    const pool = erc20Pools[wallet.address]
    const community = communities[wallet.address]
    let tx = await gaugeContract.vote(pool, parseUint(5),
    {
        gasPrice: env.gasPrice,
        gasLimit: env.gasLimit
    })
    await waitForTx(env.provider, tx.hash)
    tx = await gaugeContract.unvote(pool, parseUint(2),
    {
        gasPrice: env.gasPrice,
        gasLimit: env.gasLimit
    })
    await waitForTx(env.provider, tx.hash)
    tx = await gaugeContract.userWithdrawReward(pool,
        {
            gasPrice: env.gasPrice,
            gasLimit: env.gasLimit
        });
    await waitForTx(env.provider, tx.hash)
    tx = await gaugeContract.communityWithdrawNut(community,
        {
            gasPrice: env.gasPrice,
            gasLimit: env.gasLimit
        });
    await waitForTx(env.provider, tx.hash)
}

async function main() {
    let env = {}
    env.url = process.env.TESTENDPOINT;
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasPrice = (await env.provider.getGasPrice()) * 1.2;
    env.gasPrice = 2000000000;
    env.gasLimit = 10000000

    // for (let key of keys) {
    //     test_create1(key, env)
    // }
    await Promise.all(keys.map(k => test_create1(k, env)))
    console.log('comunity:', communities);
    console.log('erc20', erc20Pools);
    console.log('steem', steemPools);
    console.log('atom', atomPools);
    console.log('osmo', osmoPools);
    console.log('juno', junoPools);
    await Promise.all(keys.map(k => test_pool_erc20(k, env)))
    await Promise.all(keys.map(k => test_create_gauge(k, env)))
    await Promise.all(keys.map(k => test_gauge_vote(k, env)))
    await Promise.all(keys.map(k => test_pool_erc20(k, env)))
    await Promise.all(keys.map(k => test_gauge_vote(k, env)))
}

main()