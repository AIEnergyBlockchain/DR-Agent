#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT_DIR/guide/stage5/evidence}"
mkdir -p "$EVIDENCE_DIR"
EVIDENCE_TS="$(date -u +%Y%m%dT%H%M%SZ)"
EVIDENCE_FILE="$EVIDENCE_DIR/bridge-icm-evidence-$EVIDENCE_TS.log"

die() {
  echo "error: $*" >&2
  exit 1
}

log() {
  echo "$*" | tee -a "$EVIDENCE_FILE"
}

log_cmd() {
  local label="$1"
  shift
  log ""
  log "### ${label}"
  "$@" 2>&1 | tee -a "$EVIDENCE_FILE"
}

copy_if_exists() {
  local src="$1"
  local dest="$2"
  if [[ -f "$src" ]]; then
    cp "$src" "$dest"
    log "copied: $src -> $dest"
  else
    log "missing: $src"
  fi
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    die "Missing required env: ${name}"
  fi
}

has_step() {
  local target="$1"
  if [[ "${STEPS:-all}" == "all" ]]; then
    return 0
  fi
  local step
  for step in ${STEPS//,/ }; do
    if [[ "$step" == "$target" ]]; then
      return 0
    fi
  done
  return 1
}

resolve_bytes32() {
  node -e "const { ethers } = require('ethers'); console.log(ethers.keccak256(ethers.toUtf8Bytes(process.argv[1])));" "$1"
}

get_json_field() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || die "Missing deployment file: $file"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf-8')); const parts=process.argv[2].split('.'); let cur=data; for (const part of parts){ cur=cur && cur[part]; } if (!cur){ process.exit(2); } console.log(cur);" "$file" "$key"
}

ensure_chain_ids() {
  if [[ -z "${FUJI_CHAIN_ID_BYTES32:-}" ]]; then
    require_env FUJI_CHAIN_LABEL
    FUJI_CHAIN_ID_BYTES32="$(resolve_bytes32 "$FUJI_CHAIN_LABEL")"
  fi
  if [[ -z "${DR_L1_CHAIN_ID_BYTES32:-}" ]]; then
    require_env DR_L1_CHAIN_LABEL
    DR_L1_CHAIN_ID_BYTES32="$(resolve_bytes32 "$DR_L1_CHAIN_LABEL")"
  fi
}

ensure_icm_source_chain_id() {
  if [[ -z "${ICM_SOURCE_CHAIN_ID_BYTES32:-}" ]]; then
    require_env ICM_SOURCE_CHAIN_LABEL
    ICM_SOURCE_CHAIN_ID_BYTES32="$(resolve_bytes32 "$ICM_SOURCE_CHAIN_LABEL")"
  fi
}

if [[ "${CONFIRM:-}" != "YES" ]]; then
  die "This script sends on-chain transactions. Set CONFIRM=YES to continue."
fi

DEFAULT_FUJI_RPC_URL="https://api.avax-test.network/ext/bc/C/rpc"

FUJI_RPC_URL="${FUJI_RPC_URL:-${DR_FUJI_RPC_URL:-$DEFAULT_FUJI_RPC_URL}}"
DR_L1_RPC_URL="${DR_L1_RPC_URL:-}"

if [[ -z "$DR_L1_RPC_URL" ]]; then
  die "Missing required env: DR_L1_RPC_URL"
fi

require_env PRIVATE_KEY

FUJI_DEPLOY_OUT="${DR_BRIDGE_FUJI_OUT:-cache/fuji-bridge-deployment-latest.json}"
L1_DEPLOY_OUT="${DR_BRIDGE_L1_OUT:-cache/l1-bridge-deployment-latest.json}"

log "evidence_file: $EVIDENCE_FILE"
log "timestamp_utc: $EVIDENCE_TS"
log "fuji_rpc_url: $FUJI_RPC_URL"
log "dr_l1_rpc_url: $DR_L1_RPC_URL"
log "fuji_deploy_out: $FUJI_DEPLOY_OUT"
log "dr_l1_deploy_out: $L1_DEPLOY_OUT"

if has_step deploy; then
  log_cmd "deploy: bridge fuji" npm run deploy:bridge:fuji
  copy_if_exists "$FUJI_DEPLOY_OUT" "$EVIDENCE_DIR/fuji-bridge-deployment-$EVIDENCE_TS.json"
  log_cmd "deploy: bridge l1" npm run deploy:bridge:l1
  copy_if_exists "$L1_DEPLOY_OUT" "$EVIDENCE_DIR/l1-bridge-deployment-$EVIDENCE_TS.json"
fi

if has_step bind; then
  ensure_chain_ids
  FUJI_BRIDGE_ADDRESS="$(get_json_field "$FUJI_DEPLOY_OUT" "contracts.bridge")"
  L1_BRIDGE_ADDRESS="$(get_json_field "$L1_DEPLOY_OUT" "contracts.bridge")"
  log "fuji_bridge_address: $FUJI_BRIDGE_ADDRESS"
  log "dr_l1_bridge_address: $L1_BRIDGE_ADDRESS"

  log "bind: fuji -> dr_l1"
  (
    BRIDGE_RPC_URL="$FUJI_RPC_URL" BRIDGE_DEPLOY_OUT="$FUJI_DEPLOY_OUT" \
      node scripts/bridge_chain_action.js set_remote_bridge <<JSON
{"chain_id":"$DR_L1_CHAIN_ID_BYTES32","bridge_address":"$L1_BRIDGE_ADDRESS"}
JSON
  ) 2>&1 | tee -a "$EVIDENCE_FILE"

  log "bind: dr_l1 -> fuji"
  (
    BRIDGE_RPC_URL="$DR_L1_RPC_URL" BRIDGE_DEPLOY_OUT="$L1_DEPLOY_OUT" \
      node scripts/bridge_chain_action.js set_remote_bridge <<JSON
{"chain_id":"$FUJI_CHAIN_ID_BYTES32","bridge_address":"$FUJI_BRIDGE_ADDRESS"}
JSON
  ) 2>&1 | tee -a "$EVIDENCE_FILE"
fi

if has_step bridge_send; then
  BRIDGE_SEND_AMOUNT_WEI="${BRIDGE_SEND_AMOUNT_WEI:-1000000000000000000}"
  log "bridge_send: amount_wei=$BRIDGE_SEND_AMOUNT_WEI"
  (
    BRIDGE_RPC_URL="$FUJI_RPC_URL" BRIDGE_DEPLOY_OUT="$FUJI_DEPLOY_OUT" \
      node scripts/bridge_chain_action.js send_tokens <<JSON
{"amount":"$BRIDGE_SEND_AMOUNT_WEI"}
JSON
  ) 2>&1 | tee -a "$EVIDENCE_FILE"
fi

if has_step bridge_receive; then
  require_env BRIDGE_RECIPIENT
  require_env BRIDGE_SOURCE_NONCE
  ensure_chain_ids
  BRIDGE_RECEIVE_AMOUNT_WEI="${BRIDGE_RECEIVE_AMOUNT_WEI:-1000000000000000000}"
  log "bridge_receive: nonce=$BRIDGE_SOURCE_NONCE recipient=$BRIDGE_RECIPIENT amount_wei=$BRIDGE_RECEIVE_AMOUNT_WEI"
  (
    BRIDGE_RPC_URL="$DR_L1_RPC_URL" BRIDGE_DEPLOY_OUT="$L1_DEPLOY_OUT" \
      node scripts/bridge_chain_action.js receive_tokens <<JSON
{"source_nonce":$BRIDGE_SOURCE_NONCE,"recipient":"$BRIDGE_RECIPIENT","amount":"$BRIDGE_RECEIVE_AMOUNT_WEI","source_chain_id":"$FUJI_CHAIN_ID_BYTES32"}
JSON
  ) 2>&1 | tee -a "$EVIDENCE_FILE"
fi

if has_step icm_receive; then
  require_env ICM_MESSAGE_ID
  require_env ICM_MESSAGE_TYPE
  require_env ICM_SENDER
  ensure_icm_source_chain_id
  ICM_RPC_URL="${ICM_RPC_URL:-$DR_L1_RPC_URL}"
  ICM_DEPLOY_OUT="${ICM_DEPLOY_OUT:-$L1_DEPLOY_OUT}"
  ICM_PAYLOAD_JSON="${ICM_PAYLOAD_JSON:-{\"amount\":\"1000\"}}"
  log "icm_receive: message_id=$ICM_MESSAGE_ID type=$ICM_MESSAGE_TYPE sender=$ICM_SENDER"
  (
    ICM_RPC_URL="$ICM_RPC_URL" ICM_DEPLOY_OUT="$ICM_DEPLOY_OUT" \
      node scripts/icm_chain_action.js receive_message <<JSON
{"source_chain_id":"$ICM_SOURCE_CHAIN_ID_BYTES32","message_id":"$ICM_MESSAGE_ID","message_type":"$ICM_MESSAGE_TYPE","sender":"$ICM_SENDER","payload":$ICM_PAYLOAD_JSON}
JSON
  ) 2>&1 | tee -a "$EVIDENCE_FILE"
fi

if has_step icm_mark; then
  require_env ICM_MESSAGE_ID
  ICM_RPC_URL="${ICM_RPC_URL:-$DR_L1_RPC_URL}"
  ICM_DEPLOY_OUT="${ICM_DEPLOY_OUT:-$L1_DEPLOY_OUT}"
  ICM_SUCCESS="${ICM_SUCCESS:-true}"
  log "icm_mark: message_id=$ICM_MESSAGE_ID success=$ICM_SUCCESS"
  (
    ICM_RPC_URL="$ICM_RPC_URL" ICM_DEPLOY_OUT="$ICM_DEPLOY_OUT" \
      node scripts/icm_chain_action.js mark_processed <<JSON
{"message_id":"$ICM_MESSAGE_ID","success":$ICM_SUCCESS}
JSON
  ) 2>&1 | tee -a "$EVIDENCE_FILE"
fi
