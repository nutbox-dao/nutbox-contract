const { ethers } = require("hardhat");
const deploy = require("./deploy");

function utf8ToHex(str) {
  return Array.from(str)
    .map((c) =>
      c.charCodeAt(0) < 128
        ? c.charCodeAt(0).toString(16)
        : encodeURIComponent(c).replace(/\%/g, "").toLowerCase()
    )
    .join("");
}

/**
 * Same economy as create-community.js but community token is non-mintable (fixed supply).
 * Treasury is seeded so reward withdrawals and accounting tests can run.
 */
async function deployCommunityNonMintable() {
  const [owner, communityOwner, alice, bob] = await ethers.getSigners();
  let contracts = await deploy(owner);
  contracts.owner = owner;
  contracts.communityOwner = communityOwner;
  contracts.alice = alice;
  contracts.bob = bob;

  const Token = await ethers.getContractFactory("FixedSupplyERC20");
  const token = await Token.deploy(ethers.utils.parseEther("100000000"));

  const blockNumber = await ethers.provider.getBlockNumber();
  const distribution = [
    { startHeight: blockNumber + 100, stopHeight: blockNumber + 1000, amount: 100 },
    { startHeight: blockNumber + 1001, stopHeight: blockNumber + 2000, amount: 50 },
    { startHeight: blockNumber + 2001, stopHeight: blockNumber + 5000, amount: 20 },
    { startHeight: blockNumber + 5001, stopHeight: blockNumber + 10000, amount: 10 },
  ];
  let distributionStr =
    "0x" + ethers.utils.hexZeroPad(ethers.utils.hexlify(distribution.length), 1).substring(2);
  for (let dis of distribution) {
    distributionStr +=
      ethers.utils.hexZeroPad(ethers.BigNumber.from(dis.startHeight).toHexString(), 32).substring(2) +
      ethers.utils.hexZeroPad(ethers.BigNumber.from(dis.stopHeight).toHexString(), 32).substring(2) +
      ethers.utils
        .hexZeroPad(ethers.utils.parseUnits(dis.amount.toString(), 18).toHexString(), 32)
        .substring(2);
  }

  const tx = await contracts.CommunityFactory.connect(communityOwner).createCommunity(
    false,
    token.address,
    ethers.constants.AddressZero,
    "0x",
    contracts.LinearCalculator.address,
    distributionStr,
    { value: 0 }
  );

  const receipt = await tx.wait();
  const event = receipt.events.find((e) => e.event === "CommunityCreated");
  contracts.Community = await ethers.getContractAt("Community", event.args.community);
  contracts.CToken = token;

  // Non-mintable rewards are paid from community balance; seed treasury + give owner funds for test setup
  await token.transfer(event.args.community, ethers.utils.parseEther("50000000"));
  await token.transfer(communityOwner.address, ethers.utils.parseEther("5000000"));

  return contracts;
}

module.exports = deployCommunityNonMintable;
