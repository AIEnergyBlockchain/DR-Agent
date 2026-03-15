"""Authentication and authorization for DR Agent.

Supports two auth mechanisms:
  1. Legacy API key → role mapping (backward compatible)
  2. JWT token with role, actor_id, tenant_id claims

Roles:
  - operator: create/close events, settle, manage
  - participant: submit proofs, claim rewards
  - auditor: read-only audit access
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import jwt


# ---------------------------------------------------------------------------
# Role
# ---------------------------------------------------------------------------

class Role(Enum):
    OPERATOR = "operator"
    PARTICIPANT = "participant"
    AUDITOR = "auditor"

    @classmethod
    def from_string(cls, raw: str) -> Role:
        normalized = raw.strip().lower()
        for member in cls:
            if member.value == normalized:
                return member
        raise ValueError(
            f"unknown role: '{raw}'. Valid: {', '.join(m.value for m in cls)}"
        )

    def can_access(self, allowed_roles: set[str]) -> bool:
        return self.value in allowed_roles


# ---------------------------------------------------------------------------
# Token payload
# ---------------------------------------------------------------------------

@dataclass
class TokenPayload:
    actor_id: str
    role: Role
    tenant_id: Optional[str] = None


# ---------------------------------------------------------------------------
# JWT operations
# ---------------------------------------------------------------------------

_JWT_ALGORITHM = "HS256"


def create_token(
    actor_id: str,
    role: Role,
    secret: str,
    ttl_seconds: int = 3600,
    tenant_id: Optional[str] = None,
) -> str:
    now = int(time.time())
    payload = {
        "sub": actor_id,
        "role": role.value,
        "iat": now,
        "exp": now + ttl_seconds,
    }
    if tenant_id:
        payload["tenant_id"] = tenant_id
    return jwt.encode(payload, secret, algorithm=_JWT_ALGORITHM)


def decode_token(token: str, secret: str) -> TokenPayload:
    try:
        data = jwt.decode(token, secret, algorithms=[_JWT_ALGORITHM])
    except (jwt.InvalidTokenError, jwt.DecodeError, jwt.ExpiredSignatureError) as exc:
        raise ValueError(f"invalid token: {exc}") from exc

    return TokenPayload(
        actor_id=data["sub"],
        role=Role.from_string(data["role"]),
        tenant_id=data.get("tenant_id"),
    )


# ---------------------------------------------------------------------------
# AuthProvider
# ---------------------------------------------------------------------------

class AuthProvider:
    def __init__(
        self,
        api_key_map: dict[str, tuple[str, Role]] | None = None,
        jwt_secret: str | None = None,
    ):
        self._api_key_map = api_key_map or {}
        self._jwt_secret = jwt_secret

    def resolve_api_key(self, api_key: str) -> TokenPayload:
        entry = self._api_key_map.get(api_key)
        if entry is None:
            raise ValueError("invalid api key")
        actor_id, role = entry
        return TokenPayload(actor_id=actor_id, role=role)

    def resolve_jwt(self, token: str) -> TokenPayload:
        if not self._jwt_secret:
            raise ValueError("JWT not configured — set DR_JWT_SECRET")
        return decode_token(token, self._jwt_secret)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def resolve_auth() -> AuthProvider:
    api_key_map: dict[str, tuple[str, Role]] = {}

    op_key = os.getenv("DR_OPERATOR_API_KEY", "operator-key")
    pt_key = os.getenv("DR_PARTICIPANT_API_KEY", "participant-key")
    au_key = os.getenv("DR_AUDITOR_API_KEY", "auditor-key")

    if op_key:
        api_key_map[op_key] = ("operator", Role.OPERATOR)
    if pt_key:
        api_key_map[pt_key] = ("participant", Role.PARTICIPANT)
    if au_key:
        api_key_map[au_key] = ("auditor", Role.AUDITOR)

    jwt_secret = os.getenv("DR_JWT_SECRET")

    return AuthProvider(api_key_map=api_key_map, jwt_secret=jwt_secret)
