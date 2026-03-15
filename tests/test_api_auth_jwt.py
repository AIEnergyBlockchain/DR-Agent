"""TDD RED — JWT auth integration tests for API endpoints."""

import os
import pytest
from fastapi.testclient import TestClient

from services.auth import Role, create_token
from services.api import create_app

JWT_SECRET = "test-jwt-secret-key-2026"
OP_HEADERS = {"x-api-key": "operator-key", "x-actor-id": "operator"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DR_JWT_SECRET", JWT_SECRET)
    app = create_app(db_path=str(tmp_path / "test.db"))
    return TestClient(app)


def _jwt_headers(role: Role, actor_id: str = "jwt-user", **kwargs):
    token = create_token(actor_id, role, JWT_SECRET, **kwargs)
    return {"Authorization": f"Bearer {token}", "x-actor-id": actor_id}


class TestJWTAuth:
    def test_jwt_operator_accepted(self, client):
        headers = _jwt_headers(Role.OPERATOR, "op-jwt")
        resp = client.get("/v1/baseline/methods", headers=headers)
        assert resp.status_code == 200

    def test_jwt_participant_accepted(self, client):
        headers = _jwt_headers(Role.PARTICIPANT, "part-jwt")
        resp = client.get("/v1/baseline/methods", headers=headers)
        assert resp.status_code == 200

    def test_jwt_auditor_accepted(self, client):
        headers = _jwt_headers(Role.AUDITOR, "aud-jwt")
        resp = client.get("/v1/baseline/methods", headers=headers)
        assert resp.status_code == 200

    def test_jwt_expired_returns_401(self, client):
        headers = _jwt_headers(Role.OPERATOR, "op-jwt", ttl_seconds=-10)
        resp = client.get("/v1/baseline/methods", headers=headers)
        assert resp.status_code == 401

    def test_jwt_wrong_role_returns_403(self, client):
        # bridge stats requires operator or auditor, not participant
        headers = _jwt_headers(Role.PARTICIPANT, "part-jwt")
        resp = client.get("/v1/bridge/stats", headers=headers)
        assert resp.status_code == 403

    def test_api_key_still_works_after_jwt(self, client):
        resp = client.get("/v1/baseline/methods", headers=OP_HEADERS)
        assert resp.status_code == 200

    def test_invalid_jwt_returns_401(self, client):
        headers = {"Authorization": "Bearer invalid.token.here", "x-actor-id": "bad"}
        resp = client.get("/v1/baseline/methods", headers=headers)
        assert resp.status_code == 401

    def test_jwt_for_dashboard_summary(self, client):
        headers = _jwt_headers(Role.OPERATOR, "dash-user")
        resp = client.get("/v1/dashboard/summary", headers=headers)
        assert resp.status_code == 200
        assert "chain_mode" in resp.json()
