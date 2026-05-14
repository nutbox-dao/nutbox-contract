const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, mine } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunity = require("./create-community");
const { findEvent } = require("./receipt-events");

async function deployDFXStarScoreStakingFixture() {
  const contracts = await deployCommunity();
  const [owner, communityOwner, alice, bob, carol, operator] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("DFXStarScoreStakingFactory");
  const gameScoreFactory = await Factory.deploy(contracts.CommunityFactory.target);
  await gameScoreFactory.waitForDeployment();
  await contracts.Committee.adminAddContract(gameScoreFactory.target);

  const meta = ethers.solidityPacked(["address"], [operator.address]);
  const tx = await contracts.Community.connect(communityOwner).adminAddPool(
    "DFXStar Score Staking",
    [10000],
    gameScoreFactory.target,
    meta,
    { value: 0 }
  );
  const receipt = await tx.wait();
  const event = findEvent(receipt, contracts.Community.interface, "AdminSetPoolRatio");
  const poolAddress = event.args.pools[event.args.pools.length - 1];
  const pool = await ethers.getContractAt("DFXStarScoreStaking", poolAddress);

  return {
    ...contracts,
    owner,
    communityOwner,
    alice,
    bob,
    carol,
    operator,
    pool,
    gameScoreFactory,
  };
}

describe("DFXStarScoreStaking", function () {
  it("initializes with expected metadata", async () => {
    const { pool, gameScoreFactory, Community, operator } = await loadFixture(
      deployDFXStarScoreStakingFixture
    );
    expect(await pool.getFactory()).to.equal(gameScoreFactory.target);
    expect(await pool.getCommunity()).to.equal(Community.target);
    expect(await pool.gameOperator()).to.equal(operator.address);
  });

  it("only gameOperator can depositFromGame", async () => {
    const { pool, alice, bob } = await loadFixture(deployDFXStarScoreStakingFixture);
    await expect(
      pool.connect(alice).depositFromGame(bob.address, 100, { value: 0 })
    ).to.be.revertedWithCustomError(pool, "NotGameOperator");
  });

  it("injectRewards(0) reverts", async () => {
    const { pool, carol } = await loadFixture(deployDFXStarScoreStakingFixture);
    await expect(
      pool.connect(carol).injectRewards(0, { value: 0 })
    ).to.be.revertedWithCustomError(pool, "ZeroAmount");
  });

  it("any address can inject and rewards follow score ratio", async () => {
    const { pool, operator, alice, bob, carol, CToken, communityOwner } =
      await loadFixture(deployDFXStarScoreStakingFixture);

    await pool.connect(operator).depositFromGame(alice.address, 100, { value: 0 });
    await pool.connect(operator).depositFromGame(bob.address, 300, { value: 0 });

    const injected = ethers.parseEther("400");
    await CToken.connect(communityOwner).transfer(carol.address, injected);
    await CToken.connect(carol).approve(pool.target, injected);
    await pool.connect(carol).injectRewards(injected, { value: 0 });

    expect(await pool.getPendingExternalRewards(alice.address)).to.equal(
      ethers.parseEther("100")
    );
    expect(await pool.getPendingExternalRewards(bob.address)).to.equal(
      ethers.parseEther("300")
    );

    const beforeAlice = await CToken.balanceOf(alice.address);
    const beforeBob = await CToken.balanceOf(bob.address);
    await pool.connect(alice).claimExternalRewards({ value: 0 });
    await pool.connect(bob).claimExternalRewards({ value: 0 });
    const afterAlice = await CToken.balanceOf(alice.address);
    const afterBob = await CToken.balanceOf(bob.address);

    expect(afterAlice - beforeAlice).to.equal(ethers.parseEther("100"));
    expect(afterBob - beforeBob).to.equal(ethers.parseEther("300"));
  });

  it("claimExternalRewards is no-op when pending is zero", async () => {
    const { pool, operator, alice, Committee } = await loadFixture(
      deployDFXStarScoreStakingFixture
    );

    await pool.connect(operator).depositFromGame(alice.address, 100, { value: 0 });
    await Committee.adminSetPoolOperationFee(ethers.parseEther("0.01"));

    // no pending external rewards: should not revert and should not require fee
    await expect(pool.connect(alice).claimExternalRewards({ value: 0 })).to.not.be
      .reverted;

    expect(await pool.getPendingExternalRewards(alice.address)).to.equal(0n);
  });

  it("depositFromGame requires fee unless operator is fee-free", async () => {
    const { pool, operator, alice, Committee } = await loadFixture(
      deployDFXStarScoreStakingFixture
    );

    const fee = ethers.parseEther("0.01");
    await Committee.adminSetPoolOperationFee(fee);

    await expect(
      pool.connect(operator).depositFromGame(alice.address, 10, { value: 0 })
    ).to.be.revertedWith("Insufficient fee");

    await Committee.adminAddFeeFreeAddress(operator.address);
    await pool.connect(operator).depositFromGame(alice.address, 10, { value: 0 });

    expect(await pool.getUserStakedAmount(alice.address)).to.equal(10n);
  });

  it("A-line rewards are claimed by user directly from Community", async () => {
    const { pool, operator, alice, Community, CToken } = await loadFixture(
      deployDFXStarScoreStakingFixture
    );

    await pool.connect(operator).depositFromGame(alice.address, 100, { value: 0 });
    await mine(200);
    await pool.connect(operator).depositFromGame(alice.address, 1, { value: 0 });

    const pending = await Community.getPoolPendingRewards(pool.target, alice.address);
    expect(pending).to.be.gt(0n);

    const before = await CToken.balanceOf(alice.address);
    await Community.connect(alice).withdrawPoolsRewards([pool.target], { value: 0 });
    const after = await CToken.balanceOf(alice.address);
    expect(after).to.be.gt(before);
  });

  it("community owner can rotate gameOperator without touching pool accrual", async () => {
    const { pool, communityOwner, alice } = await loadFixture(
      deployDFXStarScoreStakingFixture
    );
    await pool.connect(communityOwner).adminSetGameOperator(alice.address);
    expect(await pool.gameOperator()).to.equal(alice.address);
  });
});
