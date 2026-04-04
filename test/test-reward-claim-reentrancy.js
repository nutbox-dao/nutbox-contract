const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, mine } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunityHookToken = require("./create-community-hook-token");
const { findEvent } = require("./receipt-events");

/**
 * 领取奖励（withdrawPoolsRewards）过程中，恶意社区代币在 transfer 后回调接收合约，
 * 尝试重入：再次领奖 / 向池子存款 / 从池子取款。
 */
describe("Reward claim reentrancy (hook token)", function () {
  async function minePastRewardStart(contracts, extra = 5) {
    const start = await contracts.LinearCalculator.getStartCursor(contracts.Community.target);
    let bn = await ethers.provider.getBlockNumber();
    const need = Number(start) + extra - bn;
    if (need > 0) await mine(need);
  }

  function erc20PoolMeta(tokenAddress) {
    return ethers.solidityPacked(["address"], [tokenAddress]);
  }

  async function setupPoolAndAttacker(contracts, communityOwner) {
    const meta = erc20PoolMeta(contracts.CToken.target);
    const tx = await contracts.Community.connect(communityOwner).adminAddPool(
      "Stake HCT",
      [10000],
      contracts.ERC20StakingFactory.target,
      meta,
      { value: 0 }
    );
    const receipt = await tx.wait();
    const ev = findEvent(receipt, contracts.Community.interface, "AdminSetPoolRatio");
    const poolAddr = ev.args.pools[ev.args.pools.length - 1];
    const pool = await ethers.getContractAt("ERC20Staking", poolAddr);

    const Attacker = await ethers.getContractFactory("RewardReentryAttacker");
    const attacker = await Attacker.deploy(contracts.Community.target);
    await attacker.waitForDeployment();
    await attacker.configure([poolAddr], poolAddr, contracts.CToken.target, 0);

    const stakeAmt = ethers.parseEther("2000");
    await contracts.CToken.connect(communityOwner).transfer(
      attacker.target,
      stakeAmt + ethers.parseEther("100")
    );
    await attacker.approvePool(ethers.MaxUint256);
    await attacker.stake(stakeAmt, { value: 0 });

    await minePastRewardStart(contracts);
    await mine(40);
    await attacker.stake(ethers.parseEther("1"), { value: 0 });

    const pending = await contracts.Community.getPoolPendingRewards(poolAddr, attacker.target);
    expect(pending).to.be.gt(0);

    return { poolAddr, pool, attacker };
  }

  it("nested withdrawPoolsRewards reverts (Community nonReentrant)", async function () {
    const contracts = await loadFixture(deployCommunityHookToken);
    const { communityOwner } = contracts;
    const { poolAddr, attacker } = await setupPoolAndAttacker(contracts, communityOwner);

    await contracts.CToken.setHookArmed(true);
    await attacker.configure([poolAddr], poolAddr, contracts.CToken.target, 1);

    const beforeBal = await contracts.CToken.balanceOf(attacker.target);
    await attacker.claim({ value: 0 });
    const afterBal = await contracts.CToken.balanceOf(attacker.target);

    expect(await attacker.reentryAttempted()).to.equal(true);
    expect(await attacker.nestedCallSucceeded()).to.equal(false);
    expect(afterBal).to.be.gt(beforeBal);

    await contracts.CToken.setHookArmed(false);
  });

  it("nested pool.deposit during claim: outer claim completes; hook may succeed on pool (separate guard)", async function () {
    const contracts = await loadFixture(deployCommunityHookToken);
    const { communityOwner } = contracts;
    const { poolAddr, attacker, pool } = await setupPoolAndAttacker(contracts, communityOwner);

    await contracts.CToken.setHookArmed(true);
    await attacker.configure([poolAddr], poolAddr, contracts.CToken.target, 2);

    const stakedBefore = await pool.getUserStakedAmount(attacker.target);
    await attacker.claim({ value: 0 });
    const stakedAfter = await pool.getUserStakedAmount(attacker.target);

    expect(await attacker.reentryAttempted()).to.equal(true);
    expect(await attacker.nestedCallSucceeded()).to.equal(true);
    expect(stakedAfter).to.equal(stakedBefore + 1n);

    await contracts.CToken.setHookArmed(false);
  });

  it("nested pool.withdraw during claim: outer claim completes; observe pool behavior", async function () {
    const contracts = await loadFixture(deployCommunityHookToken);
    const { communityOwner } = contracts;
    const { poolAddr, attacker, pool } = await setupPoolAndAttacker(contracts, communityOwner);

    await contracts.CToken.setHookArmed(true);
    await attacker.configure([poolAddr], poolAddr, contracts.CToken.target, 3);

    const stakedBefore = await pool.getUserStakedAmount(attacker.target);
    await attacker.claim({ value: 0 });
    const stakedAfter = await pool.getUserStakedAmount(attacker.target);

    expect(await attacker.reentryAttempted()).to.equal(true);
    expect(await attacker.nestedCallSucceeded()).to.equal(true);
    expect(stakedAfter).to.equal(stakedBefore - 1n);

    await contracts.CToken.setHookArmed(false);
  });
});
