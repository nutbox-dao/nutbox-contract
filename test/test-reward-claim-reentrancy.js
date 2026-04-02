const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, mine } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunityHookToken = require("./create-community-hook-token");

/**
 * 领取奖励（withdrawPoolsRewards）过程中，恶意社区代币在 transfer 后回调接收合约，
 * 尝试重入：再次领奖 / 向池子存款 / 从池子取款。
 */
describe("Reward claim reentrancy (hook token)", function () {
  async function minePastRewardStart(contracts, extra = 5) {
    const start = await contracts.LinearCalculator.getStartBlock(contracts.Community.address);
    let bn = await ethers.provider.getBlockNumber();
    const need = start + extra - bn;
    if (need > 0) await mine(need);
  }

  function erc20PoolMeta(tokenAddress) {
    return ethers.utils.solidityPack(["address"], [tokenAddress]);
  }

  async function setupPoolAndAttacker(contracts, communityOwner) {
    const meta = erc20PoolMeta(contracts.CToken.address);
    const tx = await contracts.Community.connect(communityOwner).adminAddPool(
      "Stake HCT",
      [10000],
      contracts.ERC20StakingFactory.address,
      meta,
      { value: 0 }
    );
    const receipt = await tx.wait();
    const ev = receipt.events.find((e) => e.event === "AdminSetPoolRatio");
    const poolAddr = ev.args.pools[ev.args.pools.length - 1];
    const pool = await ethers.getContractAt("ERC20Staking", poolAddr);

    const Attacker = await ethers.getContractFactory("RewardReentryAttacker");
    const attacker = await Attacker.deploy(contracts.Community.address);
    // pool / stakeToken 必须在首次 stake 前配置（否则 deposit 调到 address(0)）
    await attacker.configure([poolAddr], poolAddr, contracts.CToken.address, 0);

    const stakeAmt = ethers.utils.parseEther("2000");
    // 需要额外余额给“同步”用的第二次 deposit(1)
    await contracts.CToken.connect(communityOwner).transfer(
      attacker.address,
      stakeAmt.add(ethers.utils.parseEther("100"))
    );
    await attacker.approvePool(ethers.constants.MaxUint256);
    await attacker.stake(stakeAmt, { value: 0 });

    await minePastRewardStart(contracts);
    await mine(40);
    // 推动链上 totalUserPendingRewards 与视图一致（与 admin-withdraw 测试同理）
    await attacker.stake(ethers.utils.parseEther("1"), { value: 0 });

    const pending = await contracts.Community.getPoolPendingRewards(poolAddr, attacker.address);
    expect(pending).to.be.gt(0);

    return { poolAddr, pool, attacker };
  }

  it("nested withdrawPoolsRewards reverts (Community nonReentrant)", async function () {
    const contracts = await loadFixture(deployCommunityHookToken);
    const { communityOwner } = contracts;
    const { poolAddr, attacker } = await setupPoolAndAttacker(contracts, communityOwner);

    await contracts.CToken.setHookArmed(true);
    await attacker.configure([poolAddr], poolAddr, contracts.CToken.address, 1);

    const beforeBal = await contracts.CToken.balanceOf(attacker.address);
    await attacker.claim({ value: 0 });
    const afterBal = await contracts.CToken.balanceOf(attacker.address);

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
    await attacker.configure([poolAddr], poolAddr, contracts.CToken.address, 2);

    const stakedBefore = await pool.getUserStakedAmount(attacker.address);
    await attacker.claim({ value: 0 });
    const stakedAfter = await pool.getUserStakedAmount(attacker.address);

    expect(await attacker.reentryAttempted()).to.equal(true);
    expect(await attacker.nestedCallSucceeded()).to.equal(true);
    expect(stakedAfter).to.equal(stakedBefore.add(1));

    await contracts.CToken.setHookArmed(false);
  });

  it("nested pool.withdraw during claim: outer claim completes; observe pool behavior", async function () {
    const contracts = await loadFixture(deployCommunityHookToken);
    const { communityOwner } = contracts;
    const { poolAddr, attacker, pool } = await setupPoolAndAttacker(contracts, communityOwner);

    await contracts.CToken.setHookArmed(true);
    await attacker.configure([poolAddr], poolAddr, contracts.CToken.address, 3);

    const stakedBefore = await pool.getUserStakedAmount(attacker.address);
    await attacker.claim({ value: 0 });
    const stakedAfter = await pool.getUserStakedAmount(attacker.address);

    expect(await attacker.reentryAttempted()).to.equal(true);
    expect(await attacker.nestedCallSucceeded()).to.equal(true);
    expect(stakedAfter).to.equal(stakedBefore.sub(1));

    await contracts.CToken.setHookArmed(false);
  });
});
