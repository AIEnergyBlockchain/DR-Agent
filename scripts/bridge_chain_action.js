#!/usr/bin/env node
"use strict";

/**
 * Bridge action script for DRTBridge (home or remote).
 *
 * Env vars:
 *   BRIDGE_RPC_URL      — RPC endpoint for the chain (required)
 *   BRIDGE_DEPLOY_OUT   — Deployment report JSON containing contracts.bridge (default: cache/fuji-bridge-deployment-latest.json)
 *   PRIVATE_KEY         — Operator/relayer private key (required for tx actions)
 *   DR_TX_CONFIRM_MODE  — sync | hybrid (default: hybrid)
 */

const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

const DEFAULT_DEPLOY_OUT = "cache/fuji-bridge-deployment-latest.json";
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
    gas_used: receipt && receipt.gasUsed != null ? receipt.gasUsed.toString() : null,
    effective_gas_price:
      receipt && receipt.effectiveGasPrice != null
        ? receipt.effectiveGasPrice.toString()
        : null,
    fee_wei: feeWei.toString(),
    error: failed ? "transaction reverted" : null,
  };
}

function requirePrivateKey() {
  const privateKey = process.env.PRIVATE_KEY || "";
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required for bridge tx actions");
  }
  return privateKey;
}

function resolveDeployment() {
  const deployOut = process.env.BRIDGE_DEPLOY_OUT || DEFAULT_DEPLOY_OUT;
  const deployPath = path.resolve(process.cwd(), deployOut);
  if (!fs.existsSync(deployPath)) {
    throw new Error(`Bridge deployment report not found: ${deployOut}`);
  }
  const deployment = readJson(deployPath);
  const contracts = deployment.contracts || {};
  if (!contracts.bridge) {
    throw new Error("Bridge deployment report missing contracts.bridge");
  }
  return { deployOut, contracts };
}

async function main() {
  const action = process.argv[2] || "";
  if (!action) {
    throw new Error(
      "Missing action. Expected: send_tokens | receive_tokens | set_remote_bridge | check_tx"
    );
  }

  const confirmMode = normalizeConfirmMode(
    process.argv[3] || process.env.DR_TX_CONFIRM_MODE || "hybrid"
  );
  const payloadRaw = await readStdin();
  const payload = payloadRaw ? JSON.parse(payloadRaw) : {};

  const rpcUrl = process.env.BRIDGE_RPC_URL;
  if (!rpcUrl) {
    throw new Error("BRIDGE_RPC_URL is required for bridge chain action");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const chainName = `bridge:${network.chainId.toString()}`;

  if (action === "check_tx") {
    const txInfo = await checkTx(provider, String(payload.tx_hash || ""), chainName);
    process.stdout.write(
      `${JSON.stringify({ ok: true, action, confirm_mode: confirmMode, ...txInfo })}\n`
    );
    return;
  }

  const { contracts } = resolveDeployment();
  const privateKey = requirePrivateKey();
  const wallet = new ethers.Wallet(privateKey, provider);

  const bridgeAbi = loadAbi("artifacts/contracts/DRTBridge.sol/DRTBridge.json");
  const bridge = new ethers.Contract(contracts.bridge, bridgeAbi, wallet);

  if (action === "send_tokens") {
    const amount = payload.amount;
    if (!amount) {
      throw new Error("send_tokens requires amount");
    }
    const txInfo = await sendTx(bridge.sendTokens(amount), chainName, confirmMode);
    process.stdout.write(`${JSON.stringify({ ok: true, action, ...txInfo })}\n`);
    return;
  }

  if (action === "receive_tokens") {
    const sourceNonce = payload.source_nonce;
    const recipient = payload.recipient;
    const amount = payload.amount;
    const sourceChainId = payload.source_chain_id;
    if (sourceNonce == null || !recipient || !amount || !sourceChainId) {
      throw new Error("receive_tokens requires source_nonce, recipient, amount, source_chain_id");
    }
    const txInfo = await sendTx(
      bridge.receiveTokens(sourceNonce, recipient, amount, sourceChainId),
      chainName,
      confirmMode
    );
    process.stdout.write(`${JSON.stringify({ ok: true, action, ...txInfo })}\n`);
    return;
  }

  if (action === "set_remote_bridge") {
    const chainId = payload.chain_id;
    const bridgeAddr = payload.bridge_address;
    if (!chainId || !bridgeAddr) {
      throw new Error("set_remote_bridge requires chain_id and bridge_address");
    }
    const txInfo = await sendTx(
      bridge.setRemoteBridge(chainId, bridgeAddr),
      chainName,
      confirmMode
    );
    process.stdout.write(`${JSON.stringify({ ok: true, action, ...txInfo })}\n`);
    return;
  }

  throw new Error(`Unsupported action: ${action}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[bridge-action] failed:", message);
  process.exit(1);
});
