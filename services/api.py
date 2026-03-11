"""FastAPI gateway for DR Agent MVP closed-loop flow."""

from __future__ import annotations

import os
import uuid
from typing import Callable

from fastapi import Body, Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import pandas as pd

from services.baseline_engine import BaselineEngine
from services.bridge import BridgeDirection, BridgeService
from services.dto import (
    AuditDTO,
    BaselineCompareRequest,
    BaselineCompareResponse,
    BaselineMethodsResponse,
    BaselineResultDTO,
    BridgeStatsDTO,
    BridgeTransferCreateRequest,
    BridgeSourceSubmittedRequest,
    BridgeDestSubmittedRequest,
    BridgeSendTokensRequest,
    BridgeReceiveTokensRequest,
    BridgeTransferDTO,
    DashboardSummaryDTO,
    ErrorEnvelope,
    EventCreateRequest,
    EventDTO,
    ICMMessageCreateRequest,
    ICMSentRequest,
    ICMDeliveredRequest,
    ICMFailedRequest,
    ICMProcessOnchainRequest,
    ICMMessageDTO,
    ICMStatsDTO,
    JudgeSummaryDTO,
    ProofDTO,
    ProofSubmitRequest,
    SettleRequest,
    SettlementDTO,
)
from services.icm import ICMService, MessageType
from services.submitter import ServiceError, SubmitterService


def _cors_origins() -> list[str]:
    configured = os.getenv("DR_CORS_ORIGINS", "").strip()
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return ["http://127.0.0.1:4173", "http://localhost:4173"]


def _role_map() -> dict[str, str]:
    return {
        os.getenv("DR_OPERATOR_API_KEY", "operator-key"): "operator",
        os.getenv("DR_PARTICIPANT_API_KEY", "participant-key"): "participant",
        os.getenv("DR_AUDITOR_API_KEY", "auditor-key"): "auditor",
    }


def _require_role(*roles: str) -> Callable:
    async def dependency(request: Request) -> str:
        api_key = request.headers.get("x-api-key", "")
        role = _role_map().get(api_key)
        if role is None:
            raise ServiceError(401, "UNAUTHORIZED", "invalid api key")
        if role not in roles:
            raise ServiceError(403, "FORBIDDEN", "insufficient role")
        return role

    return dependency


async def _actor_id(request: Request) -> str:
    return request.headers.get("x-actor-id", "anonymous")


async def _service(request: Request) -> SubmitterService:
    return request.app.state.submitter


async def _bridge_service(request: Request) -> BridgeService:
    return request.app.state.bridge


async def _icm_service(request: Request) -> ICMService:
    return request.app.state.icm


def _chain_mode() -> str:
    return os.getenv("DR_CHAIN_MODE", "simulated")


def _tx_confirm_mode() -> str:
    mode = os.getenv("DR_TX_CONFIRM_MODE", "hybrid").strip().lower()
    if mode in {"sync", "hybrid"}:
        return mode
    return "hybrid"


def _required_sites(chain_mode: str) -> list[str]:
    configured = os.getenv("DR_REQUIRED_SITES", "").strip()
    if configured:
        values = [value.strip() for value in configured.split(",") if value.strip()]
        if values:
            return values

    demo_site_mode = os.getenv("DR_DEMO_SITE_MODE", "").strip().lower()
    if demo_site_mode == "single":
        return ["site-a"]
    return ["site-a", "site-b"]


def _require_idempotency_key(request: Request) -> str:
    key = (request.headers.get("Idempotency-Key") or "").strip()
    if not key:
        raise ServiceError(400, "IDEMPOTENCY_REQUIRED", "Idempotency-Key header required")
    return key


def _bridge_to_dto(transfer) -> BridgeTransferDTO:
    return BridgeTransferDTO(
        transfer_id=transfer.transfer_id,
        sender=transfer.sender,
        amount_wei=transfer.amount_wei,
        direction=transfer.direction.value,
        status=transfer.status,
        source_tx_hash=transfer.source_tx_hash,
        dest_tx_hash=transfer.dest_tx_hash,
        created_at=transfer.created_at,
        updated_at=transfer.updated_at,
    )


def _icm_to_dto(message) -> ICMMessageDTO:
    return ICMMessageDTO(
        message_id=message.message_id,
        source_chain=message.source_chain,
        dest_chain=message.dest_chain,
        message_type=message.message_type.value,
        sender=message.sender,
        payload=message.payload,
        status=message.status.value,
        source_tx_hash=message.source_tx_hash,
        dest_tx_hash=message.dest_tx_hash,
        error=message.error,
        created_at=message.created_at,
        updated_at=message.updated_at,
    )


def _bridge_status_order(status: str) -> int:
    order = {
        "initiated": 0,
        "source_submitted": 1,
        "source_confirmed": 2,
        "dest_submitted": 3,
        "completed": 4,
    }
    return order.get(status, -1)


def _icm_status_order(status: str) -> int:
    order = {
        "pending": 0,
        "sent": 1,
        "delivered": 2,
        "processed": 3,
        "failed": 4,
    }
    return order.get(status, -1)


def create_app(db_path: str | None = None) -> FastAPI:
    app = FastAPI(title="DR Agent API", version="0.1.0")
    app.state.submitter = SubmitterService(db_path=db_path)
    app.state.bridge = BridgeService(db_path=db_path)
    app.state.icm = ICMService(db_path=db_path)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def trace_middleware(request: Request, call_next):
        trace_id = request.headers.get("x-trace-id") or uuid.uuid4().hex
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers["x-trace-id"] = trace_id
        return response

    @app.exception_handler(ServiceError)
    async def service_error_handler(request: Request, exc: ServiceError):
        envelope = ErrorEnvelope(
            code=exc.code,
            message=exc.message,
            trace_id=getattr(request.state, "trace_id", "unknown"),
            retryable=exc.retryable,
            details=exc.details,
        )
        payload = (
            envelope.model_dump()
            if hasattr(envelope, "model_dump")
            else envelope.dict()
        )
        return JSONResponse(status_code=exc.status_code, content=payload)

    @app.get("/")
    async def root():
        return {
            "service": "dr-agent-api",
            "status": "ok",
            "docs": "/docs",
            "healthz": "/healthz",
        }

    @app.get("/healthz")
    async def healthz():
        mode = _chain_mode()
        return {
            "status": "ok",
            "mode": mode,
            "tx_confirm_mode": _tx_confirm_mode(),
            "demo_site_mode": os.getenv("DR_DEMO_SITE_MODE", "dual"),
            "required_sites": _required_sites(mode),
        }

    @app.post("/events", response_model=EventDTO)
    async def create_event(
        payload: EventCreateRequest,
        _role: str = Depends(_require_role("operator")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.create_event(payload)

    @app.post("/events/{event_id}/close", response_model=EventDTO)
    async def close_event(
        event_id: str,
        _role: str = Depends(_require_role("operator")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.close_event(event_id)

    @app.post("/proofs", response_model=ProofDTO)
    async def submit_proof(
        payload: ProofSubmitRequest,
        _role: str = Depends(_require_role("participant", "operator")),
        actor_id: str = Depends(_actor_id),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.submit_proof(payload, actor_id=actor_id)

    @app.post("/settle/{event_id}", response_model=list[SettlementDTO])
    async def settle_event(
        event_id: str,
        payload: SettleRequest = Body(default_factory=SettleRequest),
        _role: str = Depends(_require_role("operator")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.settle_event(event_id=event_id, site_ids=payload.site_ids)

    @app.post("/claim/{event_id}/{site_id}", response_model=SettlementDTO)
    async def claim_reward(
        event_id: str,
        site_id: str,
        _role: str = Depends(_require_role("participant", "operator")),
        actor_id: str = Depends(_actor_id),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.claim_reward(event_id=event_id, site_id=site_id, actor_id=actor_id)

    @app.get("/events/{event_id}", response_model=EventDTO)
    async def get_event(
        event_id: str,
        _role: str = Depends(_require_role("operator", "participant", "auditor")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.get_event(event_id)

    @app.get("/events/{event_id}/records", response_model=list[SettlementDTO])
    async def get_records(
        event_id: str,
        _role: str = Depends(_require_role("operator", "auditor")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.list_settlements(event_id)

    @app.get("/audit/{event_id}/{site_id}", response_model=AuditDTO)
    async def get_audit(
        event_id: str,
        site_id: str,
        _role: str = Depends(_require_role("operator", "auditor")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.get_audit(event_id, site_id)

    @app.get("/system/chain-mode")
    async def get_chain_mode(
        _role: str = Depends(_require_role("operator", "participant", "auditor")),
    ):
        mode = _chain_mode()
        return {
            "mode": mode,
            "tx_confirm_mode": _tx_confirm_mode(),
            "demo_site_mode": os.getenv("DR_DEMO_SITE_MODE", "dual"),
            "required_sites": _required_sites(mode),
        }

    @app.get("/judge/{event_id}/summary", response_model=JudgeSummaryDTO)
    async def get_judge_summary(
        event_id: str,
        _role: str = Depends(_require_role("operator", "participant", "auditor")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.get_judge_summary(event_id=event_id, network_mode=_chain_mode())

    @app.post("/v1/bridge/transfers", response_model=BridgeTransferDTO)
    async def create_bridge_transfer(
        payload: BridgeTransferCreateRequest,
        _role: str = Depends(_require_role("operator")),
        idem_key: str = Depends(_require_idempotency_key),
        svc: BridgeService = Depends(_bridge_service),
    ):
        direction = BridgeDirection(payload.direction)
        existing = svc.get_by_idempotency(idem_key)
        if existing:
            if (
                existing.sender != payload.sender
                or existing.amount_wei != payload.amount_wei
                or existing.direction != direction
            ):
                raise ServiceError(
                    409,
                    "IDEMPOTENCY_CONFLICT",
                    "Idempotency-Key already used with different payload",
                )
            return _bridge_to_dto(existing)
        transfer = svc.initiate_transfer(
            sender=payload.sender,
            amount_wei=payload.amount_wei,
            direction=direction,
            idempotency_key=idem_key,
        )
        return _bridge_to_dto(transfer)

    @app.get("/v1/bridge/transfers/pending", response_model=list[BridgeTransferDTO])
    async def list_pending_bridge_transfers(
        _role: str = Depends(_require_role("operator")),
        svc: BridgeService = Depends(_bridge_service),
    ):
        return [_bridge_to_dto(t) for t in svc.list_pending_transfers()]

    @app.post(
        "/v1/bridge/transfers/{transfer_id}/source-submitted",
        response_model=BridgeTransferDTO,
    )
    async def mark_bridge_source_submitted(
        transfer_id: str,
        payload: BridgeSourceSubmittedRequest,
        _role: str = Depends(_require_role("operator")),
        _idem: str = Depends(_require_idempotency_key),
        svc: BridgeService = Depends(_bridge_service),
    ):
        transfer = svc.get_transfer(transfer_id)
        if not transfer:
            raise ServiceError(404, "BRIDGE_TRANSFER_NOT_FOUND", "bridge transfer not found")
        if transfer.source_tx_hash and transfer.source_tx_hash != payload.source_tx_hash:
            raise ServiceError(
                409,
                "IDEMPOTENCY_CONFLICT",
                "source tx hash already set to a different value",
            )
        if _bridge_status_order(transfer.status) >= _bridge_status_order("source_submitted"):
            return _bridge_to_dto(transfer)
        updated = svc.mark_source_submitted(transfer_id, payload.source_tx_hash)
        return _bridge_to_dto(updated)

    @app.post(
        "/v1/bridge/transfers/{transfer_id}/send-tokens",
        response_model=BridgeTransferDTO,
    )
    async def send_bridge_tokens(
        transfer_id: str,
        payload: BridgeSendTokensRequest,
        _role: str = Depends(_require_role("operator")),
        _idem: str = Depends(_require_idempotency_key),
        svc: BridgeService = Depends(_bridge_service),
    ):
        transfer = svc.get_transfer(transfer_id)
        if not transfer:
            raise ServiceError(404, "BRIDGE_TRANSFER_NOT_FOUND", "bridge transfer not found")
        if transfer.status != "initiated":
            return _bridge_to_dto(transfer)
        try:
            tx_out = svc.send_bridge_tokens(transfer_id, payload.amount_wei)
            tx_hash = tx_out.get("tx_hash")
            if not tx_hash:
                raise ServiceError(
                    502, "BRIDGE_TX_FAILED", "bridge send_tokens missing tx_hash"
                )
            updated = svc.mark_source_submitted(transfer_id, str(tx_hash))
            return _bridge_to_dto(updated)
        except RuntimeError as exc:
            raise ServiceError(502, "BRIDGE_TX_FAILED", str(exc)) from exc

    @app.post(
        "/v1/bridge/transfers/{transfer_id}/source-confirmed",
        response_model=BridgeTransferDTO,
    )
    async def mark_bridge_source_confirmed(
        transfer_id: str,
        _role: str = Depends(_require_role("operator")),
        _idem: str = Depends(_require_idempotency_key),
        svc: BridgeService = Depends(_bridge_service),
    ):
        transfer = svc.get_transfer(transfer_id)
        if not transfer:
            raise ServiceError(404, "BRIDGE_TRANSFER_NOT_FOUND", "bridge transfer not found")
        if _bridge_status_order(transfer.status) >= _bridge_status_order("source_confirmed"):
            return _bridge_to_dto(transfer)
        updated = svc.mark_source_confirmed(transfer_id)
        return _bridge_to_dto(updated)

    @app.post(
        "/v1/bridge/transfers/{transfer_id}/dest-submitted",
        response_model=BridgeTransferDTO,
    )
    async def mark_bridge_dest_submitted(
        transfer_id: str,
        payload: BridgeDestSubmittedRequest,
        _role: str = Depends(_require_role("operator")),
        _idem: str = Depends(_require_idempotency_key),
        svc: BridgeService = Depends(_bridge_service),
    ):
        transfer = svc.get_transfer(transfer_id)
        if not transfer:
            raise ServiceError(404, "BRIDGE_TRANSFER_NOT_FOUND", "bridge transfer not found")
        if transfer.dest_tx_hash and transfer.dest_tx_hash != payload.dest_tx_hash:
            raise ServiceError(
                409,
                "IDEMPOTENCY_CONFLICT",
                "dest tx hash already set to a different value",
            )
        if _bridge_status_order(transfer.status) >= _bridge_status_order("dest_submitted"):
            return _bridge_to_dto(transfer)
        updated = svc.mark_dest_submitted(transfer_id, payload.dest_tx_hash)
        return _bridge_to_dto(updated)

    @app.post(
        "/v1/bridge/transfers/{transfer_id}/receive-tokens",
        response_model=BridgeTransferDTO,
    )
    async def receive_bridge_tokens(
        transfer_id: str,
        payload: BridgeReceiveTokensRequest,
        _role: str = Depends(_require_role("operator")),
        _idem: str = Depends(_require_idempotency_key),
        svc: BridgeService = Depends(_bridge_service),
    ):
        transfer = svc.get_transfer(transfer_id)
        if not transfer:
            raise ServiceError(404, "BRIDGE_TRANSFER_NOT_FOUND", "bridge transfer not found")
        if transfer.status not in {"source_confirmed", "dest_submitted"}:
            return _bridge_to_dto(transfer)
        try:
            tx_out = svc.receive_bridge_tokens(
                transfer_id,
                payload.source_nonce,
                payload.recipient,
                payload.amount_wei,
                payload.source_chain_id,
            )
            tx_hash = tx_out.get("tx_hash")
            if not tx_hash:
                raise ServiceError(
                    502, "BRIDGE_TX_FAILED", "bridge receive_tokens missing tx_hash"
                )
            updated = svc.mark_dest_submitted(transfer_id, str(tx_hash))
            return _bridge_to_dto(updated)
        except RuntimeError as exc:
            raise ServiceError(502, "BRIDGE_TX_FAILED", str(exc)) from exc

    @app.post(
        "/v1/bridge/transfers/{transfer_id}/completed",
        response_model=BridgeTransferDTO,
    )
    async def mark_bridge_completed(
        transfer_id: str,
        _role: str = Depends(_require_role("operator")),
        _idem: str = Depends(_require_idempotency_key),
        svc: BridgeService = Depends(_bridge_service),
    ):
        transfer = svc.get_transfer(transfer_id)
        if not transfer:
            raise ServiceError(404, "BRIDGE_TRANSFER_NOT_FOUND", "bridge transfer not found")
        if _bridge_status_order(transfer.status) >= _bridge_status_order("completed"):
            return _bridge_to_dto(transfer)
        updated = svc.mark_completed(transfer_id)
        return _bridge_to_dto(updated)

    @app.get("/v1/bridge/transfers/{transfer_id}", response_model=BridgeTransferDTO)
    async def get_bridge_transfer(
        transfer_id: str,
        _role: str = Depends(_require_role("operator")),
        svc: BridgeService = Depends(_bridge_service),
    ):
        transfer = svc.get_transfer(transfer_id)
        if not transfer:
            raise ServiceError(404, "BRIDGE_TRANSFER_NOT_FOUND", "bridge transfer not found")
        return _bridge_to_dto(transfer)

    @app.post("/v1/icm/messages", response_model=ICMMessageDTO)
    async def create_icm_message(
        payload: ICMMessageCreateRequest,
        _role: str = Depends(_require_role("operator")),
        idem_key: str = Depends(_require_idempotency_key),
        svc: ICMService = Depends(_icm_service),
    ):
        message_type = MessageType(payload.message_type)
        existing = svc.get_by_idempotency(idem_key)
        if existing:
            if (
                existing.source_chain != payload.source_chain
                or existing.dest_chain != payload.dest_chain
                or existing.message_type != message_type
                or existing.sender != payload.sender
                or existing.payload != payload.payload
            ):
                raise ServiceError(
                    409,
                    "IDEMPOTENCY_CONFLICT",
                    "Idempotency-Key already used with different payload",
                )
            return _icm_to_dto(existing)
        message = svc.create_message(
            source_chain=payload.source_chain,
            dest_chain=payload.dest_chain,
            message_type=message_type,
            sender=payload.sender,
            payload=payload.payload,
            idempotency_key=idem_key,
        )
        return _icm_to_dto(message)

    @app.get("/v1/icm/messages/pending", response_model=list[ICMMessageDTO])
    async def list_pending_icm_messages(
        _role: str = Depends(_require_role("operator")),
        svc: ICMService = Depends(_icm_service),
    ):
        return [_icm_to_dto(m) for m in svc.list_pending_messages()]

    @app.post("/v1/icm/messages/{message_id}/sent", response_model=ICMMessageDTO)
    async def mark_icm_sent(
        message_id: str,
        payload: ICMSentRequest,
        _role: str = Depends(_require_role("operator")),
        _idem: str = Depends(_require_idempotency_key),
        svc: ICMService = Depends(_icm_service),
    ):
        message = svc.get_message(message_id)
        if not message:
            raise ServiceError(404, "ICM_MESSAGE_NOT_FOUND", "icm message not found")
        if message.status.value == "failed":
            raise ServiceError(409, "IDEMPOTENCY_CONFLICT", "message already failed")
        if message.source_tx_hash and message.source_tx_hash != payload.tx_hash:
            raise ServiceError(
                409,
                "IDEMPOTENCY_CONFLICT",
                "source tx hash already set to a different value",
            )
        if _icm_status_order(message.status.value) >= _icm_status_order("sent"):
            return _icm_to_dto(message)
        updated = svc.mark_sent(message_id, payload.tx_hash)
        return _icm_to_dto(updated)

    @app.post("/v1/icm/messages/{message_id}/delivered", response_model=ICMMessageDTO)
    async def mark_icm_delivered(
        message_id: str,
        payload: ICMDeliveredRequest,
        _role: str = Depends(_require_role("operator")),
        _idem: str = Depends(_require_idempotency_key),
        svc: ICMService = Depends(_icm_service),
    ):
        message = svc.get_message(message_id)
        if not message:
            raise ServiceError(404, "ICM_MESSAGE_NOT_FOUND", "icm message not found")
        if message.status.value == "failed":
            raise ServiceError(409, "IDEMPOTENCY_CONFLICT", "message already failed")
        if message.dest_tx_hash and message.dest_tx_hash != payload.dest_tx_hash:
            raise ServiceError(
                409,
                "IDEMPOTENCY_CONFLICT",
                "dest tx hash already set to a different value",
            )
        if _icm_status_order(message.status.value) >= _icm_status_order("delivered"):
            return _icm_to_dto(message)
        updated = svc.mark_delivered(message_id, payload.dest_tx_hash)
        return _icm_to_dto(updated)

    @app.post("/v1/icm/messages/{message_id}/processed", response_model=ICMMessageDTO)
    async def mark_icm_processed(
        message_id: str,
        _role: str = Depends(_require_role("operator")),
        _idem: str = Depends(_require_idempotency_key),
        svc: ICMService = Depends(_icm_service),
    ):
        message = svc.get_message(message_id)
        if not message:
            raise ServiceError(404, "ICM_MESSAGE_NOT_FOUND", "icm message not found")
        if message.status.value == "failed":
            raise ServiceError(409, "IDEMPOTENCY_CONFLICT", "message already failed")
        if _icm_status_order(message.status.value) >= _icm_status_order("processed"):
            return _icm_to_dto(message)
        updated = svc.mark_processed(message_id)
        return _icm_to_dto(updated)

    @app.post("/v1/icm/messages/{message_id}/failed", response_model=ICMMessageDTO)
    async def mark_icm_failed(
        message_id: str,
        payload: ICMFailedRequest,
        _role: str = Depends(_require_role("operator")),
        _idem: str = Depends(_require_idempotency_key),
        svc: ICMService = Depends(_icm_service),
    ):
        message = svc.get_message(message_id)
        if not message:
            raise ServiceError(404, "ICM_MESSAGE_NOT_FOUND", "icm message not found")
        if message.status.value == "processed":
            raise ServiceError(409, "IDEMPOTENCY_CONFLICT", "message already processed")
        if message.status.value == "failed":
            return _icm_to_dto(message)
        updated = svc.mark_failed(message_id, payload.error)
        return _icm_to_dto(updated)

    @app.post("/v1/icm/messages/{message_id}/relay", response_model=ICMMessageDTO)
    async def relay_icm_message(
        message_id: str,
        _role: str = Depends(_require_role("operator")),
        _idem: str = Depends(_require_idempotency_key),
        svc: ICMService = Depends(_icm_service),
    ):
        message = svc.get_message(message_id)
        if not message:
            raise ServiceError(404, "ICM_MESSAGE_NOT_FOUND", "icm message not found")
        if message.status.value in {"failed", "processed"}:
            return _icm_to_dto(message)
        try:
            tx_out = svc.relay_message(message)
            tx_hash = tx_out.get("tx_hash")
            if not tx_hash:
                raise ServiceError(502, "ICM_TX_FAILED", "icm relay missing tx_hash")
            updated = svc.mark_delivered(message_id, str(tx_hash))
            return _icm_to_dto(updated)
        except RuntimeError as exc:
            raise ServiceError(502, "ICM_TX_FAILED", str(exc)) from exc

    @app.post("/v1/icm/messages/{message_id}/process-onchain", response_model=ICMMessageDTO)
    async def process_icm_message_onchain(
        message_id: str,
        payload: ICMProcessOnchainRequest,
        _role: str = Depends(_require_role("operator")),
        _idem: str = Depends(_require_idempotency_key),
        svc: ICMService = Depends(_icm_service),
    ):
        message = svc.get_message(message_id)
        if not message:
            raise ServiceError(404, "ICM_MESSAGE_NOT_FOUND", "icm message not found")
        if message.status.value == "failed":
            return _icm_to_dto(message)
        try:
            tx_out = svc.mark_processed_onchain(message, payload.success)
            tx_hash = tx_out.get("tx_hash")
            if not tx_hash:
                raise ServiceError(502, "ICM_TX_FAILED", "icm mark_processed missing tx_hash")
            updated = svc.mark_processed(message_id)
            return _icm_to_dto(updated)
        except RuntimeError as exc:
            raise ServiceError(502, "ICM_TX_FAILED", str(exc)) from exc

    @app.get("/v1/icm/messages/{message_id}", response_model=ICMMessageDTO)
    async def get_icm_message(
        message_id: str,
        _role: str = Depends(_require_role("operator")),
        svc: ICMService = Depends(_icm_service),
    ):
        message = svc.get_message(message_id)
        if not message:
            raise ServiceError(404, "ICM_MESSAGE_NOT_FOUND", "icm message not found")
        return _icm_to_dto(message)

    # ---------- Stats Endpoints ----------

    @app.get("/v1/bridge/stats", response_model=BridgeStatsDTO)
    async def get_bridge_stats(
        _role: str = Depends(_require_role("operator", "auditor")),
        svc: BridgeService = Depends(_bridge_service),
    ):
        return svc.get_stats()

    @app.get("/v1/icm/stats", response_model=ICMStatsDTO)
    async def get_icm_stats(
        _role: str = Depends(_require_role("operator", "auditor")),
        svc: ICMService = Depends(_icm_service),
    ):
        return svc.get_stats()

    # ---------- Baseline Endpoints ----------

    @app.get("/v1/baseline/methods", response_model=BaselineMethodsResponse)
    async def get_baseline_methods(
        _role: str = Depends(_require_role("operator", "participant", "auditor")),
    ):
        engine = BaselineEngine()
        return BaselineMethodsResponse(methods=engine.available_methods())

    @app.post("/v1/baseline/compare", response_model=BaselineCompareResponse)
    async def compare_baselines(
        payload: BaselineCompareRequest,
        _role: str = Depends(_require_role("operator", "participant", "auditor")),
    ):
        if not payload.history:
            raise ServiceError(422, "EMPTY_HISTORY", "history data is required")
        df = pd.DataFrame(payload.history)
        engine = BaselineEngine()
        all_results = engine.compute_all(df, payload.event_hour)
        result_dtos = [
            BaselineResultDTO(
                baseline_kwh=r.baseline_kwh,
                method=r.method,
                confidence=r.confidence,
                details=r.details,
            )
            for r in all_results
        ]
        best = max(all_results, key=lambda r: r.confidence)
        recommended = BaselineResultDTO(
            baseline_kwh=best.baseline_kwh,
            method=best.method,
            confidence=best.confidence,
            details=best.details,
        )
        return BaselineCompareResponse(results=result_dtos, recommended=recommended)

    # ---------- Dashboard Summary ----------

    @app.get("/v1/dashboard/summary", response_model=DashboardSummaryDTO)
    async def get_dashboard_summary(
        _role: str = Depends(_require_role("operator", "participant", "auditor")),
        bridge_svc: BridgeService = Depends(_bridge_service),
        icm_svc: ICMService = Depends(_icm_service),
    ):
        bridge_stats = bridge_svc.get_stats()
        icm_stats = icm_svc.get_stats()
        engine = BaselineEngine()
        return DashboardSummaryDTO(
            chain_mode=_chain_mode(),
            bridge=BridgeStatsDTO(**bridge_stats),
            icm=ICMStatsDTO(**icm_stats),
            baseline_methods=engine.available_methods(),
        )

    return app


app = create_app()
