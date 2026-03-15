from __future__ import annotations

from pathlib import Path

from asgi_client import AppClient
from services.api import create_app


def _headers(api_key: str, actor_id: str, idem_key: str | None = None) -> dict[str, str]:
    headers = {"x-api-key": api_key, "x-actor-id": actor_id}
    if idem_key:
        headers["Idempotency-Key"] = idem_key
    return headers


def test_bridge_transfer_idempotent_and_conflict(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "bridge_api.db"))
    client = AppClient(app)

    body = {"sender": "0xabc", "amount_wei": "1000", "direction": "home_to_remote"}
    headers = _headers("operator-key", "operator-1", "idem-bridge-1")

    first = client.post("/v1/bridge/transfers", json=body, headers=headers)
    assert first.status_code == 200
    transfer_id = first.json()["transfer_id"]

    second = client.post("/v1/bridge/transfers", json=body, headers=headers)
    assert second.status_code == 200
    assert second.json()["transfer_id"] == transfer_id

    conflict = client.post(
        "/v1/bridge/transfers",
        json={"sender": "0xabc", "amount_wei": "2000", "direction": "home_to_remote"},
        headers=headers,
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "IDEMPOTENCY_CONFLICT"


def test_bridge_transfer_requires_idempotency(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "bridge_api_idem.db"))
    client = AppClient(app)

    body = {"sender": "0xabc", "amount_wei": "1000", "direction": "home_to_remote"}
    headers = _headers("operator-key", "operator-1")

    response = client.post("/v1/bridge/transfers", json=body, headers=headers)
    assert response.status_code == 400
    assert response.json()["code"] == "IDEMPOTENCY_REQUIRED"


def test_bridge_transfer_list_and_get(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "bridge_api_list.db"))
    client = AppClient(app)

    body = {"sender": "0xabc", "amount_wei": "1000", "direction": "remote_to_home"}
    headers = _headers("operator-key", "operator-1", "idem-bridge-2")

    created = client.post("/v1/bridge/transfers", json=body, headers=headers)
    assert created.status_code == 200
    transfer_id = created.json()["transfer_id"]

    pending = client.get("/v1/bridge/transfers/pending", headers=headers)
    assert pending.status_code == 200
    assert transfer_id in {item["transfer_id"] for item in pending.json()}

    fetched = client.get(f"/v1/bridge/transfers/{transfer_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["transfer_id"] == transfer_id

    missing = client.get("/v1/bridge/transfers/missing-id", headers=headers)
    assert missing.status_code == 404
    assert missing.json()["code"] == "BRIDGE_TRANSFER_NOT_FOUND"
