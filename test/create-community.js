const { ethers } = require('hardhat');
const deploy = require('./deploy')

async function deployCommunity(owner, communityOwner) {
    const contracts = await deploy(owner);

    // create community
    

}