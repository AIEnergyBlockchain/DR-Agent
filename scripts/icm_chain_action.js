#!/usr/bin/env node
"use strict";

/**
 * ICM action script for ICMRelayer.
 *
 * Env vars:
 *   ICM_RPC_URL       — RPC endpoint for the chain (required)
 *   ICM_DEPLOY_OUT    — Deployment report JSON containing contracts.icm_relayer (default: cache/l1-bridge-deployment-latest.json)
 *   PRIVATE_KEY       — Operator/relayer private key (required for tx actions)
 *   DR_TX_CONFIRM_MODE — sync | hybrid (default: hybrid)
 */

const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

const DEFAULT_DEPLOY_OUT = "cache/l1-bridge-deployment-latest.json";
const VALID_CONFIRM_MODES = new Set(["sync", "hybrid"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => { resolve(data.trim()); });
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
    gas_used: receipt && receipt.gasUsed != null ? receipt.gasUsed.toString() : null,
    effective_gas_price:
      receipt && receipt.effectiveGasPrice != null
        ? receipt.effectiveGasPrice.toString()
        : null,
    fee_wei: feeWei.toString(),
    error: failed ? "transaction reverted" : null,
  };
}

function resolveBytes32(value) {
  const raw = String(value || "").trim();
  if (raw.startsWith("0x") && raw.length === 66) {
    return raw;
  }
  return ethers.keccak256(ethers.toUtf8Bytes(raw));
}

function normalizeMessageType(messageType) {
  if (messageType === 0 || messageType === 1 || messageType === 2) {
    return messageType;
  }
  const normalized = String(messageType || "").trim().toLowerCase();
  if (normalized === "bridge_transfer") return 0;
  if (normalized === "settlement_sync") return 1;
  if (normalized === "proof_attestation") return 2;
  throw new Error(`Invalid message_type: ${messageType}`);
}

function toPayloadBytes(payload) {
  if (payload == null) {
    return ethers.toUtf8Bytes("");
  }
  if (typeof payload === "string") {
    if (payload.startsWith("0x")) {
      return payload;
    }
    return ethers.toUtf8Bytes(payload);
  }
  return ethers.toUtf8Bytes(JSON.stringify(payload));
}

function resolveDeployment() {
  const deployOut = process.env.ICM_DEPLOY_OUT || DEFAULT_DEPLOY_OUT;
  const deployPath = path.resolve(process.cwd(), deployOut);
  if (!fs.existsSync(deployPath)) {
    throw new Error(`ICM deployment report not found: ${deployOut}`);
  }
  const deployment = readJson(deployPath);
  const contracts = deployment.contracts || {};
  if (!contracts.icm_relayer) {
    throw new Error("ICM deployment report missing contracts.icm_relayer");
  }
  return { deployOut, contracts };
}

async function main() {
  const action = process.argv[2] || "";
  if (!action) {
    throw new Error("Missing action. Expected: receive_message | mark_processed");
  }

  const confirmMode = normalizeConfirmMode(
    process.argv[3] || process.env.DR_TX_CONFIRM_MODE || "hybrid"
  );
  const payloadRaw = await readStdin();
  const payload = payloadRaw ? JSON.parse(payloadRaw) : {};

  const rpcUrl = process.env.ICM_RPC_URL;
  if (!rpcUrl) {
    throw new Error("ICM_RPC_URL is required for icm chain action");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const chainName = `icm:${network.chainId.toString()}`;

  const { contracts } = resolveDeployment();
  const privateKey = process.env.PRIVATE_KEY || "";
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required for icm chain action");
  }
  const wallet = new ethers.Wallet(privateKey, provider);

  const relayerAbi = loadAbi("artifacts/contracts/ICMRelayer.sol/ICMRelayer.json");
  const relayer = new ethers.Contract(contracts.icm_relayer, relayerAbi, wallet);

  if (action === "receive_message") {
    const sourceChainId = resolveBytes32(payload.source_chain_id);
    const messageId = resolveBytes32(payload.message_id);
    const messageType = normalizeMessageType(payload.message_type);
    const sender = payload.sender;
    if (!sender) {
      throw new Error("receive_message requires sender");
    }
    const rawPayload = toPayloadBytes(payload.payload);
    const txInfo = await sendTx(
      relayer.receiveMessage(sourceChainId, messageId, messageType, sender, rawPayload),
      chainName,
      confirmMode
    );
    process.stdout.write(`${JSON.stringify({ ok: true, action, ...txInfo })}\n`);
    return;
  }

  if (action === "mark_processed") {
    const messageId = resolveBytes32(payload.message_id);
    const success = payload.success !== false;
    const txInfo = await sendTx(relayer.markProcessed(messageId, success), chainName, confirmMode);
    process.stdout.write(`${JSON.stringify({ ok: true, action, ...txInfo })}\n`);
    return;
  }

  throw new Error(`Unsupported action: ${action}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[icm-action] failed:", message);
  process.exit(1);
});
