import { expect } from "chai";
import { ethers } from "hardhat";
import {
  DRToken,
  EventManager,
  ProofRegistry,
  Settlement,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Settlement flow", function () {
  let operator: SignerWithAddress;
  let participantA: SignerWithAddress;
  let participantB: SignerWithAddress;
  let outsider: SignerWithAddress;

  let drtToken: DRToken;
  let eventManager: EventManager;
  let proofRegistry: ProofRegistry;
  let settlement: Settlement;

  const eventId = ethers.id("event-closed-loop-001");
  const siteA = ethers.id("site-a");
  const siteB = ethers.id("site-b");
  const INITIAL_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [operator, participantA, participantB, outsider] = await ethers.getSigners();

    const drtFactory = await ethers.getContractFactory("DRToken");
    drtToken = await drtFactory.deploy(operator.address, INITIAL_SUPPLY);

    const eventFactory = await ethers.getContractFactory("EventManager");
    eventManager = await eventFactory.deploy(operator.address);

    const proofFactory = await ethers.getContractFactory("ProofRegistry");
    proofRegistry = await proofFactory.deploy(await eventManager.getAddress());

    const settlementFactory = await ethers.getContractFactory("Settlement");
    settlement = await settlementFactory.deploy(
      await eventManager.getAddress(),
      await proofRegistry.getAddress(),
      operator.address,
      await drtToken.getAddress()
    );

    // Fund Settlement contract with DRT tokens
    await drtToken.transfer(await settlement.getAddress(), ethers.parseEther("500000"));

    await eventManager.setSettlementContract(await settlement.getAddress());
  });

  it("runs create -> submit -> settle -> claim happy path", async function () {
    await eventManager.createEvent(
      eventId,
      1700000000,
      1700003600,
      200,
      10,
      5
    );

    await proofRegistry
      .connect(participantA)
      .submitProof(eventId, siteA, 150, 40, ethers.id("payload-a"), "ipfs://a");
    await proofRegistry
      .connect(participantB)
      .submitProof(eventId, siteB, 150, 120, ethers.id("payload-b"), "ipfs://b");

    await eventManager.closeEvent(eventId);

    await settlement.settleEvent(eventId, [siteA, siteB]);

    const eventInfo = await eventManager.getEventInfo(eventId);
    expect(eventInfo.status).to.equal(3);

    const settledA = await settlement.getSettlement(eventId, siteA);
    const settledB = await settlement.getSettlement(eventId, siteB);

    expect(settledA.payout).to.equal(1000); // targetShare=100 => 100*10
    expect(settledB.payout).to.equal(-50); // 30*10 - (70*5)

    // participantA has positive payout (1000) — should receive DRT tokens
    const balBefore = await drtToken.balanceOf(participantA.address);

    await expect(
      settlement.connect(participantA).claimReward(eventId, siteA)
    ).to.emit(settlement, "RewardClaimed");

    const balAfter = await drtToken.balanceOf(participantA.address);
    expect(balAfter - balBefore).to.equal(1000n);

    const claimed = await settlement.getSettlement(eventId, siteA);
    expect(claimed.status).to.equal(2);

    await expect(
      settlement.connect(participantA).claimReward(eventId, siteA)
    ).to.be.revertedWith("Not claimable");
  });

  it("prevents duplicate proof submission", async function () {
    await eventManager.createEvent(
      eventId,
      1700000000,
      1700003600,
      200,
      10,
      5
    );

    await proofRegistry
      .connect(participantA)
      .submitProof(eventId, siteA, 120, 80, ethers.id("payload-a"), "ipfs://a");

    await expect(
      proofRegistry
        .connect(participantA)
        .submitProof(eventId, siteA, 120, 80, ethers.id("payload-a2"), "ipfs://a2")
    ).to.be.revertedWith("Proof already submitted");
  });

  it("requires event to be closed before settle", async function () {
    await eventManager.createEvent(
      eventId,
      1700000000,
      1700003600,
      100,
      10,
      5
    );

    await proofRegistry
      .connect(participantA)
      .submitProof(eventId, siteA, 120, 80, ethers.id("payload-a"), "ipfs://a");

    await expect(settlement.settleEvent(eventId, [siteA])).to.be.revertedWith(
      "Event must be closed"
    );
  });

  it("enforces role checks for settle and claim", async function () {
    await eventManager.createEvent(
      eventId,
      1700000000,
      1700003600,
      100,
      10,
      5
    );

    await proofRegistry
      .connect(participantA)
      .submitProof(eventId, siteA, 120, 80, ethers.id("payload-a"), "ipfs://a");

    await eventManager.closeEvent(eventId);

    await expect(
      settlement.connect(outsider).settleEvent(eventId, [siteA])
    ).to.be.revertedWith("Not operator/service");

    await settlement.settleEvent(eventId, [siteA]);

    await expect(
      settlement.connect(outsider).claimReward(eventId, siteA)
    ).to.be.revertedWith("Not proof submitter");
  });

  it("enforces idempotent settlement", async function () {
    await eventManager.createEvent(
      eventId,
      1700000000,
      1700003600,
      100,
      10,
      5
    );

    await proofRegistry
      .connect(participantA)
      .submitProof(eventId, siteA, 120, 80, ethers.id("payload-a"), "ipfs://a");

    await eventManager.closeEvent(eventId);
    await settlement.settleEvent(eventId, [siteA]);

    await expect(settlement.settleEvent(eventId, [siteA])).to.be.revertedWith(
      "Event already settled"
    );
  });

  it("allows authorized service to trigger settle", async function () {
    await eventManager.createEvent(
      eventId,
      1700000000,
      1700003600,
      100,
      10,
      5
    );

    await proofRegistry
      .connect(participantA)
      .submitProof(eventId, siteA, 120, 80, ethers.id("payload-a"), "ipfs://a");

    await eventManager.closeEvent(eventId);
    await settlement.setAuthorizedService(outsider.address, true);

    await expect(
      settlement.connect(outsider).settleEvent(eventId, [siteA])
    ).to.emit(settlement, "SiteSettled");
  });
});
