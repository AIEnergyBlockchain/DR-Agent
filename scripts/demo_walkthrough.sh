#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:8000}"
OP_KEY="${DR_OPERATOR_API_KEY:-operator-key}"
PART_KEY="${DR_PARTICIPANT_API_KEY:-participant-key}"
AUD_KEY="${DR_AUDITOR_API_KEY:-auditor-key}"

EVENT_ID="${1:-event-demo-$(date -u +%Y%m%d%H%M%S)}"

read START_TIME END_TIME < <(python3 - <<'PY'
from datetime import datetime, timezone, timedelta
start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=1)
end = start + timedelta(minutes=60)
print(start.isoformat().replace('+00:00','Z'), end.isoformat().replace('+00:00','Z'))
PY
)

request() {
  local method="$1"
  local path="$2"
  local key="$3"
  local actor="$4"
  local body="${5:-}"

  echo ""
  echo "==> ${method} ${path}"

  if [[ -n "$body" ]]; then
    curl --noproxy '*' -sS -X "$method" "${API_URL}${path}" \
      -H "Content-Type: application/json" \
      -H "x-api-key: ${key}" \
      -H "x-actor-id: ${actor}" \
      -d "$body"
  else
    curl --noproxy '*' -sS -X "$method" "${API_URL}${path}" \
      -H "Content-Type: application/json" \
      -H "x-api-key: ${key}" \
      -H "x-actor-id: ${actor}"
  fi

  echo ""
}

echo "[demo] API_URL=${API_URL}"
echo "[demo] EVENT_ID=${EVENT_ID}"
echo "[demo] start=${START_TIME} end=${END_TIME}"

if ! curl --noproxy '*' -sS "${API_URL}/docs" >/dev/null 2>&1; then
  echo "[demo] API is unreachable at ${API_URL}. Start FastAPI first."
  echo "[demo] Example: source .venv/bin/activate && uvicorn services.main:app --host 127.0.0.1 --port 8000 --reload"
  exit 1
fi

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

request "POST" "/events" "$OP_KEY" "operator-1" "$CREATE_PAYLOAD"
request "POST" "/proofs" "$PART_KEY" "site-a" "$PROOF_A_PAYLOAD"
request "POST" "/proofs" "$PART_KEY" "site-b" "$PROOF_B_PAYLOAD"
request "POST" "/events/${EVENT_ID}/close" "$OP_KEY" "operator-1"
request "POST" "/settle/${EVENT_ID}" "$OP_KEY" "operator-1" "$SETTLE_PAYLOAD"
request "POST" "/claim/${EVENT_ID}/site-a" "$PART_KEY" "site-a"
request "GET" "/events/${EVENT_ID}" "$AUD_KEY" "auditor-1"
request "GET" "/events/${EVENT_ID}/records" "$AUD_KEY" "auditor-1"
request "GET" "/audit/${EVENT_ID}/site-a" "$AUD_KEY" "auditor-1"

echo "[demo] walkthrough flow finished"
