from __future__ import annotations

from pathlib import Path

from asgi_client import AppClient
from services.api import create_app


def _headers(api_key: str, actor_id: str, idem_key: str | None = None) -> dict[str, str]:
    headers = {"x-api-key": api_key, "x-actor-id": actor_id}
    if idem_key:
        headers["Idempotency-Key"] = idem_key
    return headers


def _create_transfer(client: AppClient, idem_key: str) -> str:
    body = {"sender": "0xabc", "amount_wei": "1000", "direction": "home_to_remote"}
    response = client.post(
        "/v1/bridge/transfers",
        json=body,
        headers=_headers("operator-key", "operator-1", idem_key),
    )
    assert response.status_code == 200
    return response.json()["transfer_id"]


def test_bridge_status_progression(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "bridge_status.db"))
    client = AppClient(app)

    transfer_id = _create_transfer(client, "idem-bridge-status-1")

    source = client.post(
        f"/v1/bridge/transfers/{transfer_id}/source-submitted",
        json={"source_tx_hash": "0xaaa"},
        headers=_headers("operator-key", "operator-1", "idem-bridge-status-2"),
    )
    assert source.status_code == 200
    assert source.json()["status"] == "source_submitted"

    confirmed = client.post(
        f"/v1/bridge/transfers/{transfer_id}/source-confirmed",
        headers=_headers("operator-key", "operator-1", "idem-bridge-status-3"),
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "source_confirmed"

    dest = client.post(
        f"/v1/bridge/transfers/{transfer_id}/dest-submitted",
        json={"dest_tx_hash": "0xbbb"},
        headers=_headers("operator-key", "operator-1", "idem-bridge-status-4"),
    )
    assert dest.status_code == 200
    assert dest.json()["status"] == "dest_submitted"

    completed = client.post(
        f"/v1/bridge/transfers/{transfer_id}/completed",
        headers=_headers("operator-key", "operator-1", "idem-bridge-status-5"),
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"


def test_bridge_status_conflict_on_mismatched_hash(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "bridge_status_conflict.db"))
    client = AppClient(app)

    transfer_id = _create_transfer(client, "idem-bridge-status-6")

    first = client.post(
        f"/v1/bridge/transfers/{transfer_id}/source-submitted",
        json={"source_tx_hash": "0xaaa"},
        headers=_headers("operator-key", "operator-1", "idem-bridge-status-7"),
    )
    assert first.status_code == 200

    conflict = client.post(
        f"/v1/bridge/transfers/{transfer_id}/source-submitted",
        json={"source_tx_hash": "0xbbb"},
        headers=_headers("operator-key", "operator-1", "idem-bridge-status-8"),
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "IDEMPOTENCY_CONFLICT"
