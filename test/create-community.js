const { ethers } = require("hardhat");
const deploy = require("./deploy");
const { findEvent } = require("./receipt-events");
const { encodeLinearDistribution } = require("./distribution-meta");

function utf8ToHex(str) {
  return Array.from(str)
    .map((c) =>
      c.charCodeAt(0) < 128
        ? c.charCodeAt(0).toString(16)
        : encodeURIComponent(c).replace(/\%/g, "").toLowerCase()
    )
    .join("");
}

async function deployCommunity() {
  const [owner, communityOwner, alice, bob] = await ethers.getSigners();
  let contracts = await deploy(owner);
  contracts.owner = owner;
  contracts.communityOwner = communityOwner;
  contracts.alice = alice;
  contracts.bob = bob;

  const blockNumber = await ethers.provider.getBlockNumber();
  const distribution = [
    { startHeight: blockNumber + 100, stopHeight: blockNumber + 1000, amount: 100 },
    { startHeight: blockNumber + 1001, stopHeight: blockNumber + 2000, amount: 50 },
    { startHeight: blockNumber + 2001, stopHeight: blockNumber + 5000, amount: 20 },
    { startHeight: blockNumber + 5001, stopHeight: blockNumber + 10000, amount: 10 },
  ];
  const distributionStr = encodeLinearDistribution(distribution);

  const meta =
    "0x" +
    ethers.zeroPadValue(ethers.toBeHex("meme FERC".length), 1).substring(2) +
    utf8ToHex("meme FERC") +
    ethers.zeroPadValue(ethers.toBeHex("MFERC".length), 1).substring(2) +
    utf8ToHex("MFERC") +
    ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits("10000", 18)), 32).substring(2) +
    communityOwner.address.substring(2);

  const tx = await contracts.CommunityFactory.connect(communityOwner).createCommunity(
    true,
    ethers.ZeroAddress,
    contracts.MintableERC20Factory.target,
    meta,
    contracts.LinearCalculator.target,
    distributionStr,
    { value: 0 }
  );

  const receipt = await tx.wait();
  const event = findEvent(
    receipt,
    contracts.CommunityFactory.interface,
    "CommunityCreated"
  );
  contracts.Community = await ethers.getContractAt("Community", event.args.community);
  contracts.CToken = await ethers.getContractAt(
    "MintableERC20",
    event.args.communityToken
  );
  return contracts;
}

module.exports = deployCommunity;
