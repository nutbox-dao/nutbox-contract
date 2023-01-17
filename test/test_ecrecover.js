require('dotenv').config();
const ethers = require('ethers');
const { getEnv, waitForTx } = require('../scripts/utils');

const Curation = require("../build/contracts/Curation.json");


async function main() {
    let env = await getEnv(false);

    let cCuration = new ethers.Contract(Curation.networks[env.chainId].address, Curation.abi, env.wallet);

    console.log("signer: ", env.wallet.address);

    let twitterId = 123;
    let curationIds = [123, 234, 345, 456];
    let amounts = [10, 100, 1000, 10000];

    let data = ethers.utils.solidityKeccak256(["uint256", "uint256", "address", "uint256[]", "uint256[]"], [twitterId, 137, env.wallet.address, curationIds, amounts]);

    console.log("data: ", data.length, data);

    data = ethers.utils.arrayify(data);
    console.log("hashmsg: ", ethers.utils.hashMessage(data));

    let sign = await env.wallet.signMessage(data);
    console.log("sign: ", sign.length, sign);

    let sig = ethers.utils.splitSignature(sign);
    console.log("sig: ", sig);

    await cCuration.claimPrize(twitterId, env.wallet.address, curationIds, amounts, sign);
}


main()
    .catch(console.error)
    .finally(() => process.exit());

