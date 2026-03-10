import { expect } from "chai";
import { ethers } from "hardhat";
import { ICMRelayer } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ICMRelayer — Interchain Messaging", function () {
  let operator: SignerWithAddress;
  let outsider: SignerWithAddress;
  let relayer: ICMRelayer;

  const FUJI_CHAIN_ID = ethers.id("fuji:43113");
  const DR_L1_CHAIN_ID = ethers.id("dr-l1:99999");

  beforeEach(async function () {
    [operator, outsider] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("ICMRelayer");
    relayer = await factory.deploy(operator.address);

    // Trust both chains
    await relayer.setTrustedChain(FUJI_CHAIN_ID, true);
    await relayer.setTrustedChain(DR_L1_CHAIN_ID, true);
  });

  // -----------------------------------------------------------------------
  // Trusted chain management
  // -----------------------------------------------------------------------

  describe("Trusted chains", function () {
    it("sets trusted chain", async function () {
      expect(await relayer.trustedChains(FUJI_CHAIN_ID)).to.be.true;
    });

    it("removes trusted chain", async function () {
      await relayer.setTrustedChain(FUJI_CHAIN_ID, false);
      expect(await relayer.trustedChains(FUJI_CHAIN_ID)).to.be.false;
    });

    it("only operator can set trusted chain", async function () {
      await expect(
        relayer.connect(outsider).setTrustedChain(FUJI_CHAIN_ID, true)
      ).to.be.revertedWith("ICMRelayer: not operator");
    });

    it("emits TrustedChainUpdated", async function () {
      const newChain = ethers.id("test-chain:12345");
      await expect(relayer.setTrustedChain(newChain, true))
        .to.emit(relayer, "TrustedChainUpdated")
        .withArgs(newChain, true);
    });
  });

  // -----------------------------------------------------------------------
  // Message receiving
  // -----------------------------------------------------------------------

  describe("receiveMessage", function () {
    it("receives a bridge transfer message", async function () {
      const msgId = ethers.id("msg-001");
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [outsider.address, ethers.parseEther("1000")]
      );

      await expect(
        relayer.receiveMessage(FUJI_CHAIN_ID, msgId, 0, outsider.address, payload)
      )
        .to.emit(relayer, "MessageReceived")
        .withArgs(msgId, FUJI_CHAIN_ID, 0, outsider.address);

      expect(await relayer.messageCount()).to.equal(1);
    });

    it("receives a settlement sync message", async function () {
      const msgId = ethers.id("msg-002");
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "uint256"],
        [ethers.id("event-001"), 1000]
      );

      await relayer.receiveMessage(DR_L1_CHAIN_ID, msgId, 1, operator.address, payload);

      const msg = await relayer.getMessage(msgId);
      expect(msg.messageType).to.equal(1); // SettlementSync
      expect(msg.sourceChainId).to.equal(DR_L1_CHAIN_ID);
    });

    it("receives a proof attestation message", async function () {
      const msgId = ethers.id("msg-003");
      const payload = "0x";

      await relayer.receiveMessage(FUJI_CHAIN_ID, msgId, 2, outsider.address, payload);

      const msg = await relayer.getMessage(msgId);
      expect(msg.messageType).to.equal(2); // ProofAttestation
    });

    it("rejects untrusted source chain", async function () {
      const untrustedChain = ethers.id("rogue-chain:666");
      const msgId = ethers.id("msg-bad");

      await expect(
        relayer.receiveMessage(untrustedChain, msgId, 0, outsider.address, "0x")
      ).to.be.revertedWith("ICMRelayer: untrusted source chain");
    });

    it("rejects duplicate message", async function () {
      const msgId = ethers.id("msg-dup");
      await relayer.receiveMessage(FUJI_CHAIN_ID, msgId, 0, outsider.address, "0x");

      await expect(
        relayer.receiveMessage(FUJI_CHAIN_ID, msgId, 0, outsider.address, "0x")
      ).to.be.revertedWith("ICMRelayer: duplicate message");
    });

    it("rejects invalid message type", async function () {
      const msgId = ethers.id("msg-invalid-type");

      await expect(
        relayer.receiveMessage(FUJI_CHAIN_ID, msgId, 5, outsider.address, "0x")
      ).to.be.revertedWith("ICMRelayer: invalid type");
    });

    it("only operator can receive messages", async function () {
      const msgId = ethers.id("msg-unauth");

      await expect(
        relayer.connect(outsider).receiveMessage(FUJI_CHAIN_ID, msgId, 0, outsider.address, "0x")
      ).to.be.revertedWith("ICMRelayer: not operator");
    });
  });

  // -----------------------------------------------------------------------
  // Message processing
  // -----------------------------------------------------------------------

  describe("markProcessed", function () {
    it("marks message as processed", async function () {
      const msgId = ethers.id("msg-process");
      await relayer.receiveMessage(FUJI_CHAIN_ID, msgId, 0, outsider.address, "0x");

      await expect(relayer.markProcessed(msgId, true))
        .to.emit(relayer, "MessageProcessed")
        .withArgs(msgId, true);

      expect(await relayer.isProcessed(msgId)).to.be.true;
    });

    it("rejects processing unknown message", async function () {
      const msgId = ethers.id("msg-unknown");

      await expect(
        relayer.markProcessed(msgId, true)
      ).to.be.revertedWith("ICMRelayer: message not found");
    });

    it("rejects double processing", async function () {
      const msgId = ethers.id("msg-double");
      await relayer.receiveMessage(FUJI_CHAIN_ID, msgId, 0, outsider.address, "0x");
      await relayer.markProcessed(msgId, true);

      await expect(
        relayer.markProcessed(msgId, true)
      ).to.be.revertedWith("ICMRelayer: already processed");
    });

    it("can mark as failed", async function () {
      const msgId = ethers.id("msg-fail");
      await relayer.receiveMessage(FUJI_CHAIN_ID, msgId, 0, outsider.address, "0x");

      await expect(relayer.markProcessed(msgId, false))
        .to.emit(relayer, "MessageProcessed")
        .withArgs(msgId, false);

      expect(await relayer.isProcessed(msgId)).to.be.true;
    });
  });

  // -----------------------------------------------------------------------
  // Full flow: receive → process
  // -----------------------------------------------------------------------

  describe("Full ICM flow", function () {
    it("receives multiple messages from different chains and processes them", async function () {
      const msg1 = ethers.id("bridge-msg-001");
      const msg2 = ethers.id("settle-msg-001");
      const msg3 = ethers.id("proof-msg-001");

      // Receive bridge transfer from Fuji
      await relayer.receiveMessage(FUJI_CHAIN_ID, msg1, 0, outsider.address, "0x");

      // Receive settlement sync from DR-L1
      await relayer.receiveMessage(DR_L1_CHAIN_ID, msg2, 1, operator.address, "0x");

      // Receive proof attestation from Fuji
      await relayer.receiveMessage(FUJI_CHAIN_ID, msg3, 2, outsider.address, "0x");

      expect(await relayer.messageCount()).to.equal(3);

      // Process first two
      await relayer.markProcessed(msg1, true);
      await relayer.markProcessed(msg2, true);

      expect(await relayer.isProcessed(msg1)).to.be.true;
      expect(await relayer.isProcessed(msg2)).to.be.true;
      expect(await relayer.isProcessed(msg3)).to.be.false;
    });
  });
});
