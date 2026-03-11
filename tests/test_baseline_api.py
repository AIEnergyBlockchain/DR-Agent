"""TDD RED — Baseline comparison API tests."""

import pytest
from fastapi.testclient import TestClient

from services.api import create_app

OP_HEADERS = {"x-api-key": "operator-key", "x-actor-id": "operator"}
PART_HEADERS = {"x-api-key": "participant-key", "x-actor-id": "site-a"}


@pytest.fixture()
def client(tmp_path):
    app = create_app(db_path=str(tmp_path / "test.db"))
    return TestClient(app)


def _make_history(days=14, hour=14, base_kw=100):
    """Generate hourly meter history for testing."""
    from datetime import datetime, timedelta

    rows = []
    start = datetime(2026, 3, 1, 0, 0, 0)
    for d in range(days):
        for h in range(24):
            ts = start + timedelta(days=d, hours=h)
            kw = base_kw + (10 if h == hour else 0) + d * 2
            rows.append({"timestamp": ts.isoformat(), "kw": kw})
    return rows


class TestBaselineMethods:
    def test_list_methods(self, client):
        resp = client.get("/v1/baseline/methods", headers=OP_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "methods" in data
        assert "simple" in data["methods"]
        assert "ewma" in data["methods"]
        assert "percentile" in data["methods"]
        assert "auto" in data["methods"]

    def test_list_methods_requires_auth(self, client):
        resp = client.get("/v1/baseline/methods")
        assert resp.status_code == 401


class TestBaselineCompare:
    def test_compare_returns_all_methods(self, client):
        history = _make_history(days=14, hour=14, base_kw=100)
        resp = client.post(
            "/v1/baseline/compare",
            json={"history": history, "event_hour": 14},
            headers=OP_HEADERS,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        methods = {r["method"] for r in data["results"]}
        assert methods == {"simple", "ewma", "percentile"}
        for r in data["results"]:
            assert "baseline_kwh" in r
            assert "confidence" in r
            assert r["confidence"] >= 0
            assert r["confidence"] <= 1

    def test_compare_with_auto_recommendation(self, client):
        history = _make_history(days=14, hour=10, base_kw=200)
        resp = client.post(
            "/v1/baseline/compare",
            json={"history": history, "event_hour": 10},
            headers=OP_HEADERS,
        )
        data = resp.json()
        assert "recommended" in data
        assert data["recommended"]["method"] in {"simple", "ewma", "percentile"}
        assert data["recommended"]["baseline_kwh"] > 0

    def test_compare_requires_auth(self, client):
        resp = client.post(
            "/v1/baseline/compare",
            json={"history": [], "event_hour": 14},
        )
        assert resp.status_code == 401

    def test_compare_empty_history(self, client):
        resp = client.post(
            "/v1/baseline/compare",
            json={"history": [], "event_hour": 14},
            headers=OP_HEADERS,
        )
        # Should handle gracefully (either 200 with fallback or 422)
        assert resp.status_code in (200, 422)

    def test_compare_participant_can_access(self, client):
        history = _make_history(days=7, hour=8, base_kw=50)
        resp = client.post(
            "/v1/baseline/compare",
            json={"history": history, "event_hour": 8},
            headers=PART_HEADERS,
        )
        assert resp.status_code == 200


class TestDashboardSummary:
    def test_dashboard_summary_empty(self, client):
        resp = client.get("/v1/dashboard/summary", headers=OP_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "chain_mode" in data
        assert "bridge" in data
        assert "icm" in data
        assert "baseline_methods" in data

    def test_dashboard_summary_requires_auth(self, client):
        resp = client.get("/v1/dashboard/summary")
        assert resp.status_code == 401
