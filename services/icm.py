"""ICM (Interchain Messaging) service for cross-chain message relay tracking.

Tracks the lifecycle of Avalanche Warp Messages between chains:
  pending → sent → delivered → processed (or failed)
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from services.db import connect as db_connect


class MessageType(Enum):
    BRIDGE_TRANSFER = "bridge_transfer"
    SETTLEMENT_SYNC = "settlement_sync"
    PROOF_ATTESTATION = "proof_attestation"


class MessageStatus(Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    PROCESSED = "processed"
    FAILED = "failed"


@dataclass
class ICMMessage:
    message_id: str
    source_chain: str
    dest_chain: str
    message_type: MessageType
    sender: str
    payload: dict[str, Any]
    status: MessageStatus
    source_tx_hash: str | None
    dest_tx_hash: str | None
    error: str | None
    created_at: str
    updated_at: str


ICM_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS icm_messages (
    message_id TEXT PRIMARY KEY,
    source_chain TEXT NOT NULL,
    dest_chain TEXT NOT NULL,
    message_type TEXT NOT NULL,
    sender TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    source_tx_hash TEXT,
    dest_tx_hash TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ICMService:
    def __init__(self, db_path: str | None = None):
        self.conn = db_connect(db_path)
        self.conn.executescript(ICM_SCHEMA_SQL)
        self.conn.commit()

    def create_message(
        self,
        source_chain: str,
        dest_chain: str,
        message_type: MessageType,
        sender: str,
        payload: dict[str, Any],
    ) -> ICMMessage:
        message_id = f"icm-{uuid.uuid4().hex[:12]}"
        now = _utc_now()
        self.conn.execute(
            """
            INSERT INTO icm_messages
                (message_id, source_chain, dest_chain, message_type, sender,
                 payload, status, source_tx_hash, dest_tx_hash, error,
                 created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?, ?)
            """,
            (message_id, source_chain, dest_chain, message_type.value,
             sender, json.dumps(payload), now, now),
        )
        self.conn.commit()
        return self._get(message_id)

    def mark_sent(self, message_id: str, tx_hash: str) -> ICMMessage:
        self._update(message_id, status="sent", source_tx_hash=tx_hash)
        return self._get(message_id)

    def mark_delivered(self, message_id: str, dest_tx_hash: str) -> ICMMessage:
        self._update(message_id, status="delivered", dest_tx_hash=dest_tx_hash)
        return self._get(message_id)

    def mark_processed(self, message_id: str) -> ICMMessage:
        self._update(message_id, status="processed")
        return self._get(message_id)

    def mark_failed(self, message_id: str, error: str) -> ICMMessage:
        self._update(message_id, status="failed", error=error)
        return self._get(message_id)

    def get_message(self, message_id: str) -> ICMMessage | None:
        row = self.conn.execute(
            "SELECT * FROM icm_messages WHERE message_id = ?",
            (message_id,),
        ).fetchone()
        if row is None:
            return None
        return self._row_to_message(row)

    def list_pending_messages(self) -> list[ICMMessage]:
        rows = self.conn.execute(
            "SELECT * FROM icm_messages WHERE status NOT IN ('processed', 'failed') ORDER BY created_at",
        ).fetchall()
        return [self._row_to_message(r) for r in rows]

    def list_by_type(self, message_type: MessageType) -> list[ICMMessage]:
        rows = self.conn.execute(
            "SELECT * FROM icm_messages WHERE message_type = ? ORDER BY created_at",
            (message_type.value,),
        ).fetchall()
        return [self._row_to_message(r) for r in rows]

    # -- internal --

    def _get(self, message_id: str) -> ICMMessage:
        msg = self.get_message(message_id)
        if msg is None:
            raise ValueError(f"ICM message not found: {message_id}")
        return msg

    def _update(
        self,
        message_id: str,
        status: str,
        source_tx_hash: str | None = None,
        dest_tx_hash: str | None = None,
        error: str | None = None,
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
        if error is not None:
            sets.append("error = ?")
            params.append(error)
        params.append(message_id)
        self.conn.execute(
            f"UPDATE icm_messages SET {', '.join(sets)} WHERE message_id = ?",
            params,
        )
        self.conn.commit()

    @staticmethod
    def _row_to_message(row: sqlite3.Row) -> ICMMessage:
        return ICMMessage(
            message_id=row["message_id"],
            source_chain=row["source_chain"],
            dest_chain=row["dest_chain"],
            message_type=MessageType(row["message_type"]),
            sender=row["sender"],
            payload=json.loads(row["payload"]),
            status=MessageStatus(row["status"]),
            source_tx_hash=row["source_tx_hash"],
            dest_tx_hash=row["dest_tx_hash"],
            error=row["error"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
