"""TDD RED — Stats API tests for bridge and ICM statistics endpoints."""

import pytest
from fastapi.testclient import TestClient

from services.api import create_app

OP_HEADERS = {"x-api-key": "operator-key", "x-actor-id": "operator"}
IDEM = {"Idempotency-Key": ""}


def _idem(key: str) -> dict:
    return {**OP_HEADERS, "Idempotency-Key": key}


@pytest.fixture()
def client(tmp_path):
    app = create_app(db_path=str(tmp_path / "test.db"))
    return TestClient(app)


# ---------- Bridge Stats ----------


class TestBridgeStats:
    def test_bridge_stats_empty(self, client):
        resp = client.get("/v1/bridge/stats", headers=OP_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_transfers"] == 0
        assert data["pending_count"] == 0
        assert data["completed_count"] == 0

    def test_bridge_stats_after_transfers(self, client):
        # Create two transfers
        client.post(
            "/v1/bridge/transfers",
            json={"sender": "0xABC", "amount_wei": "1000", "direction": "home_to_remote"},
            headers=_idem("bt-1"),
        )
        client.post(
            "/v1/bridge/transfers",
            json={"sender": "0xDEF", "amount_wei": "2000", "direction": "remote_to_home"},
            headers=_idem("bt-2"),
        )
        resp = client.get("/v1/bridge/stats", headers=OP_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_transfers"] == 2
        assert data["pending_count"] == 2
        assert data["completed_count"] == 0

    def test_bridge_stats_completed_count(self, client):
        # Create and complete a transfer
        r = client.post(
            "/v1/bridge/transfers",
            json={"sender": "0xABC", "amount_wei": "500", "direction": "home_to_remote"},
            headers=_idem("bt-c1"),
        )
        tid = r.json()["transfer_id"]
        client.post(
            f"/v1/bridge/transfers/{tid}/source-submitted",
            json={"source_tx_hash": "0xaaa"},
            headers=_idem("bt-c2"),
        )
        client.post(
            f"/v1/bridge/transfers/{tid}/source-confirmed",
            headers=_idem("bt-c3"),
        )
        client.post(
            f"/v1/bridge/transfers/{tid}/dest-submitted",
            json={"dest_tx_hash": "0xbbb"},
            headers=_idem("bt-c4"),
        )
        client.post(
            f"/v1/bridge/transfers/{tid}/completed",
            headers=_idem("bt-c5"),
        )
        resp = client.get("/v1/bridge/stats", headers=OP_HEADERS)
        data = resp.json()
        assert data["total_transfers"] == 1
        assert data["completed_count"] == 1
        assert data["pending_count"] == 0

    def test_bridge_stats_requires_auth(self, client):
        resp = client.get("/v1/bridge/stats")
        assert resp.status_code == 401


# ---------- ICM Stats ----------


class TestICMStats:
    def test_icm_stats_empty(self, client):
        resp = client.get("/v1/icm/stats", headers=OP_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_messages"] == 0
        assert data["by_status"]["pending"] == 0

    def test_icm_stats_after_messages(self, client):
        client.post(
            "/v1/icm/messages",
            json={
                "source_chain": "dr-l1",
                "dest_chain": "c-chain",
                "message_type": "bridge_transfer",
                "sender": "0xABC",
                "payload": {"amount": "100"},
            },
            headers=_idem("icm-1"),
        )
        client.post(
            "/v1/icm/messages",
            json={
                "source_chain": "c-chain",
                "dest_chain": "dr-l1",
                "message_type": "settlement_sync",
                "sender": "0xDEF",
                "payload": {"event_id": "evt-1"},
            },
            headers=_idem("icm-2"),
        )
        resp = client.get("/v1/icm/stats", headers=OP_HEADERS)
        data = resp.json()
        assert data["total_messages"] == 2
        assert data["by_status"]["pending"] == 2
        assert data["by_type"]["bridge_transfer"] == 1
        assert data["by_type"]["settlement_sync"] == 1

    def test_icm_stats_by_status(self, client):
        r = client.post(
            "/v1/icm/messages",
            json={
                "source_chain": "dr-l1",
                "dest_chain": "c-chain",
                "message_type": "proof_attestation",
                "sender": "0xABC",
                "payload": {"proof": "hash"},
            },
            headers=_idem("icm-s1"),
        )
        mid = r.json()["message_id"]
        client.post(
            f"/v1/icm/messages/{mid}/sent",
            json={"tx_hash": "0xaaa"},
            headers=_idem("icm-s2"),
        )
        resp = client.get("/v1/icm/stats", headers=OP_HEADERS)
        data = resp.json()
        assert data["by_status"]["sent"] == 1
        assert data["by_status"]["pending"] == 0

    def test_icm_stats_requires_auth(self, client):
        resp = client.get("/v1/icm/stats")
        assert resp.status_code == 401
