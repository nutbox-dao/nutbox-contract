require('dotenv').config();
const ethers = require('ethers');

const ERC1155NFT = require('../build/contracts/ERC1155NFT.json')

async function deployContract(env, uri) {
    let factory = new ethers.ContractFactory(ERC1155NFT.abi, ERC1155NFT.bytecode, env.wallet);
    let contract = await factory.deploy(uri);
    await contract.deployed();
    console.log("✅ Contract deployed: ", contract.address, uri);
    return contract.address;
}
async function main() {
    let env = {};
    env.url = process.env.TESTENDPOINT || 'http://localhost:8545';
    env.privateKey = process.env.TESTKEY;
    env.provider = new ethers.providers.JsonRpcProvider(env.url);
    console.log(`private: ${env.privateKey}, url: ${env.url}`);
    env.wallet = new ethers.Wallet(env.privateKey, env.provider);
    env.gasPrice = await env.provider.getGasPrice();

    const ADMIN_ROLE = ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 32);
    const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
    const PAUSER_ROLE = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a";

    // let ambassadorAddr = await deployContract(env, "https://ipfs.nutbox.app/gateway/ipns/k51qzi5uqu5dhrsa56dshoqcgl3utvvdn7qnt6kvh9vroww8ruawcphzrn1dna/{id}.json");
    let ambassadorAddr = "0xf37b162B98197D3f19eD4c597FEe99BaA71fC0D2";
    let ambassadorCon = new ethers.Contract(ambassadorAddr, ERC1155NFT.abi, env.wallet);
    // set role
    // let tx = await ambassadorCon.grantRole(ADMIN_ROLE, "0x39F6d5ccdB419335FA65283C300619c51599ba38");
    // tx = await ambassadorCon.grantRole(MINTER_ROLE, "0x375F413690b9Bb1CAB13084332D72B46B7De8881");
    // tx = await ambassadorCon.grantRole(MINTER_ROLE, "0xb78998FDE7FFe6AF4F21721A99E3F245E7236BA2");
    // tx = await ambassadorCon.grantRole(MINTER_ROLE, "0x096CbFf53fD2797D5504F297D644A15fFe0d3A49");

    // let peanutAddr = await deployContract(env, "https://ipfs.nutbox.app/gateway/ipns/k51qzi5uqu5dldudfbieqapmwds3e15s2vcunpf7qsycmcz6n88h98we2ksz9z/{id}.json");
    let peanutAddr ="0xfbBC551fEb4CBB691602402edBB74cEE513cAB88";
    let peanutCon = new ethers.Contract(peanutAddr, ERC1155NFT.abi, env.wallet);
    // set role
    // tx = await peanutCon.grantRole(ADMIN_ROLE, "0x39F6d5ccdB419335FA65283C300619c51599ba38");
    // tx = await peanutCon.grantRole(MINTER_ROLE, "0x375F413690b9Bb1CAB13084332D72B46B7De8881");
    // tx = await peanutCon.grantRole(MINTER_ROLE, "0xb78998FDE7FFe6AF4F21721A99E3F245E7236BA2");
    // tx = await peanutCon.grantRole(MINTER_ROLE, "0x096CbFf53fD2797D5504F297D644A15fFe0d3A49");
}

main()
    .catch(console.error)
    .finally(() => process.exit());