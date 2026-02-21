from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.api import create_app


def _headers(api_key: str, actor_id: str) -> dict[str, str]:
    return {"x-api-key": api_key, "x-actor-id": actor_id}


def test_closed_loop_create_submit_settle_claim_audit(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "dr_agent_test.db"))
    client = TestClient(app)

    operator = _headers("operator-key", "operator-1")
    participant_a = _headers("participant-key", "site-a")
    participant_b = _headers("participant-key", "site-b")
    auditor = _headers("auditor-key", "auditor-1")

    event_payload = {
        "event_id": "event-2026-closed-loop",
        "start_time": "2026-02-17T10:00:00Z",
        "end_time": "2026-02-17T11:00:00Z",
        "target_kw": 200,
        "reward_rate": 10,
        "penalty_rate": 5,
    }
    created = client.post("/events", json=event_payload, headers=operator)
    assert created.status_code == 200
    assert created.json()["status"] == "active"
    assert created.json()["tx_hash"].startswith("0x")

    proof_a = {
        "event_id": event_payload["event_id"],
        "site_id": "site-a",
        "baseline_kwh": 150,
        "actual_kwh": 40,
        "uri": "ipfs://site-a-raw",
        "raw_payload": {"meter": [10, 20, 30]},
        "baseline_method": "simple",
    }
    proof_b = {
        "event_id": event_payload["event_id"],
        "site_id": "site-b",
        "baseline_kwh": 150,
        "actual_kwh": 120,
        "uri": "ipfs://site-b-raw",
        "raw_payload": {"meter": [11, 21, 31]},
        "baseline_method": "prophet",
    }

    resp_a = client.post("/proofs", json=proof_a, headers=participant_a)
    resp_b = client.post("/proofs", json=proof_b, headers=participant_b)
    assert resp_a.status_code == 200
    assert resp_b.status_code == 200
    assert resp_a.json()["tx_hash"].startswith("0x")
    assert resp_b.json()["tx_hash"].startswith("0x")

    closed = client.post(f"/events/{event_payload['event_id']}/close", headers=operator)
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"
    assert closed.json()["close_tx_hash"].startswith("0x")

    settled = client.post(
        f"/settle/{event_payload['event_id']}",
        json={"site_ids": ["site-a", "site-b"]},
        headers=operator,
    )
    assert settled.status_code == 200
    assert len(settled.json()) == 2
    assert settled.json()[0]["tx_hash"].startswith("0x")

    claim = client.post(
        f"/claim/{event_payload['event_id']}/site-a",
        headers=participant_a,
    )
    assert claim.status_code == 200
    assert claim.json()["status"] == "claimed"
    assert claim.json()["claim_tx_hash"].startswith("0x")

    records = client.get(
        f"/events/{event_payload['event_id']}/records", headers=auditor
    )
    assert records.status_code == 200
    assert len(records.json()) == 2

    audit = client.get(f"/audit/{event_payload['event_id']}/site-a", headers=auditor)
    assert audit.status_code == 200
    assert audit.json()["match"] is True


def test_duplicate_proof_is_blocked(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "dr_agent_test.db"))
    client = TestClient(app)

    operator = _headers("operator-key", "operator-1")
    participant = _headers("participant-key", "site-a")

    client.post(
        "/events",
        json={
            "event_id": "event-dup-proof",
            "start_time": "2026-02-17T10:00:00Z",
            "end_time": "2026-02-17T11:00:00Z",
            "target_kw": 100,
            "reward_rate": 10,
            "penalty_rate": 5,
        },
        headers=operator,
    )

    payload = {
        "event_id": "event-dup-proof",
        "site_id": "site-a",
        "baseline_kwh": 100,
        "actual_kwh": 80,
        "uri": "ipfs://dup-proof",
        "baseline_method": "simple",
    }

    first = client.post("/proofs", json=payload, headers=participant)
    second = client.post("/proofs", json=payload, headers=participant)
    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["code"] == "PROOF_EXISTS"


def test_forbidden_settlement_for_non_operator(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "dr_agent_test.db"))
    client = TestClient(app)

    operator = _headers("operator-key", "operator-1")
    participant = _headers("participant-key", "site-a")

    client.post(
        "/events",
        json={
            "event_id": "event-forbidden-settle",
            "start_time": "2026-02-17T10:00:00Z",
            "end_time": "2026-02-17T11:00:00Z",
            "target_kw": 100,
            "reward_rate": 10,
            "penalty_rate": 5,
        },
        headers=operator,
    )

    client.post(
        "/proofs",
        json={
            "event_id": "event-forbidden-settle",
            "site_id": "site-a",
            "baseline_kwh": 100,
            "actual_kwh": 70,
            "uri": "ipfs://site-a",
            "baseline_method": "simple",
        },
        headers=participant,
    )

    client.post("/events/event-forbidden-settle/close", headers=operator)

    settled = client.post(
        "/settle/event-forbidden-settle",
        json={"site_ids": ["site-a"]},
        headers=participant,
    )

    assert settled.status_code == 403
    assert settled.json()["code"] == "FORBIDDEN"


def test_settle_requires_closed_event(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "dr_agent_test.db"))
    client = TestClient(app)

    operator = _headers("operator-key", "operator-1")
    participant = _headers("participant-key", "site-a")

    client.post(
        "/events",
        json={
            "event_id": "event-must-close-first",
            "start_time": "2026-02-17T10:00:00Z",
            "end_time": "2026-02-17T11:00:00Z",
            "target_kw": 100,
            "reward_rate": 10,
            "penalty_rate": 5,
        },
        headers=operator,
    )

    client.post(
        "/proofs",
        json={
            "event_id": "event-must-close-first",
            "site_id": "site-a",
            "baseline_kwh": 100,
            "actual_kwh": 70,
            "uri": "ipfs://site-a",
            "baseline_method": "simple",
        },
        headers=participant,
    )

    settled = client.post(
        "/settle/event-must-close-first",
        json={"site_ids": ["site-a"]},
        headers=operator,
    )
    assert settled.status_code == 409
    assert settled.json()["code"] == "EVENT_NOT_CLOSED"


def test_chain_mode_endpoint_includes_required_sites(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "dr_agent_chain_mode.db"))
    client = TestClient(app)
    auditor = _headers("auditor-key", "auditor-1")

    response = client.get("/system/chain-mode", headers=auditor)
    assert response.status_code == 200
    payload = response.json()
    assert "mode" in payload
    assert payload.get("tx_confirm_mode") in {"hybrid", "sync"}
    assert isinstance(payload.get("required_sites"), list)


def test_default_demo_site_and_confirm_mode(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("DR_DEMO_SITE_MODE", raising=False)
    monkeypatch.delenv("DR_TX_CONFIRM_MODE", raising=False)
    monkeypatch.setenv("DR_CHAIN_MODE", "simulated")

    app = create_app(db_path=str(tmp_path / "dr_agent_default_modes.db"))
    client = TestClient(app)
    auditor = _headers("auditor-key", "auditor-1")

    mode_resp = client.get("/system/chain-mode", headers=auditor)
    assert mode_resp.status_code == 200
    mode_payload = mode_resp.json()
    assert mode_payload["demo_site_mode"] == "dual"
    assert mode_payload["tx_confirm_mode"] == "hybrid"

    health_resp = client.get("/healthz")
    assert health_resp.status_code == 200
    health_payload = health_resp.json()
    assert health_payload["demo_site_mode"] == "dual"
    assert health_payload["tx_confirm_mode"] == "hybrid"


if __name__ == "__main__":
    import pytest

    raise SystemExit(pytest.main([__file__]))
