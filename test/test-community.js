const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunity = require("./create-community");

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
    return ethers.utils.solidityPack(["address"], [tokenAddress]);
  }

  describe("Create", () => {
    it("Community owner is set from factory", async () => {
      expect(await contracts.Community.owner()).to.equal(communityOwner.address);
    });

    it("Committee sets and charges Tier 1 fees on community creation", async () => {
      const { Committee, CommunityFactory, MintableERC20Factory, LinearCalculator } = contracts;
      const fee = ethers.utils.parseEther("0.1");
      await Committee.adminSetCreateCommunityFee(fee);
      
      const meta = "0x" + ethers.utils.hexZeroPad(ethers.utils.hexlify("Test Token".length), 1).substring(2) + Buffer.from("Test Token").toString("hex") + ethers.utils.hexZeroPad(ethers.utils.hexlify("TEST".length), 1).substring(2) + Buffer.from("TEST").toString("hex") + ethers.utils.hexZeroPad(ethers.utils.parseUnits("1000", 18), 32).substring(2) + alice.address.substring(2);

      const blockNumber = await ethers.provider.getBlockNumber();
      const distribution = "0x01" + ethers.utils.hexZeroPad(ethers.utils.hexlify(blockNumber + 10), 32).substring(2) + ethers.utils.hexZeroPad(ethers.utils.hexlify(blockNumber + 100), 32).substring(2) + ethers.utils.hexZeroPad(ethers.utils.parseUnits("100", 18), 32).substring(2);

      // Should revert if no fee sent
      await expect(
        CommunityFactory.connect(alice).createCommunity(true, ethers.constants.AddressZero, MintableERC20Factory.address, meta, LinearCalculator.address, distribution, { value: 0 })
      ).to.be.revertedWith("Insufficient fee");

      // Should succeed if exact fee sent
      await CommunityFactory.connect(alice).createCommunity(true, ethers.constants.AddressZero, MintableERC20Factory.address, meta, LinearCalculator.address, distribution, { value: fee });

      // Clean up for other tests
      await Committee.adminSetCreateCommunityFee(0);
    });
  });

  describe("Create pools", () => {
    it("Community owner can add ERC20 pool", async () => {
      const meta = erc20PoolMeta(contracts.CToken.address);
      await contracts.Community.connect(communityOwner).adminAddPool(
        "Stake ERC20",
        [10000],
        contracts.ERC20StakingFactory.address,
        meta,
        { value: 0 }
      );
    });

    it("Non-owner cannot add pool", async () => {
      const meta = erc20PoolMeta(contracts.CToken.address);
      await expect(
        contracts.Community.adminAddPool(
          "Stake ERC20",
          [10000],
          contracts.ERC20StakingFactory.address,
          meta,
          { value: 0 }
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("User can deposit into ERC20 staking pool", async () => {
      const meta = erc20PoolMeta(contracts.CToken.address);
      const tx = await contracts.Community.connect(communityOwner).adminAddPool(
        "Stake ERC20",
        [10000],
        contracts.ERC20StakingFactory.address,
        meta,
        { value: 0 }
      );
      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "AdminSetPoolRatio");
      const poolAddress = event.args.pools[0];

      await contracts.CToken.connect(communityOwner).transfer(alice.address, 1000);
      await contracts.CToken.connect(alice).approve(poolAddress, 100000);
      
      const fee = ethers.utils.parseEther("0.01");
      await contracts.Committee.adminSetPoolOperationFee(fee);

      const poolContract = await ethers.getContractAt("ERC20Staking", poolAddress);
      
      // Should revert if no fee sent
      await expect(poolContract.connect(alice).deposit(1000, { value: 0 })).to.be.revertedWith("Insufficient fee");
      
      // Deposit with Tier 3 fee
      await poolContract.connect(alice).deposit(1000, { value: fee });
      expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(1000);

      // Clean up
      await contracts.Committee.adminSetPoolOperationFee(0);
    });

    it("User can lock and redeem ERC20 in locking pool", async () => {
      // Create ERC20Locking pool with 1 week lock (604800s)
      const lockDur = 604800;
      const meta = ethers.utils.solidityPack(["address", "uint256"], [contracts.CToken.address, lockDur]);
      
      const tx = await contracts.Community.connect(communityOwner).adminAddPool(
        "Lock ERC20",
        [10000],
        contracts.ERC20LockingFactory.address,
        meta,
        { value: 0 }
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "AdminSetPoolRatio");
      const poolAddress = event.args.pools[0]; // Active pool length index would be different, but in isolation it's [0] or [1].
      
      // Let's actually use the activePools method to get the latest pool
      const activedPools = await contracts.Community.activedPools(0);
      const targetPool = activedPools; // If only one created. Wait, previous tests aren't isolated perfectly, so let's get the right one from array length.
      
      const lockingPool = await ethers.getContractAt("ERC20Locking", poolAddress);

      await contracts.CToken.connect(communityOwner).transfer(alice.address, 1000);
      await contracts.CToken.connect(alice).approve(lockingPool.address, 1000);

      // Deposit
      await lockingPool.connect(alice).deposit(1000, { value: 0 });
      expect(await lockingPool.getUserStakedAmount(alice.address)).to.equal(1000);

      // Withdraw - moves to queue
      await lockingPool.connect(alice).withdraw(1000, { value: 0 });
      expect(await lockingPool.getUserStakedAmount(alice.address)).to.equal(0);
      
      const count = await lockingPool.redeemRequestCount(alice.address);
      expect(count).to.equal(1);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [lockDur]);
      await ethers.provider.send("evm_mine");

      // Claim
      const b0 = await contracts.CToken.balanceOf(alice.address);
      await lockingPool.connect(alice).redeem();
      const b1 = await contracts.CToken.balanceOf(alice.address);
      
      expect(b1.sub(b0)).to.equal(1000);
    });
  });

  describe("BNB Protocol Fees (Tier 1, 2, 3)", () => {
    it("Should charge Tier 2 fee for community settings and refund excess", async () => {
      const fee = ethers.utils.parseEther("0.05");
      await contracts.Committee.adminSetCommunitySettingsFee(fee);

      // We will call adminSetFeeRatio which requires Tier 2 fee
      // Excess sending: send 0.15 ether, expect 0.1 ether refund
      const sendingAmount = ethers.utils.parseEther("0.15");

      const balanceBefore = await ethers.provider.getBalance(communityOwner.address);
      const recipientBalanceBefore = await ethers.provider.getBalance(owner.address); // owner is feeRecipient from deploy.js

      const tx = await contracts.Community.connect(communityOwner).adminSetFeeRatio(2000, { value: sendingAmount });
      const receipt = await tx.wait();
      
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

      const balanceAfter = await ethers.provider.getBalance(communityOwner.address);
      const recipientBalanceAfter = await ethers.provider.getBalance(owner.address);

      // Recipient gets exact fee
      expect(recipientBalanceAfter.sub(recipientBalanceBefore)).to.equal(fee);

      // Sender spent exactly gas + fee (refund occurred)
      expect(balanceBefore.sub(balanceAfter)).to.equal(fee.add(gasUsed));

      // Clean up
      await contracts.Committee.adminSetCommunitySettingsFee(0);
    });

    it("Should charge Tier 3 fee and skip if user is in FeeFreeList", async () => {
      const meta = erc20PoolMeta(contracts.CToken.address);
      const tx = await contracts.Community.connect(communityOwner).adminAddPool(
        "Stake ERC20",
        [10000],
        contracts.ERC20StakingFactory.address,
        meta,
        { value: 0 } // Tier 2 fee is 0 here
      );
      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "AdminSetPoolRatio");
      const poolAddress = event.args.pools[0];

      const poolContract = await ethers.getContractAt("ERC20Staking", poolAddress);
      
      await contracts.CToken.connect(communityOwner).transfer(alice.address, 1000);
      await contracts.CToken.connect(alice).approve(poolAddress, 100000);

      const fee = ethers.utils.parseEther("0.02");
      await contracts.Committee.adminSetPoolOperationFee(fee);

      // 1. Fails without fee
      await expect(poolContract.connect(alice).deposit(100, { value: 0 })).to.be.revertedWith("Insufficient fee");

      // 2. Succeeds with fee
      await poolContract.connect(alice).deposit(100, { value: fee });

      // 3. User added to feeFreeList bypasses fee
      await contracts.Committee.adminAddFeeFreeAddress(alice.address);
      await poolContract.connect(alice).deposit(100, { value: 0 }); // No fee sent!
      
      expect(await poolContract.getUserStakedAmount(alice.address)).to.equal(200);

      // Clean up
      await contracts.Committee.adminSetPoolOperationFee(0);
      await contracts.Committee.adminRemoveFeeFreeAddress(alice.address);
    });
  });
});
