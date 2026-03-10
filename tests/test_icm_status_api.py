from __future__ import annotations

from pathlib import Path

from asgi_client import AppClient
from services.api import create_app


def _headers(api_key: str, actor_id: str, idem_key: str | None = None) -> dict[str, str]:
    headers = {"x-api-key": api_key, "x-actor-id": actor_id}
    if idem_key:
        headers["Idempotency-Key"] = idem_key
    return headers


def _create_message(client: AppClient, idem_key: str) -> str:
    body = {
        "source_chain": "fuji",
        "dest_chain": "dr-l1",
        "message_type": "bridge_transfer",
        "sender": "0xabc",
        "payload": {"amount": "1000"},
    }
    response = client.post(
        "/v1/icm/messages",
        json=body,
        headers=_headers("operator-key", "operator-1", idem_key),
    )
    assert response.status_code == 200
    return response.json()["message_id"]


def test_icm_status_progression(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "icm_status.db"))
    client = AppClient(app)

    message_id = _create_message(client, "idem-icm-status-1")

    sent = client.post(
        f"/v1/icm/messages/{message_id}/sent",
        json={"tx_hash": "0xaaa"},
        headers=_headers("operator-key", "operator-1", "idem-icm-status-2"),
    )
    assert sent.status_code == 200
    assert sent.json()["status"] == "sent"

    delivered = client.post(
        f"/v1/icm/messages/{message_id}/delivered",
        json={"dest_tx_hash": "0xbbb"},
        headers=_headers("operator-key", "operator-1", "idem-icm-status-3"),
    )
    assert delivered.status_code == 200
    assert delivered.json()["status"] == "delivered"

    processed = client.post(
        f"/v1/icm/messages/{message_id}/processed",
        headers=_headers("operator-key", "operator-1", "idem-icm-status-4"),
    )
    assert processed.status_code == 200
    assert processed.json()["status"] == "processed"


def test_icm_status_conflict_on_mismatched_hash(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "icm_status_conflict.db"))
    client = AppClient(app)

    message_id = _create_message(client, "idem-icm-status-5")

    first = client.post(
        f"/v1/icm/messages/{message_id}/sent",
        json={"tx_hash": "0xaaa"},
        headers=_headers("operator-key", "operator-1", "idem-icm-status-6"),
    )
    assert first.status_code == 200

    conflict = client.post(
        f"/v1/icm/messages/{message_id}/sent",
        json={"tx_hash": "0xbbb"},
        headers=_headers("operator-key", "operator-1", "idem-icm-status-7"),
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "IDEMPOTENCY_CONFLICT"


def test_icm_failed_blocked_after_processed(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "icm_status_failed.db"))
    client = AppClient(app)

    message_id = _create_message(client, "idem-icm-status-8")

    client.post(
        f"/v1/icm/messages/{message_id}/processed",
        headers=_headers("operator-key", "operator-1", "idem-icm-status-9"),
    )

    failed = client.post(
        f"/v1/icm/messages/{message_id}/failed",
        json={"error": "boom"},
        headers=_headers("operator-key", "operator-1", "idem-icm-status-10"),
    )
    assert failed.status_code == 409
    assert failed.json()["code"] == "IDEMPOTENCY_CONFLICT"
