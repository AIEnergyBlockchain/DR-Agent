#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

const DEFAULT_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc";
const DEFAULT_DEPLOY_OUT = "cache/fuji-deployment-latest.json";
const VALID_CONFIRM_MODES = new Set(["sync", "hybrid"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data.trim());
    });
    process.stdin.on("error", reject);
  });
}

function loadAbi(relativeArtifactPath) {
  const absolutePath = path.resolve(process.cwd(), relativeArtifactPath);
  const artifact = readJson(absolutePath);
  if (!artifact.abi) {
    throw new Error(`ABI missing in artifact: ${relativeArtifactPath}`);
  }
  return artifact.abi;
}

function toBytes32Label(value) {
  return ethers.keccak256(ethers.toUtf8Bytes(String(value)));
}

function toUnixSeconds(value) {
  const ts = Date.parse(String(value));
  if (Number.isNaN(ts)) {
    throw new Error(`Invalid RFC3339 time: ${value}`);
  }
  return BigInt(Math.floor(ts / 1000));
}

function toBigInt(value, field) {
  if (value === null || value === undefined) {
    throw new Error(`Missing numeric field: ${field}`);
  }
  return BigInt(value);
}

function normalizeConfirmMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "hybrid";
  if (!VALID_CONFIRM_MODES.has(normalized)) {
    throw new Error(`Invalid confirm mode: ${value}. Expected sync|hybrid`);
  }
  return normalized;
}

function calculateFeeWei(receipt, tx) {
  const gasUsed =
    receipt && receipt.gasUsed != null ? BigInt(receipt.gasUsed.toString()) : 0n;
  const gasPrice =
    receipt && receipt.gasPrice != null
      ? BigInt(receipt.gasPrice.toString())
      : receipt && receipt.effectiveGasPrice != null
      ? BigInt(receipt.effectiveGasPrice.toString())
      : tx && tx.gasPrice != null
      ? BigInt(tx.gasPrice.toString())
      : 0n;
  if (receipt && receipt.fee != null) {
    return BigInt(receipt.fee.toString());
  }
  return gasUsed * gasPrice;
}

async function sendTx(txPromise, chainName, confirmMode) {
  const tx = await txPromise;
  const submittedAt = new Date().toISOString();

  if (confirmMode === "hybrid") {
    return {
      chain: chainName,
      tx_hash: tx.hash,
      tx_state: "submitted",
      submitted_at: submittedAt,
      confirmed_at: null,
      block_number: null,
      nonce: Number(tx.nonce),
      gas_used: null,
      effective_gas_price: null,
      fee_wei: null,
    };
  }

  const receipt = await tx.wait();
  const gasUsed =
    receipt && receipt.gasUsed != null ? BigInt(receipt.gasUsed.toString()) : 0n;
  const gasPrice =
    receipt && receipt.effectiveGasPrice != null
      ? BigInt(receipt.effectiveGasPrice.toString())
      : receipt && receipt.gasPrice != null
      ? BigInt(receipt.gasPrice.toString())
      : tx.gasPrice != null
      ? BigInt(tx.gasPrice.toString())
      : 0n;
  const feeWei = calculateFeeWei(receipt, tx);
  const failed = receipt && receipt.status != null && Number(receipt.status) === 0;

  return {
    chain: chainName,
    tx_hash: receipt && receipt.hash ? receipt.hash : tx.hash,
    tx_state: failed ? "failed" : "confirmed",
    submitted_at: submittedAt,
    confirmed_at: new Date().toISOString(),
    block_number:
      receipt && receipt.blockNumber != null ? Number(receipt.blockNumber) : null,
    nonce: Number(tx.nonce),
    gas_used: gasUsed.toString(),
    effective_gas_price: gasPrice.toString(),
    fee_wei: feeWei.toString(),
    error: failed ? "transaction reverted" : null,
  };
}

async function checkTx(provider, txHash, chainName) {
  if (!txHash || !ethers.isHexString(txHash)) {
    throw new Error("tx_hash is required for check_tx");
  }

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    return {
      chain: chainName,
      tx_hash: txHash,
      tx_state: "submitted",
      submitted_at: null,
      confirmed_at: null,
      block_number: null,
      gas_used: null,
      effective_gas_price: null,
      fee_wei: null,
      error: null,
    };
  }

  const gasUsed =
    receipt && receipt.gasUsed != null ? BigInt(receipt.gasUsed.toString()) : 0n;
  const gasPrice =
    receipt && receipt.effectiveGasPrice != null
      ? BigInt(receipt.effectiveGasPrice.toString())
      : receipt && receipt.gasPrice != null
      ? BigInt(receipt.gasPrice.toString())
      : 0n;
  const feeWei = calculateFeeWei(receipt, null);
  const failed = receipt.status != null && Number(receipt.status) === 0;

  return {
    chain: chainName,
    tx_hash: receipt.hash || txHash,
    tx_state: failed ? "failed" : "confirmed",
    submitted_at: null,
    confirmed_at: new Date().toISOString(),
    block_number:
      receipt && receipt.blockNumber != null ? Number(receipt.blockNumber) : null,
    gas_used: gasUsed.toString(),
    effective_gas_price: gasPrice.toString(),
    fee_wei: feeWei.toString(),
    error: failed ? "transaction reverted" : null,
  };
}

function requirePrivateKey() {
  const privateKey = process.env.PRIVATE_KEY || "";
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required for fuji live chain mode");
  }
  return privateKey;
}

function resolveDeployment() {
  const deployOut = process.env.DR_DEPLOY_OUT || DEFAULT_DEPLOY_OUT;
  const deployPath = path.resolve(process.cwd(), deployOut);
  if (!fs.existsSync(deployPath)) {
    throw new Error(`Deployment report not found: ${deployOut}`);
  }
  const deployment = readJson(deployPath);
  const contracts = deployment.contracts || {};
  if (!contracts.event_manager || !contracts.proof_registry || !contracts.settlement) {
    throw new Error(
      "Deployment report missing contracts.event_manager/proof_registry/settlement"
    );
  }
  return {
    deployOut,
    contracts,
  };
}

async function main() {
  const action = process.argv[2] || "";
  if (!action) {
    throw new Error(
      "Missing action. Expected one of: create_event | close_event | submit_proof | settle_event | claim_reward | check_tx"
    );
  }

  const confirmMode = normalizeConfirmMode(
    process.argv[3] || process.env.DR_TX_CONFIRM_MODE || "hybrid"
  );
  const payloadRaw = await readStdin();
  const payload = payloadRaw ? JSON.parse(payloadRaw) : {};
  const rpcUrl = process.env.DR_FUJI_RPC_URL || DEFAULT_RPC_URL;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const chainName = `fuji:${network.chainId.toString()}`;

  if (action === "check_tx") {
    const txInfo = await checkTx(provider, String(payload.tx_hash || ""), chainName);
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        action,
        confirm_mode: confirmMode,
        ...txInfo,
      })}\n`
    );
    return;
  }

  const privateKey = requirePrivateKey();
  const { deployOut, contracts } = resolveDeployment();
  const wallet = new ethers.Wallet(privateKey, provider);
  const eventManager = new ethers.Contract(
    contracts.event_manager,
    loadAbi("artifacts/contracts/EventManager.sol/EventManager.json"),
    wallet
  );
  const proofRegistry = new ethers.Contract(
    contracts.proof_registry,
    loadAbi("artifacts/contracts/ProofRegistry.sol/ProofRegistry.json"),
    wallet
  );
  const settlement = new ethers.Contract(
    contracts.settlement,
    loadAbi("artifacts/contracts/Settlement.sol/Settlement.json"),
    wallet
  );

  let txInfo;
  if (action === "create_event") {
    txInfo = await sendTx(
      eventManager.createEvent(
        toBytes32Label(payload.event_id),
        toUnixSeconds(payload.start_time),
        toUnixSeconds(payload.end_time),
        toBigInt(payload.target_kw, "target_kw"),
        toBigInt(payload.reward_rate, "reward_rate"),
        toBigInt(payload.penalty_rate, "penalty_rate")
      ),
      chainName,
      confirmMode
    );
  } else if (action === "close_event") {
    txInfo = await sendTx(
      eventManager.closeEvent(toBytes32Label(payload.event_id)),
      chainName,
      confirmMode
    );
  } else if (action === "submit_proof") {
    const proofHash = String(payload.proof_hash || "");
    if (!ethers.isHexString(proofHash, 32)) {
      throw new Error("proof_hash must be 32-byte hex string");
    }
    txInfo = await sendTx(
      proofRegistry.submitProof(
        toBytes32Label(payload.event_id),
        toBytes32Label(payload.site_id),
        toBigInt(payload.baseline_kwh, "baseline_kwh"),
        toBigInt(payload.actual_kwh, "actual_kwh"),
        proofHash,
        String(payload.uri || "")
      ),
      chainName,
      confirmMode
    );
  } else if (action === "settle_event") {
    const siteIds = Array.isArray(payload.site_ids) ? payload.site_ids : [];
    if (!siteIds.length) {
      throw new Error("site_ids is required for settle_event");
    }
    txInfo = await sendTx(
      settlement.settleEvent(
        toBytes32Label(payload.event_id),
        siteIds.map((siteId) => toBytes32Label(siteId))
      ),
      chainName,
      confirmMode
    );
  } else if (action === "claim_reward") {
    txInfo = await sendTx(
      settlement.claimReward(
        toBytes32Label(payload.event_id),
        toBytes32Label(payload.site_id)
      ),
      chainName,
      confirmMode
    );
  } else {
    throw new Error(`Unsupported action: ${action}`);
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      action,
      confirm_mode: confirmMode,
      deploy_out: deployOut,
      from: wallet.address,
      ...txInfo,
    })}\n`
  );
}

main().catch((err) => {
  const output = {
    ok: false,
    error: err && err.message ? err.message : String(err),
  };
  process.stderr.write(`${JSON.stringify(output)}\n`);
  process.exit(1);
});
