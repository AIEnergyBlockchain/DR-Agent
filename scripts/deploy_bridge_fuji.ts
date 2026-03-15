import fs from "node:fs";
import path from "node:path";

import { ethers, network } from "hardhat";

type DeploymentReport = {
  contracts?: {
    drt_token?: string;
  };
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function resolveDrtToken(): string {
  const direct = (process.env.DRT_TOKEN_ADDRESS || "").trim();
  if (direct) {
    return direct;
  }
  const fallbackPath = process.env.DR_FUJI_DEPLOY_OUT || "cache/fuji-deployment-latest.json";
  const resolved = path.resolve(process.cwd(), fallbackPath);
  if (!fs.existsSync(resolved)) {
    throw new Error("DRT_TOKEN_ADDRESS missing and fuji deployment report not found");
  }
  const report = readJson<DeploymentReport>(resolved);
  const token = report.contracts?.drt_token;
  if (!token) {
    throw new Error("fuji deployment report missing contracts.drt_token");
  }
  return token;
}

function resolveBytes32(label: string): string {
  const raw = label.trim();
  if (raw.startsWith("0x") && raw.length === 66) {
    return raw;
  }
  return ethers.keccak256(ethers.toUtf8Bytes(raw));
}

async function main(): Promise<void> {
  if (network.name !== "fuji") {
    throw new Error(`This script is for fuji network only. Current: ${network.name}`);
  }

  if (!process.env.PRIVATE_KEY) {
    throw new Error(
      "PRIVATE_KEY is required for Fuji bridge deployment. Run with secrets configured."
    );
  }

  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  const drtToken = resolveDrtToken();
  const relayer = (process.env.DR_BRIDGE_RELAYER || deployer.address).trim();

  console.log("[bridge-fuji] deployer:", deployer.address);
  console.log("[bridge-fuji] chainId:", chain.chainId.toString());
  console.log("[bridge-fuji] balance (wei):", balance.toString());
  console.log("[bridge-fuji] drt_token:", drtToken);
  console.log("[bridge-fuji] relayer:", relayer);

  const bridgeFactory = await ethers.getContractFactory("DRTBridge");
  const bridge = await bridgeFactory.deploy(
    drtToken,
    0, // Home mode
    deployer.address,
    relayer
  );
  await bridge.waitForDeployment();

  let setRemoteTxHash: string | null = null;
  const remoteChain = (process.env.DR_BRIDGE_REMOTE_CHAIN || "").trim();
  const remoteBridge = (process.env.DR_BRIDGE_REMOTE_ADDRESS || "").trim();
  if (remoteChain && remoteBridge) {
    const chainIdBytes32 = resolveBytes32(remoteChain);
    const setTx = await bridge.setRemoteBridge(chainIdBytes32, remoteBridge);
    const receipt = await setTx.wait();
    setRemoteTxHash = receipt?.hash ?? setTx.hash;
  }

  const report = {
    deployed_at_utc: new Date().toISOString(),
    network: network.name,
    chain_id: Number(chain.chainId),
    deployer: deployer.address,
    contracts: {
      drt_token: drtToken,
      bridge: await bridge.getAddress(),
    },
    config: {
      mode: "home",
      operator: deployer.address,
      relayer,
      remote_chain: remoteChain || null,
      remote_bridge: remoteBridge || null,
    },
    tx_hashes: {
      deploy_bridge: bridge.deploymentTransaction()?.hash ?? null,
      set_remote_bridge: setRemoteTxHash,
    },
  };

  const outPath = process.env.DR_BRIDGE_FUJI_OUT || "cache/fuji-bridge-deployment-latest.json";
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log("[bridge-fuji] deployment report written:", outPath);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[bridge-fuji] deployment failed:", message);
  process.exit(1);
});
