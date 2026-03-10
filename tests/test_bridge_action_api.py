from __future__ import annotations

from pathlib import Path

import pytest

from asgi_client import AppClient
from services.api import create_app


def _headers(api_key: str, actor_id: str, idem_key: str | None = None) -> dict[str, str]:
    headers = {"x-api-key": api_key, "x-actor-id": actor_id}
    if idem_key:
        headers["Idempotency-Key"] = idem_key
    return headers


def test_bridge_send_tokens_fails_without_chain_action(tmp_path: Path):
    app = create_app(db_path=str(tmp_path / "bridge_action.db"))
    client = AppClient(app)

    create = client.post(
        "/v1/bridge/transfers",
        json={"sender": "0xabc", "amount_wei": "1000", "direction": "home_to_remote"},
        headers=_headers("operator-key", "operator-1", "idem-bridge-action-1"),
    )
    assert create.status_code == 200
    transfer_id = create.json()["transfer_id"]

    response = client.post(
        f"/v1/bridge/transfers/{transfer_id}/send-tokens",
        json={"amount_wei": "1000"},
        headers=_headers("operator-key", "operator-1", "idem-bridge-action-2"),
    )
    assert response.status_code == 502
    assert response.json()["code"] == "BRIDGE_TX_FAILED"
