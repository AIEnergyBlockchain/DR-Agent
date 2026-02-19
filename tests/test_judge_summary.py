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


def _create_event(client: TestClient, event_id: str):
    operator = _headers("operator-key", "operator-1")
    response = client.post(
        "/events",
        json={
            "event_id": event_id,
            "start_time": "2026-02-17T10:00:00Z",
            "end_time": "2026-02-17T11:00:00Z",
            "target_kw": 200,
            "reward_rate": 10,
            "penalty_rate": 5,
        },
        headers=operator,
    )
    assert response.status_code == 200


def test_judge_summary_lifecycle(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "dr_agent_summary.db"))
    client = TestClient(app)

    event_id = "event-summary-lifecycle"
    operator = _headers("operator-key", "operator-1")
    participant_a = _headers("participant-key", "site-a")
    participant_b = _headers("participant-key", "site-b")
    auditor = _headers("auditor-key", "auditor-1")

    _create_event(client, event_id)

    summary = client.get(f"/judge/{event_id}/summary", headers=auditor)
    assert summary.status_code == 200
    first = summary.json()
    assert first["current_step"] == "proofs"
    assert first["proof_submitted"] == 0
    assert first["health"] == "in-progress"

    client.post(
        "/proofs",
        json={
            "event_id": event_id,
            "site_id": "site-a",
            "baseline_kwh": 150,
            "actual_kwh": 40,
            "uri": "ipfs://site-a-summary",
            "baseline_method": "simple",
        },
        headers=participant_a,
    )
    client.post(
        "/proofs",
        json={
            "event_id": event_id,
            "site_id": "site-b",
            "baseline_kwh": 150,
            "actual_kwh": 120,
            "uri": "ipfs://site-b-summary",
            "baseline_method": "simple",
        },
        headers=participant_b,
    )
    client.post(f"/events/{event_id}/close", headers=operator)
    client.post(f"/settle/{event_id}", json={"site_ids": ["site-a", "site-b"]}, headers=operator)
    client.post(f"/claim/{event_id}/site-a", headers=participant_a)
    client.get(f"/audit/{event_id}/site-a", headers=auditor)

    summary_after = client.get(f"/judge/{event_id}/summary", headers=auditor)
    assert summary_after.status_code == 200
    final = summary_after.json()
    assert final["current_step"] == "completed"
    assert final["health"] == "done"
    assert final["audit_requested"] is True
    assert final["progress_pct"] == 100
    assert final["total_payout_drt"] >= 0
    assert final["claim_site_a_status"] == "claimed"
    assert final["last_transition_at"] is not None
    assert isinstance(final["agent_hint"], str) and len(final["agent_hint"]) > 0


def test_judge_summary_allows_participant_role(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "dr_agent_summary_role.db"))
    client = TestClient(app)

    event_id = "event-summary-role"
    _create_event(client, event_id)

    participant = _headers("participant-key", "site-a")
    response = client.get(f"/judge/{event_id}/summary", headers=participant)
    assert response.status_code == 200
    assert response.json()["event_id"] == event_id


def test_judge_summary_returns_not_found_for_unknown_event(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "dr_agent_summary_missing.db"))
    client = TestClient(app)
    auditor = _headers("auditor-key", "auditor-1")

    response = client.get("/judge/missing-event/summary", headers=auditor)
    assert response.status_code == 404
    assert response.json()["code"] == "EVENT_NOT_FOUND"

