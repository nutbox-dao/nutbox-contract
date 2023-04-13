require('dotenv').config();
const ethers = require('ethers');
const { getEnv } = require('../scripts/utils');

const Curation = require("../build/contracts/AutoCuration.json");

async function main() {
    let env = await getEnv(false);

    let cCuration = new ethers.Contract(Curation.networks[env.chainId].address, Curation.abi, env.wallet);

    console.log("signer: ", env.wallet.address);

    let twitterId = 3419530221;
    let curationIds = ['0x4215233f3d1f'];
    let amount = ethers.utils.parseEther("1172.165639227039953926")

    let data = ethers.utils.solidityKeccak256(['uint256', 'uint256', 'address', 'uint256[]', 'uint256'], [twitterId, env.chainId, env.wallet.address, curationIds, amount]);

    console.log("data: ", data.length, data);

    data = ethers.utils.arrayify(data);
    console.log("hashmsg: ", ethers.utils.hashMessage(data));

    let sign = await env.wallet.signMessage(data);
    console.log("sign: ", sign.length, sign);

    let sig = ethers.utils.splitSignature(sign);
    console.log("sig: ", sig);

    await cCuration.claimPrize(twitterId, env.wallet.address, curationIds, amount, sign);
}


main()
    .catch(console.error)
    .finally(() => process.exit());



// [
//     BigNumber { _hex: '0xcbd1e3ed', _isBigNumber: true },
//     '0x58637112d07e32aB86208E36b1E81463e9C64E60',
//     [BigNumber { _hex: '0x4215233f3d1f', _isBigNumber: true }],
//     BigNumber { _hex: '0x3f8b10e67a2e663406', _isBigNumber: true },
//     '0xe66b8ff162dd92256848eb2099f6ac727be70fdd4a1fd0ca376bb1c9d15e7435097464c01c16e9b9cdc41741c0f8b5cfd088a457a772edb56ceee6a181359c871b'
// ]
// 3419530221