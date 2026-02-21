import fs from "node:fs";
import path from "node:path";

import { ethers, network } from "hardhat";

async function main(): Promise<void> {
  if (network.name !== "fuji") {
    throw new Error(`This script is for fuji network only. Current: ${network.name}`);
  }

  if (!process.env.PRIVATE_KEY) {
    throw new Error(
      "PRIVATE_KEY is required for fuji deployment. Set it in ~/.config/dr-agent/secrets.env and run `npm run deploy:fuji` (or `make deploy-fuji`)."
    );
  }

  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("[fuji] deployer:", deployer.address);
  console.log("[fuji] chainId:", chain.chainId.toString());
  console.log("[fuji] balance (wei):", balance.toString());

  const eventFactory = await ethers.getContractFactory("EventManager");
  const eventManager = await eventFactory.deploy(deployer.address);
  await eventManager.waitForDeployment();

  const proofFactory = await ethers.getContractFactory("ProofRegistry");
  const proofRegistry = await proofFactory.deploy(await eventManager.getAddress());
  await proofRegistry.waitForDeployment();

  const settlementFactory = await ethers.getContractFactory("Settlement");
  const settlement = await settlementFactory.deploy(
    await eventManager.getAddress(),
    await proofRegistry.getAddress(),
    deployer.address
  );
  await settlement.waitForDeployment();

  const setTx = await eventManager.setSettlementContract(await settlement.getAddress());
  const setReceipt = await setTx.wait();

  const report = {
    deployed_at_utc: new Date().toISOString(),
    network: network.name,
    chain_id: Number(chain.chainId),
    deployer: deployer.address,
    contracts: {
      event_manager: await eventManager.getAddress(),
      proof_registry: await proofRegistry.getAddress(),
      settlement: await settlement.getAddress(),
    },
    tx_hashes: {
      set_settlement_contract: setReceipt?.hash ?? setTx.hash,
    },
  };

  const outPath = process.env.DR_DEPLOY_OUT || "cache/fuji-deployment-latest.json";
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log("[fuji] deployment report written:", outPath);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("[fuji] deployment failed:", err.message);
  process.exit(1);
});
