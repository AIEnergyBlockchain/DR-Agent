import fs from "node:fs";
import path from "node:path";

import { ethers, network } from "hardhat";

function resolveBytes32(label: string): string {
  const raw = label.trim();
  if (raw.startsWith("0x") && raw.length === 66) {
    return raw;
  }
  return ethers.keccak256(ethers.toUtf8Bytes(raw));
}

async function main(): Promise<void> {
  if (network.name !== "dr_l1") {
    throw new Error(`This script is for dr_l1 network only. Current: ${network.name}`);
  }

  if (!process.env.PRIVATE_KEY) {
    throw new Error(
      "PRIVATE_KEY is required for Custom L1 bridge deployment. Set it in ~/.config/dr-agent/secrets.env."
    );
  }

  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  const relayer = (process.env.DR_BRIDGE_RELAYER || deployer.address).trim();
  console.log("[bridge-l1] deployer:", deployer.address);
  console.log("[bridge-l1] chainId:", chain.chainId.toString());
  console.log("[bridge-l1] balance (wei):", balance.toString());
  console.log("[bridge-l1] relayer:", relayer);

  const tokenFactory = await ethers.getContractFactory("DRTokenRemote");
  const tokenRemote = await tokenFactory.deploy(deployer.address);
  await tokenRemote.waitForDeployment();

  const bridgeFactory = await ethers.getContractFactory("DRTBridge");
  const bridge = await bridgeFactory.deploy(
    await tokenRemote.getAddress(),
    1, // Remote mode
    deployer.address,
    relayer
  );
  await bridge.waitForDeployment();

  const setBridgeTx = await tokenRemote.setBridge(await bridge.getAddress());
  const setBridgeReceipt = await setBridgeTx.wait();

  let setRemoteTxHash: string | null = null;
  const remoteChain = (process.env.DR_BRIDGE_HOME_CHAIN || "").trim();
  const remoteBridge = (process.env.DR_BRIDGE_HOME_ADDRESS || "").trim();
  if (remoteChain && remoteBridge) {
    const chainIdBytes32 = resolveBytes32(remoteChain);
    const setTx = await bridge.setRemoteBridge(chainIdBytes32, remoteBridge);
    const receipt = await setTx.wait();
    setRemoteTxHash = receipt?.hash ?? setTx.hash;
  }

  const relayerFactory = await ethers.getContractFactory("ICMRelayer");
  const icmRelayer = await relayerFactory.deploy(deployer.address);
  await icmRelayer.waitForDeployment();

  const report = {
    deployed_at_utc: new Date().toISOString(),
    network: network.name,
    chain_id: Number(chain.chainId),
    deployer: deployer.address,
    contracts: {
      drt_remote: await tokenRemote.getAddress(),
      bridge: await bridge.getAddress(),
      icm_relayer: await icmRelayer.getAddress(),
    },
    config: {
      mode: "remote",
      operator: deployer.address,
      relayer,
      home_chain: remoteChain || null,
      home_bridge: remoteBridge || null,
    },
    tx_hashes: {
      deploy_drt_remote: tokenRemote.deploymentTransaction()?.hash ?? null,
      deploy_bridge: bridge.deploymentTransaction()?.hash ?? null,
      set_drt_remote_bridge: setBridgeReceipt?.hash ?? setBridgeTx.hash,
      set_remote_bridge: setRemoteTxHash,
      deploy_icm_relayer: icmRelayer.deploymentTransaction()?.hash ?? null,
    },
  };

  const outPath = process.env.DR_BRIDGE_L1_OUT || "cache/l1-bridge-deployment-latest.json";
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log("[bridge-l1] deployment report written:", outPath);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[bridge-l1] deployment failed:", message);
  process.exit(1);
});
