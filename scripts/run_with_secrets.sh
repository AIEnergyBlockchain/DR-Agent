#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_SECRETS_FILE="${HOME}/.config/dr-agent/secrets.env"
SECRETS_FILE="${DR_SECRETS_FILE:-${DEFAULT_SECRETS_FILE}}"

usage() {
  cat <<'USAGE'
Usage:
  DR_SECRETS_FILE=/absolute/path/to/secrets.env bash scripts/run_with_secrets.sh <command> [args...]

Defaults:
  DR_SECRETS_FILE is optional and defaults to ~/.config/dr-agent/secrets.env
USAGE
}

if [[ $# -lt 1 ]]; then
  usage
  exit 2
fi

if [[ ! -f "${SECRETS_FILE}" ]]; then
  echo "[secrets] file not found: ${SECRETS_FILE}" >&2
  echo "[secrets] initialize with: make secrets-init" >&2
  exit 1
fi

if [[ "${SECRETS_FILE}" == "${PROJECT_ROOT}"/* ]]; then
  echo "[secrets] refusing workspace-local secrets file: ${SECRETS_FILE}" >&2
  echo "[secrets] move it outside workspace (example: ~/.config/dr-agent/secrets.env)." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${SECRETS_FILE}"
set +a

exec "$@"
