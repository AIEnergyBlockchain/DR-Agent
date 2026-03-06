import fs from "node:fs";
import path from "node:path";

import { ethers, network } from "hardhat";

function getInitialSupplyUnits(): string {
  const raw = (process.env.DRT_INITIAL_SUPPLY ?? "1000000").trim();
  if (!raw) {
    throw new Error("DRT_INITIAL_SUPPLY must be a non-empty number string");
  }
  return raw;
}

async function main(): Promise<void> {
  if (network.name !== "fuji") {
    throw new Error(`This script is for fuji network only. Current: ${network.name}`);
  }

  if (!process.env.PRIVATE_KEY) {
    throw new Error(
      "PRIVATE_KEY is required for Fuji DRT deployment. Run `npm run deploy:fuji:drt` (or `make deploy-fuji-drt`) with secrets configured."
    );
  }

  const initialSupplyUnits = getInitialSupplyUnits();
  const initialSupplyWei = ethers.parseUnits(initialSupplyUnits, 18);
  if (initialSupplyWei <= 0n) {
    throw new Error("DRT_INITIAL_SUPPLY must be greater than 0");
  }

  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("[drt-fuji] deployer:", deployer.address);
  console.log("[drt-fuji] chainId:", chain.chainId.toString());
  console.log("[drt-fuji] balance (wei):", balance.toString());
  console.log("[drt-fuji] initial supply (units):", initialSupplyUnits);

  const drtFactory = await ethers.getContractFactory("DRToken");
  const drtToken = await drtFactory.deploy(deployer.address, initialSupplyWei);
  const deployTx = drtToken.deploymentTransaction();
  if (!deployTx) {
    throw new Error("Failed to capture deployment transaction for DRToken");
  }

  await drtToken.waitForDeployment();
  const deployReceipt = await deployTx.wait();
  if (!deployReceipt) {
    throw new Error("Failed to fetch deployment receipt for DRToken");
  }

  const receiptAny = deployReceipt as unknown as Record<string, bigint | number | string | undefined>;
  const gasUsed = deployReceipt.gasUsed ?? 0n;
  const effectiveGasPrice = (receiptAny.effectiveGasPrice as bigint | undefined) ??
    (receiptAny.gasPrice as bigint | undefined) ??
    0n;
  const deployFeeWei = gasUsed * effectiveGasPrice;

  const report = {
    deployed_at_utc: new Date().toISOString(),
    network: network.name,
    chain_id: Number(chain.chainId),
    deployer: deployer.address,
    contracts: {
      drt_token: await drtToken.getAddress(),
    },
    token: {
      name: await drtToken.name(),
      symbol: await drtToken.symbol(),
      decimals: Number(await drtToken.decimals()),
      initial_supply_units: initialSupplyUnits,
      initial_supply_wei: initialSupplyWei.toString(),
    },
    tx_hashes: {
      deploy_drt_token: deployReceipt.hash ?? deployTx.hash,
    },
    tx_receipts: {
      deploy_drt_token: {
        block_number: deployReceipt.blockNumber,
        gas_used: gasUsed.toString(),
        effective_gas_price_wei: effectiveGasPrice.toString(),
        tx_fee_wei: deployFeeWei.toString(),
      },
    },
  };

  const outPath = process.env.DR_DRT_DEPLOY_OUT || "cache/fuji-drt-deployment-latest.json";
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log("[drt-fuji] deployment report written:", outPath);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[drt-fuji] deployment failed:", message);
  process.exit(1);
});
