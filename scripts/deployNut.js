require('dotenv').config();
const ethers = require('ethers');
const fs = require("fs");
const { utf8ToHex } = require('./utils')

const NUTTokenJson = require('../build/contracts/NUTToken.json');
const NUTAddress = '0x4429FcdD4eC4EA4756B493e9c0525cBe747c2745'

async function deployNutContract(env) {
    let factory = new ethers.ContractFactory(NUTTokenJson.abi, NUTTokenJson.bytecode, env.wallet);
    let contract = await factory.deploy(
        'Nutbox',
        'NUT',
        ethers.utils.parseUnits("20000000.0", 18),
        '0x7b1941AE388f62d5Caf20D4f709Aafd74001ff58',
        { gasPrice: env.gasPrice, gasLimit: env.gasLimit}
    );
    await contract.deployed();
    console.log("✓ NUTToken contract deployed", contract.address);
    return contract.address;
}

async function addAddressToWhiteList(address, env) {
    const contract = new ethers.Contract('0x4429FcdD4eC4EA4756B493e9c0525cBe747c2745', NUTTokenJson.abi, env.wallet);
    const res = await contract.setWhiteList(address);
    console.log(`Add ${address} to NUT whiteList`);
}

async function removeAddressToWhiteList(address, env) {
    const contract = new ethers.Contract('0x4429FcdD4eC4EA4756B493e9c0525cBe747c2745', NUTTokenJson.abi, env.wallet);
    const res = await contract.removeWhiteList(address);
    console.log(`Remove ${address} to NUT whiteList`);
}

async function printRole(contract) {
    const minterRole = ethers.utils.keccak256('0x' + utf8ToHex("MINTER_ROLE"));
    const pauserRole = ethers.utils.keccak256('0x' + utf8ToHex("PAUSER_ROLE"));
    const adminRole = '0x0000000000000000000000000000000000000000000000000000000000000000'

    const [adminadmin, minteradmin, puaseradmin] = await Promise.all([contract.getRoleAdmin(adminRole),
        contract.getRoleAdmin(minterRole),
        contract.getRoleAdmin(pauserRole)
        ]) 
    console.log(adminadmin, minteradmin, puaseradmin);
    return
    const [mint0, pause0, admin0, mint1, pause1, admin1] = await Promise.all([
        contract.hasRole(minterRole, '0xc72aAaeA360Ca25b6FcdDE0422867ffBD3aE84C7'),
        contract.hasRole(pauserRole, '0xc72aAaeA360Ca25b6FcdDE0422867ffBD3aE84C7'),
        contract.hasRole(adminRole, '0xc72aAaeA360Ca25b6FcdDE0422867ffBD3aE84C7'),
        contract.hasRole(minterRole, '0xE32Fc78246c85e4f9801Bf54060B17467a6bB2ce'),
        contract.hasRole(pauserRole, '0xE32Fc78246c85e4f9801Bf54060B17467a6bB2ce'),
        contract.hasRole(adminRole, '0xE32Fc78246c85e4f9801Bf54060B17467a6bB2ce'),
    ])
    
    console.log(mint0, pause0, admin0, mint1, pause1, admin1);
}

async function main() {
    let env = {};
    env.url = process.env.ENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.KEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasLimit = ethers.utils.hexlify(Number(process.env.GASLIMIT));
    env.gasPrice = await env.provider.getGasPrice();

    const minterRole = ethers.utils.keccak256('0x' + utf8ToHex("MINTER_ROLE"));
    const pauserRole = ethers.utils.keccak256('0x' + utf8ToHex("PAUSER_ROLE"));
    const adminRole = '0x0000000000000000000000000000000000000000000000000000000000000000'
    console.log(minterRole, pauserRole);

    const contract = new ethers.Contract(NUTAddress, NUTTokenJson.abi, env.wallet);
   
    // await printRole(contract);
    // return;

    // grant role
    // let tx = await contract.grantRole(minterRole, '0xE32Fc78246c85e4f9801Bf54060B17467a6bB2ce', {
    //     gasPrice: env.gasPrice,
    //     gasLimit: env.gasLimit
    // })
    // console.log(tx.hash);
    // tx = await contract.grantRole(pauserRole, '0xE32Fc78246c85e4f9801Bf54060B17467a6bB2ce', {
    //     gasPrice: env.gasPrice,
    //     gasLimit: env.gasLimit
    // })
    // console.log(tx.hash);
    // let tx = await contract.grantRole(adminRole, '0xE32Fc78246c85e4f9801Bf54060B17467a6bB2ce', {
    //     gasPrice: env.gasPrice,
    //     gasLimit: env.gasLimit
    // });
    // console.log(tx.hash);

    // await printRole(contract);

     let tx = await contract.transferOwnership('0xE32Fc78246c85e4f9801Bf54060B17467a6bB2ce')
     console.log(tx.hash);
     let owner = await contract.owner()
     console.log(owner);

    return;
    tx = await contract.grantRole()

    // const NUT = await deployNutContract(env);
    await addAddressToWhiteList('0xAF33cBE3F52C159f9408a2b87Aed65826ac47258', env);
}

main()
  .catch(console.error)
  .finally(() => process.exit());