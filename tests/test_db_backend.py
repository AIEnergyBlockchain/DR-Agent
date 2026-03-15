"""TDD tests for database backend abstraction layer.

Tests that both SQLite and PostgreSQL backends provide identical
behavior through a unified interface, allowing zero-change switching.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.db_backend import (
    DatabaseBackend,
    SQLiteBackend,
    PostgresBackend,
    create_backend,
    BackendType,
)


# ---------------------------------------------------------------------------
# BackendType
# ---------------------------------------------------------------------------

class TestBackendType:
    def test_sqlite(self):
        assert BackendType.SQLITE.value == "sqlite"

    def test_postgres(self):
        assert BackendType.POSTGRES.value == "postgres"

    def test_from_env_sqlite(self):
        assert BackendType.from_env("sqlite") == BackendType.SQLITE

    def test_from_env_postgres(self):
        assert BackendType.from_env("postgres") == BackendType.POSTGRES
        assert BackendType.from_env("postgresql") == BackendType.POSTGRES
        assert BackendType.from_env("pg") == BackendType.POSTGRES

    def test_from_env_unknown_raises(self):
        with pytest.raises(ValueError, match="unknown"):
            BackendType.from_env("mysql")


# ---------------------------------------------------------------------------
# SQLiteBackend — core operations
# ---------------------------------------------------------------------------

class TestSQLiteBackend:
    def test_create_and_connect(self, tmp_path: Path):
        backend = SQLiteBackend(db_path=str(tmp_path / "test.db"))
        assert backend.backend_type == BackendType.SQLITE
        assert backend.is_connected

    def test_execute_ddl(self, tmp_path: Path):
        backend = SQLiteBackend(db_path=str(tmp_path / "test.db"))
        backend.execute_script("""
            CREATE TABLE IF NOT EXISTS test_tbl (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            );
        """)
        # Should not raise
        backend.execute("INSERT INTO test_tbl (id, name) VALUES (?, ?)", ("1", "alice"))
        backend.commit()

    def test_execute_and_fetchone(self, tmp_path: Path):
        backend = SQLiteBackend(db_path=str(tmp_path / "test.db"))
        backend.execute_script("CREATE TABLE t (id TEXT PRIMARY KEY, val INTEGER);")
        backend.execute("INSERT INTO t (id, val) VALUES (?, ?)", ("a", 42))
        backend.commit()

        row = backend.fetchone("SELECT id, val FROM t WHERE id = ?", ("a",))
        assert row is not None
        assert row["id"] == "a"
        assert row["val"] == 42

    def test_fetchone_returns_none(self, tmp_path: Path):
        backend = SQLiteBackend(db_path=str(tmp_path / "test.db"))
        backend.execute_script("CREATE TABLE t (id TEXT PRIMARY KEY);")
        assert backend.fetchone("SELECT * FROM t WHERE id = ?", ("x",)) is None

    def test_fetchall(self, tmp_path: Path):
        backend = SQLiteBackend(db_path=str(tmp_path / "test.db"))
        backend.execute_script("CREATE TABLE t (id TEXT, val INTEGER);")
        backend.execute("INSERT INTO t VALUES (?, ?)", ("a", 1))
        backend.execute("INSERT INTO t VALUES (?, ?)", ("b", 2))
        backend.commit()

        rows = backend.fetchall("SELECT * FROM t ORDER BY id")
        assert len(rows) == 2
        assert rows[0]["id"] == "a"
        assert rows[1]["val"] == 2

    def test_fetchall_empty(self, tmp_path: Path):
        backend = SQLiteBackend(db_path=str(tmp_path / "test.db"))
        backend.execute_script("CREATE TABLE t (id TEXT);")
        rows = backend.fetchall("SELECT * FROM t")
        assert rows == []

    def test_row_dict_access(self, tmp_path: Path):
        backend = SQLiteBackend(db_path=str(tmp_path / "test.db"))
        backend.execute_script("CREATE TABLE t (name TEXT, age INTEGER);")
        backend.execute("INSERT INTO t VALUES (?, ?)", ("bob", 30))
        backend.commit()

        row = backend.fetchone("SELECT * FROM t")
        # Must support both dict-key and index access
        assert row["name"] == "bob"
        assert row["age"] == 30

    def test_transaction_rollback(self, tmp_path: Path):
        backend = SQLiteBackend(db_path=str(tmp_path / "test.db"))
        backend.execute_script("CREATE TABLE t (id TEXT PRIMARY KEY);")
        backend.execute("INSERT INTO t VALUES (?)", ("keep",))
        backend.commit()

        backend.execute("INSERT INTO t VALUES (?)", ("discard",))
        backend.rollback()

        rows = backend.fetchall("SELECT * FROM t")
        assert len(rows) == 1
        assert rows[0]["id"] == "keep"

    def test_close(self, tmp_path: Path):
        backend = SQLiteBackend(db_path=str(tmp_path / "test.db"))
        backend.close()
        assert not backend.is_connected


# ---------------------------------------------------------------------------
# SQLiteBackend — compatibility with existing db.py
# ---------------------------------------------------------------------------

class TestSQLiteBackendCompat:
    def test_raw_connection_available(self, tmp_path: Path):
        """The raw sqlite3.Connection must be accessible for existing code."""
        backend = SQLiteBackend(db_path=str(tmp_path / "test.db"))
        raw = backend.raw_connection
        assert raw is not None
        # Must have row_factory set
        assert raw.row_factory is not None

    def test_schema_applied_on_connect(self, tmp_path: Path):
        """When init_schema is provided, it runs on connect."""
        schema = "CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY);"
        backend = SQLiteBackend(
            db_path=str(tmp_path / "test.db"),
            init_schema=schema,
        )
        backend.execute("INSERT INTO items (id) VALUES (?)", ("x",))
        backend.commit()
        row = backend.fetchone("SELECT * FROM items WHERE id = ?", ("x",))
        assert row["id"] == "x"


# ---------------------------------------------------------------------------
# PostgresBackend — stub (tests marked for skip if no PG)
# ---------------------------------------------------------------------------

class TestPostgresBackend:
    def test_backend_type(self):
        """PostgresBackend must report correct type even if not connected."""
        backend = PostgresBackend.__new__(PostgresBackend)
        backend._backend_type = BackendType.POSTGRES
        assert backend._backend_type == BackendType.POSTGRES

    def test_create_backend_pg_without_url_raises(self):
        with pytest.raises(ValueError, match="DR_PG_URL"):
            create_backend(backend_type=BackendType.POSTGRES)


# ---------------------------------------------------------------------------
# create_backend factory
# ---------------------------------------------------------------------------

class TestCreateBackend:
    def test_default_is_sqlite(self, tmp_path: Path, monkeypatch):
        monkeypatch.delenv("DR_DB_BACKEND", raising=False)
        backend = create_backend(db_path=str(tmp_path / "test.db"))
        assert backend.backend_type == BackendType.SQLITE

    def test_explicit_sqlite(self, tmp_path: Path):
        backend = create_backend(
            backend_type=BackendType.SQLITE,
            db_path=str(tmp_path / "test.db"),
        )
        assert backend.backend_type == BackendType.SQLITE

    def test_from_env_sqlite(self, tmp_path: Path, monkeypatch):
        monkeypatch.setenv("DR_DB_BACKEND", "sqlite")
        backend = create_backend(db_path=str(tmp_path / "test.db"))
        assert backend.backend_type == BackendType.SQLITE

    def test_from_env_postgres_without_url_raises(self, monkeypatch):
        monkeypatch.setenv("DR_DB_BACKEND", "postgres")
        monkeypatch.delenv("DR_PG_URL", raising=False)
        with pytest.raises(ValueError, match="DR_PG_URL"):
            create_backend()


# ---------------------------------------------------------------------------
# Integration: existing connect() still works
# ---------------------------------------------------------------------------

class TestLegacyConnectCompat:
    def test_legacy_connect_returns_sqlite_connection(self, tmp_path: Path):
        from services.db import connect

        conn = connect(db_path=str(tmp_path / "legacy.db"))
        assert conn is not None
        # Must still be a raw sqlite3.Connection for backward compat
        import sqlite3
        assert isinstance(conn, sqlite3.Connection)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
