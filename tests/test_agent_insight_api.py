"""Tests for Agent Insight API endpoint — POST /v1/agent/insight."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from asgi_client import AppClient
from services.api import create_app


def _headers(api_key: str = "operator-key", actor_id: str = "operator-1"):
    return {"x-api-key": api_key, "x-actor-id": actor_id}


def test_insight_basic_create_step(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/insight",
        json={"event_id": "evt-1", "current_step": "create"},
        headers=_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "headline" in data
    assert "reasoning" in data
    assert "confidence" in data
    assert 0.0 <= data["confidence"] <= 1.0
    assert isinstance(data["risk_flags"], list)


def test_insight_with_proofs(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/insight",
        json={
            "event_id": "evt-1",
            "current_step": "proofs",
            "proofs": [
                {"site_id": "site-a", "baseline_kwh": 150, "actual_kwh": 40},
            ],
        },
        headers=_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["data_points"]["proof_count"] == 1


def test_insight_with_full_context(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/insight",
        json={
            "event_id": "evt-1",
            "current_step": "settle",
            "proofs": [
                {"site_id": "site-a", "baseline_kwh": 150, "actual_kwh": 40},
                {"site_id": "site-b", "baseline_kwh": 150, "actual_kwh": 120},
            ],
            "baseline_result": {"baseline_kwh": 150, "method": "simple"},
            "settlement": {"payout": 1100},
        },
        headers=_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["confidence"] > 0.5


def test_insight_chinese_language(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/insight",
        json={"event_id": "evt-1", "current_step": "create", "lang": "zh"},
        headers=_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert any("\u4e00" <= c <= "\u9fff" for c in data["headline"])


def test_insight_error_pipeline(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/insight",
        json={
            "event_id": "evt-1",
            "current_step": "proofs",
            "tx_pipeline": [{"status": "failed", "tx_error": "gas too low"}],
        },
        headers=_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "tx_failure" in data["risk_flags"]


def test_insight_suggested_action_present(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/insight",
        json={"event_id": "evt-1", "current_step": "proofs"},
        headers=_headers(),
    )
    assert resp.status_code == 200
    assert resp.json()["suggested_action"] is not None


def test_insight_all_roles_allowed(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    payload = {"event_id": "evt-1", "current_step": "create"}
    for key in ("operator-key", "participant-key", "auditor-key"):
        resp = client.post("/v1/agent/insight", json=payload, headers=_headers(api_key=key))
        assert resp.status_code == 200


def test_insight_no_auth_rejected(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/insight",
        json={"event_id": "evt-1", "current_step": "create"},
    )
    assert resp.status_code in (401, 403)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
