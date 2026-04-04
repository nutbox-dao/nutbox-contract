const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunity = require("./create-community");
const { findEvent } = require("./receipt-events");
const { u256Hex, amountHex } = require("./distribution-meta");

describe("Create community", async () => {
  let contracts;
  let owner;
  let communityOwner;
  let alice;

  beforeEach(async () => {
    contracts = await loadFixture(deployCommunity);
    owner = contracts.owner;
    communityOwner = contracts.communityOwner;
    alice = contracts.alice;
  });

  function erc20PoolMeta(tokenAddress) {
    return ethers.solidityPacked(["address"], [tokenAddress]);
  }

  describe("Create", () => {
    it("Community owner is set from factory", async () => {
      expect(await contracts.Community.owner()).to.equal(communityOwner.address);
    });

    it("Committee sets and charges Tier 1 fees on community creation", async () => {
      const { Committee, CommunityFactory, MintableERC20Factory, LinearCalculator } = contracts;
      const fee = ethers.parseEther("0.1");
      await Committee.adminSetCreateCommunityFee(fee);

      const meta =
        "0x" +
        ethers.zeroPadValue(ethers.toBeHex("Test Token".length), 1).substring(2) +
        Buffer.from("Test Token").toString("hex") +
        ethers.zeroPadValue(ethers.toBeHex("TEST".length), 1).substring(2) +
        Buffer.from("TEST").toString("hex") +
        ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits("1000", 18)), 32).substring(2) +
        alice.address.substring(2);

      const blockNumber = await ethers.provider.getBlockNumber();
      const distribution =
        "0x01" +
        u256Hex(blockNumber + 10) +
        u256Hex(blockNumber + 100) +
        amountHex(ethers.parseUnits("100", 18));

      await expect(
        CommunityFactory.connect(alice).createCommunity(
          true,
          ethers.ZeroAddress,
          MintableERC20Factory.target,
          meta,
          LinearCalculator.target,
          distribution,
          { value: 0 }
        )
      ).to.be.revertedWith("Insufficient fee");

      await CommunityFactory.connect(alice).createCommunity(
        true,
        ethers.ZeroAddress,
        MintableERC20Factory.target,
        meta,
        LinearCalculator.target,
        distribution,
        { value: fee }
      );

      await Committee.adminSetCreateCommunityFee(0);
    });
  });

  describe("Create pools", () => {
    it("Community owner can add ERC20 pool", async () => {
      const meta = erc20PoolMeta(contracts.CToken.target);
      await contracts.Community.connect(communityOwner).adminAddPool(
        "Stake ERC20",
        [10000],
        contracts.ERC20StakingFactory.target,
        meta,
        { value: 0 }
      );
    });

    it("Non-owner cannot add pool", async () => {
      const meta = erc20PoolMeta(contracts.CToken.target);
      await expect(
        contracts.Community.adminAddPool(
          "Stake ERC20",
          [10000],
          contracts.ERC20StakingFactory.target,
          meta,
          { value: 0 }
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("User can deposit into ERC20 staking pool", async () => {
      const meta = erc20PoolMeta(contracts.CToken.target);
      const tx = await contracts.Community.connect(communityOwner).adminAddPool(
        "Stake ERC20",
        [10000],
        contracts.ERC20StakingFactory.target,
        meta,
        { value: 0 }
      );
      const receipt = await tx.wait();
      const event = findEvent(
        receipt,
        contracts.Community.interface,
        "AdminSetPoolRatio"
      );
      const poolAddress = event.args.pools[0];

      await contracts.CToken.connect(communityOwner).transfer(alice.address, 1000);
      await contracts.CToken.connect(alice).approve(poolAddress, 100000);

      const fee = ethers.parseEther("0.01");
      await contracts.Committee.adminSetPoolOperationFee(fee);

      const poolContract = await ethers.getContractAt("ERC20Staking", poolAddress);

      await expect(
        poolContract.connect(alice).deposit(1000, { value: 0 })
      ).to.be.revertedWith("Insufficient fee");

      await poolContract.connect(alice).deposit(1000, { value: fee });
      expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(1000n);

      await contracts.Committee.adminSetPoolOperationFee(0);
    });

    it("User can lock and redeem ERC20 in locking pool", async () => {
      const lockDur = 604800;
      const meta = ethers.solidityPacked(
        ["address", "uint256"],
        [contracts.CToken.target, lockDur]
      );

      const tx = await contracts.Community.connect(communityOwner).adminAddPool(
        "Lock ERC20",
        [10000],
        contracts.ERC20LockingFactory.target,
        meta,
        { value: 0 }
      );

      const receipt = await tx.wait();
      const event = findEvent(
        receipt,
        contracts.Community.interface,
        "AdminSetPoolRatio"
      );
      const poolAddress = event.args.pools[0];

      const lockingPool = await ethers.getContractAt("ERC20Locking", poolAddress);

      await contracts.CToken.connect(communityOwner).transfer(alice.address, 1000);
      await contracts.CToken.connect(alice).approve(lockingPool.target, 1000);

      await lockingPool.connect(alice).deposit(1000, { value: 0 });
      expect(await lockingPool.getUserStakedAmount(alice.address)).to.equal(1000n);

      await lockingPool.connect(alice).withdraw(1000, { value: 0 });
      expect(await lockingPool.getUserStakedAmount(alice.address)).to.equal(0n);

      const count = await lockingPool.redeemRequestCount(alice.address);
      expect(count).to.equal(1n);

      await ethers.provider.send("evm_increaseTime", [lockDur]);
      await ethers.provider.send("evm_mine");

      const b0 = await contracts.CToken.balanceOf(alice.address);
      await lockingPool.connect(alice).redeem();
      const b1 = await contracts.CToken.balanceOf(alice.address);

      expect(b1 - b0).to.equal(1000n);
    });
  });

  describe("BNB Protocol Fees (Tier 1, 2, 3)", () => {
    it("Should charge Tier 2 fee for community settings and refund excess", async () => {
      const fee = ethers.parseEther("0.05");
      await contracts.Committee.adminSetCommunitySettingsFee(fee);

      const sendingAmount = ethers.parseEther("0.15");

      const balanceBefore = await ethers.provider.getBalance(communityOwner.address);
      const recipientBalanceBefore = await ethers.provider.getBalance(owner.address);

      const tx = await contracts.Community.connect(communityOwner).adminSetFeeRatio(
        2000,
        { value: sendingAmount }
      );
      const receipt = await tx.wait();

      const gasWei =
        receipt.gasUsed *
        (receipt.gasPrice ?? receipt.effectiveGasPrice ?? 0n);

      const balanceAfter = await ethers.provider.getBalance(communityOwner.address);
      const recipientBalanceAfter = await ethers.provider.getBalance(owner.address);

      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(fee);

      expect(balanceBefore - balanceAfter).to.equal(fee + gasWei);

      await contracts.Committee.adminSetCommunitySettingsFee(0);
    });

    it("Should charge Tier 3 fee and skip if user is in FeeFreeList", async () => {
      const meta = erc20PoolMeta(contracts.CToken.target);
      const tx = await contracts.Community.connect(communityOwner).adminAddPool(
        "Stake ERC20",
        [10000],
        contracts.ERC20StakingFactory.target,
        meta,
        { value: 0 }
      );
      const receipt = await tx.wait();
      const event = findEvent(
        receipt,
        contracts.Community.interface,
        "AdminSetPoolRatio"
      );
      const poolAddress = event.args.pools[0];

      const poolContract = await ethers.getContractAt("ERC20Staking", poolAddress);

      await contracts.CToken.connect(communityOwner).transfer(alice.address, 1000);
      await contracts.CToken.connect(alice).approve(poolAddress, 100000);

      const fee = ethers.parseEther("0.02");
      await contracts.Committee.adminSetPoolOperationFee(fee);

      await expect(
        poolContract.connect(alice).deposit(100, { value: 0 })
      ).to.be.revertedWith("Insufficient fee");

      await poolContract.connect(alice).deposit(100, { value: fee });

      await contracts.Committee.adminAddFeeFreeAddress(alice.address);
      await poolContract.connect(alice).deposit(100, { value: 0 });

      expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(200n);

      await contracts.Committee.adminSetPoolOperationFee(0);
      await contracts.Committee.adminRemoveFeeFreeAddress(alice.address);
    });
  });
});
