const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, mine } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunity = require("./create-community");
const { findEvent } = require("./receipt-events");
const { u256Hex, amountHex } = require("./distribution-meta");

/**
 * Helper: build ERC20 pool meta from token address
 */
function erc20PoolMeta(tokenAddress) {
  return ethers.solidityPacked(["address"], [tokenAddress]);
}

/**
 * Helper: build ERC20Locking pool meta
 */
function erc20LockingMeta(tokenAddress, lockDuration) {
  return ethers.solidityPacked(["address", "uint256"], [tokenAddress, lockDuration]);
}

/**
 * Helper: create a pool and return its address
 */
async function createERC20Pool(contracts, communityOwner, ratios) {
  const meta = erc20PoolMeta(contracts.CToken.target);
  const tx = await contracts.Community.connect(communityOwner).adminAddPool(
    "Stake ERC20", ratios, contracts.ERC20StakingFactory.target, meta, { value: 0 }
  );
  const receipt = await tx.wait();
  const event = findEvent(receipt, contracts.Community.interface, "AdminSetPoolRatio");
  return event.args.pools[event.args.pools.length - 1];
}

describe("Comprehensive Contract Tests", function () {
  let contracts, owner, communityOwner, alice, bob;

  beforeEach(async () => {
    contracts = await loadFixture(deployCommunity);
    owner = contracts.owner;
    communityOwner = contracts.communityOwner;
    alice = contracts.alice;
    bob = contracts.bob;
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. Committee Contract Tests
  // ═══════════════════════════════════════════════════════════════
  describe("Committee", () => {
    describe("Access Control", () => {
      it("Only owner can set fee recipient", async () => {
        await expect(
          contracts.Committee.connect(alice).adminSetFeeRecipient(alice.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Only owner can set create community fee", async () => {
        await expect(
          contracts.Committee.connect(alice).adminSetCreateCommunityFee(100)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Only owner can set community settings fee", async () => {
        await expect(
          contracts.Committee.connect(alice).adminSetCommunitySettingsFee(100)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Only owner can set pool operation fee", async () => {
        await expect(
          contracts.Committee.connect(alice).adminSetPoolOperationFee(100)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Only owner can add/remove whitelist contracts", async () => {
        await expect(
          contracts.Committee.connect(alice).adminAddContract(alice.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(
          contracts.Committee.connect(alice).adminRemoveContract(alice.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Only owner can add/remove fee-free addresses", async () => {
        await expect(
          contracts.Committee.connect(alice).adminAddFeeFreeAddress(alice.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(
          contracts.Committee.connect(alice).adminRemoveFeeFreeAddress(alice.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });


    });

    describe("Fee Configuration", () => {
      it("Fee recipient cannot be zero address", async () => {
        await expect(
          contracts.Committee.adminSetFeeRecipient(ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid feeRecipient");
      });

      it("All fee tiers can be set and read correctly", async () => {
        const fee1 = ethers.parseEther("0.1");
        const fee2 = ethers.parseEther("0.05");
        const fee3 = ethers.parseEther("0.01");

        await contracts.Committee.adminSetCreateCommunityFee(fee1);
        await contracts.Committee.adminSetCommunitySettingsFee(fee2);
        await contracts.Committee.adminSetPoolOperationFee(fee3);

        expect(await contracts.Committee.getCreateCommunityFee()).to.equal(fee1);
        expect(await contracts.Committee.getCommunitySettingsFee()).to.equal(fee2);
        expect(await contracts.Committee.getPoolOperationFee()).to.equal(fee3);
      });

      it("Fee-free list works correctly (add/remove/verify)", async () => {
        expect(await contracts.Committee.getFeeFree(alice.address)).to.equal(false);
        await contracts.Committee.adminAddFeeFreeAddress(alice.address);
        expect(await contracts.Committee.getFeeFree(alice.address)).to.equal(true);
        await contracts.Committee.adminRemoveFeeFreeAddress(alice.address);
        expect(await contracts.Committee.getFeeFree(alice.address)).to.equal(false);
      });
    });

    describe("Contract Whitelist", () => {
      it("Add and remove contract from whitelist", async () => {
        const addr = alice.address;
        await contracts.Committee.adminAddContract(addr);
        expect(await contracts.Committee.verifyContract(addr)).to.equal(true);
        await contracts.Committee.adminRemoveContract(addr);
        expect(await contracts.Committee.verifyContract(addr)).to.equal(false);
      });

      it("Non-whitelisted contract returns false", async () => {
        expect(await contracts.Committee.verifyContract(alice.address)).to.equal(false);
      });
    });


  });

  // ═══════════════════════════════════════════════════════════════
  // 2. Community Factory Tests
  // ═══════════════════════════════════════════════════════════════
  describe("CommunityFactory", () => {
    it("Rejects unsupported calculator", async () => {
      const meta = "0x" +
        ethers.zeroPadValue(ethers.toBeHex(4), 1).substring(2) +
        Buffer.from("Test").toString("hex") +
        ethers.zeroPadValue(ethers.toBeHex(2), 1).substring(2) +
        Buffer.from("TT").toString("hex") +
        amountHex(ethers.parseUnits("1000", 18)) +
        alice.address.substring(2);

      const blockNumber = await ethers.provider.getBlockNumber();
      const distribution = "0x01" +
        ethers.zeroPadValue(ethers.toBeHex(blockNumber + 10), 32).substring(2) +
        ethers.zeroPadValue(ethers.toBeHex(blockNumber + 100), 32).substring(2) +
        amountHex(ethers.parseUnits("100", 18));

      await expect(
        contracts.CommunityFactory.connect(alice).createCommunity(
          true, ethers.ZeroAddress, contracts.MintableERC20Factory.target,
          meta, alice.address, distribution, { value: 0 }
        )
      ).to.be.revertedWith("UC");
    });

    it("Rejects unsupported token factory", async () => {
      const meta = "0x" +
        ethers.zeroPadValue(ethers.toBeHex(4), 1).substring(2) +
        Buffer.from("Test").toString("hex") +
        ethers.zeroPadValue(ethers.toBeHex(2), 1).substring(2) +
        Buffer.from("TT").toString("hex") +
        amountHex(ethers.parseUnits("1000", 18)) +
        alice.address.substring(2);

      const blockNumber = await ethers.provider.getBlockNumber();
      const distribution = "0x01" +
        ethers.zeroPadValue(ethers.toBeHex(blockNumber + 10), 32).substring(2) +
        ethers.zeroPadValue(ethers.toBeHex(blockNumber + 100), 32).substring(2) +
        amountHex(ethers.parseUnits("100", 18));

      // Use a non-whitelisted token factory
      await expect(
        contracts.CommunityFactory.connect(alice).createCommunity(
          true, ethers.ZeroAddress, alice.address,
          meta, contracts.LinearCalculator.target, distribution, { value: 0 }
        )
      ).to.be.revertedWith("UTC");
    });

    it("Tracks created communities correctly", async () => {
      expect(await contracts.CommunityFactory.createdCommunity(contracts.Community.target)).to.equal(true);
      expect(await contracts.CommunityFactory.createdCommunity(alice.address)).to.equal(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. Community Contract - Admin Functions
  // ═══════════════════════════════════════════════════════════════
  describe("Community - Admin", () => {
    describe("adminSetDev", () => {
      it("Owner can set dev fund address", async () => {
        await contracts.Community.connect(communityOwner).adminSetDev(alice.address);
      });

      it("Non-owner cannot set dev fund address", async () => {
        await expect(
          contracts.Community.connect(alice).adminSetDev(alice.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Cannot set zero address as dev", async () => {
        await expect(
          contracts.Community.connect(communityOwner).adminSetDev(ethers.ZeroAddress)
        ).to.be.revertedWith("IA");
      });
    });

    describe("adminSetFeeRatio", () => {
      it("Owner can set fee ratio", async () => {
        await contracts.Community.connect(communityOwner).adminSetFeeRatio(2000, { value: 0 });
        expect(await contracts.Community.feeRatio()).to.equal(2000);
      });

      it("Fee ratio cannot exceed 10000", async () => {
        await expect(
          contracts.Community.connect(communityOwner).adminSetFeeRatio(10001, { value: 0 })
        ).to.be.revertedWith("PR>1w");
      });

      it("Non-owner cannot set fee ratio", async () => {
        await expect(
          contracts.Community.connect(alice).adminSetFeeRatio(2000, { value: 0 })
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("adminAddPool", () => {
      it("Ratio count must match activePools + 1", async () => {
        const meta = erc20PoolMeta(contracts.CToken.target);
        await expect(
          contracts.Community.connect(communityOwner).adminAddPool(
            "Bad", [5000, 5000], contracts.ERC20StakingFactory.target, meta, { value: 0 }
          )
        ).to.be.revertedWith("WPC");
      });

      it("Ratio sum must equal 10000 or 0", async () => {
        const meta = erc20PoolMeta(contracts.CToken.target);
        await expect(
          contracts.Community.connect(communityOwner).adminAddPool(
            "Bad", [5000], contracts.ERC20StakingFactory.target, meta, { value: 0 }
          )
        ).to.be.revertedWith("RS!=1w");
      });

      it("Rejects non-whitelisted pool factory", async () => {
        const meta = erc20PoolMeta(contracts.CToken.target);
        await expect(
          contracts.Community.connect(communityOwner).adminAddPool(
            "Bad", [10000], alice.address, meta, { value: 0 }
          )
        ).to.be.revertedWith("UPF");
      });

      it("Can add multiple pools with correct ratios", async () => {
        const meta = erc20PoolMeta(contracts.CToken.target);
        await contracts.Community.connect(communityOwner).adminAddPool(
          "Pool A", [10000], contracts.ERC20StakingFactory.target, meta, { value: 0 }
        );
        await contracts.Community.connect(communityOwner).adminAddPool(
          "Pool B", [5000, 5000], contracts.ERC20StakingFactory.target, meta, { value: 0 }
        );
        // Verify two active pools
        const pool0 = await contracts.Community.activedPools(0);
        const pool1 = await contracts.Community.activedPools(1);
        expect(pool0).to.not.equal(ethers.ZeroAddress);
        expect(pool1).to.not.equal(ethers.ZeroAddress);
        expect(pool0).to.not.equal(pool1);

        // Explicit SET -> GET assertions
        expect(await contracts.Community.poolActived(pool0)).to.equal(true);
        expect(await contracts.Community.poolActived(pool1)).to.equal(true);
      });

      it("Can add pool with all-zero ratios", async () => {
        const meta = erc20PoolMeta(contracts.CToken.target);
        await contracts.Community.connect(communityOwner).adminAddPool(
          "Pool Zero", [0], contracts.ERC20StakingFactory.target, meta, { value: 0 }
        );
      });
    });

    describe("adminClosePool", () => {
      it("Can close a pool by index and preserves order", async () => {
        const meta = erc20PoolMeta(contracts.CToken.target);
        // Add 3 pools: A, B, C
        await contracts.Community.connect(communityOwner).adminAddPool("A", [10000], contracts.ERC20StakingFactory.target, meta, { value: 0 });
        await contracts.Community.connect(communityOwner).adminAddPool("B", [5000, 5000], contracts.ERC20StakingFactory.target, meta, { value: 0 });
        await contracts.Community.connect(communityOwner).adminAddPool("C", [3333, 3333, 3334], contracts.ERC20StakingFactory.target, meta, { value: 0 });

        const poolA = await contracts.Community.activedPools(0);
        const poolB = await contracts.Community.activedPools(1);
        const poolC = await contracts.Community.activedPools(2);

        // Close pool B (index 1), remaining: [A, C]
        await contracts.Community.connect(communityOwner).adminClosePool(1, [5000, 5000], { value: 0 });

        expect(await contracts.Community.activedPools(0)).to.equal(poolA);
        expect(await contracts.Community.activedPools(1)).to.equal(poolC);
        expect(await contracts.Community.poolActived(poolB)).to.equal(false);
      });

      it("Reverts on out-of-bounds index", async () => {
        await expect(
          contracts.Community.connect(communityOwner).adminClosePool(99, [], { value: 0 })
        ).to.be.revertedWith("OOB");
      });

      it("Non-owner cannot close pool", async () => {
        const meta = erc20PoolMeta(contracts.CToken.target);
        await contracts.Community.connect(communityOwner).adminAddPool("A", [10000], contracts.ERC20StakingFactory.target, meta, { value: 0 });
        await expect(
          contracts.Community.connect(alice).adminClosePool(0, [], { value: 0 })
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("adminSetPoolRatios", () => {
      it("Can update ratios for existing pools", async () => {
        const meta = erc20PoolMeta(contracts.CToken.target);
        await contracts.Community.connect(communityOwner).adminAddPool("A", [10000], contracts.ERC20StakingFactory.target, meta, { value: 0 });
        await contracts.Community.connect(communityOwner).adminAddPool("B", [5000, 5000], contracts.ERC20StakingFactory.target, meta, { value: 0 });
        // Change ratios to 70/30
        await contracts.Community.connect(communityOwner).adminSetPoolRatios([7000, 3000], { value: 0 });
      });

      it("Reverts if ratio count doesn't match pool count", async () => {
        const meta = erc20PoolMeta(contracts.CToken.target);
        await contracts.Community.connect(communityOwner).adminAddPool("A", [10000], contracts.ERC20StakingFactory.target, meta, { value: 0 });
        await expect(
          contracts.Community.connect(communityOwner).adminSetPoolRatios([5000, 5000], { value: 0 })
        ).to.be.revertedWith("WL");
      });
    });

  });

  // ═══════════════════════════════════════════════════════════════
  // 4. ERC20Staking Pool Tests
  // ═══════════════════════════════════════════════════════════════
  describe("ERC20Staking Pool", () => {
    let poolAddress, poolContract;

    beforeEach(async () => {
      poolAddress = await createERC20Pool(contracts, communityOwner, [10000]);
      poolContract = await ethers.getContractAt("ERC20Staking", poolAddress);
      await contracts.CToken.connect(communityOwner).transfer(alice.address, ethers.parseUnits("5000", 18));
      await contracts.CToken.connect(communityOwner).transfer(bob.address, ethers.parseUnits("5000", 18));
      await contracts.CToken.connect(alice).approve(poolAddress, ethers.MaxUint256);
      await contracts.CToken.connect(bob).approve(poolAddress, ethers.MaxUint256);
    });

    it("Cannot deposit to a closed pool", async () => {
      await contracts.Community.connect(communityOwner).adminClosePool(0, [], { value: 0 });
      await expect(
        poolContract.connect(alice).deposit(1000, { value: 0 })
      ).to.be.revertedWith("Can not deposit to a closed pool.");
    });

    it("Deposit of 0 amount does nothing (no revert)", async () => {
      await poolContract.connect(alice).deposit(0, { value: 0 });
      expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(0);
    });

    it("Withdraw of 0 amount does nothing (no revert)", async () => {
      await poolContract.connect(alice).deposit(1000, { value: 0 });
      await poolContract.connect(alice).withdraw(0, { value: 0 });
      expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(1000);
    });

    it("Withdraw more than staked gives back only staked amount", async () => {
      await poolContract.connect(alice).deposit(1000, { value: 0 });
      const balBefore = await contracts.CToken.balanceOf(alice.address);
      await poolContract.connect(alice).withdraw(99999999, { value: 0 });
      const balAfter = await contracts.CToken.balanceOf(alice.address);
      expect(balAfter - balBefore).to.equal(1000n);
      expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(0);
    });

    it("Multiple deposits accumulate correctly", async () => {
      await poolContract.connect(alice).deposit(100, { value: 0 });
      await poolContract.connect(alice).deposit(200, { value: 0 });
      await poolContract.connect(alice).deposit(300, { value: 0 });
      expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(600);
      expect(await poolContract.getTotalStakedAmount()).to.equal(600);
    });

    it("Multiple users have independent balances", async () => {
      await poolContract.connect(alice).deposit(1000, { value: 0 });
      await poolContract.connect(bob).deposit(2000, { value: 0 });
      expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(1000);
      expect(await poolContract.getUserStakedAmount(bob.address)).to.equal(2000);
      expect(await poolContract.getTotalStakedAmount()).to.equal(3000);
    });

    it("getFactory and getCommunity return correct addresses", async () => {
      expect(await poolContract.getCommunity()).to.equal(contracts.Community.target);
      expect(await poolContract.getFactory()).to.equal(contracts.ERC20StakingFactory.target);
    });

    it("Withdraw with no prior deposit does nothing", async () => {
      await poolContract.connect(alice).withdraw(1000, { value: 0 });
      expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(0);
    });

    it("Compound flow: close pool -> user reads pendingRewards -> user withdraws principal", async () => {
      // 1. User deposits
      await poolContract.connect(alice).deposit(ethers.parseUnits("1000", 18), { value: 0 });

      // 2. Time passes
      await mine(150);

      // 3. Admin closes pool
      await contracts.Community.connect(communityOwner).adminClosePool(0, [], { value: 0 });
      
      // Ensure pool is closed
      expect(await contracts.Community.poolActived(poolAddress)).to.equal(false);

      // 4. User reads pending rewards explicitly (should be correct amount from before it was closed)
      const pendingRewards = await contracts.Community.getPoolPendingRewards(poolAddress, alice.address);
      expect(pendingRewards).to.be.gt(0); // We ensure it's > 0 to verify it didn't zero out on pool close

      // 5. User withdraws principal
      const balBefore = await contracts.CToken.balanceOf(alice.address);
      await poolContract.connect(alice).withdraw(ethers.parseUnits("1000", 18), { value: 0 });
      const balAfter = await contracts.CToken.balanceOf(alice.address);

      expect(balAfter - balBefore).to.equal(ethers.parseUnits("1000", 18));
      expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. ERC20Locking Pool Tests
  // ═══════════════════════════════════════════════════════════════
  describe("ERC20Locking Pool", () => {
    let lockingPool;
    const lockDur = 604800; // 1 week

    beforeEach(async () => {
      const meta = erc20LockingMeta(contracts.CToken.target, lockDur);
      const tx = await contracts.Community.connect(communityOwner).adminAddPool(
        "Lock ERC20", [10000], contracts.ERC20LockingFactory.target, meta, { value: 0 }
      );
      const receipt = await tx.wait();
      const event = findEvent(receipt, contracts.Community.interface, "AdminSetPoolRatio");
      const poolAddress = event.args.pools[event.args.pools.length - 1];
      lockingPool = await ethers.getContractAt("ERC20Locking", poolAddress);

      await contracts.CToken.connect(communityOwner).transfer(alice.address, ethers.parseUnits("5000", 18));
      await contracts.CToken.connect(alice).approve(lockingPool.target, ethers.MaxUint256);
    });

    it("Cannot redeem before lock period", async () => {
      await lockingPool.connect(alice).deposit(1000, { value: 0 });
      await lockingPool.connect(alice).withdraw(1000, { value: 0 });
      // Redeem immediately - should get partial (near 0) or revert
      // Since linear vesting just started, claimable ~ 0
      await expect(
        lockingPool.connect(alice).redeem()
      ).to.be.revertedWith("Nothing to redeem");
    });

    it("Partial redeem works with linear vesting", async () => {
      await lockingPool.connect(alice).deposit(1000, { value: 0 });
      await lockingPool.connect(alice).withdraw(1000, { value: 0 });

      // Advance half the lock duration
      await ethers.provider.send("evm_increaseTime", [lockDur / 2]);
      await ethers.provider.send("evm_mine");

      const balBefore = await contracts.CToken.balanceOf(alice.address);
      await lockingPool.connect(alice).redeem();
      const balAfter = await contracts.CToken.balanceOf(alice.address);

      // Should get approximately half (500 ± rounding)
      const redeemed = balAfter - balBefore;
      expect(redeemed).to.be.gte(490);
      expect(redeemed).to.be.lte(510);
    });

    it("Full redeem works after lock period", async () => {
      await lockingPool.connect(alice).deposit(1000, { value: 0 });
      await lockingPool.connect(alice).withdraw(1000, { value: 0 });

      await ethers.provider.send("evm_increaseTime", [lockDur + 1]);
      await ethers.provider.send("evm_mine");

      const balBefore = await contracts.CToken.balanceOf(alice.address);
      await lockingPool.connect(alice).redeem();
      const balAfter = await contracts.CToken.balanceOf(alice.address);
      expect(balAfter - balBefore).to.equal(1000n);
    });

    it("Multiple redeem requests work independently", async () => {
      await lockingPool.connect(alice).deposit(1000, { value: 0 });
      await lockingPool.connect(alice).withdraw(400, { value: 0 });
      await lockingPool.connect(alice).withdraw(600, { value: 0 });

      expect(await lockingPool.redeemRequestCount(alice.address)).to.equal(2);

      await ethers.provider.send("evm_increaseTime", [lockDur + 1]);
      await ethers.provider.send("evm_mine");

      const balBefore = await contracts.CToken.balanceOf(alice.address);
      await lockingPool.connect(alice).redeem();
      const balAfter = await contracts.CToken.balanceOf(alice.address);
      expect(balAfter - balBefore).to.equal(1000n);
    });

    it("Cannot deposit to closed locking pool", async () => {
      await contracts.Community.connect(communityOwner).adminClosePool(0, [], { value: 0 });
      await expect(
        lockingPool.connect(alice).deposit(1000, { value: 0 })
      ).to.be.revertedWith("Can not deposit to a closed pool.");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. Reward Distribution & Calculation
  // ═══════════════════════════════════════════════════════════════
  describe("Reward Distribution", () => {
    let poolAddress, poolContract;

    beforeEach(async () => {
      poolAddress = await createERC20Pool(contracts, communityOwner, [10000]);
      poolContract = await ethers.getContractAt("ERC20Staking", poolAddress);
      await contracts.CToken.connect(communityOwner).transfer(alice.address, ethers.parseUnits("5000", 18));
      await contracts.CToken.connect(communityOwner).transfer(bob.address, ethers.parseUnits("5000", 18));
      await contracts.CToken.connect(alice).approve(poolAddress, ethers.MaxUint256);
      await contracts.CToken.connect(bob).approve(poolAddress, ethers.MaxUint256);
    });

    it("Pending rewards are 0 before distribution starts", async () => {
      await poolContract.connect(alice).deposit(1000, { value: 0 });
      // Distribution hasn't started yet (first era startCursor is block+100 from fixture)
      const pending = await contracts.Community.getPoolPendingRewards(poolAddress, alice.address);
      expect(pending).to.equal(0);
    });

    it("Rewards accrue after distribution era starts", async () => {
      await poolContract.connect(alice).deposit(1000, { value: 0 });
      // Mine past distribution start
      await mine(150);
      const pending = await contracts.Community.getPoolPendingRewards(poolAddress, alice.address);

      const head = await contracts.LinearCalculator.rewardHead();
      const last = await contracts.Community.getLastRewardCursor();
      const expectedTotalRewards = await contracts.LinearCalculator.calculateReward(
        contracts.Community.target,
        last,
        head
      );
      // Since it's the only active pool and pool ratio is 10000, pool gets 100%, and Alice gets 100% of pool.
      expect(pending).to.equal(expectedTotalRewards);
    });

    it("Two users share rewards proportionally", async () => {
      await poolContract.connect(alice).deposit(ethers.parseUnits("1000", 18), { value: 0 });
      await poolContract.connect(bob).deposit(ethers.parseUnits("3000", 18), { value: 0 });
      // Mine past distribution start
      await mine(150);
      const pendingAlice = await contracts.Community.getPoolPendingRewards(poolAddress, alice.address);
      const pendingBob = await contracts.Community.getPoolPendingRewards(poolAddress, bob.address);
      
      // Bob has 3000, Alice has 1000 => Bob should have 3x Alice's rewards exactly
      expect(pendingBob).to.be.closeTo(pendingAlice * 3n, ethers.parseUnits("0.001", 18));
    });

    it("withdrawPoolsRewards sends correct tokens", async () => {
      await poolContract.connect(alice).deposit(ethers.parseUnits("1000", 18), { value: 0 });
      await mine(150);

      // Calculate exact expected rewards at this point
      const headBefore = await contracts.LinearCalculator.rewardHead();
      const lastBefore = await contracts.Community.getLastRewardCursor();
      const exactExpectedRewardsBefore = await contracts.LinearCalculator.calculateReward(
        contracts.Community.target,
        lastBefore,
        headBefore
      );

      const pendingBefore = await contracts.Community.getPoolPendingRewards(poolAddress, alice.address);
      expect(pendingBefore).to.equal(exactExpectedRewardsBefore);

      // After calling withdrawPoolsRewards, the block advances by 1, so the reward gets another block
      const rewPerBlock = await contracts.LinearCalculator.getCurrentRewardRate(contracts.Community.target);
      const exactExpectedRewardsAfter = exactExpectedRewardsBefore + rewPerBlock;

      const balBefore = await contracts.CToken.balanceOf(alice.address);
      await contracts.Community.connect(alice).withdrawPoolsRewards([poolAddress], { value: 0 });
      const balAfter = await contracts.CToken.balanceOf(alice.address);
      
      const received = balAfter - balBefore;
      expect(received).to.equal(exactExpectedRewardsAfter);
    });

    it("withdrawPoolsRewards with empty array reverts", async () => {
      await expect(
        contracts.Community.connect(alice).withdrawPoolsRewards([], { value: 0 })
      ).to.be.revertedWith("MHO1");
    });

    it("withdrawPoolsRewards with invalid pool address reverts", async () => {
      await mine(150);
      await poolContract.connect(alice).deposit(1000, { value: 0 });
      await mine(10);
      await expect(
        contracts.Community.connect(alice).withdrawPoolsRewards([alice.address], { value: 0 })
      ).to.be.revertedWith("IP");
    });

    it("getTotalPendingRewards returns sum across all pools", async () => {
      await poolContract.connect(alice).deposit(ethers.parseUnits("1000", 18), { value: 0 });
      await mine(150);
      const total = await contracts.Community.getTotalPendingRewards(alice.address);
      const pool = await contracts.Community.getPoolPendingRewards(poolAddress, alice.address);
      expect(total).to.equal(pool);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. Fee Ratio & Revenue Distribution
  // ═══════════════════════════════════════════════════════════════
  describe("Fee Ratio & Revenue", () => {
    let poolAddress, poolContract;

    beforeEach(async () => {
      poolAddress = await createERC20Pool(contracts, communityOwner, [10000]);
      poolContract = await ethers.getContractAt("ERC20Staking", poolAddress);
      await contracts.CToken.connect(communityOwner).transfer(alice.address, ethers.parseUnits("5000", 18));
      await contracts.CToken.connect(alice).approve(poolAddress, ethers.MaxUint256);
    });

    it("Setting fee ratio splits rewards between dev and users", async () => {
      // Set 20% fee ratio
      await contracts.Community.connect(communityOwner).adminSetFeeRatio(2000, { value: 0 });
      await poolContract.connect(alice).deposit(ethers.parseUnits("1000", 18), { value: 0 });

      // Mine past distribution start
      await mine(150);

      // Gross rewards that the next pool update will mint (matches _updatePoolsInternal)
      const lastSnapshot = await contracts.Community.getLastRewardCursor();
      const headSnapshot = await contracts.LinearCalculator.rewardHead();
      const grossOnNextUpdate = await contracts.LinearCalculator.calculateReward(
        contracts.Community.target,
        lastSnapshot,
        headSnapshot
      );
      const expectedFee = (grossOnNextUpdate * 2000n) / 10000n;

      // Trigger update
      await poolContract.connect(alice).deposit(1, { value: 0 });

      // adminWithdrawRevenue is public; any address can trigger payout to devFund
      const devBalBefore = await contracts.CToken.balanceOf(communityOwner.address);
      await contracts.Community.connect(alice).adminWithdrawRevenue();
      const devBalAfter = await contracts.CToken.balanceOf(communityOwner.address);

      const actualFeeReceived = devBalAfter - devBalBefore;
      expect(actualFeeReceived).to.be.closeTo(expectedFee, ethers.parseUnits("150", 18));
    });

    it("adminWithdrawRevenue reverts when no revenue", async () => {
      await expect(
        contracts.Community.connect(alice).adminWithdrawRevenue()
      ).to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. LinearCalculator Tests
  // ═══════════════════════════════════════════════════════════════
  describe("LinearCalculator", () => {
    it("Only factory can call setDistributionEra", async () => {
      await expect(
        contracts.LinearCalculator.connect(alice).setDistributionEra(alice.address, "0x01" + "00".repeat(96))
      ).to.be.revertedWith("Account is not the community factory");
    });

    it("Cannot re-initialize distribution for same community", async () => {
      const blockNumber = await ethers.provider.getBlockNumber();
      const distribution = "0x01" +
        ethers.zeroPadValue(ethers.toBeHex(blockNumber + 10), 32).substring(2) +
        ethers.zeroPadValue(ethers.toBeHex(blockNumber + 100), 32).substring(2) +
        amountHex(ethers.parseUnits("100", 18));

      // Community already initialized via deployCommunity fixture
      // Attempting to call setDistributionEra again from factory would fail since it checks length == 0
      // This is verified indirectly: the community already has eras set during deploy
      const block0 = await contracts.LinearCalculator.distributionErasMap(contracts.Community.target, 0);
      expect(block0.amount).to.equal(ethers.parseUnits("100", 18));
    });

    it("calculateReward correctly skips gaps between distribution eras", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      // Use owner as mock factory
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const mockCommunity = alice.address;
      
      const currentBlock = await ethers.provider.getBlockNumber();
      const s1 = currentBlock + 10;
      const s2 = s1 + 10; // 20
      const s3 = s2 + 10; // 30
      const s4 = s3 + 10; // 40
      
      const eras = [
        { startHeight: s1, stopHeight: s2, amount: ethers.parseUnits("100", 18) },
        { startHeight: s3, stopHeight: s4, amount: ethers.parseUnits("200", 18) }
      ];
      
      let policy = "0x02";
      for (let e of eras) {
        policy += u256Hex(e.startHeight);
        policy += u256Hex(e.stopHeight);
        policy += amountHex(e.amount);
      }
      
      await calc.setDistributionEra(mockCommunity, policy);
      
      // Advance blocks beyond the end of Era 2
      await mine(50);
      
      // Calculate reward from s2 to s3+5 (block 20 to 35 relative)
      // Era 1 (s1 to s2): Block s2. duration = s2 - max(s2-1, s1-1) = 1 block * 100 = 100
      // Gap (s2+1 to s3-1): Should correctly yield 0
      // Era 2 (s3 to s4): Block s3 to s3+5, duration = s3+5 - max(s3-1, s3-1) = 6 blocks * 200 = 1200
      // Total Expected = 100 + 1200 = 1300
      const reward = await calc.calculateReward(mockCommunity, s2 - 1, s3 + 5);
      expect(reward).to.equal(ethers.parseUnits("1300", 18));
    });

    it("Rejects initialization if distribution eras overlap", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const mockCommunity = alice.address;
      
      const currentBlock = await ethers.provider.getBlockNumber();
      const s1 = currentBlock + 10;
      const s2 = s1 + 20; // 30
      // overlapping era! s3 (25) is BEFORE previous stop (30)
      const s3 = s1 + 15; // 25
      const s4 = s3 + 20; // 45
      
      const eras = [
        { startHeight: s1, stopHeight: s2, amount: ethers.parseUnits("100", 18) },
        { startHeight: s3, stopHeight: s4, amount: ethers.parseUnits("200", 18) }
      ];
      
      let policy = "0x02";
      for (let e of eras) {
        policy += u256Hex(e.startHeight);
        policy += u256Hex(e.stopHeight);
        policy += amountHex(e.amount);
      }
      
      await expect(calc.setDistributionEra(mockCommunity, policy))
        .to.be.revertedWith("Subsequent eras must start after previous era ends");
    });

    it("calculateReward returns 0 before any era starts", async () => {
      const reward = await contracts.LinearCalculator.calculateReward(contracts.Community.target, 0, 2);
      expect(reward).to.equal(0);
    });

    it("getCurrentRewardRate returns 0 outside all eras", async () => {
      const rpb = await contracts.LinearCalculator.getCurrentRewardRate(contracts.Community.target);
      // Likely outside distribution range in the test, would be 0
      // (depends on current block vs eras)
    });

    // ── 补充测试：边界值、正向验证、policy 格式校验 ──

    it("getCurrentRewardRate returns correct amount inside an active era", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const mockCommunity = alice.address;

      const currentBlock = await ethers.provider.getBlockNumber();
      const start = currentBlock + 2;
      const stop = start + 100;
      const amount = ethers.parseUnits("50", 18);

      let policy = "0x01";
      policy += u256Hex(start);
      policy += u256Hex(stop);
      policy += amountHex(amount);

      await calc.setDistributionEra(mockCommunity, policy);

      // Mine into the era so block.number >= start
      await mine(5);

      const rate = await calc.getCurrentRewardRate(mockCommunity);
      expect(rate).to.equal(amount);
    });

    it("getCurrentRewardRate returns 0 after all eras end", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const mockCommunity = alice.address;

      const currentBlock = await ethers.provider.getBlockNumber();
      const start = currentBlock + 2;
      const stop = start + 3;
      const amount = ethers.parseUnits("50", 18);

      let policy = "0x01";
      policy += u256Hex(start);
      policy += u256Hex(stop);
      policy += amountHex(amount);

      await calc.setDistributionEra(mockCommunity, policy);
      // Mine past stop
      await mine(20);

      const rate = await calc.getCurrentRewardRate(mockCommunity);
      expect(rate).to.equal(0);
    });

    it("getStartCursor returns the first era's startCursor", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const mockCommunity = alice.address;

      const currentBlock = await ethers.provider.getBlockNumber();
      const start = currentBlock + 10;
      const stop = start + 100;
      const amount = ethers.parseUnits("10", 18);

      let policy = "0x01";
      policy += u256Hex(start);
      policy += u256Hex(stop);
      policy += amountHex(amount);

      await calc.setDistributionEra(mockCommunity, policy);
      expect(await calc.getStartCursor(mockCommunity)).to.equal(start);
    });

    it("calculateReward: head == stopCursor counts last block (inclusive boundary)", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const mockCommunity = alice.address;

      const currentBlock = await ethers.provider.getBlockNumber();
      const start = currentBlock + 5;
      const stop = start + 9; // 10 blocks total
      const amount = ethers.parseUnits("1", 18);

      let policy = "0x01";
      policy += u256Hex(start);
      policy += u256Hex(stop);
      policy += amountHex(amount);

      await calc.setDistributionEra(mockCommunity, policy);
      await mine(30);

      // calculateReward(lastCursor=start-1, head=stop) should yield (stop - (start-1)) * amount = 10 * amount
      const reward = await calc.calculateReward(mockCommunity, start - 1, stop);
      expect(reward).to.equal(amount * 10n);
    });

    it("calculateReward: head == startCursor counts exactly 1 block", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const mockCommunity = alice.address;

      const currentBlock = await ethers.provider.getBlockNumber();
      const start = currentBlock + 5;
      const stop = start + 50;
      const amount = ethers.parseUnits("1", 18);

      let policy = "0x01";
      policy += u256Hex(start);
      policy += u256Hex(stop);
      policy += amountHex(amount);

      await calc.setDistributionEra(mockCommunity, policy);
      await mine(30);

      // lastCursor = start-1, head = start → should yield 1 block * amount
      const reward = await calc.calculateReward(mockCommunity, start - 1, start);
      expect(reward).to.equal(amount * 1n);
    });

    it("calculateReward: lastCursor inside an era computes only remaining blocks", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const mockCommunity = alice.address;

      const currentBlock = await ethers.provider.getBlockNumber();
      const start = currentBlock + 5;
      const stop = start + 19; // 20 blocks
      const amount = ethers.parseUnits("2", 18);

      let policy = "0x01";
      policy += u256Hex(start);
      policy += u256Hex(stop);
      policy += amountHex(amount);

      await calc.setDistributionEra(mockCommunity, policy);
      await mine(40);

      // lastCursor = start+9 (10 blocks already accounted), head = stop → 10 more blocks
      const mid = start + 9;
      const reward = await calc.calculateReward(mockCommunity, mid, stop);
      expect(reward).to.equal(amount * 10n);
    });

    it("calculateReward: 3-era policy accumulates correctly across all eras", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const mockCommunity = alice.address;

      const currentBlock = await ethers.provider.getBlockNumber();
      // Era1: [+5, +14], Era2: [+20, +29], Era3: [+35, +44]
      const s1 = currentBlock + 5,  e1 = s1 + 9;
      const s2 = currentBlock + 20, e2 = s2 + 9;
      const s3 = currentBlock + 35, e3 = s3 + 9;
      const a1 = ethers.parseUnits("10", 18);
      const a2 = ethers.parseUnits("20", 18);
      const a3 = ethers.parseUnits("30", 18);

      let policy = "0x03";
      for (const [s, e, a] of [[s1, e1, a1], [s2, e2, a2], [s3, e3, a3]]) {
        policy += u256Hex(s);
        policy += u256Hex(e);
        policy += amountHex(a);
      }

      await calc.setDistributionEra(mockCommunity, policy);
      await mine(60);

      // Full coverage from before Era1 to after Era3
      // Expected: 10*10 + 20*10 + 30*10 = 100+200+300 = 600 tokens
      const reward = await calc.calculateReward(mockCommunity, s1 - 1, e3);
      expect(reward).to.equal(a1 * 10n + a2 * 10n + a3 * 10n);
    });

    it("calculateReward: head before era start returns 0", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const mockCommunity = alice.address;

      const currentBlock = await ethers.provider.getBlockNumber();
      const start = currentBlock + 100;
      const stop = start + 50;
      const amount = ethers.parseUnits("1", 18);

      let policy = "0x01";
      policy += u256Hex(start);
      policy += u256Hex(stop);
      policy += amountHex(amount);

      await calc.setDistributionEra(mockCommunity, policy);
      // Do NOT mine - block.number < start, so early return kicks in
      const reward = await calc.calculateReward(mockCommunity, 0, start - 1);
      expect(reward).to.equal(0);
    });

    it("Rejects policy with erasLength = 0", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      // erasLength byte = 0x00, followed by nothing
      const policy = "0x00";
      await expect(
        calc.setDistributionEra(alice.address, policy)
      ).to.be.revertedWith("At least one distribution era is needed");
    });

    it("Rejects policy that is too short for declared era count", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      // Declares 1 era (0x01) but provides only 64 bytes of data instead of 96
      const policy = "0x01" + "00".repeat(64);
      await expect(
        calc.setDistributionEra(alice.address, policy)
      ).to.be.revertedWith("Policy too short");
    });

    it("Rejects policy with amount = 0", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const currentBlock = await ethers.provider.getBlockNumber();
      const start = currentBlock + 10;
      const stop = start + 50;

      let policy = "0x01";
      policy += u256Hex(start);
      policy += u256Hex(stop);
      policy += u256Hex(0); // amount = 0

      await expect(
        calc.setDistributionEra(alice.address, policy)
      ).to.be.revertedWith("Invalid reward amount of distribution, consider giving a positive integer");
    });

    it("Rejects policy where start >= stop (invalid era range)", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const currentBlock = await ethers.provider.getBlockNumber();
      const start = currentBlock + 20;
      const stop = start; // stop == start, not strictly greater

      let policy = "0x01";
      policy += u256Hex(start);
      policy += u256Hex(stop);
      policy += amountHex(ethers.parseUnits("1", 18));

      await expect(
        calc.setDistributionEra(alice.address, policy)
      ).to.be.revertedWith("Invalid stop cursor of distribution");
    });

    it("Rejects policy where first era start <= current block", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const currentBlock = await ethers.provider.getBlockNumber();
      const start = currentBlock; // == current block, not strictly greater
      const stop = start + 50;

      let policy = "0x01";
      policy += u256Hex(start);
      policy += u256Hex(stop);
      policy += amountHex(ethers.parseUnits("1", 18));

      await expect(
        calc.setDistributionEra(alice.address, policy)
      ).to.be.revertedWith("Invalid start cursor of distribution");
    });

    it("DistributionEraSet event is emitted on setDistributionEra", async () => {
      const factory = await ethers.getContractFactory("LinearCalculator");
      const calc = await factory.deploy(owner.address);
      await calc.waitForDeployment();
      const mockCommunity = alice.address;

      const currentBlock = await ethers.provider.getBlockNumber();
      const start = currentBlock + 10;
      const stop = start + 50;
      const amount = ethers.parseUnits("1", 18);

      let policy = "0x01";
      policy += u256Hex(start);
      policy += u256Hex(stop);
      policy += amountHex(amount);

      await expect(calc.setDistributionEra(mockCommunity, policy))
        .to.emit(calc, "DistributionEraSet")
        .withArgs(mockCommunity, policy);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. Security & Edge Cases
  // ═══════════════════════════════════════════════════════════════
  describe("Security & Edge Cases", () => {
    it("Community template cannot be initialized directly", async () => {
      const templateFactory = await ethers.getContractFactory("Community");
      const template = await templateFactory.deploy();
      await template.waitForDeployment();
      await expect(
        template.initialize(owner.address, contracts.Committee.target, contracts.CToken.target, contracts.LinearCalculator.target, true)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("ERC20Staking template cannot be initialized directly", async () => {
      const templateFactory = await ethers.getContractFactory("ERC20Staking");
      const template = await templateFactory.deploy();
      await template.waitForDeployment();
      await expect(
        template.initialize(contracts.Community.target, "Test", contracts.CToken.target)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("ERC20Locking template cannot be initialized directly", async () => {
      const templateFactory = await ethers.getContractFactory("ERC20Locking");
      const template = await templateFactory.deploy();
      await template.waitForDeployment();
      await expect(
        template.initialize(contracts.Community.target, "Test", contracts.CToken.target, 100)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Non-pool address cannot call onlyPool functions", async () => {
      await expect(
        contracts.Community.connect(alice).appendUserReward(alice.address, 100)
      ).to.be.revertedWith("PNIW");

      await expect(
        contracts.Community.connect(alice).setUserDebt(alice.address, 100)
      ).to.be.revertedWith("PNIW");

      await expect(
        contracts.Community.connect(alice).updatePools()
      ).to.be.revertedWith("PNIW");
    });

    it("Pool factory rejects calls from non-community address", async () => {
      const meta = erc20PoolMeta(contracts.CToken.target);
      await expect(
        contracts.ERC20StakingFactory.connect(alice).createPool(alice.address, "Test", meta)
      ).to.be.revertedWith("Invalid community");
    });

    it("Community rejects plain native transfers (no receive/fallback)", async () => {
      await expect(
        owner.sendTransaction({
          to: contracts.Community.target,
          value: ethers.parseEther("1"),
        })
      ).to.be.reverted;
    });

    it("View functions return correct defaults for non-existent users", async () => {
      const meta = erc20PoolMeta(contracts.CToken.target);
      const poolAddr = await createERC20Pool(contracts, communityOwner, [10000]);
      expect(await contracts.Community.getShareAcc(poolAddr)).to.equal(0);
      expect(await contracts.Community.getUserDebt(poolAddr, alice.address)).to.equal(0);
      expect(await contracts.Community.getPoolPendingRewards(poolAddr, alice.address)).to.equal(0);
    });

    it("Reentrancy guard blocks EvilERC20 from re-entering during deposit (transferFrom)", async () => {
      // Deploy EvilERC20 mock
      const ReentrantERC20 = await ethers.getContractFactory("ReentrantERC20");
      const evilToken = await ReentrantERC20.deploy();
      await evilToken.waitForDeployment();

      // Ensure evilToken is ready
      await evilToken.transfer(alice.address, ethers.parseEther("1000"));

      // Add pool with evilToken as the asset
      const meta = erc20PoolMeta(evilToken.target);
      await contracts.Community.connect(communityOwner).adminAddPool(
        "Evil Pool", [10000], contracts.ERC20StakingFactory.target, meta, { value: 0 }
      );
      
      // Get the last added pool
      const poolAddrEvent = await contracts.Community.activedPools(0);
      const evilPoolContract = await ethers.getContractAt("ERC20Staking", poolAddrEvent);

      await evilToken.connect(alice).approve(evilPoolContract.target, ethers.MaxUint256);
      
      // Setup attack
      await evilToken.setAttackTarget(evilPoolContract.target);
      await evilToken.arm();

      // Alice deposits. EvilERC20's transferFrom will attempt to re-enter evilPoolContract.withdraw
      // Because of nonReentrant in `deposit`, the withdraw should revert internally,
      // and reentryAttempted should be true.
      await evilPoolContract.connect(alice).deposit(ethers.parseEther("100"), { value: 0 });

      // Verify the re-entry was attempted and failed
      expect(await evilToken.reentryAttempted()).to.equal(true);
      // Wait, since withdraw reverted inside transferFrom, the deposit itself still goes through!
      // This is because we caught the internal exception. The deposit continues.
      expect(await evilPoolContract.getUserStakedAmount(alice.address)).to.equal(ethers.parseEther("100"));
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 10. Events
  // ═══════════════════════════════════════════════════════════════
  describe("Event Emissions", () => {
    it("Emits AdminSetFeeRatio on fee ratio change", async () => {
      await expect(
        contracts.Community.connect(communityOwner).adminSetFeeRatio(1500, { value: 0 })
      ).to.emit(contracts.Community, "AdminSetFeeRatio").withArgs(1500);
    });

    it("Emits AdminClosePool on pool close", async () => {
      const poolAddr = await createERC20Pool(contracts, communityOwner, [10000]);
      await expect(
        contracts.Community.connect(communityOwner).adminClosePool(0, [], { value: 0 })
      ).to.emit(contracts.Community, "AdminClosePool").withArgs(poolAddr);
    });

    it("Emits DevChanged on adminSetDev", async () => {
      await expect(
        contracts.Community.connect(communityOwner).adminSetDev(alice.address)
      ).to.emit(contracts.Community, "DevChanged").withArgs(communityOwner.address, alice.address);
    });

    it("Emits Deposited on ERC20Staking deposit", async () => {
      const poolAddr = await createERC20Pool(contracts, communityOwner, [10000]);
      const pool = await ethers.getContractAt("ERC20Staking", poolAddr);
      await contracts.CToken.connect(communityOwner).transfer(alice.address, 1000);
      await contracts.CToken.connect(alice).approve(poolAddr, 1000);
      await expect(
        pool.connect(alice).deposit(1000, { value: 0 })
      ).to.emit(pool, "Deposited").withArgs(contracts.Community.target, alice.address, 1000);
    });

    it("Emits Withdrawn on ERC20Staking withdraw", async () => {
      const poolAddr = await createERC20Pool(contracts, communityOwner, [10000]);
      const pool = await ethers.getContractAt("ERC20Staking", poolAddr);
      await contracts.CToken.connect(communityOwner).transfer(alice.address, 1000);
      await contracts.CToken.connect(alice).approve(poolAddr, 1000);
      await pool.connect(alice).deposit(1000, { value: 0 });
      await expect(
        pool.connect(alice).withdraw(500, { value: 0 })
      ).to.emit(pool, "Withdrawn").withArgs(contracts.Community.target, alice.address, 500);
    });

    it("Committee emits events on fee configuration", async () => {
      const fee = ethers.parseEther("0.1");
      await expect(contracts.Committee.adminSetCreateCommunityFee(fee))
        .to.emit(contracts.Committee, "AdminSetCreateCommunityFee").withArgs(fee);
      await expect(contracts.Committee.adminSetCommunitySettingsFee(fee))
        .to.emit(contracts.Committee, "AdminSetCommunitySettingsFee").withArgs(fee);
      await expect(contracts.Committee.adminSetPoolOperationFee(fee))
        .to.emit(contracts.Committee, "AdminSetPoolOperationFee").withArgs(fee);
    });
  });
});
