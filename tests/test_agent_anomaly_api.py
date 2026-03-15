"""Tests for Agent Anomaly API endpoint — POST /v1/agent/anomaly."""

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


def test_anomaly_no_proofs(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/anomaly",
        json={"proofs": []},
        headers=_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_anomaly"] is False


def test_anomaly_normal_proofs(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/anomaly",
        json={
            "proofs": [
                {"site_id": "site-a", "baseline_kwh": 150, "actual_kwh": 100},
                {"site_id": "site-b", "baseline_kwh": 150, "actual_kwh": 110},
            ]
        },
        headers=_headers(),
    )
    assert resp.status_code == 200
    assert resp.json()["has_anomaly"] is False


def test_anomaly_load_spike(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/anomaly",
        json={
            "proofs": [
                {"site_id": "site-a", "baseline_kwh": 150, "actual_kwh": 40},
                {"site_id": "site-b", "baseline_kwh": 150, "actual_kwh": 145},
                {"site_id": "site-c", "baseline_kwh": 150, "actual_kwh": 145},
                {"site_id": "site-d", "baseline_kwh": 150, "actual_kwh": 145},
            ]
        },
        headers=_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_anomaly"] is True
    assert data["anomaly_type"] == "load_spike"
    assert "site-a" in data["affected_proofs"]


def test_anomaly_proof_mismatch(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/anomaly",
        json={
            "proofs": [
                {"site_id": "site-a", "baseline_kwh": 100, "actual_kwh": 150},
                {"site_id": "site-b", "baseline_kwh": 100, "actual_kwh": 70},
            ]
        },
        headers=_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_anomaly"] is True
    assert data["anomaly_type"] == "proof_mismatch"


def test_anomaly_baseline_drift(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/anomaly",
        json={
            "proofs": [
                {"site_id": "site-a", "baseline_kwh": 200, "actual_kwh": 100},
            ],
            "baseline_result": {"baseline_kwh": 100},
        },
        headers=_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_anomaly"] is True
    assert data["anomaly_type"] == "baseline_drift"


def test_anomaly_response_has_recommendation(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    resp = client.post(
        "/v1/agent/anomaly",
        json={
            "proofs": [
                {"site_id": "site-a", "baseline_kwh": 100, "actual_kwh": 150},
                {"site_id": "site-b", "baseline_kwh": 100, "actual_kwh": 70},
            ]
        },
        headers=_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    if data["has_anomaly"]:
        assert data["recommendation"]


def test_anomaly_all_roles_allowed(tmp_path):
    app = create_app(db_path=str(tmp_path / "agent_test.db"))
    client = AppClient(app)
    payload = {"proofs": []}
    for key in ("operator-key", "participant-key", "auditor-key"):
        resp = client.post("/v1/agent/anomaly", json=payload, headers=_headers(api_key=key))
        assert resp.status_code == 200


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
