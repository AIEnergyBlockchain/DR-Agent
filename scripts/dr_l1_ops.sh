#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT_DIR/guide/stage5/evidence}"
mkdir -p "$EVIDENCE_DIR"
EVIDENCE_TS="$(date -u +%Y%m%dT%H%M%SZ)"
EVIDENCE_FILE="$EVIDENCE_DIR/dr-l1-evidence-$EVIDENCE_TS.log"

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

if [[ "${CONFIRM:-}" != "YES" ]]; then
  die "This script sends on-chain transactions. Set CONFIRM=YES to continue."
fi

DR_L1_SUBNET_NAME="${DR_L1_SUBNET_NAME:-dr-l1}"
DR_L1_DEPLOY_OUT="${DR_L1_DEPLOY_OUT:-cache/l1-deployment-latest.json}"
DR_L1_RPC_URL="${DR_L1_RPC_URL:-}"

log "evidence_file: $EVIDENCE_FILE"
log "timestamp_utc: $EVIDENCE_TS"
log "dr_l1_subnet_name: $DR_L1_SUBNET_NAME"
log "dr_l1_deploy_out: $DR_L1_DEPLOY_OUT"
log "dr_l1_rpc_url: ${DR_L1_RPC_URL:-<missing>}"

if has_step subnet; then
  if ! command -v avalanche >/dev/null 2>&1; then
    die "avalanche CLI not found in PATH. Install Avalanche CLI before running subnet step."
  fi
  log_cmd "subnet deploy" avalanche subnet deploy "$DR_L1_SUBNET_NAME"
fi

if has_step deploy; then
  require_env PRIVATE_KEY
  log_cmd "deploy: dr-l1 core contracts" ./node_modules/.bin/hardhat run scripts/deploy_l1.ts --network dr_l1
  copy_if_exists "$DR_L1_DEPLOY_OUT" "$EVIDENCE_DIR/dr-l1-deployment-$EVIDENCE_TS.json"
fi

if has_step smoke_create; then
  require_env DR_L1_RPC_URL
  require_env PRIVATE_KEY
  DR_L1_EVENT_ID="${DR_L1_EVENT_ID:-event-l1-$EVIDENCE_TS}"
  START_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  END_TIME="$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)"
  log "smoke_event_id: $DR_L1_EVENT_ID"
  log_cmd "smoke: create_event" node scripts/l1_chain_action.js create_event <<JSON
{"event_id":"$DR_L1_EVENT_ID","start_time":"$START_TIME","end_time":"$END_TIME","target_kw":100,"reward_rate":10,"penalty_rate":2}
JSON
fi

if has_step smoke_close; then
  require_env DR_L1_RPC_URL
  require_env PRIVATE_KEY
  DR_L1_EVENT_ID="${DR_L1_EVENT_ID:-event-l1-$EVIDENCE_TS}"
  log "smoke_event_id: $DR_L1_EVENT_ID"
  log_cmd "smoke: close_event" node scripts/l1_chain_action.js close_event <<JSON
{"event_id":"$DR_L1_EVENT_ID"}
JSON
fi
