from __future__ import annotations

from pathlib import Path

from asgi_client import AppClient
from services.api import create_app


def _headers(api_key: str, actor_id: str, idem_key: str | None = None) -> dict[str, str]:
    headers = {"x-api-key": api_key, "x-actor-id": actor_id}
    if idem_key:
        headers["Idempotency-Key"] = idem_key
    return headers


def _create_message(client: AppClient, headers: dict[str, str]) -> str:
    body = {
        "source_chain": "fuji",
        "dest_chain": "dr-l1",
        "message_type": "bridge_transfer",
        "sender": "0xabc",
        "payload": {"amount": "1000"},
    }
    created = client.post("/v1/icm/messages", json=body, headers=headers)
    assert created.status_code == 200
    return created.json()["message_id"]


def test_icm_relay_and_process_fail_without_chain_action(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("ICM_RPC_URL", raising=False)
    monkeypatch.delenv("PRIVATE_KEY", raising=False)
    monkeypatch.delenv("ICM_DEPLOY_OUT", raising=False)

    app = create_app(db_path=str(tmp_path / "icm_action.db"))
    client = AppClient(app)

    message_id = _create_message(client, _headers("operator-key", "operator-1", "idem-icm-action-1"))

    relay = client.post(
        f"/v1/icm/messages/{message_id}/relay",
        headers=_headers("operator-key", "operator-1", "idem-icm-action-2"),
    )
    assert relay.status_code == 502
    assert relay.json()["code"] == "ICM_TX_FAILED"

    process_onchain = client.post(
        f"/v1/icm/messages/{message_id}/process-onchain",
        json={"success": True},
        headers=_headers("operator-key", "operator-1", "idem-icm-action-3"),
    )
    assert process_onchain.status_code == 502
    assert process_onchain.json()["code"] == "ICM_TX_FAILED"
