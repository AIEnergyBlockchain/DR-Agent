"""TDD tests for JWT authentication and RBAC authorization.

Tests the auth module that supports both legacy API key auth
and JWT token auth, with role-based access control.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.auth import (
    AuthProvider,
    Role,
    TokenPayload,
    create_token,
    decode_token,
    resolve_auth,
)


# ---------------------------------------------------------------------------
# Role enum
# ---------------------------------------------------------------------------

class TestRole:
    def test_operator(self):
        assert Role.OPERATOR.value == "operator"

    def test_participant(self):
        assert Role.PARTICIPANT.value == "participant"

    def test_auditor(self):
        assert Role.AUDITOR.value == "auditor"

    def test_from_string(self):
        assert Role.from_string("operator") == Role.OPERATOR
        assert Role.from_string("PARTICIPANT") == Role.PARTICIPANT

    def test_from_string_invalid_raises(self):
        with pytest.raises(ValueError, match="unknown role"):
            Role.from_string("admin")

    def test_can_access_operator_endpoints(self):
        assert Role.OPERATOR.can_access({"operator"})
        assert not Role.PARTICIPANT.can_access({"operator"})

    def test_can_access_multi_role(self):
        assert Role.OPERATOR.can_access({"operator", "participant"})
        assert Role.PARTICIPANT.can_access({"operator", "participant"})
        assert not Role.AUDITOR.can_access({"operator", "participant"})

    def test_can_access_any_role(self):
        assert Role.AUDITOR.can_access({"operator", "participant", "auditor"})


# ---------------------------------------------------------------------------
# JWT token creation and decoding
# ---------------------------------------------------------------------------

class TestJWTTokens:
    def test_create_token(self):
        token = create_token(
            actor_id="operator-1",
            role=Role.OPERATOR,
            secret="test-secret",
        )
        assert isinstance(token, str)
        assert len(token) > 0

    def test_decode_token(self):
        token = create_token(
            actor_id="site-a",
            role=Role.PARTICIPANT,
            secret="test-secret",
        )
        payload = decode_token(token, secret="test-secret")
        assert payload.actor_id == "site-a"
        assert payload.role == Role.PARTICIPANT

    def test_decode_invalid_token_raises(self):
        with pytest.raises(ValueError, match="invalid token"):
            decode_token("garbage.token.here", secret="test-secret")

    def test_decode_wrong_secret_raises(self):
        token = create_token("op-1", Role.OPERATOR, secret="correct")
        with pytest.raises(ValueError, match="invalid token"):
            decode_token(token, secret="wrong")

    def test_token_expiry(self):
        token = create_token(
            actor_id="op-1",
            role=Role.OPERATOR,
            secret="test-secret",
            ttl_seconds=1,
        )
        # Should work immediately
        payload = decode_token(token, secret="test-secret")
        assert payload.actor_id == "op-1"

    def test_token_payload_fields(self):
        token = create_token(
            actor_id="auditor-1",
            role=Role.AUDITOR,
            secret="s",
            tenant_id="drp-001",
        )
        payload = decode_token(token, secret="s")
        assert payload.actor_id == "auditor-1"
        assert payload.role == Role.AUDITOR
        assert payload.tenant_id == "drp-001"


# ---------------------------------------------------------------------------
# TokenPayload
# ---------------------------------------------------------------------------

class TestTokenPayload:
    def test_creation(self):
        p = TokenPayload(actor_id="a", role=Role.OPERATOR, tenant_id="t1")
        assert p.actor_id == "a"
        assert p.role == Role.OPERATOR
        assert p.tenant_id == "t1"

    def test_default_tenant(self):
        p = TokenPayload(actor_id="a", role=Role.PARTICIPANT)
        assert p.tenant_id is None


# ---------------------------------------------------------------------------
# AuthProvider — unified resolution
# ---------------------------------------------------------------------------

class TestAuthProvider:
    def test_resolve_from_api_key(self):
        provider = AuthProvider(
            api_key_map={
                "op-key": ("operator-1", Role.OPERATOR),
                "part-key": ("site-a", Role.PARTICIPANT),
            }
        )
        result = provider.resolve_api_key("op-key")
        assert result.actor_id == "operator-1"
        assert result.role == Role.OPERATOR

    def test_resolve_invalid_api_key_raises(self):
        provider = AuthProvider(api_key_map={})
        with pytest.raises(ValueError, match="invalid api key"):
            provider.resolve_api_key("bad-key")

    def test_resolve_from_jwt(self):
        secret = "jwt-secret"
        provider = AuthProvider(jwt_secret=secret)
        token = create_token("site-b", Role.PARTICIPANT, secret=secret)

        result = provider.resolve_jwt(token)
        assert result.actor_id == "site-b"
        assert result.role == Role.PARTICIPANT

    def test_resolve_jwt_without_secret_raises(self):
        provider = AuthProvider()
        with pytest.raises(ValueError, match="JWT not configured"):
            provider.resolve_jwt("some-token")


# ---------------------------------------------------------------------------
# resolve_auth factory
# ---------------------------------------------------------------------------

class TestResolveAuth:
    def test_default_creates_api_key_provider(self, monkeypatch):
        monkeypatch.setenv("DR_OPERATOR_API_KEY", "op-k")
        monkeypatch.setenv("DR_PARTICIPANT_API_KEY", "pt-k")
        monkeypatch.setenv("DR_AUDITOR_API_KEY", "au-k")
        monkeypatch.delenv("DR_JWT_SECRET", raising=False)

        provider = resolve_auth()
        result = provider.resolve_api_key("op-k")
        assert result.role == Role.OPERATOR

    def test_jwt_enabled_when_secret_set(self, monkeypatch):
        monkeypatch.setenv("DR_JWT_SECRET", "my-secret")
        monkeypatch.setenv("DR_OPERATOR_API_KEY", "op-k")
        monkeypatch.setenv("DR_PARTICIPANT_API_KEY", "pt-k")
        monkeypatch.setenv("DR_AUDITOR_API_KEY", "au-k")

        provider = resolve_auth()
        token = create_token("op-1", Role.OPERATOR, secret="my-secret")
        result = provider.resolve_jwt(token)
        assert result.actor_id == "op-1"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
