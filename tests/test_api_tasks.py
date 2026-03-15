"""TDD RED — Task queue API endpoint tests."""

import pytest
from fastapi.testclient import TestClient

from services.api import create_app

OP_HEADERS = {"x-api-key": "operator-key", "x-actor-id": "operator"}


@pytest.fixture()
def client(tmp_path):
    app = create_app(db_path=str(tmp_path / "test.db"))
    return TestClient(app)


class TestTaskAPI:
    def test_get_task_not_found(self, client):
        resp = client.get("/v1/tasks/task-nonexistent", headers=OP_HEADERS)
        assert resp.status_code == 404

    def test_enqueue_and_get_task(self, client):
        resp = client.post(
            "/v1/tasks",
            json={"task_type": "confirm_tx", "payload": {"tx_hash": "0xabc"}},
            headers=OP_HEADERS,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["task_type"] == "confirm_tx"
        assert data["status"] == "pending"
        task_id = data["task_id"]

        resp2 = client.get(f"/v1/tasks/{task_id}", headers=OP_HEADERS)
        assert resp2.status_code == 200
        assert resp2.json()["task_id"] == task_id

    def test_task_requires_auth(self, client):
        resp = client.get("/v1/tasks/task-123")
        assert resp.status_code == 401

    def test_task_pending_count(self, client):
        client.post(
            "/v1/tasks",
            json={"task_type": "bridge_relay", "payload": {"transfer_id": "t1"}},
            headers=OP_HEADERS,
        )
        client.post(
            "/v1/tasks",
            json={"task_type": "icm_deliver", "payload": {"message_id": "m1"}},
            headers=OP_HEADERS,
        )
        resp = client.get("/v1/tasks/summary", headers=OP_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["pending_count"] >= 2
