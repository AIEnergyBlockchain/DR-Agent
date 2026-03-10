import { expect } from "chai";
import { ethers } from "hardhat";
import {
  DRToken,
  DRTokenRemote,
  DRTBridge,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DRTBridge — ICTT cross-chain token bridge", function () {
  let operator: SignerWithAddress;
  let relayer: SignerWithAddress;
  let userA: SignerWithAddress;
  let outsider: SignerWithAddress;

  let drtHome: DRToken;
  let drtRemote: DRTokenRemote;
  let bridgeHome: DRTBridge;
  let bridgeRemote: DRTBridge;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const BRIDGE_FUND = ethers.parseEther("500000");
  const REMOTE_CHAIN_ID = ethers.id("dr-l1:99999");
  const HOME_CHAIN_ID = ethers.id("fuji:43113");

  beforeEach(async function () {
    [operator, relayer, userA, outsider] = await ethers.getSigners();

    // Deploy home chain DRT
    const drtFactory = await ethers.getContractFactory("DRToken");
    drtHome = await drtFactory.deploy(operator.address, INITIAL_SUPPLY);

    // Deploy remote chain DRT.r
    const drtRemoteFactory = await ethers.getContractFactory("DRTokenRemote");
    drtRemote = await drtRemoteFactory.deploy(operator.address);

    // Deploy home bridge (lock/unlock mode)
    const bridgeFactory = await ethers.getContractFactory("DRTBridge");
    bridgeHome = await bridgeFactory.deploy(
      await drtHome.getAddress(),
      0, // BridgeMode.Home
      operator.address,
      relayer.address
    );

    // Deploy remote bridge (mint/burn mode)
    bridgeRemote = await bridgeFactory.deploy(
      await drtRemote.getAddress(),
      1, // BridgeMode.Remote
      operator.address,
      relayer.address
    );

    // Set bridge on DRTokenRemote
    await drtRemote.setBridge(await bridgeRemote.getAddress());

    // Configure remote bridge addresses on each side
    await bridgeHome.setRemoteBridge(REMOTE_CHAIN_ID, await bridgeRemote.getAddress());
    await bridgeRemote.setRemoteBridge(HOME_CHAIN_ID, await bridgeHome.getAddress());

    // Fund home bridge with DRT (pre-lock for initial liquidity)
    await drtHome.transfer(await bridgeHome.getAddress(), BRIDGE_FUND);

    // Give userA some DRT on home chain
    await drtHome.transfer(userA.address, ethers.parseEther("10000"));
  });

  // -----------------------------------------------------------------------
  // DRTokenRemote
  // -----------------------------------------------------------------------

  describe("DRTokenRemote", function () {
    it("has correct name and symbol", async function () {
      expect(await drtRemote.name()).to.equal("Demand Response Token (Remote)");
      expect(await drtRemote.symbol()).to.equal("DRT.r");
    });

    it("only bridge can mint", async function () {
      await expect(
        drtRemote.connect(outsider).mint(outsider.address, 100)
      ).to.be.revertedWith("DRTokenRemote: caller is not the bridge");
    });

    it("only bridge can burn", async function () {
      await expect(
        drtRemote.connect(outsider).burn(outsider.address, 100)
      ).to.be.revertedWith("DRTokenRemote: caller is not the bridge");
    });

    it("only owner can set bridge", async function () {
      await expect(
        drtRemote.connect(outsider).setBridge(outsider.address)
      ).to.be.revertedWith("DRTokenRemote: caller is not the owner");
    });

    it("emits BridgeUpdated when bridge is set", async function () {
      await expect(
        drtRemote.setBridge(outsider.address)
      ).to.emit(drtRemote, "BridgeUpdated");
    });
  });

  // -----------------------------------------------------------------------
  // Home bridge — lock & send
  // -----------------------------------------------------------------------

  describe("Home bridge: sendTokens (lock)", function () {
    it("locks DRT and emits BridgeSend", async function () {
      const amount = ethers.parseEther("1000");
      await drtHome.connect(userA).approve(await bridgeHome.getAddress(), amount);

      await expect(
        bridgeHome.connect(userA).sendTokens(amount)
      )
        .to.emit(bridgeHome, "BridgeSend")
        .withArgs(1, userA.address, amount, REMOTE_CHAIN_ID, await bridgeRemote.getAddress());

      // DRT transferred from userA to bridge
      expect(await drtHome.balanceOf(userA.address)).to.equal(
        ethers.parseEther("9000")
      );
    });

    it("increments nonce", async function () {
      const amount = ethers.parseEther("100");
      await drtHome.connect(userA).approve(await bridgeHome.getAddress(), amount * 2n);

      await bridgeHome.connect(userA).sendTokens(amount);
      expect(await bridgeHome.nonce()).to.equal(1);

      await bridgeHome.connect(userA).sendTokens(amount);
      expect(await bridgeHome.nonce()).to.equal(2);
    });

    it("rejects zero amount", async function () {
      await expect(
        bridgeHome.connect(userA).sendTokens(0)
      ).to.be.revertedWith("DRTBridge: zero amount");
    });

    it("rejects when paused", async function () {
      await bridgeHome.setPaused(true);
      const amount = ethers.parseEther("100");
      await drtHome.connect(userA).approve(await bridgeHome.getAddress(), amount);

      await expect(
        bridgeHome.connect(userA).sendTokens(amount)
      ).to.be.revertedWith("DRTBridge: paused");
    });
  });

  // -----------------------------------------------------------------------
  // Remote bridge — receive (mint)
  // -----------------------------------------------------------------------

  describe("Remote bridge: receiveTokens (mint)", function () {
    it("mints DRT.r to recipient", async function () {
      const amount = ethers.parseEther("1000");

      await expect(
        bridgeRemote.connect(relayer).receiveTokens(1, userA.address, amount, HOME_CHAIN_ID)
      )
        .to.emit(bridgeRemote, "BridgeReceive")
        .withArgs(1, userA.address, amount, HOME_CHAIN_ID);

      expect(await drtRemote.balanceOf(userA.address)).to.equal(amount);
    });

    it("only relayer can call receiveTokens", async function () {
      await expect(
        bridgeRemote.connect(outsider).receiveTokens(1, userA.address, 100, HOME_CHAIN_ID)
      ).to.be.revertedWith("DRTBridge: not relayer");
    });

    it("rejects zero recipient", async function () {
      await expect(
        bridgeRemote.connect(relayer).receiveTokens(
          1, ethers.ZeroAddress, 100, HOME_CHAIN_ID
        )
      ).to.be.revertedWith("DRTBridge: zero recipient");
    });
  });

  // -----------------------------------------------------------------------
  // Remote bridge — send back (burn)
  // -----------------------------------------------------------------------

  describe("Remote bridge: sendTokens (burn)", function () {
    it("burns DRT.r and emits BridgeSend", async function () {
      // First mint some DRT.r to userA via relayer
      const amount = ethers.parseEther("1000");
      await bridgeRemote.connect(relayer).receiveTokens(1, userA.address, amount, HOME_CHAIN_ID);

      // Now userA sends back (burn)
      await expect(
        bridgeRemote.connect(userA).sendTokens(amount)
      )
        .to.emit(bridgeRemote, "BridgeSend")
        .withArgs(1, userA.address, amount, HOME_CHAIN_ID, await bridgeHome.getAddress());

      expect(await drtRemote.balanceOf(userA.address)).to.equal(0);
    });
  });

  // -----------------------------------------------------------------------
  // Home bridge — receiveTokens (unlock)
  // -----------------------------------------------------------------------

  describe("Home bridge: receiveTokens (unlock)", function () {
    it("unlocks DRT to recipient", async function () {
      const amount = ethers.parseEther("500");
      const balBefore = await drtHome.balanceOf(userA.address);

      await bridgeHome.connect(relayer).receiveTokens(1, userA.address, amount, REMOTE_CHAIN_ID);

      const balAfter = await drtHome.balanceOf(userA.address);
      expect(balAfter - balBefore).to.equal(amount);
    });
  });

  // -----------------------------------------------------------------------
  // Full round-trip: Home → Remote → Home
  // -----------------------------------------------------------------------

  describe("Full round-trip bridge flow", function () {
    it("lock → mint → burn → unlock preserves supply", async function () {
      const amount = ethers.parseEther("2000");

      // Step 1: userA locks DRT on home bridge
      await drtHome.connect(userA).approve(await bridgeHome.getAddress(), amount);
      await bridgeHome.connect(userA).sendTokens(amount);

      const homeBalAfterLock = await drtHome.balanceOf(userA.address);
      expect(homeBalAfterLock).to.equal(ethers.parseEther("8000"));

      // Step 2: relayer mints DRT.r on remote
      await bridgeRemote.connect(relayer).receiveTokens(1, userA.address, amount, HOME_CHAIN_ID);
      expect(await drtRemote.balanceOf(userA.address)).to.equal(amount);

      // Step 3: userA burns DRT.r to send back
      await bridgeRemote.connect(userA).sendTokens(amount);
      expect(await drtRemote.balanceOf(userA.address)).to.equal(0);

      // Step 4: relayer unlocks DRT on home
      await bridgeHome.connect(relayer).receiveTokens(1, userA.address, amount, REMOTE_CHAIN_ID);
      const homeBalAfterUnlock = await drtHome.balanceOf(userA.address);
      expect(homeBalAfterUnlock).to.equal(ethers.parseEther("10000")); // back to original
    });
  });

  // -----------------------------------------------------------------------
  // Admin functions
  // -----------------------------------------------------------------------

  describe("Admin", function () {
    it("only operator can set relayer", async function () {
      await expect(
        bridgeHome.connect(outsider).setRelayer(outsider.address)
      ).to.be.revertedWith("DRTBridge: not operator");
    });

    it("only operator can pause", async function () {
      await expect(
        bridgeHome.connect(outsider).setPaused(true)
      ).to.be.revertedWith("DRTBridge: not operator");
    });

    it("only operator can set remote bridge", async function () {
      await expect(
        bridgeHome.connect(outsider).setRemoteBridge(REMOTE_CHAIN_ID, outsider.address)
      ).to.be.revertedWith("DRTBridge: not operator");
    });

    it("lockedBalance reports correct amount", async function () {
      const locked = await bridgeHome.lockedBalance();
      expect(locked).to.equal(BRIDGE_FUND);
    });
  });
});
