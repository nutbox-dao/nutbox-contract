const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, mine } = require("@nomicfoundation/hardhat-network-helpers");
const deployCommunity = require("./create-community");
const { findEvent } = require("./receipt-events");

// ─── EIP-712 Signature Helper ───────────────────────────────────────────────

const CLAIM_TYPES = {
  Claim: [
    { name: "chainId", type: "uint256" },
    { name: "pool", type: "address" },
    { name: "orderId", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "to", type: "address" },
    { name: "deadline", type: "uint256" },
  ],
};

async function signClaim(signer, poolAddress, { orderId, amount, to, deadline, chainId }) {
  const cid = chainId || 1337;
  const domain = {
    name: "Nutbox SocialCuration",
    version: "1",
    chainId: cid,
    verifyingContract: poolAddress,
  };
  const value = { chainId: cid, pool: poolAddress, orderId, amount, to, deadline };
  return await signer.signTypedData(domain, CLAIM_TYPES, value);
}

// ─── Fixture ────────────────────────────────────────────────────────────────

async function deploySocialCurationFixture() {
  const contracts = await deployCommunity();
  const [owner, communityOwner, alice, bob, claimSigner] = await ethers.getSigners();

  const tx = await contracts.Community.connect(communityOwner).adminAddPool(
    "Social Curation",
    [10000],
    contracts.SocialCurationFactory.target,
    "0x",
    { value: 0 }
  );
  const receipt = await tx.wait();
  const event = findEvent(receipt, contracts.Community.interface, "AdminSetPoolRatio");
  const poolAddress = event.args.pools[event.args.pools.length - 1];
  const socialCurationPool = await ethers.getContractAt("SocialCuration", poolAddress);

  return {
    ...contracts,
    socialCurationFactory: contracts.SocialCurationFactory,
    socialCurationPool,
    claimSigner,
    owner,
    communityOwner,
    alice,
    bob,
  };
}

// Helper: get a future deadline
async function futureDeadline() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp + 3600;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("SocialCuration Contract Tests", function () {
  // ═══════════════════════════════════════════════════════════════
  // 1. SocialCurationFactory
  // ═══════════════════════════════════════════════════════════════
  describe("SocialCurationFactory", () => {
    describe("createPool", () => {
      it("Successfully creates a pool via Community.adminAddPool", async () => {
        const { socialCurationPool, socialCurationFactory, Community } =
          await loadFixture(deploySocialCurationFixture);

        expect(await socialCurationPool.factory()).to.equal(socialCurationFactory.target);
        expect(await socialCurationPool.community()).to.equal(Community.target);
      });

      it("Emits SocialCurationCreated event", async () => {
        const contracts = await deployCommunity();
        const [owner, , , , claimSigner] = await ethers.getSigners();

        const SCFactory = await ethers.getContractFactory("SocialCurationFactory");
        const factory = await SCFactory.deploy(contracts.CommunityFactory.target, claimSigner.address);
        await factory.waitForDeployment();
        await contracts.Committee.adminAddContract(factory.target);

        const communityOwner = contracts.communityOwner;
        // We listen on the factory for the event
        const tx = await contracts.Community.connect(communityOwner).adminAddPool(
          "Social Curation",
          [10000],
          factory.target,
          "0x",
          { value: 0 }
        );
        const receipt = await tx.wait();
        // The factory emits SocialCurationCreated - check via logs
        const iface = factory.interface;
        const log = receipt.logs.find((l) => {
          try {
            return iface.parseLog(l).name === "SocialCurationCreated";
          } catch {
            return false;
          }
        });
        expect(log).to.not.be.undefined;
        const parsed = iface.parseLog(log);
        expect(parsed.args.community).to.equal(contracts.Community.target);
        expect(parsed.args.name).to.equal("Social Curation");
      });

      it("Rejects duplicate pool for same community", async () => {
        const { Community, communityOwner, socialCurationFactory } =
          await loadFixture(deploySocialCurationFixture);

        await expect(
          Community.connect(communityOwner).adminAddPool(
            "Social Curation 2",
            [5000, 5000],
            socialCurationFactory.target,
            "0x",
            { value: 0 }
          )
        ).to.be.revertedWith("Community already has this pool");
      });

      it("Marks createdPoolOfCommunity as true after creation", async () => {
        const { socialCurationFactory, Community } =
          await loadFixture(deploySocialCurationFixture);

        expect(await socialCurationFactory.createdPoolOfCommunity(Community.target)).to.equal(true);
      });
    });

    describe("adminSetClaimSigner", () => {
      it("Owner can update claimSigner", async () => {
        const { socialCurationFactory, alice } =
          await loadFixture(deploySocialCurationFixture);

        await socialCurationFactory.adminSetClaimSigner(alice.address);
        expect(await socialCurationFactory.claimSigner()).to.equal(alice.address);
      });

      it("Non-owner cannot update claimSigner", async () => {
        const { socialCurationFactory, alice } =
          await loadFixture(deploySocialCurationFixture);

        await expect(
          socialCurationFactory.connect(alice).adminSetClaimSigner(alice.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Rejects zero address", async () => {
        const { socialCurationFactory } =
          await loadFixture(deploySocialCurationFixture);

        await expect(
          socialCurationFactory.adminSetClaimSigner(ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid address");
      });
    });

    describe("Dynamic claimSigner", () => {
      it("Updating factory claimSigner affects existing pool claim verification", async () => {
        const { socialCurationFactory, socialCurationPool, alice, bob } =
          await loadFixture(deploySocialCurationFixture);

        // Mine blocks to accrue rewards, then harvest
        await mine(200);
        await socialCurationPool.harvestRewards({ value: 0 });

        const amount = ethers.parseEther("1");
        const deadline = await futureDeadline();

        // Sign with bob (not the current claimSigner)
        const sig = await signClaim(bob, socialCurationPool.target, {
          orderId: 1, amount, to: alice.address, deadline,
        });

        // Should fail with current signer
        await expect(
          socialCurationPool.connect(alice).claim(1, amount, deadline, sig, { value: 0 })
        ).to.be.revertedWith("Bad sig");

        // Update factory signer to bob
        await socialCurationFactory.adminSetClaimSigner(bob.address);

        // Now should succeed
        await socialCurationPool.connect(alice).claim(1, amount, deadline, sig, { value: 0 });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. SocialCuration Pool - IPool Interface
  // ═══════════════════════════════════════════════════════════════
  describe("SocialCuration Pool", () => {
    describe("IPool Interface", () => {
      it("getFactory returns factory address", async () => {
        const { socialCurationPool, socialCurationFactory } =
          await loadFixture(deploySocialCurationFixture);

        expect(await socialCurationPool.getFactory()).to.equal(socialCurationFactory.target);
      });

      it("getCommunity returns community address", async () => {
        const { socialCurationPool, Community } =
          await loadFixture(deploySocialCurationFixture);

        expect(await socialCurationPool.getCommunity()).to.equal(Community.target);
      });

      it("getUserStakedAmount(pool) returns VIRTUAL_STAKE (1e18)", async () => {
        const { socialCurationPool } =
          await loadFixture(deploySocialCurationFixture);

        const stake = await socialCurationPool.getUserStakedAmount(socialCurationPool.target);
        expect(stake).to.equal(ethers.parseEther("1"));
      });

      it("getUserStakedAmount(other) returns 0", async () => {
        const { socialCurationPool, alice } =
          await loadFixture(deploySocialCurationFixture);

        expect(await socialCurationPool.getUserStakedAmount(alice.address)).to.equal(0n);
      });

      it("getTotalStakedAmount returns VIRTUAL_STAKE (1e18)", async () => {
        const { socialCurationPool } =
          await loadFixture(deploySocialCurationFixture);

        expect(await socialCurationPool.getTotalStakedAmount()).to.equal(ethers.parseEther("1"));
      });
    });

    describe("initialize", () => {
      it("Cannot re-initialize", async () => {
        const { socialCurationPool, Community } =
          await loadFixture(deploySocialCurationFixture);

        await expect(
          socialCurationPool.initialize(Community.target)
        ).to.be.revertedWith("Initializable: contract is already initialized");
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. EIP-712 Claims
  // ═══════════════════════════════════════════════════════════════
  describe("EIP-712 Claims", () => {
    describe("Valid Claims", () => {
      it("Claim with valid signature succeeds", async () => {
        const { socialCurationPool, claimSigner, alice, CToken } =
          await loadFixture(deploySocialCurationFixture);

        // Mine blocks to accrue rewards, then harvest to fill pool balance
        await mine(200);
        await socialCurationPool.harvestRewards({ value: 0 });

        const amount = ethers.parseEther("10");
        const deadline = await futureDeadline();
        const sig = await signClaim(claimSigner, socialCurationPool.target, {
          orderId: 1, amount, to: alice.address, deadline,
        });

        await expect(
          socialCurationPool.connect(alice).claim(1, amount, deadline, sig, { value: 0 })
        ).to.emit(socialCurationPool, "SocialClaimed")
          .withArgs(alice.address, 1, amount, false);

        expect(await CToken.balanceOf(alice.address)).to.equal(amount);
      });

      it("Multiple claims with different orderIds succeed", async () => {
        const { socialCurationPool, claimSigner, alice, CToken } =
          await loadFixture(deploySocialCurationFixture);

        await mine(200);
        await socialCurationPool.harvestRewards({ value: 0 });

        const amount = ethers.parseEther("5");
        const deadline = await futureDeadline();

        for (let orderId = 1; orderId <= 3; orderId++) {
          const sig = await signClaim(claimSigner, socialCurationPool.target, {
            orderId, amount, to: alice.address, deadline,
          });
          await socialCurationPool.connect(alice).claim(orderId, amount, deadline, sig, { value: 0 });
        }

        expect(await CToken.balanceOf(alice.address)).to.equal(amount * 3n);
      });

      it("totalClaimed tracks cumulative claims", async () => {
        const { socialCurationPool, claimSigner, alice } =
          await loadFixture(deploySocialCurationFixture);

        await mine(200);
        await socialCurationPool.harvestRewards({ value: 0 });

        const amount = ethers.parseEther("5");
        const deadline = await futureDeadline();

        const sig1 = await signClaim(claimSigner, socialCurationPool.target, {
          orderId: 1, amount, to: alice.address, deadline,
        });
        await socialCurationPool.connect(alice).claim(1, amount, deadline, sig1, { value: 0 });

        const sig2 = await signClaim(claimSigner, socialCurationPool.target, {
          orderId: 2, amount, to: alice.address, deadline,
        });
        await socialCurationPool.connect(alice).claim(2, amount, deadline, sig2, { value: 0 });

        expect(await socialCurationPool.totalClaimed()).to.equal(amount * 2n);
      });

      it("Different users can claim with their own signatures", async () => {
        const { socialCurationPool, claimSigner, alice, bob, CToken } =
          await loadFixture(deploySocialCurationFixture);

        await mine(200);
        await socialCurationPool.harvestRewards({ value: 0 });

        const amount = ethers.parseEther("5");
        const deadline = await futureDeadline();

        const sigAlice = await signClaim(claimSigner, socialCurationPool.target, {
          orderId: 1, amount, to: alice.address, deadline,
        });
        await socialCurationPool.connect(alice).claim(1, amount, deadline, sigAlice, { value: 0 });

        const sigBob = await signClaim(claimSigner, socialCurationPool.target, {
          orderId: 1, amount, to: bob.address, deadline,
        });
        await socialCurationPool.connect(bob).claim(1, amount, deadline, sigBob, { value: 0 });

        expect(await CToken.balanceOf(alice.address)).to.equal(amount);
        expect(await CToken.balanceOf(bob.address)).to.equal(amount);
      });
    });

    describe("Signature Validation", () => {
      it("Expired deadline reverts", async () => {
        const { socialCurationPool, claimSigner, alice } =
          await loadFixture(deploySocialCurationFixture);

        const amount = ethers.parseEther("1");
        // Deadline in the past
        const deadline = 1;
        const sig = await signClaim(claimSigner, socialCurationPool.target, {
          orderId: 1, amount, to: alice.address, deadline,
        });

        await expect(
          socialCurationPool.connect(alice).claim(1, amount, deadline, sig, { value: 0 })
        ).to.be.revertedWith("Expired");
      });

      it("Amount=0 reverts", async () => {
        const { socialCurationPool, claimSigner, alice } =
          await loadFixture(deploySocialCurationFixture);

        const deadline = await futureDeadline();
        const sig = await signClaim(claimSigner, socialCurationPool.target, {
          orderId: 1, amount: 0, to: alice.address, deadline,
        });

        await expect(
          socialCurationPool.connect(alice).claim(1, 0, deadline, sig, { value: 0 })
        ).to.be.revertedWith("Amount=0");
      });

      it("Already-used orderId reverts", async () => {
        const { socialCurationPool, claimSigner, alice } =
          await loadFixture(deploySocialCurationFixture);

        await mine(200);
        await socialCurationPool.harvestRewards({ value: 0 });

        const amount = ethers.parseEther("1");
        const deadline = await futureDeadline();
        const sig = await signClaim(claimSigner, socialCurationPool.target, {
          orderId: 1, amount, to: alice.address, deadline,
        });

        await socialCurationPool.connect(alice).claim(1, amount, deadline, sig, { value: 0 });

        // Same orderId again
        await expect(
          socialCurationPool.connect(alice).claim(1, amount, deadline, sig, { value: 0 })
        ).to.be.revertedWith("Claimed");
      });

      it("Wrong signer reverts", async () => {
        const { socialCurationPool, alice, bob } =
          await loadFixture(deploySocialCurationFixture);

        await mine(200);
        await socialCurationPool.harvestRewards({ value: 0 });

        const amount = ethers.parseEther("1");
        const deadline = await futureDeadline();
        // Sign with bob (not the claimSigner)
        const sig = await signClaim(bob, socialCurationPool.target, {
          orderId: 1, amount, to: alice.address, deadline,
        });

        await expect(
          socialCurationPool.connect(alice).claim(1, amount, deadline, sig, { value: 0 })
        ).to.be.revertedWith("Bad sig");
      });

      it("Signature for wrong user reverts", async () => {
        const { socialCurationPool, claimSigner, alice, bob } =
          await loadFixture(deploySocialCurationFixture);

        await mine(200);
        await socialCurationPool.harvestRewards({ value: 0 });

        const amount = ethers.parseEther("1");
        const deadline = await futureDeadline();
        // Signed for bob, but alice tries to claim
        const sig = await signClaim(claimSigner, socialCurationPool.target, {
          orderId: 1, amount, to: bob.address, deadline,
        });

        await expect(
          socialCurationPool.connect(alice).claim(1, amount, deadline, sig, { value: 0 })
        ).to.be.revertedWith("Bad sig");
      });

      it("Signature with wrong amount reverts", async () => {
        const { socialCurationPool, claimSigner, alice } =
          await loadFixture(deploySocialCurationFixture);

        await mine(200);
        await socialCurationPool.harvestRewards({ value: 0 });

        const deadline = await futureDeadline();
        // Sign for 10 tokens, try to claim 20
        const sig = await signClaim(claimSigner, socialCurationPool.target, {
          orderId: 1, amount: ethers.parseEther("10"), to: alice.address, deadline,
        });

        await expect(
          socialCurationPool.connect(alice).claim(
            1, ethers.parseEther("20"), deadline, sig, { value: 0 }
          )
        ).to.be.revertedWith("Bad sig");
      });

      it("Same orderId for different users is allowed", async () => {
        const { socialCurationPool, claimSigner, alice, bob } =
          await loadFixture(deploySocialCurationFixture);

        await mine(200);
        await socialCurationPool.harvestRewards({ value: 0 });

        const amount = ethers.parseEther("1");
        const deadline = await futureDeadline();

        // orderId=1 for alice
        const sigAlice = await signClaim(claimSigner, socialCurationPool.target, {
          orderId: 1, amount, to: alice.address, deadline,
        });
        await socialCurationPool.connect(alice).claim(1, amount, deadline, sigAlice, { value: 0 });

        // orderId=1 for bob (different user, same orderId is OK)
        const sigBob = await signClaim(claimSigner, socialCurationPool.target, {
          orderId: 1, amount, to: bob.address, deadline,
        });
        await socialCurationPool.connect(bob).claim(1, amount, deadline, sigBob, { value: 0 });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. Reward Harvesting
  // ═══════════════════════════════════════════════════════════════
  describe("Reward Harvesting", () => {
    it("Claim triggers harvest when pool balance insufficient (harvested=true)", async () => {
      const { socialCurationPool, claimSigner, alice } =
        await loadFixture(deploySocialCurationFixture);

      // Mine blocks but do NOT harvest - let claim trigger it
      await mine(200);

      const amount = ethers.parseEther("1");
      const deadline = await futureDeadline();
      const sig = await signClaim(claimSigner, socialCurationPool.target, {
        orderId: 1, amount, to: alice.address, deadline,
      });

      const tx = await socialCurationPool.connect(alice).claim(
        1, amount, deadline, sig, { value: 0 }
      );
      const receipt = await tx.wait();
      const iface = socialCurationPool.interface;
      const parsed = findEvent(receipt, iface, "SocialClaimed");
      expect(parsed.args.harvested).to.equal(true);
    });

    it("Claim uses existing balance when sufficient (harvested=false)", async () => {
      const { socialCurationPool, claimSigner, alice } =
        await loadFixture(deploySocialCurationFixture);

      // Harvest first to fill pool balance
      await mine(200);
      await socialCurationPool.harvestRewards({ value: 0 });

      const amount = ethers.parseEther("1");
      const deadline = await futureDeadline();
      const sig = await signClaim(claimSigner, socialCurationPool.target, {
        orderId: 1, amount, to: alice.address, deadline,
      });

      await expect(
        socialCurationPool.connect(alice).claim(1, amount, deadline, sig, { value: 0 })
      ).to.emit(socialCurationPool, "SocialClaimed")
        .withArgs(alice.address, 1, amount, false);
    });

    it("harvestRewards callable by anyone", async () => {
      const { socialCurationPool, alice, CToken } =
        await loadFixture(deploySocialCurationFixture);

      await mine(200);

      const balBefore = await CToken.balanceOf(socialCurationPool.target);
      await socialCurationPool.connect(alice).harvestRewards({ value: 0 });
      const balAfter = await CToken.balanceOf(socialCurationPool.target);

      expect(balAfter).to.be.gt(balBefore);
    });

    it("Claim reverts if harvest still yields insufficient balance", async () => {
      const { socialCurationPool, claimSigner, alice } =
        await loadFixture(deploySocialCurationFixture);

      // Only a few blocks mined - very little reward accrued
      // Distribution starts at blockNumber+100, so mine just past start
      await mine(105);

      // Try to claim a huge amount
      const hugeAmount = ethers.parseEther("999999999");
      const deadline = await futureDeadline();
      const sig = await signClaim(claimSigner, socialCurationPool.target, {
        orderId: 1, amount: hugeAmount, to: alice.address, deadline,
      });

      await expect(
        socialCurationPool.connect(alice).claim(1, hugeAmount, deadline, sig, { value: 0 })
      ).to.be.revertedWith("Insufficient bal");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. Fee Handling
  // ═══════════════════════════════════════════════════════════════
  describe("Fee Handling", () => {
    it("Claim charges Tier-3 fee when pool has sufficient balance", async () => {
      const { socialCurationPool, claimSigner, alice, Committee, owner } =
        await loadFixture(deploySocialCurationFixture);

      const fee = ethers.parseEther("0.01");
      await Committee.adminSetPoolOperationFee(fee);

      await mine(200);
      await socialCurationPool.connect(alice).harvestRewards({ value: fee });

      const amount = ethers.parseEther("1");
      const deadline = await futureDeadline();
      const sig = await signClaim(claimSigner, socialCurationPool.target, {
        orderId: 1, amount, to: alice.address, deadline,
      });

      const recipientBalBefore = await ethers.provider.getBalance(owner.address);

      await socialCurationPool.connect(alice).claim(
        1, amount, deadline, sig, { value: fee }
      );

      const recipientBalAfter = await ethers.provider.getBalance(owner.address);
      expect(recipientBalAfter - recipientBalBefore).to.equal(fee);
    });

    it("Claim reverts without sufficient ETH for fee", async () => {
      const { socialCurationPool, claimSigner, alice, Committee } =
        await loadFixture(deploySocialCurationFixture);

      const fee = ethers.parseEther("0.01");
      await Committee.adminSetPoolOperationFee(fee);

      await mine(200);
      await socialCurationPool.harvestRewards({ value: fee });

      const amount = ethers.parseEther("1");
      const deadline = await futureDeadline();
      const sig = await signClaim(claimSigner, socialCurationPool.target, {
        orderId: 1, amount, to: alice.address, deadline,
      });

      // Send 0 ETH when fee is required
      await expect(
        socialCurationPool.connect(alice).claim(1, amount, deadline, sig, { value: 0 })
      ).to.be.revertedWith("Insufficient fee");
    });

    it("Fee-free user skips fee (direct path)", async () => {
      const { socialCurationPool, claimSigner, alice, Committee } =
        await loadFixture(deploySocialCurationFixture);

      const fee = ethers.parseEther("0.01");
      await Committee.adminSetPoolOperationFee(fee);
      await Committee.adminAddFeeFreeAddress(alice.address);

      await mine(200);
      await socialCurationPool.connect(alice).harvestRewards({ value: fee });

      const amount = ethers.parseEther("1");
      const deadline = await futureDeadline();
      const sig = await signClaim(claimSigner, socialCurationPool.target, {
        orderId: 1, amount, to: alice.address, deadline,
      });

      // Fee-free user sends 0 ETH and succeeds
      await socialCurationPool.connect(alice).claim(1, amount, deadline, sig, { value: 0 });
    });

    it("Excess ETH is refunded to user", async () => {
      const { socialCurationPool, claimSigner, alice, Committee } =
        await loadFixture(deploySocialCurationFixture);

      const fee = ethers.parseEther("0.01");
      await Committee.adminSetPoolOperationFee(fee);

      await mine(200);
      await socialCurationPool.harvestRewards({ value: fee });

      const amount = ethers.parseEther("1");
      const deadline = await futureDeadline();
      const sig = await signClaim(claimSigner, socialCurationPool.target, {
        orderId: 1, amount, to: alice.address, deadline,
      });

      const excessValue = ethers.parseEther("0.05");
      const balBefore = await ethers.provider.getBalance(alice.address);

      const tx = await socialCurationPool.connect(alice).claim(
        1, amount, deadline, sig, { value: excessValue }
      );
      const receipt = await tx.wait();
      const gasCost =
        receipt.gasUsed *
        (receipt.gasPrice ?? receipt.effectiveGasPrice ?? 0n);

      const balAfter = await ethers.provider.getBalance(alice.address);
      // User spent only fee + gas, excess was refunded
      expect(balBefore - balAfter - gasCost).to.equal(fee);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. Integration Tests
  // ═══════════════════════════════════════════════════════════════
  describe("Integration", () => {
    it("Full lifecycle: create community -> add pool -> mine -> claim", async () => {
      const { socialCurationPool, claimSigner, alice, CToken } =
        await loadFixture(deploySocialCurationFixture);

      // Verify pool starts with 0 balance
      expect(await CToken.balanceOf(socialCurationPool.target)).to.equal(0n);

      // Mine past distribution start (blockNumber+100)
      await mine(200);

      // Claim triggers harvest
      const amount = ethers.parseEther("10");
      const deadline = await futureDeadline();
      const sig = await signClaim(claimSigner, socialCurationPool.target, {
        orderId: 1, amount, to: alice.address, deadline,
      });

      await socialCurationPool.connect(alice).claim(1, amount, deadline, sig, { value: 0 });

      expect(await CToken.balanceOf(alice.address)).to.equal(amount);
      expect(await socialCurationPool.totalClaimed()).to.equal(amount);
    });

    it("SocialCuration pool alongside ERC20Staking pool (ratio split)", async () => {
      const contracts = await loadFixture(deploySocialCurationFixture);
      const { Community, communityOwner, claimSigner, alice, CToken, socialCurationPool } = contracts;

      // Add an ERC20Staking pool (50/50 ratio split)
      const stakeMeta = ethers.solidityPacked(["address"], [CToken.target]);
      const tx = await Community.connect(communityOwner).adminAddPool(
        "Stake ERC20",
        [5000, 5000],
        contracts.ERC20StakingFactory.target,
        stakeMeta,
        { value: 0 }
      );
      const receipt = await tx.wait();
      const event = findEvent(receipt, Community.interface, "AdminSetPoolRatio");
      const erc20PoolAddr = event.args.pools[event.args.pools.length - 1];

      // Mine blocks to accrue rewards
      await mine(200);

      // Harvest social curation pool
      await socialCurationPool.harvestRewards({ value: 0 });

      // Social curation pool should have received ~50% of rewards
      const poolBal = await CToken.balanceOf(socialCurationPool.target);
      expect(poolBal).to.be.gt(0);

      // Claim from social curation pool
      const claimAmount = ethers.parseEther("1");
      const deadline = await futureDeadline();
      const sig = await signClaim(claimSigner, socialCurationPool.target, {
        orderId: 1, amount: claimAmount, to: alice.address, deadline,
      });
      await socialCurationPool.connect(alice).claim(
        1, claimAmount, deadline, sig, { value: 0 }
      );

      expect(await CToken.balanceOf(alice.address)).to.equal(claimAmount);
    });

    it("Multiple users claiming from same pool in sequence", async () => {
      const { socialCurationPool, claimSigner, alice, bob, CToken } =
        await loadFixture(deploySocialCurationFixture);

      await mine(200);
      await socialCurationPool.harvestRewards({ value: 0 });

      const amount = ethers.parseEther("5");
      const deadline = await futureDeadline();

      // Alice claims
      const sigAlice = await signClaim(claimSigner, socialCurationPool.target, {
        orderId: 1, amount, to: alice.address, deadline,
      });
      await socialCurationPool.connect(alice).claim(1, amount, deadline, sigAlice, { value: 0 });

      // Bob claims
      const sigBob = await signClaim(claimSigner, socialCurationPool.target, {
        orderId: 1, amount, to: bob.address, deadline,
      });
      await socialCurationPool.connect(bob).claim(1, amount, deadline, sigBob, { value: 0 });

      expect(await CToken.balanceOf(alice.address)).to.equal(amount);
      expect(await CToken.balanceOf(bob.address)).to.equal(amount);
      expect(await socialCurationPool.totalClaimed()).to.equal(amount * 2n);
    });
  });
});
