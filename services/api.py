"""FastAPI gateway for DR Agent MVP closed-loop flow."""

from __future__ import annotations

import os
import uuid
from typing import Callable

from fastapi import Body, Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from services.dto import (
    AuditDTO,
    ErrorEnvelope,
    EventCreateRequest,
    EventDTO,
    JudgeSummaryDTO,
    ProofDTO,
    ProofSubmitRequest,
    SettleRequest,
    SettlementDTO,
)
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
    def dependency(request: Request) -> str:
        api_key = request.headers.get("x-api-key", "")
        role = _role_map().get(api_key)
        if role is None:
            raise ServiceError(401, "UNAUTHORIZED", "invalid api key")
        if role not in roles:
            raise ServiceError(403, "FORBIDDEN", "insufficient role")
        return role

    return dependency


def _actor_id(request: Request) -> str:
    return request.headers.get("x-actor-id", "anonymous")


def _service(request: Request) -> SubmitterService:
    return request.app.state.submitter


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


def create_app(db_path: str | None = None) -> FastAPI:
    app = FastAPI(title="DR Agent API", version="0.1.0")
    app.state.submitter = SubmitterService(db_path=db_path)
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
    def root():
        return {
            "service": "dr-agent-api",
            "status": "ok",
            "docs": "/docs",
            "healthz": "/healthz",
        }

    @app.get("/healthz")
    def healthz():
        mode = _chain_mode()
        return {
            "status": "ok",
            "mode": mode,
            "tx_confirm_mode": _tx_confirm_mode(),
            "demo_site_mode": os.getenv("DR_DEMO_SITE_MODE", "dual"),
            "required_sites": _required_sites(mode),
        }

    @app.post("/events", response_model=EventDTO)
    def create_event(
        payload: EventCreateRequest,
        _role: str = Depends(_require_role("operator")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.create_event(payload)

    @app.post("/events/{event_id}/close", response_model=EventDTO)
    def close_event(
        event_id: str,
        _role: str = Depends(_require_role("operator")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.close_event(event_id)

    @app.post("/proofs", response_model=ProofDTO)
    def submit_proof(
        payload: ProofSubmitRequest,
        _role: str = Depends(_require_role("participant", "operator")),
        actor_id: str = Depends(_actor_id),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.submit_proof(payload, actor_id=actor_id)

    @app.post("/settle/{event_id}", response_model=list[SettlementDTO])
    def settle_event(
        event_id: str,
        payload: SettleRequest = Body(default_factory=SettleRequest),
        _role: str = Depends(_require_role("operator")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.settle_event(event_id=event_id, site_ids=payload.site_ids)

    @app.post("/claim/{event_id}/{site_id}", response_model=SettlementDTO)
    def claim_reward(
        event_id: str,
        site_id: str,
        _role: str = Depends(_require_role("participant", "operator")),
        actor_id: str = Depends(_actor_id),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.claim_reward(event_id=event_id, site_id=site_id, actor_id=actor_id)

    @app.get("/events/{event_id}", response_model=EventDTO)
    def get_event(
        event_id: str,
        _role: str = Depends(_require_role("operator", "participant", "auditor")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.get_event(event_id)

    @app.get("/events/{event_id}/records", response_model=list[SettlementDTO])
    def get_records(
        event_id: str,
        _role: str = Depends(_require_role("operator", "auditor")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.list_settlements(event_id)

    @app.get("/audit/{event_id}/{site_id}", response_model=AuditDTO)
    def get_audit(
        event_id: str,
        site_id: str,
        _role: str = Depends(_require_role("operator", "auditor")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.get_audit(event_id, site_id)

    @app.get("/system/chain-mode")
    def get_chain_mode(
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
    def get_judge_summary(
        event_id: str,
        _role: str = Depends(_require_role("operator", "participant", "auditor")),
        svc: SubmitterService = Depends(_service),
    ):
        return svc.get_judge_summary(
            event_id=event_id, network_mode=_chain_mode()
        )

    return app


app = create_app()
