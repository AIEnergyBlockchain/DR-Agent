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


class BridgeTransferCreateRequest(BaseModel):
    sender: str
    amount_wei: str
    direction: Literal["home_to_remote", "remote_to_home"]


class BridgeSourceSubmittedRequest(BaseModel):
    source_tx_hash: str


class BridgeDestSubmittedRequest(BaseModel):
    dest_tx_hash: str


class BridgeSendTokensRequest(BaseModel):
    amount_wei: str


class BridgeReceiveTokensRequest(BaseModel):
    source_nonce: int
    recipient: str
    amount_wei: str
    source_chain_id: str


class ICMMessageCreateRequest(BaseModel):
    source_chain: str
    dest_chain: str
    message_type: Literal["bridge_transfer", "settlement_sync", "proof_attestation"]
    sender: str
    payload: dict[str, Any]


class ICMSentRequest(BaseModel):
    tx_hash: str


class ICMDeliveredRequest(BaseModel):
    dest_tx_hash: str


class ICMFailedRequest(BaseModel):
    error: str


class ICMProcessOnchainRequest(BaseModel):
    success: bool = True


class EventDTO(BaseModel):
    event_id: str
    start_time: str
    end_time: str
    target_kw: int
    reward_rate: int
    penalty_rate: int
    status: Literal["active", "closed", "settled"]
    tx_hash: str | None = None
    tx_fee_wei: str | None = None
    tx_state: Literal["submitted", "confirmed", "failed"] | None = None
    tx_submitted_at: str | None = None
    tx_confirmed_at: str | None = None
    tx_error: str | None = None
    close_tx_hash: str | None = None
    close_tx_fee_wei: str | None = None
    close_tx_state: Literal["submitted", "confirmed", "failed"] | None = None
    close_tx_submitted_at: str | None = None
    close_tx_confirmed_at: str | None = None
    close_tx_error: str | None = None


class ProofDTO(BaseModel):
    event_id: str
    site_id: str
    baseline_kwh: int
    actual_kwh: int
    reduction_kwh: int
    proof_hash: str
    uri: str
    submitted_at: str
    tx_hash: str | None = None
    tx_fee_wei: str | None = None
    tx_state: Literal["submitted", "confirmed", "failed"] | None = None
    tx_submitted_at: str | None = None
    tx_confirmed_at: str | None = None
    tx_error: str | None = None


class SettlementDTO(BaseModel):
    event_id: str
    site_id: str
    payout: int
    status: Literal["settled", "claimed"]
    settled_at: str
    tx_hash: str
    tx_fee_wei: str | None = None
    tx_state: Literal["submitted", "confirmed", "failed"] | None = None
    tx_submitted_at: str | None = None
    tx_confirmed_at: str | None = None
    tx_error: str | None = None
    claim_tx_hash: str | None = None
    claim_tx_fee_wei: str | None = None
    claim_tx_state: Literal["submitted", "confirmed", "failed"] | None = None
    claim_tx_submitted_at: str | None = None
    claim_tx_confirmed_at: str | None = None
    claim_tx_error: str | None = None


class BridgeTransferDTO(BaseModel):
    transfer_id: str
    sender: str
    amount_wei: str
    direction: str
    status: str
    source_tx_hash: str | None = None
    dest_tx_hash: str | None = None
    created_at: str
    updated_at: str


class ICMMessageDTO(BaseModel):
    message_id: str
    source_chain: str
    dest_chain: str
    message_type: str
    sender: str
    payload: dict[str, Any]
    status: str
    source_tx_hash: str | None = None
    dest_tx_hash: str | None = None
    error: str | None = None
    created_at: str
    updated_at: str


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
    tx_pipeline_total: int = Field(ge=0)
    tx_pipeline_submitted: int = Field(ge=0)
    tx_pipeline_confirmed: int = Field(ge=0)
    tx_pipeline_failed: int = Field(ge=0)
    last_transition_at: str | None = None
    created_at: str | None = None
    closed_at: str | None = None
    settled_at: str | None = None
    agent_hint: str


class BridgeStatsDTO(BaseModel):
    total_transfers: int
    pending_count: int
    completed_count: int


class ICMStatsDTO(BaseModel):
    total_messages: int
    by_status: dict[str, int]
    by_type: dict[str, int]


class BaselineCompareRequest(BaseModel):
    history: list[dict[str, Any]]
    event_hour: int = Field(ge=0, le=23)


class BaselineResultDTO(BaseModel):
    baseline_kwh: float
    method: str
    confidence: float
    details: dict[str, Any]


class BaselineCompareResponse(BaseModel):
    results: list[BaselineResultDTO]
    recommended: BaselineResultDTO


class BaselineMethodsResponse(BaseModel):
    methods: list[str]


class DashboardSummaryDTO(BaseModel):
    chain_mode: str
    bridge: BridgeStatsDTO
    icm: ICMStatsDTO
    baseline_methods: list[str]


class AgentInsightRequest(BaseModel):
    event_id: str | None = None
    current_step: str = "create"
    proofs: list[dict[str, Any]] = Field(default_factory=list)
    baseline_result: dict[str, Any] | None = None
    settlement: dict[str, Any] | None = None
    tx_pipeline: list[dict[str, Any]] = Field(default_factory=list)
    lang: str = "en"


class AgentInsightResponse(BaseModel):
    headline: str
    reasoning: str
    confidence: float = Field(ge=0.0, le=1.0)
    suggested_action: str | None = None
    risk_flags: list[str] = Field(default_factory=list)
    data_points: dict[str, Any] = Field(default_factory=dict)


class AgentAnomalyRequest(BaseModel):
    proofs: list[dict[str, Any]]
    baseline_result: dict[str, Any] | None = None
    event_id: str | None = None


class AnomalyReport(BaseModel):
    has_anomaly: bool
    anomaly_type: str | None = None
    severity: Literal["info", "warning", "critical"] = "info"
    description: str = ""
    affected_proofs: list[str] = Field(default_factory=list)
    recommendation: str = ""


class AgentStatusResponse(BaseModel):
    status: Literal["active", "idle"] = "active"
    provider: str = "mock"
    total_analyses: int = 0
    total_anomalies_detected: int = 0


class ErrorEnvelope(BaseModel):
    code: str
    message: str
    trace_id: str
    retryable: bool = False
    details: dict[str, Any] = Field(default_factory=dict)
