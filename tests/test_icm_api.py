from __future__ import annotations

from pathlib import Path

from asgi_client import AppClient
from services.api import create_app


def _headers(api_key: str, actor_id: str, idem_key: str | None = None) -> dict[str, str]:
    headers = {"x-api-key": api_key, "x-actor-id": actor_id}
    if idem_key:
        headers["Idempotency-Key"] = idem_key
    return headers


def test_icm_message_idempotent_and_conflict(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "icm_api.db"))
    client = AppClient(app)

    body = {
        "source_chain": "fuji",
        "dest_chain": "dr-l1",
        "message_type": "bridge_transfer",
        "sender": "0xabc",
        "payload": {"amount": "1000"},
    }
    headers = _headers("operator-key", "operator-1", "idem-icm-1")

    first = client.post("/v1/icm/messages", json=body, headers=headers)
    assert first.status_code == 200
    message_id = first.json()["message_id"]

    second = client.post("/v1/icm/messages", json=body, headers=headers)
    assert second.status_code == 200
    assert second.json()["message_id"] == message_id

    conflict = client.post(
        "/v1/icm/messages",
        json={
            "source_chain": "fuji",
            "dest_chain": "dr-l1",
            "message_type": "bridge_transfer",
            "sender": "0xabc",
            "payload": {"amount": "2000"},
        },
        headers=headers,
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "IDEMPOTENCY_CONFLICT"


def test_icm_message_requires_idempotency(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "icm_api_idem.db"))
    client = AppClient(app)

    body = {
        "source_chain": "fuji",
        "dest_chain": "dr-l1",
        "message_type": "settlement_sync",
        "sender": "0xabc",
        "payload": {"event_id": "event-1"},
    }
    headers = _headers("operator-key", "operator-1")

    response = client.post("/v1/icm/messages", json=body, headers=headers)
    assert response.status_code == 400
    assert response.json()["code"] == "IDEMPOTENCY_REQUIRED"


def test_icm_message_list_and_get(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "icm_api_list.db"))
    client = AppClient(app)

    body = {
        "source_chain": "fuji",
        "dest_chain": "dr-l1",
        "message_type": "proof_attestation",
        "sender": "0xabc",
        "payload": {"proof_hash": "0x123"},
    }
    headers = _headers("operator-key", "operator-1", "idem-icm-2")

    created = client.post("/v1/icm/messages", json=body, headers=headers)
    assert created.status_code == 200
    message_id = created.json()["message_id"]

    pending = client.get("/v1/icm/messages/pending", headers=headers)
    assert pending.status_code == 200
    assert message_id in {item["message_id"] for item in pending.json()}

    fetched = client.get(f"/v1/icm/messages/{message_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["message_id"] == message_id

    missing = client.get("/v1/icm/messages/missing-id", headers=headers)
    assert missing.status_code == 404
    assert missing.json()["code"] == "ICM_MESSAGE_NOT_FOUND"
