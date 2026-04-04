const { ethers } = require("hardhat");
const deploy = require("./deploy");
const { findEvent } = require("./receipt-events");
const { encodeLinearDistribution } = require("./distribution-meta");

/**
 * Non-mintable community using HookCommunityToken so reward `transfer` can invoke IRewardHook on recipient.
 */
async function deployCommunityHookToken() {
  const [owner, communityOwner, alice, bob] = await ethers.getSigners();
  let contracts = await deploy(owner);
  contracts.owner = owner;
  contracts.communityOwner = communityOwner;
  contracts.alice = alice;
  contracts.bob = bob;

  const Token = await ethers.getContractFactory("HookCommunityToken");
  const token = await Token.deploy(ethers.parseEther("100000000"));
  await token.waitForDeployment();

  const blockNumber = await ethers.provider.getBlockNumber();
  const distribution = [
    { startHeight: blockNumber + 100, stopHeight: blockNumber + 1000, amount: 100 },
    { startHeight: blockNumber + 1001, stopHeight: blockNumber + 2000, amount: 50 },
    { startHeight: blockNumber + 2001, stopHeight: blockNumber + 5000, amount: 20 },
    { startHeight: blockNumber + 5001, stopHeight: blockNumber + 10000, amount: 10 },
  ];
  const distributionStr = encodeLinearDistribution(distribution);

  const tx = await contracts.CommunityFactory.connect(communityOwner).createCommunity(
    false,
    token.target,
    ethers.ZeroAddress,
    "0x",
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
  contracts.CToken = token;

  await token.setHookCommunity(event.args.community);

  await token.transfer(event.args.community, ethers.parseEther("50000000"));
  await token.transfer(communityOwner.address, ethers.parseEther("5000000"));

  return contracts;
}

module.exports = deployCommunityHookToken;
