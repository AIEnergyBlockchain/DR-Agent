"""DTO schemas for DR Agent API and service layer."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class EventCreateRequest(BaseModel):
    event_id: str
    start_time: datetime
    end_time: datetime
    target_kw: int = Field(ge=0)
    reward_rate: int = Field(ge=0)
    penalty_rate: int = Field(ge=0)


class ProofSubmitRequest(BaseModel):
    event_id: str
    site_id: str
    baseline_kwh: int = Field(ge=0)
    actual_kwh: int = Field(ge=0)
    uri: str
    raw_payload: dict[str, Any] | None = None
    proof_hash: str | None = None
    baseline_method: Literal["simple", "prophet"] = "simple"


class SettleRequest(BaseModel):
    site_ids: list[str] = Field(default_factory=list)


class EventDTO(BaseModel):
    event_id: str
    start_time: str
    end_time: str
    target_kw: int
    reward_rate: int
    penalty_rate: int
    status: Literal["active", "closed", "settled"]


class ProofDTO(BaseModel):
    event_id: str
    site_id: str
    baseline_kwh: int
    actual_kwh: int
    reduction_kwh: int
    proof_hash: str
    uri: str
    submitted_at: str


class SettlementDTO(BaseModel):
    event_id: str
    site_id: str
    payout: int
    status: Literal["settled", "claimed"]
    settled_at: str
    tx_hash: str


class AuditDTO(BaseModel):
    event_id: str
    site_id: str
    proof_hash_onchain: str
    proof_hash_recomputed: str
    match: bool
    raw_uri: str


class JudgeSummaryDTO(BaseModel):
    event_id: str
    network_mode: str
    event_status: str
    current_step: str
    health: Literal["pending", "in-progress", "done", "error"]
    blocking_reason: str
    progress_completed: int = Field(ge=0)
    progress_total: int = Field(ge=1)
    progress_pct: int = Field(ge=0, le=100)
    proof_submitted: int = Field(ge=0)
    proof_required: int = Field(ge=1)
    total_reduction_kwh: int
    total_payout_drt: int
    claim_site_a_status: str
    audit_requested: bool
    audit_match: bool | None = None
    last_transition_at: str | None = None
    created_at: str | None = None
    closed_at: str | None = None
    settled_at: str | None = None
    agent_hint: str


class ErrorEnvelope(BaseModel):
    code: str
    message: str
    trace_id: str
    retryable: bool = False
    details: dict[str, Any] = Field(default_factory=dict)
