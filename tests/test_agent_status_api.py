"""Tests for Agent Status API endpoint — GET /v1/agent/status."""

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


def test_status_returns_active(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.get("/v1/agent/status", headers=_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "active"
    assert data["provider"] == "mock"
    assert data["total_analyses"] == 0


def test_status_counts_after_insight(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    headers = _headers()
    # Generate two insights
    client.post("/v1/agent/insight", json={"event_id": "evt-1", "current_step": "create"}, headers=headers)
    client.post("/v1/agent/insight", json={"event_id": "evt-1", "current_step": "proofs"}, headers=headers)
    resp = client.get("/v1/agent/status", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total_analyses"] == 2


def test_status_counts_anomalies(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    headers = _headers()
    client.post(
        "/v1/agent/anomaly",
        json={
            "proofs": [
                {"site_id": "site-a", "baseline_kwh": 100, "actual_kwh": 150},
                {"site_id": "site-b", "baseline_kwh": 100, "actual_kwh": 70},
            ]
        },
        headers=headers,
    )
    resp = client.get("/v1/agent/status", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total_anomalies_detected"] == 1


def test_status_all_roles_allowed(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    for key in ("operator-key", "participant-key", "auditor-key"):
        resp = client.get("/v1/agent/status", headers=_headers(api_key=key))
        assert resp.status_code == 200


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
