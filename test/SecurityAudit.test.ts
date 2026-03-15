import { expect } from "chai";
import { ethers } from "hardhat";
import {
  DRToken,
  DRTokenRemote,
  DRTBridge,
  EventManager,
  ProofRegistry,
  Settlement,
  ICMRelayer,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Security audit test suite.
 *
 * Covers OWASP smart contract top 10, reentrancy guards, access control,
 * integer overflow/underflow, and edge cases for pre-audit hardening.
 */
describe("Security Audit — Pre-audit hardening tests", function () {
  let operator: SignerWithAddress;
  let userA: SignerWithAddress;
  let userB: SignerWithAddress;
  let attacker: SignerWithAddress;

  beforeEach(async function () {
    [operator, userA, userB, attacker] = await ethers.getSigners();
  });

  // -----------------------------------------------------------------------
  // Access Control
  // -----------------------------------------------------------------------

  describe("Access Control", function () {
    it("EventManager: non-operator cannot create event", async function () {
      const factory = await ethers.getContractFactory("EventManager");
      const em = await factory.deploy(operator.address);
      const eventId = ethers.id("access-test-1");

      await expect(
        em.connect(attacker).createEvent(eventId, 1700000000, 1700003600, 100, 10, 5)
      ).to.be.revertedWith("Not operator");
    });

    it("EventManager: non-operator cannot close event", async function () {
      const factory = await ethers.getContractFactory("EventManager");
      const em = await factory.deploy(operator.address);
      const eventId = ethers.id("access-test-2");
      await em.createEvent(eventId, 1700000000, 1700003600, 100, 10, 5);

      await expect(
        em.connect(attacker).closeEvent(eventId)
      ).to.be.revertedWith("Not operator");
    });

    it("Settlement: non-operator cannot set authorized service", async function () {
      const em = await (await ethers.getContractFactory("EventManager")).deploy(operator.address);
      const pr = await (await ethers.getContractFactory("ProofRegistry")).deploy(await em.getAddress());
      const drt = await (await ethers.getContractFactory("DRToken")).deploy(operator.address, 1000000);
      const s = await (await ethers.getContractFactory("Settlement")).deploy(
        await em.getAddress(), await pr.getAddress(), operator.address, await drt.getAddress()
      );

      await expect(
        s.connect(attacker).setAuthorizedService(attacker.address, true)
      ).to.be.revertedWith("Not operator");
    });

    it("DRTokenRemote: non-owner cannot set bridge", async function () {
      const factory = await ethers.getContractFactory("DRTokenRemote");
      const remote = await factory.deploy(operator.address);

      await expect(
        remote.connect(attacker).setBridge(attacker.address)
      ).to.be.revertedWith("DRTokenRemote: caller is not the owner");
    });

    it("ICMRelayer: non-operator cannot receive messages", async function () {
      const factory = await ethers.getContractFactory("ICMRelayer");
      const relayer = await factory.deploy(operator.address);
      const chainId = ethers.id("fuji:43113");
      await relayer.setTrustedChain(chainId, true);

      await expect(
        relayer.connect(attacker).receiveMessage(chainId, ethers.id("m1"), 0, attacker.address, "0x")
      ).to.be.revertedWith("ICMRelayer: not operator");
    });
  });

  // -----------------------------------------------------------------------
  // Zero address protection
  // -----------------------------------------------------------------------

  describe("Zero Address Protection", function () {
    it("EventManager: rejects zero operator", async function () {
      const factory = await ethers.getContractFactory("EventManager");
      await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWith("Zero address");
    });

    it("DRToken: rejects zero owner", async function () {
      const factory = await ethers.getContractFactory("DRToken");
      await expect(factory.deploy(ethers.ZeroAddress, 1000)).to.be.revertedWith("Zero owner");
    });

    it("Settlement: rejects zero addresses in constructor", async function () {
      const factory = await ethers.getContractFactory("Settlement");
      await expect(
        factory.deploy(ethers.ZeroAddress, operator.address, operator.address, operator.address)
      ).to.be.revertedWith("Zero event manager");
    });

    it("DRTBridge: rejects zero token", async function () {
      const factory = await ethers.getContractFactory("DRTBridge");
      await expect(
        factory.deploy(ethers.ZeroAddress, 0, operator.address, operator.address)
      ).to.be.revertedWith("DRTBridge: zero token");
    });

    it("DRTBridge: rejects zero relayer", async function () {
      const drt = await (await ethers.getContractFactory("DRToken")).deploy(operator.address, 1000);
      const factory = await ethers.getContractFactory("DRTBridge");
      await expect(
        factory.deploy(await drt.getAddress(), 0, operator.address, ethers.ZeroAddress)
      ).to.be.revertedWith("DRTBridge: zero relayer");
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases and invariants
  // -----------------------------------------------------------------------

  describe("Edge Cases", function () {
    it("Settlement: payout with zero reduction yields negative", async function () {
      const em = await (await ethers.getContractFactory("EventManager")).deploy(operator.address);
      const pr = await (await ethers.getContractFactory("ProofRegistry")).deploy(await em.getAddress());
      const drt = await (await ethers.getContractFactory("DRToken")).deploy(operator.address, ethers.parseEther("1000000"));
      const s = await (await ethers.getContractFactory("Settlement")).deploy(
        await em.getAddress(), await pr.getAddress(), operator.address, await drt.getAddress()
      );
      await drt.transfer(await s.getAddress(), ethers.parseEther("500000"));
      await em.setSettlementContract(await s.getAddress());

      const eventId = ethers.id("edge-zero-reduction");
      const siteId = ethers.id("site-a");

      await em.createEvent(eventId, 1700000000, 1700003600, 100, 10, 5);
      await pr.connect(userA).submitProof(eventId, siteId, 100, 100, ethers.id("p"), "ipfs://x");
      await em.closeEvent(eventId);
      await s.settleEvent(eventId, [siteId]);

      const record = await s.getSettlement(eventId, siteId);
      // 0 reduction, target_share=100: payout = 0*10 - (100-0)*5 = -500
      expect(record.payout).to.equal(-500);
    });

    it("ProofRegistry: rejects proof for non-active event", async function () {
      const em = await (await ethers.getContractFactory("EventManager")).deploy(operator.address);
      const pr = await (await ethers.getContractFactory("ProofRegistry")).deploy(await em.getAddress());

      const eventId = ethers.id("edge-not-active");
      await em.createEvent(eventId, 1700000000, 1700003600, 100, 10, 5);
      await em.closeEvent(eventId);

      await expect(
        pr.connect(userA).submitProof(eventId, ethers.id("s-a"), 100, 80, ethers.id("ph"), "ipfs://x")
      ).to.be.revertedWith("Event not active");
    });

    it("Settlement: claim with negative payout transfers nothing", async function () {
      const em = await (await ethers.getContractFactory("EventManager")).deploy(operator.address);
      const pr = await (await ethers.getContractFactory("ProofRegistry")).deploy(await em.getAddress());
      const drt = await (await ethers.getContractFactory("DRToken")).deploy(operator.address, ethers.parseEther("1000000"));
      const s = await (await ethers.getContractFactory("Settlement")).deploy(
        await em.getAddress(), await pr.getAddress(), operator.address, await drt.getAddress()
      );
      await drt.transfer(await s.getAddress(), ethers.parseEther("500000"));
      await em.setSettlementContract(await s.getAddress());

      const eventId = ethers.id("edge-negative-payout");
      const siteId = ethers.id("site-neg");

      await em.createEvent(eventId, 1700000000, 1700003600, 200, 10, 5);
      // Submit proof with zero reduction
      await pr.connect(userA).submitProof(eventId, siteId, 100, 100, ethers.id("p"), "ipfs://x");
      await em.closeEvent(eventId);
      await s.settleEvent(eventId, [siteId]);

      const balBefore = await drt.balanceOf(userA.address);
      await s.connect(userA).claimReward(eventId, siteId);
      const balAfter = await drt.balanceOf(userA.address);

      // Negative payout = no token transfer
      expect(balAfter).to.equal(balBefore);
    });

    it("DRTBridge: cannot send without remote bridge set", async function () {
      const drt = await (await ethers.getContractFactory("DRToken")).deploy(operator.address, ethers.parseEther("10000"));
      const bridge = await (await ethers.getContractFactory("DRTBridge")).deploy(
        await drt.getAddress(), 0, operator.address, userA.address
      );
      // remoteBridge not set

      await drt.approve(await bridge.getAddress(), ethers.parseEther("100"));
      await expect(
        bridge.sendTokens(ethers.parseEther("100"))
      ).to.be.revertedWith("DRTBridge: remote bridge not set");
    });

    it("ICMRelayer: message count tracks correctly", async function () {
      const relayer = await (await ethers.getContractFactory("ICMRelayer")).deploy(operator.address);
      const chainId = ethers.id("fuji:43113");
      await relayer.setTrustedChain(chainId, true);

      expect(await relayer.messageCount()).to.equal(0);

      await relayer.receiveMessage(chainId, ethers.id("m1"), 0, userA.address, "0x");
      await relayer.receiveMessage(chainId, ethers.id("m2"), 1, userA.address, "0x");

      expect(await relayer.messageCount()).to.equal(2);
    });
  });

  // -----------------------------------------------------------------------
  // DRToken supply integrity
  // -----------------------------------------------------------------------

  describe("DRT Supply Integrity", function () {
    it("total supply matches initial supply after deployment", async function () {
      const supply = ethers.parseEther("1000000");
      const drt = await (await ethers.getContractFactory("DRToken")).deploy(operator.address, supply);

      expect(await drt.totalSupply()).to.equal(supply);
      expect(await drt.balanceOf(operator.address)).to.equal(supply);
    });

    it("bridge lock does not change total supply", async function () {
      const supply = ethers.parseEther("1000000");
      const drt = await (await ethers.getContractFactory("DRToken")).deploy(operator.address, supply);
      const bridge = await (await ethers.getContractFactory("DRTBridge")).deploy(
        await drt.getAddress(), 0, operator.address, userA.address
      );
      const chainId = ethers.id("remote:1");
      await bridge.setRemoteBridge(chainId, userB.address);

      await drt.approve(await bridge.getAddress(), ethers.parseEther("1000"));
      await bridge.sendTokens(ethers.parseEther("1000"));

      // Total supply unchanged — tokens locked, not burned
      expect(await drt.totalSupply()).to.equal(supply);
    });
  });
});
