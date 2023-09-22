const { ethers, helpers } = require('hardhat');
const deploy = require('./deploy');

function utf8ToHex(str) 
{
    return Array.from(str).map(c =>
        c.charCodeAt(0) < 128 ? c.charCodeAt(0).toString(16) :
        encodeURIComponent(c).replace(/\%/g,'').toLowerCase()
    ).join('');
}

async function deployCommunity() {

    const [owner, communityOwner, alice, bob] = await ethers.getSigners();
    let contracts = await deploy(owner);
    contracts.owner = owner;
    contracts.communityOwner = communityOwner;
    contracts.alice = alice;
    contracts.bob = bob;

    // create community
    const blockNumber = await ethers.provider.getBlockNumber();
    console.log('Community will start at', blockNumber + 100);
    const distribution = [
        {
            startHeight: blockNumber + 100,
            stopHeight: blockNumber + 1000,
            amount: 100
        },
        {
            startHeight: blockNumber + 1001,
            stopHeight: blockNumber + 2000,
            amount: 50
        },
        {
            startHeight: blockNumber + 2001,
            stopHeight: blockNumber + 5000,
            amount: 20
        },
        {
            startHeight: blockNumber + 5001,
            stopHeight: blockNumber + 10000,
            amount: 10
        }
    ]
    let distributionStr =
        "0x" +
        ethers.utils
          .hexZeroPad(ethers.utils.hexlify(distribution.length), 1)
          .substring(2);
    for (let dis of distribution) {
        distributionStr +=
            ethers.utils
            .hexZeroPad(
                ethers.BigNumber.from(dis.startHeight).toHexString(),
                32
            )
            .substring(2) +
            ethers.utils
            .hexZeroPad(ethers.BigNumber.from(dis.stopHeight).toHexString(), 32)
            .substring(2) +
            ethers.utils
            .hexZeroPad(
                ethers.utils
                .parseUnits(dis.amount.toString(), 18)
                .toHexString(),
                32
            )
            .substring(2);
    }
    const meta = '0x' + ethers.utils.hexZeroPad(ethers.utils.hexlify("meme FERC".length), 1).substring(2)
                + utf8ToHex("meme FERC")
                + ethers.utils.hexZeroPad(ethers.utils.hexlify("MFERC".length), 1).substring(2)
                + utf8ToHex("MFERC")
                + ethers.utils.hexZeroPad(ethers.utils.parseUnits("10000", 18), 32).substring(2)
                + communityOwner.address.substring(2)

                
    const tx = await contracts.CommunityFactory.connect(communityOwner).createCommunity(true, ethers.constants.AddressZero, contracts.MintableERC20Factory.address, 
        meta, contracts.LinearCalculator.address, distributionStr);
    
    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === 'CommunityCreated')
    contracts.Community = await ethers.getContractAt('Community', event.args.community);
    contracts.CToken = await ethers.getContractAt("MintableERC20", event.args.communityToken);
    return contracts;
}

module.exports = deployCommunity