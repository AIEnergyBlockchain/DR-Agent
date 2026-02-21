#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:8000}"
OP_KEY="${DR_OPERATOR_API_KEY:-operator-key}"
PART_KEY="${DR_PARTICIPANT_API_KEY:-participant-key}"
AUD_KEY="${DR_AUDITOR_API_KEY:-auditor-key}"
CHAIN_MODE="${DR_CHAIN_MODE:-simulated}"
TX_CONFIRM_MODE="${DR_TX_CONFIRM_MODE:-hybrid}"
DEMO_SITE_MODE="${DR_DEMO_SITE_MODE:-dual}"

EVENT_ID="${1:-event-demo-$(date -u +%Y%m%d%H%M%S)}"
TX_OUT_DIR="${DR_TX_OUT_DIR:-cache}"
TX_SUMMARY_FILE="${TX_OUT_DIR}/demo-tx-${EVENT_ID}.json"
EVIDENCE_FILE="${TX_OUT_DIR}/demo-evidence-${EVENT_ID}.json"
RAW_DIR="${TX_OUT_DIR}/demo-raw-${EVENT_ID}"
TIMING_FILE="${RAW_DIR}/timings.tsv"

read START_TIME END_TIME < <(python3 - <<'PY'
from datetime import datetime, timezone, timedelta
start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=1)
end = start + timedelta(minutes=60)
print(start.isoformat().replace('+00:00','Z'), end.isoformat().replace('+00:00','Z'))
PY
)

LAST_RESPONSE=""
LAST_DURATION_MS="0"

request() {
  local method="$1"
  local path="$2"
  local key="$3"
  local actor="$4"
  local body="${5:-}"
  local step_name="${6:-}"

  echo ""
  echo "==> ${method} ${path}"

  local started_ms ended_ms
  started_ms="$(date +%s%3N)"
  if [[ -n "$body" ]]; then
    LAST_RESPONSE="$(curl --noproxy '*' -sS -X "$method" "${API_URL}${path}" \
      -H "Content-Type: application/json" \
      -H "x-api-key: ${key}" \
      -H "x-actor-id: ${actor}" \
      -d "$body")"
  else
    LAST_RESPONSE="$(curl --noproxy '*' -sS -X "$method" "${API_URL}${path}" \
      -H "Content-Type: application/json" \
      -H "x-api-key: ${key}" \
      -H "x-actor-id: ${actor}")"
  fi
  ended_ms="$(date +%s%3N)"
  LAST_DURATION_MS="$((ended_ms - started_ms))"

  if [[ -n "${step_name}" ]]; then
    printf '%s\t%s\n' "${step_name}" "${LAST_DURATION_MS}" >> "${TIMING_FILE}"
  fi

  echo "${LAST_RESPONSE}"
  echo ""
  echo "[demo] ${step_name:-request} duration_ms=${LAST_DURATION_MS}"
}

echo "[demo] API_URL=${API_URL}"
echo "[demo] EVENT_ID=${EVENT_ID}"
echo "[demo] CHAIN_MODE=${CHAIN_MODE}"
echo "[demo] TX_CONFIRM_MODE=${TX_CONFIRM_MODE}"
echo "[demo] DEMO_SITE_MODE=${DEMO_SITE_MODE}"
echo "[demo] start=${START_TIME} end=${END_TIME}"

if ! curl --noproxy '*' -sS "${API_URL}/docs" >/dev/null 2>&1; then
  echo "[demo] API is unreachable at ${API_URL}. Start FastAPI first."
  echo "[demo] Example: source .venv/bin/activate && uvicorn services.main:app --host 127.0.0.1 --port 8000 --reload"
  exit 1
fi

mkdir -p "${TX_OUT_DIR}" "${RAW_DIR}"
: > "${TIMING_FILE}"

CREATE_PAYLOAD="$(cat <<JSON
{"event_id":"${EVENT_ID}","start_time":"${START_TIME}","end_time":"${END_TIME}","target_kw":200,"reward_rate":10,"penalty_rate":5}
JSON
)"

PROOF_A_PAYLOAD="$(cat <<JSON
{"event_id":"${EVENT_ID}","site_id":"site-a","baseline_kwh":150,"actual_kwh":40,"uri":"ipfs://site-a-demo","raw_payload":{"meter":[10,20,30]},"baseline_method":"simple"}
JSON
)"

PROOF_B_PAYLOAD="$(cat <<JSON
{"event_id":"${EVENT_ID}","site_id":"site-b","baseline_kwh":150,"actual_kwh":120,"uri":"ipfs://site-b-demo","raw_payload":{"meter":[11,21,31]},"baseline_method":"simple"}
JSON
)"

SETTLE_PAYLOAD='{"site_ids":["site-a","site-b"]}'
if [[ "${DEMO_SITE_MODE}" == "single" ]]; then
  SETTLE_PAYLOAD='{"site_ids":["site-a"]}'
fi

request "POST" "/events" "$OP_KEY" "operator-1" "$CREATE_PAYLOAD" "create"
CREATE_RESP="${LAST_RESPONSE}"
request "POST" "/proofs" "$PART_KEY" "site-a" "$PROOF_A_PAYLOAD" "proof_site_a"
PROOF_A_RESP="${LAST_RESPONSE}"
PROOF_B_RESP='null'
if [[ "${DEMO_SITE_MODE}" == "dual" ]]; then
  request "POST" "/proofs" "$PART_KEY" "site-b" "$PROOF_B_PAYLOAD" "proof_site_b"
  PROOF_B_RESP="${LAST_RESPONSE}"
else
  echo "[demo] skipping site-b proof in single-site mode to minimize faucet AVAX burn"
fi
request "POST" "/events/${EVENT_ID}/close" "$OP_KEY" "operator-1" "" "close"
CLOSE_RESP="${LAST_RESPONSE}"
request "POST" "/settle/${EVENT_ID}" "$OP_KEY" "operator-1" "$SETTLE_PAYLOAD" "settle"
SETTLE_RESP="${LAST_RESPONSE}"
request "POST" "/claim/${EVENT_ID}/site-a" "$PART_KEY" "site-a" "" "claim_site_a"
CLAIM_RESP="${LAST_RESPONSE}"
request "GET" "/events/${EVENT_ID}" "$AUD_KEY" "auditor-1" "" "get_event"
EVENT_RESP="${LAST_RESPONSE}"
request "GET" "/events/${EVENT_ID}/records" "$AUD_KEY" "auditor-1" "" "get_records"
RECORDS_RESP="${LAST_RESPONSE}"
request "GET" "/audit/${EVENT_ID}/site-a" "$AUD_KEY" "auditor-1" "" "get_audit_site_a"
AUDIT_RESP="${LAST_RESPONSE}"

printf '%s\n' "${CREATE_RESP}" > "${RAW_DIR}/create.json"
printf '%s\n' "${PROOF_A_RESP}" > "${RAW_DIR}/proof_site_a.json"
printf '%s\n' "${PROOF_B_RESP}" > "${RAW_DIR}/proof_site_b.json"
printf '%s\n' "${CLOSE_RESP}" > "${RAW_DIR}/close.json"
printf '%s\n' "${SETTLE_RESP}" > "${RAW_DIR}/settle.json"
printf '%s\n' "${CLAIM_RESP}" > "${RAW_DIR}/claim_site_a.json"
printf '%s\n' "${EVENT_RESP}" > "${RAW_DIR}/event.json"
printf '%s\n' "${RECORDS_RESP}" > "${RAW_DIR}/records.json"
printf '%s\n' "${AUDIT_RESP}" > "${RAW_DIR}/audit_site_a.json"

python3 - "${RAW_DIR}" "${TIMING_FILE}" "${TX_SUMMARY_FILE}" "${EVIDENCE_FILE}" "${EVENT_ID}" "${CHAIN_MODE}" "${DEMO_SITE_MODE}" "${TX_CONFIRM_MODE}" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

raw_dir = Path(sys.argv[1])
timing_file = Path(sys.argv[2])
out_file = Path(sys.argv[3])
evidence_file = Path(sys.argv[4])
event_id = sys.argv[5]
chain_mode = sys.argv[6]
site_mode = sys.argv[7]
tx_confirm_mode = sys.argv[8]


def load(name: str):
    path = raw_dir / name
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def parse_fee(value):
    if value is None:
        return None
    try:
        return int(str(value))
    except ValueError:
        return None


def parse_timings(path: Path):
    durations = {}
    if not path.exists():
        return durations
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) != 2:
            continue
        step = parts[0].strip()
        try:
            durations[step] = int(parts[1].strip())
        except ValueError:
            continue
    return durations


create = load("create.json") or {}
proof_a = load("proof_site_a.json") or {}
proof_b = load("proof_site_b.json")
close = load("close.json") or {}
settle = load("settle.json") or []
claim = load("claim_site_a.json") or {}
settle_first = settle[0] if isinstance(settle, list) and settle else {}

step_tx = [
    ("create", create.get("tx_hash"), create.get("tx_fee_wei")),
    ("proof_site_a", proof_a.get("tx_hash"), proof_a.get("tx_fee_wei")),
    (
        "proof_site_b",
        (proof_b or {}).get("tx_hash") if isinstance(proof_b, dict) else None,
        (proof_b or {}).get("tx_fee_wei") if isinstance(proof_b, dict) else None,
    ),
    ("close", close.get("close_tx_hash") or close.get("tx_hash"), close.get("close_tx_fee_wei")),
    ("settle", settle_first.get("tx_hash"), settle_first.get("tx_fee_wei")),
    ("claim_site_a", claim.get("claim_tx_hash") or claim.get("tx_hash"), claim.get("claim_tx_fee_wei")),
]

tx_hashes = {step: tx_hash for step, tx_hash, _ in step_tx}

fee_breakdown = []
naive_fee_total = 0
for step, tx_hash, fee_raw in step_tx:
    fee_int = parse_fee(fee_raw)
    if fee_int is None:
        continue
    naive_fee_total += fee_int
    fee_breakdown.append({"step": step, "tx_hash": tx_hash, "tx_fee_wei": str(fee_int)})

unique_map = {}
for step, tx_hash, fee_raw in step_tx:
    if not tx_hash:
        continue
    fee_int = parse_fee(fee_raw)
    item = unique_map.setdefault(tx_hash, {"tx_hash": tx_hash, "steps": [], "fee_wei": None})
    item["steps"].append(step)
    if fee_int is not None and item["fee_wei"] is None:
        item["fee_wei"] = fee_int

unique_txs = sorted(unique_map.values(), key=lambda row: row["steps"][0])
unique_fee_total = sum(item["fee_wei"] for item in unique_txs if item["fee_wei"] is not None)
for item in unique_txs:
    if item["fee_wei"] is not None:
        item["fee_wei"] = str(item["fee_wei"])

step_durations_ms = parse_timings(timing_file)
total_duration_ms = sum(step_durations_ms.values())

summary = {
    "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "event_id": event_id,
    "chain_mode": chain_mode,
    "tx_confirm_mode": tx_confirm_mode,
    "demo_site_mode": site_mode,
    "tx_hashes": tx_hashes,
    "tx_count_non_empty": sum(1 for value in tx_hashes.values() if value),
    "fee_total_wei_naive": str(naive_fee_total),
    "fee_total_wei_unique": str(unique_fee_total),
    "fee_breakdown": fee_breakdown,
    "unique_write_txs": unique_txs,
    "step_durations_ms": step_durations_ms,
    "total_duration_ms": total_duration_ms,
}

if chain_mode.lower() in {"fuji", "fuji-live"}:
    summary["explorer_links"] = {
        key: (f"https://testnet.snowtrace.io/tx/{value}" if value else None)
        for key, value in tx_hashes.items()
    }
    summary["unique_explorer_links"] = [
        {
            "tx_hash": item["tx_hash"],
            "snowtrace": f"https://testnet.snowtrace.io/tx/{item['tx_hash']}",
            "steps": item["steps"],
            "fee_wei": item["fee_wei"],
        }
        for item in unique_txs
    ]

evidence = {
    "generated_at_utc": summary["generated_at_utc"],
    "event_id": event_id,
    "chain_mode": chain_mode,
    "tx_confirm_mode": tx_confirm_mode,
    "demo_site_mode": site_mode,
    "total_duration_ms": total_duration_ms,
    "step_durations_ms": step_durations_ms,
    "tx_hashes": tx_hashes,
    "unique_write_txs": summary["unique_write_txs"],
    "fee_total_wei_unique": summary["fee_total_wei_unique"],
    "snowtrace_links": summary.get("explorer_links", {}),
}

if chain_mode.lower() in {"fuji", "fuji-live"}:
    doc_date = datetime.now(timezone.utc).date().isoformat()
    doc_path = Path("guide/docs") / f"Fuji-Live-Demo-Evidence-{doc_date}.md"
    lines = [
        "# Fuji Live Demo Evidence",
        "",
        f"- Generated at (UTC): {summary['generated_at_utc']}",
        f"- Event ID: `{event_id}`",
        f"- Chain mode: `{chain_mode}`",
        f"- Tx confirm mode: `{tx_confirm_mode}`",
        f"- Demo site mode: `{site_mode}`",
        f"- Unique tx fee total (wei): `{summary['fee_total_wei_unique']}`",
        f"- Total API duration (ms): `{total_duration_ms}`",
        "",
        "## Unique Write Transactions",
        "",
        "| Step(s) | Tx Hash | Fee (wei) | Snowtrace |",
        "|---|---|---:|---|",
    ]
    for item in summary["unique_write_txs"]:
        tx_hash = item["tx_hash"]
        steps = ", ".join(item["steps"])
        fee = item["fee_wei"] or "-"
        link = f"https://testnet.snowtrace.io/tx/{tx_hash}"
        lines.append(f"| {steps} | `{tx_hash}` | {fee} | [open]({link}) |")
    lines.extend(
        [
            "",
            "## Step Durations",
            "",
            "| Step | Duration (ms) |",
            "|---|---:|",
        ]
    )
    for step, duration in step_durations_ms.items():
        lines.append(f"| {step} | {duration} |")
    doc_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    summary["live_evidence_doc"] = str(doc_path)
    evidence["live_evidence_doc"] = str(doc_path)

out_file.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
evidence_file.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
print(json.dumps(summary, indent=2))
PY

echo "[demo] walkthrough flow finished"
echo "[demo] tx summary: ${TX_SUMMARY_FILE}"
echo "[demo] demo evidence: ${EVIDENCE_FILE}"
echo "[demo] raw step responses: ${RAW_DIR}"
