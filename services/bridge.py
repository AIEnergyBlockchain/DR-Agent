"""Bridge service for DRT cross-chain transfers (ICTT pattern).

Tracks the lifecycle of cross-chain bridge transfers in SQLite:
  initiated → source_submitted → source_confirmed → dest_submitted → completed
"""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

from services.db import connect as db_connect


class BridgeDirection(Enum):
    HOME_TO_REMOTE = "home_to_remote"
    REMOTE_TO_HOME = "remote_to_home"


@dataclass
class BridgeTransfer:
    transfer_id: str
    sender: str
    amount_wei: str
    direction: BridgeDirection
    status: str
    source_tx_hash: str | None
    dest_tx_hash: str | None
    created_at: str
    updated_at: str


BRIDGE_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS bridge_transfers (
    transfer_id TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE,
    sender TEXT NOT NULL,
    amount_wei TEXT NOT NULL,
    direction TEXT NOT NULL,
    status TEXT NOT NULL,
    source_tx_hash TEXT,
    dest_tx_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class BridgeService:
    def __init__(self, db_path: str | None = None):
        self.conn = db_connect(db_path)
        self.conn.executescript(BRIDGE_SCHEMA_SQL)
        self._ensure_idempotency_key()
        self.conn.commit()
        self.chain_mode = os.getenv("DR_CHAIN_MODE", "simulated")
        self.chain_action_script = (
            Path(__file__).resolve().parents[1]
            / "scripts"
            / _chain_action_script_for_mode(self.chain_mode)
        )

    def _ensure_idempotency_key(self) -> None:
        columns = {row["name"] for row in self.conn.execute("PRAGMA table_info(bridge_transfers)")}
        if "idempotency_key" not in columns:
            self.conn.execute("ALTER TABLE bridge_transfers ADD COLUMN idempotency_key TEXT")
        self.conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS bridge_transfers_idempotency_key ON bridge_transfers(idempotency_key)"
        )
        self.conn.commit()

    def initiate_transfer(
        self,
        sender: str,
        amount_wei: str,
        direction: BridgeDirection,
        idempotency_key: str | None = None,
    ) -> BridgeTransfer:
        transfer_id = f"bridge-{uuid.uuid4().hex[:12]}"
        now = _utc_now()
        self.conn.execute(
            """
            INSERT INTO bridge_transfers
                (transfer_id, idempotency_key, sender, amount_wei, direction, status,
                 source_tx_hash, dest_tx_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'initiated', NULL, NULL, ?, ?)
            """,
            (transfer_id, idempotency_key, sender, amount_wei, direction.value, now, now),
        )
        self.conn.commit()
        return self._get(transfer_id)

    def mark_source_submitted(
        self, transfer_id: str, source_tx_hash: str
    ) -> BridgeTransfer:
        self._update(transfer_id, status="source_submitted", source_tx_hash=source_tx_hash)
        return self._get(transfer_id)

    def mark_source_confirmed(self, transfer_id: str) -> BridgeTransfer:
        self._update(transfer_id, status="source_confirmed")
        return self._get(transfer_id)

    def mark_dest_submitted(
        self, transfer_id: str, dest_tx_hash: str
    ) -> BridgeTransfer:
        self._update(transfer_id, status="dest_submitted", dest_tx_hash=dest_tx_hash)
        return self._get(transfer_id)

    def mark_completed(self, transfer_id: str) -> BridgeTransfer:
        self._update(transfer_id, status="completed")
        return self._get(transfer_id)

    def get_transfer(self, transfer_id: str) -> BridgeTransfer | None:
        row = self.conn.execute(
            "SELECT * FROM bridge_transfers WHERE transfer_id = ?",
            (transfer_id,),
        ).fetchone()
        if row is None:
            return None
        return self._row_to_transfer(row)

    def get_by_idempotency(self, idempotency_key: str) -> BridgeTransfer | None:
        row = self.conn.execute(
            "SELECT * FROM bridge_transfers WHERE idempotency_key = ?",
            (idempotency_key,),
        ).fetchone()
        if row is None:
            return None
        return self._row_to_transfer(row)

    def list_pending_transfers(self) -> list[BridgeTransfer]:
        rows = self.conn.execute(
            "SELECT * FROM bridge_transfers WHERE status != 'completed' ORDER BY created_at",
        ).fetchall()
        return [self._row_to_transfer(r) for r in rows]

    def send_bridge_tokens(self, transfer_id: str, amount_wei: str) -> dict:
        return self._chain_action("send_tokens", {"amount": amount_wei})

    def receive_bridge_tokens(
        self,
        transfer_id: str,
        source_nonce: int,
        recipient: str,
        amount_wei: str,
        source_chain_id: str,
    ) -> dict:
        payload = {
            "source_nonce": source_nonce,
            "recipient": recipient,
            "amount": amount_wei,
            "source_chain_id": source_chain_id,
        }
        return self._chain_action("receive_tokens", payload)

    # -- internal --

    def _get(self, transfer_id: str) -> BridgeTransfer:
        t = self.get_transfer(transfer_id)
        if t is None:
            raise ValueError(f"bridge transfer not found: {transfer_id}")
        return t

    def _update(
        self,
        transfer_id: str,
        status: str,
        source_tx_hash: str | None = None,
        dest_tx_hash: str | None = None,
    ) -> None:
        now = _utc_now()
        sets = ["status = ?", "updated_at = ?"]
        params: list = [status, now]
        if source_tx_hash is not None:
            sets.append("source_tx_hash = ?")
            params.append(source_tx_hash)
        if dest_tx_hash is not None:
            sets.append("dest_tx_hash = ?")
            params.append(dest_tx_hash)
        params.append(transfer_id)
        self.conn.execute(
            f"UPDATE bridge_transfers SET {', '.join(sets)} WHERE transfer_id = ?",
            params,
        )
        self.conn.commit()

    @staticmethod
    def _row_to_transfer(row: sqlite3.Row) -> BridgeTransfer:
        return BridgeTransfer(
            transfer_id=row["transfer_id"],
            sender=row["sender"],
            amount_wei=row["amount_wei"],
            direction=BridgeDirection(row["direction"]),
            status=row["status"],
            source_tx_hash=row["source_tx_hash"],
            dest_tx_hash=row["dest_tx_hash"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _chain_action(self, action: str, payload: dict) -> dict:
        if not self.chain_action_script.exists():
            raise ValueError(f"bridge chain action script not found: {self.chain_action_script}")
        cmd = ["node", str(self.chain_action_script), action]
        result = subprocess.run(
            cmd,
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            check=False,
            env=os.environ.copy(),
        )
        if result.returncode != 0:
            stderr = (result.stderr or "").strip()
            stdout = (result.stdout or "").strip()
            detail = stderr or stdout or f"exit={result.returncode}"
            raise RuntimeError(f"bridge chain action failed: {detail}")
        raw = (result.stdout or "").strip()
        if not raw:
            raise RuntimeError("bridge chain action returned empty output")
        try:
            return json.loads(raw.splitlines()[-1])
        except json.JSONDecodeError as exc:
            raise RuntimeError("bridge chain action returned non-json output") from exc


def _chain_action_script_for_mode(chain_mode: str) -> str:
    if chain_mode in {"dr_l1", "l1"}:
        return "bridge_chain_action.js"
    if chain_mode in {"fuji", "fuji-live"}:
        return "bridge_chain_action.js"
    return "bridge_chain_action.js"
