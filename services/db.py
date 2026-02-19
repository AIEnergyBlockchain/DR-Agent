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


def connect(db_path: str | None = None) -> sqlite3.Connection:
    path = db_path or os.getenv("DR_AGENT_DB", DEFAULT_DB_PATH)
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(target, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    return conn
