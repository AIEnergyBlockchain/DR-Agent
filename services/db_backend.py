"""Database backend abstraction layer.

Provides a unified interface for SQLite and PostgreSQL backends,
allowing the system to switch between them via configuration.

Usage:
    backend = create_backend()  # reads DR_DB_BACKEND env var
    backend.execute("INSERT INTO t VALUES (?)", ("x",))
    row = backend.fetchone("SELECT * FROM t WHERE id = ?", ("x",))
    backend.commit()
"""

from __future__ import annotations

import os
import sqlite3
from enum import Enum
from pathlib import Path
from typing import Any, Protocol, Sequence


# ---------------------------------------------------------------------------
# Backend type
# ---------------------------------------------------------------------------

class BackendType(Enum):
    SQLITE = "sqlite"
    POSTGRES = "postgres"

    @classmethod
    def from_env(cls, raw: str) -> BackendType:
        normalized = raw.strip().lower()
        aliases = {
            "sqlite": cls.SQLITE,
            "postgres": cls.POSTGRES,
            "postgresql": cls.POSTGRES,
            "pg": cls.POSTGRES,
        }
        result = aliases.get(normalized)
        if result is None:
            raise ValueError(
                f"unknown database backend: '{raw}'. "
                f"Valid: {', '.join(aliases.keys())}"
            )
        return result


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------

class DatabaseBackend(Protocol):
    @property
    def backend_type(self) -> BackendType: ...

    @property
    def is_connected(self) -> bool: ...

    def execute(self, sql: str, params: Sequence[Any] = ()) -> None: ...

    def execute_script(self, sql: str) -> None: ...

    def fetchone(self, sql: str, params: Sequence[Any] = ()) -> dict[str, Any] | None: ...

    def fetchall(self, sql: str, params: Sequence[Any] = ()) -> list[dict[str, Any]]: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...

    def close(self) -> None: ...


# ---------------------------------------------------------------------------
# SQLite backend
# ---------------------------------------------------------------------------

class SQLiteBackend:
    def __init__(
        self,
        db_path: str | None = None,
        init_schema: str | None = None,
    ):
        path = db_path or "cache/dr_agent.db"
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)

        self._conn = sqlite3.connect(target, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._connected = True

        if init_schema:
            self._conn.executescript(init_schema)
            self._conn.commit()

    @property
    def backend_type(self) -> BackendType:
        return BackendType.SQLITE

    @property
    def is_connected(self) -> bool:
        return self._connected

    @property
    def raw_connection(self) -> sqlite3.Connection:
        return self._conn

    def execute(self, sql: str, params: Sequence[Any] = ()) -> None:
        self._conn.execute(sql, params)

    def execute_script(self, sql: str) -> None:
        self._conn.executescript(sql)

    def fetchone(
        self, sql: str, params: Sequence[Any] = ()
    ) -> dict[str, Any] | None:
        row = self._conn.execute(sql, params).fetchone()
        if row is None:
            return None
        return row  # sqlite3.Row supports dict-key access

    def fetchall(
        self, sql: str, params: Sequence[Any] = ()
    ) -> list[dict[str, Any]]:
        return self._conn.execute(sql, params).fetchall()

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()
        self._connected = False


# ---------------------------------------------------------------------------
# PostgreSQL backend (stub — requires psycopg2/psycopg)
# ---------------------------------------------------------------------------

class PostgresBackend:
    _backend_type = BackendType.POSTGRES

    def __init__(self, pg_url: str, init_schema: str | None = None):
        try:
            import psycopg2
            import psycopg2.extras
        except ImportError:
            raise ImportError(
                "psycopg2 is required for PostgreSQL backend. "
                "Install with: pip install psycopg2-binary"
            )

        self._conn = psycopg2.connect(pg_url)
        self._conn.autocommit = False
        self._connected = True

        if init_schema:
            with self._conn.cursor() as cur:
                cur.execute(init_schema)
            self._conn.commit()

    @property
    def backend_type(self) -> BackendType:
        return BackendType.POSTGRES

    @property
    def is_connected(self) -> bool:
        return self._connected

    def execute(self, sql: str, params: Sequence[Any] = ()) -> None:
        with self._conn.cursor() as cur:
            cur.execute(self._adapt_placeholders(sql), params)

    def execute_script(self, sql: str) -> None:
        with self._conn.cursor() as cur:
            cur.execute(sql)
        self._conn.commit()

    def fetchone(
        self, sql: str, params: Sequence[Any] = ()
    ) -> dict[str, Any] | None:
        import psycopg2.extras

        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(self._adapt_placeholders(sql), params)
            return cur.fetchone()

    def fetchall(
        self, sql: str, params: Sequence[Any] = ()
    ) -> list[dict[str, Any]]:
        import psycopg2.extras

        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(self._adapt_placeholders(sql), params)
            return cur.fetchall()

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()
        self._connected = False

    @staticmethod
    def _adapt_placeholders(sql: str) -> str:
        """Convert SQLite-style ? placeholders to PostgreSQL %s."""
        return sql.replace("?", "%s")


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def create_backend(
    backend_type: BackendType | None = None,
    db_path: str | None = None,
    pg_url: str | None = None,
    init_schema: str | None = None,
) -> SQLiteBackend | PostgresBackend:
    if backend_type is None:
        raw = os.getenv("DR_DB_BACKEND", "sqlite")
        backend_type = BackendType.from_env(raw)

    if backend_type == BackendType.SQLITE:
        return SQLiteBackend(db_path=db_path, init_schema=init_schema)

    if backend_type == BackendType.POSTGRES:
        url = pg_url or os.getenv("DR_PG_URL")
        if not url:
            raise ValueError(
                "DR_PG_URL is required when using PostgreSQL backend. "
                "Set DR_PG_URL=postgresql://user:pass@host:5432/dbname"
            )
        return PostgresBackend(pg_url=url, init_schema=init_schema)

    raise ValueError(f"unsupported backend: {backend_type}")
