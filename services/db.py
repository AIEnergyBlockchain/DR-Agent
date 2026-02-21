"""SQLite persistence for DR Agent MVP."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = "cache/dr_agent.db"


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    target_kw INTEGER NOT NULL,
    reward_rate INTEGER NOT NULL,
    penalty_rate INTEGER NOT NULL,
    status TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    tx_fee_wei TEXT,
    tx_state TEXT,
    tx_submitted_at TEXT,
    tx_confirmed_at TEXT,
    tx_error TEXT,
    close_tx_hash TEXT,
    close_tx_fee_wei TEXT,
    close_tx_state TEXT,
    close_tx_submitted_at TEXT,
    close_tx_confirmed_at TEXT,
    close_tx_error TEXT,
    created_at TEXT NOT NULL,
    closed_at TEXT,
    settled_at TEXT
);

CREATE TABLE IF NOT EXISTS proofs (
    event_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    baseline_kwh INTEGER NOT NULL,
    actual_kwh INTEGER NOT NULL,
    reduction_kwh INTEGER NOT NULL,
    proof_hash TEXT NOT NULL,
    uri TEXT NOT NULL,
    payload TEXT NOT NULL,
    baseline_method TEXT NOT NULL,
    tx_hash TEXT,
    tx_fee_wei TEXT,
    tx_state TEXT,
    tx_submitted_at TEXT,
    tx_confirmed_at TEXT,
    tx_error TEXT,
    submitter TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    PRIMARY KEY (event_id, site_id)
);

CREATE TABLE IF NOT EXISTS settlements (
    event_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    payout INTEGER NOT NULL,
    status TEXT NOT NULL,
    settled_at TEXT NOT NULL,
    claimed_at TEXT,
    tx_hash TEXT NOT NULL,
    tx_fee_wei TEXT,
    tx_state TEXT,
    tx_submitted_at TEXT,
    tx_confirmed_at TEXT,
    tx_error TEXT,
    claim_tx_hash TEXT,
    claim_tx_fee_wei TEXT,
    claim_tx_state TEXT,
    claim_tx_submitted_at TEXT,
    claim_tx_confirmed_at TEXT,
    claim_tx_error TEXT,
    PRIMARY KEY (event_id, site_id)
);

CREATE TABLE IF NOT EXISTS audits (
    event_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    requested_at TEXT NOT NULL,
    PRIMARY KEY (event_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_proofs_event ON proofs(event_id);
CREATE INDEX IF NOT EXISTS idx_settlements_event ON settlements(event_id);
CREATE INDEX IF NOT EXISTS idx_audits_event ON audits(event_id);
"""


def _column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(row[1] == column for row in rows)


def _apply_schema_migrations(conn: sqlite3.Connection) -> None:
    migrations: list[tuple[str, str, str]] = [
        ("events", "close_tx_hash", "ALTER TABLE events ADD COLUMN close_tx_hash TEXT"),
        ("events", "tx_fee_wei", "ALTER TABLE events ADD COLUMN tx_fee_wei TEXT"),
        (
            "events",
            "close_tx_fee_wei",
            "ALTER TABLE events ADD COLUMN close_tx_fee_wei TEXT",
        ),
        ("events", "tx_state", "ALTER TABLE events ADD COLUMN tx_state TEXT"),
        (
            "events",
            "tx_submitted_at",
            "ALTER TABLE events ADD COLUMN tx_submitted_at TEXT",
        ),
        (
            "events",
            "tx_confirmed_at",
            "ALTER TABLE events ADD COLUMN tx_confirmed_at TEXT",
        ),
        ("events", "tx_error", "ALTER TABLE events ADD COLUMN tx_error TEXT"),
        (
            "events",
            "close_tx_state",
            "ALTER TABLE events ADD COLUMN close_tx_state TEXT",
        ),
        (
            "events",
            "close_tx_submitted_at",
            "ALTER TABLE events ADD COLUMN close_tx_submitted_at TEXT",
        ),
        (
            "events",
            "close_tx_confirmed_at",
            "ALTER TABLE events ADD COLUMN close_tx_confirmed_at TEXT",
        ),
        (
            "events",
            "close_tx_error",
            "ALTER TABLE events ADD COLUMN close_tx_error TEXT",
        ),
        ("proofs", "tx_hash", "ALTER TABLE proofs ADD COLUMN tx_hash TEXT"),
        ("proofs", "tx_fee_wei", "ALTER TABLE proofs ADD COLUMN tx_fee_wei TEXT"),
        ("proofs", "tx_state", "ALTER TABLE proofs ADD COLUMN tx_state TEXT"),
        (
            "proofs",
            "tx_submitted_at",
            "ALTER TABLE proofs ADD COLUMN tx_submitted_at TEXT",
        ),
        (
            "proofs",
            "tx_confirmed_at",
            "ALTER TABLE proofs ADD COLUMN tx_confirmed_at TEXT",
        ),
        ("proofs", "tx_error", "ALTER TABLE proofs ADD COLUMN tx_error TEXT"),
        (
            "settlements",
            "claim_tx_hash",
            "ALTER TABLE settlements ADD COLUMN claim_tx_hash TEXT",
        ),
        (
            "settlements",
            "tx_fee_wei",
            "ALTER TABLE settlements ADD COLUMN tx_fee_wei TEXT",
        ),
        (
            "settlements",
            "claim_tx_fee_wei",
            "ALTER TABLE settlements ADD COLUMN claim_tx_fee_wei TEXT",
        ),
        (
            "settlements",
            "tx_state",
            "ALTER TABLE settlements ADD COLUMN tx_state TEXT",
        ),
        (
            "settlements",
            "tx_submitted_at",
            "ALTER TABLE settlements ADD COLUMN tx_submitted_at TEXT",
        ),
        (
            "settlements",
            "tx_confirmed_at",
            "ALTER TABLE settlements ADD COLUMN tx_confirmed_at TEXT",
        ),
        (
            "settlements",
            "tx_error",
            "ALTER TABLE settlements ADD COLUMN tx_error TEXT",
        ),
        (
            "settlements",
            "claim_tx_state",
            "ALTER TABLE settlements ADD COLUMN claim_tx_state TEXT",
        ),
        (
            "settlements",
            "claim_tx_submitted_at",
            "ALTER TABLE settlements ADD COLUMN claim_tx_submitted_at TEXT",
        ),
        (
            "settlements",
            "claim_tx_confirmed_at",
            "ALTER TABLE settlements ADD COLUMN claim_tx_confirmed_at TEXT",
        ),
        (
            "settlements",
            "claim_tx_error",
            "ALTER TABLE settlements ADD COLUMN claim_tx_error TEXT",
        ),
    ]
    for table, column, sql in migrations:
        if not _column_exists(conn, table, column):
            conn.execute(sql)
    conn.commit()


def _backfill_tx_metadata(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        UPDATE events
        SET tx_state = CASE
            WHEN tx_hash IS NULL THEN tx_state
            WHEN tx_state IS NULL THEN CASE WHEN tx_fee_wei IS NOT NULL THEN 'confirmed' ELSE 'submitted' END
            ELSE tx_state
        END;
        UPDATE events
        SET tx_submitted_at = COALESCE(tx_submitted_at, created_at)
        WHERE tx_hash IS NOT NULL;
        UPDATE events
        SET tx_confirmed_at = COALESCE(tx_confirmed_at, created_at)
        WHERE tx_hash IS NOT NULL AND tx_state = 'confirmed' AND tx_confirmed_at IS NULL;

        UPDATE events
        SET close_tx_state = CASE
            WHEN close_tx_hash IS NULL THEN close_tx_state
            WHEN close_tx_state IS NULL THEN CASE WHEN close_tx_fee_wei IS NOT NULL THEN 'confirmed' ELSE 'submitted' END
            ELSE close_tx_state
        END;
        UPDATE events
        SET close_tx_submitted_at = COALESCE(close_tx_submitted_at, closed_at)
        WHERE close_tx_hash IS NOT NULL;
        UPDATE events
        SET close_tx_confirmed_at = COALESCE(close_tx_confirmed_at, closed_at)
        WHERE close_tx_hash IS NOT NULL AND close_tx_state = 'confirmed' AND close_tx_confirmed_at IS NULL;

        UPDATE proofs
        SET tx_state = CASE
            WHEN tx_hash IS NULL THEN tx_state
            WHEN tx_state IS NULL THEN CASE WHEN tx_fee_wei IS NOT NULL THEN 'confirmed' ELSE 'submitted' END
            ELSE tx_state
        END;
        UPDATE proofs
        SET tx_submitted_at = COALESCE(tx_submitted_at, submitted_at)
        WHERE tx_hash IS NOT NULL;
        UPDATE proofs
        SET tx_confirmed_at = COALESCE(tx_confirmed_at, submitted_at)
        WHERE tx_hash IS NOT NULL AND tx_state = 'confirmed' AND tx_confirmed_at IS NULL;

        UPDATE settlements
        SET tx_state = CASE
            WHEN tx_hash IS NULL THEN tx_state
            WHEN tx_state IS NULL THEN CASE WHEN tx_fee_wei IS NOT NULL THEN 'confirmed' ELSE 'submitted' END
            ELSE tx_state
        END;
        UPDATE settlements
        SET tx_submitted_at = COALESCE(tx_submitted_at, settled_at)
        WHERE tx_hash IS NOT NULL;
        UPDATE settlements
        SET tx_confirmed_at = COALESCE(tx_confirmed_at, settled_at)
        WHERE tx_hash IS NOT NULL AND tx_state = 'confirmed' AND tx_confirmed_at IS NULL;

        UPDATE settlements
        SET claim_tx_state = CASE
            WHEN claim_tx_hash IS NULL THEN claim_tx_state
            WHEN claim_tx_state IS NULL THEN CASE WHEN claim_tx_fee_wei IS NOT NULL THEN 'confirmed' ELSE 'submitted' END
            ELSE claim_tx_state
        END;
        UPDATE settlements
        SET claim_tx_submitted_at = COALESCE(claim_tx_submitted_at, claimed_at)
        WHERE claim_tx_hash IS NOT NULL;
        UPDATE settlements
        SET claim_tx_confirmed_at = COALESCE(claim_tx_confirmed_at, claimed_at)
        WHERE claim_tx_hash IS NOT NULL AND claim_tx_state = 'confirmed' AND claim_tx_confirmed_at IS NULL;
        """
    )
    conn.commit()


def connect(db_path: str | None = None) -> sqlite3.Connection:
    path = db_path or os.getenv("DR_AGENT_DB", DEFAULT_DB_PATH)
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(target, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    _apply_schema_migrations(conn)
    _backfill_tx_metadata(conn)
    conn.commit()
    return conn
