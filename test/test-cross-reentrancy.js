const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunity = require("./create-community");
const { findEvent } = require("./receipt-events");

describe("Cross-Contract Reentrancy Test", async () => {
  let contracts;
  let owner;
  let communityOwner;
  let alice;
  let crossReentrantToken;

  beforeEach(async () => {
    contracts = await loadFixture(deployCommunity);
    owner = contracts.owner;
    communityOwner = contracts.communityOwner;
    alice = contracts.alice;

    const MaliciousToken = await ethers.getContractFactory("CrossReentrantERC20");
    crossReentrantToken = await MaliciousToken.deploy();
    await crossReentrantToken.waitForDeployment();
  });

  function erc20PoolMeta(tokenAddress) {
    return ethers.solidityPacked(["address"], [tokenAddress]);
  }

  it("should prevent CEI cross-contract reentrancy and calculate correct pending rewards", async () => {
    const meta = erc20PoolMeta(crossReentrantToken.target);
    const tx = await contracts.Community.connect(communityOwner).adminAddPool(
      "Stake Evil Token",
      [10000],
      contracts.ERC20StakingFactory.target,
      meta,
      { value: 0 }
    );
    const receipt = await tx.wait();
    const event = findEvent(receipt, contracts.Community.interface, "AdminSetPoolRatio");
    const poolAddr = await contracts.Community.activedPools(0);
    const pool = await ethers.getContractAt("ERC20Staking", poolAddr);

    await crossReentrantToken.transfer(alice.address, ethers.parseEther("100"));
    await crossReentrantToken.connect(alice).approve(poolAddr, ethers.MaxUint256);
    await crossReentrantToken.connect(alice).setTargets(contracts.Community.target, poolAddr);

    await pool.connect(alice).deposit(ethers.parseEther("10"));

    for (let i = 0; i < 5; i++) {
      await ethers.provider.send("evm_mine", []);
    }

    await crossReentrantToken.connect(alice).arm();

    await pool.connect(alice).withdraw(ethers.parseEther("10"));

    const attempted = await crossReentrantToken.reentryAttempted();

    expect(attempted).to.be.true;
  });
});
