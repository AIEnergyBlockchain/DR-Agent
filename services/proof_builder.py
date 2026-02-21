"""Build canonical proof payloads and deterministic proof hashes."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any


def _utc_now_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def canonical_json(payload: dict[str, Any]) -> str:
    """Return canonical JSON used for proof hash generation."""
    return json.dumps(payload, separators=(",", ":"), sort_keys=True)


def keccak256_hex(raw: bytes) -> str:
    """Return keccak-style hash in hex format.

    Uses pysha3 keccak when available, otherwise falls back to sha3_256.
    """
    try:
        import sha3  # type: ignore

        hasher = sha3.keccak_256()
    except Exception:
        hasher = hashlib.sha3_256()

    hasher.update(raw)
    return "0x" + hasher.hexdigest()


def build_proof_payload(
    event_id: str,
    site_id: str,
    baseline_kwh: int,
    actual_kwh: int,
    baseline_method: str,
    raw_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    reduction = baseline_kwh - actual_kwh
    return {
        "event_id": event_id,
        "site_id": site_id,
        "baseline_kwh": baseline_kwh,
        "actual_kwh": actual_kwh,
        "reduction_kwh": max(reduction, 0),
        "baseline_method": baseline_method,
        "raw_payload": raw_payload or {},
        "created_at": _utc_now_iso(),
    }


def build_proof_artifacts(
    event_id: str,
    site_id: str,
    baseline_kwh: int,
    actual_kwh: int,
    baseline_method: str,
    raw_payload: dict[str, Any] | None = None,
) -> tuple[str, str, int]:
    payload = build_proof_payload(
        event_id=event_id,
        site_id=site_id,
        baseline_kwh=baseline_kwh,
        actual_kwh=actual_kwh,
        baseline_method=baseline_method,
        raw_payload=raw_payload,
    )
    payload_json = canonical_json(payload)
    proof_hash = keccak256_hex(payload_json.encode("utf-8"))
    return payload_json, proof_hash, payload["reduction_kwh"]


def recompute_hash(payload_json: str) -> str:
    return keccak256_hex(payload_json.encode("utf-8"))
