"""TDD tests for Docker configuration validation.

Validates that Dockerfile and docker-compose.yml are well-formed
and contain required service definitions.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


# ---------------------------------------------------------------------------
# Dockerfile validation
# ---------------------------------------------------------------------------

class TestDockerfile:
    @pytest.fixture
    def dockerfile(self) -> str:
        return (PROJECT_ROOT / "Dockerfile").read_text()

    def test_exists(self):
        assert (PROJECT_ROOT / "Dockerfile").exists()

    def test_multi_stage_build(self, dockerfile: str):
        assert "FROM node:" in dockerfile
        assert "FROM python:" in dockerfile

    def test_contracts_compilation(self, dockerfile: str):
        assert "hardhat compile" in dockerfile

    def test_api_server_cmd(self, dockerfile: str):
        assert "uvicorn" in dockerfile

    def test_healthcheck(self, dockerfile: str):
        assert "HEALTHCHECK" in dockerfile
        assert "/healthz" in dockerfile

    def test_exposes_port(self, dockerfile: str):
        assert "EXPOSE 8000" in dockerfile

    def test_copies_services(self, dockerfile: str):
        assert "COPY services/" in dockerfile

    def test_default_simulated_mode(self, dockerfile: str):
        assert "DR_CHAIN_MODE=simulated" in dockerfile


# ---------------------------------------------------------------------------
# docker-compose.yml validation
# ---------------------------------------------------------------------------

class TestDockerCompose:
    @pytest.fixture
    def compose(self) -> str:
        return (PROJECT_ROOT / "docker-compose.yml").read_text()

    def test_exists(self):
        assert (PROJECT_ROOT / "docker-compose.yml").exists()

    def test_api_service(self, compose: str):
        assert "api:" in compose

    def test_postgres_service(self, compose: str):
        assert "postgres:" in compose
        assert "postgres:16" in compose

    def test_redis_service(self, compose: str):
        assert "redis:" in compose

    def test_api_port_mapping(self, compose: str):
        assert "8000" in compose

    def test_pg_url_configured(self, compose: str):
        assert "DR_PG_URL=postgresql://" in compose

    def test_profiles_defined(self, compose: str):
        assert "postgres" in compose
        assert "full" in compose

    def test_volumes_defined(self, compose: str):
        assert "pg-data" in compose
        assert "api-cache" in compose

    def test_healthchecks(self, compose: str):
        assert "pg_isready" in compose
        assert "redis-cli" in compose


# ---------------------------------------------------------------------------
# .dockerignore validation
# ---------------------------------------------------------------------------

class TestDockerIgnore:
    @pytest.fixture
    def dockerignore(self) -> str:
        return (PROJECT_ROOT / ".dockerignore").read_text()

    def test_exists(self):
        assert (PROJECT_ROOT / ".dockerignore").exists()

    def test_ignores_node_modules(self, dockerignore: str):
        assert "node_modules" in dockerignore

    def test_ignores_venv(self, dockerignore: str):
        assert ".venv" in dockerignore

    def test_ignores_env_files(self, dockerignore: str):
        assert ".env" in dockerignore

    def test_keeps_env_example(self, dockerignore: str):
        assert "!.env.example" in dockerignore


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
