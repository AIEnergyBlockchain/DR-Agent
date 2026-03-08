"""Minimal local smoke test for DR Agent API."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def fail(msg: str) -> None:
    print(f"[smoke] FAIL: {msg}")
    sys.exit(1)


try:
    from asgi_client import AppClient
    from services.api import create_app
except Exception as exc:  # pragma: no cover
    fail(f"missing runtime dependency: {exc}")


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="dr-agent-smoke-") as tmp:
        db_path = str(Path(tmp) / "smoke.db")
        app = create_app(db_path=db_path)
        client = AppClient(app)

        headers = {"x-api-key": "operator-key", "x-actor-id": "operator-1"}
        payload = {
            "event_id": "event-smoke-20260217",
            "start_time": "2026-02-17T10:00:00Z",
            "end_time": "2026-02-17T11:00:00Z",
            "target_kw": 100,
            "reward_rate": 10,
            "penalty_rate": 5,
        }

        resp = client.post("/events", headers=headers, json=payload)
        if resp.status_code != 200:
            fail(f"unexpected status: {resp.status_code} body={resp.text}")

        body = resp.json()
        if body.get("status") != "active":
            fail(f"unexpected event status: {body}")

    print("[smoke] PASS: /events create flow is healthy")


if __name__ == "__main__":
    main()
