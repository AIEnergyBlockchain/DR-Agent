"""Service orchestration for DR Agent MVP API.

This module centralizes event/proof/settlement workflows and maintains
an auditable SQLite index for query and hash re-check.
"""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

from services.db import connect
from services.dto import (
    AuditDTO,
    EventCreateRequest,
    EventDTO,
    JudgeSummaryDTO,
    ProofDTO,
    ProofSubmitRequest,
    SettlementDTO,
)
from services.proof_builder import build_proof_artifacts, recompute_hash
from services.scorer import calculate_payout


class ServiceError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        retryable: bool = False,
        details: dict | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.retryable = retryable
        self.details = details or {}


class SubmitterService:
    def __init__(self, db_path: str | None = None):
        self.conn = connect(db_path)
        self.chain_mode = _normalize_chain_mode(os.getenv("DR_CHAIN_MODE", "simulated"))
        self.tx_confirm_mode = _normalize_tx_confirm_mode(
            os.getenv("DR_TX_CONFIRM_MODE", "hybrid")
        )
        self.live_chain = _is_live_chain_mode(self.chain_mode)
        self.chain_action_script = (
            Path(__file__).resolve().parents[1] / "scripts" / "fuji_chain_action.js"
        )

    def _required_sites(self) -> list[str]:
        configured = os.getenv("DR_REQUIRED_SITES", "").strip()
        if configured:
            site_ids = [value.strip() for value in configured.split(",") if value.strip()]
            if site_ids:
                return site_ids

        demo_site_mode = os.getenv("DR_DEMO_SITE_MODE", "").strip().lower()
        if demo_site_mode == "single":
            return ["site-a"]
        return ["site-a", "site-b"]

    def _chain_action(
        self, action: str, payload: dict, confirm_mode: str | None = None
    ) -> dict:
        if not self.chain_action_script.exists():
            raise ServiceError(
                500,
                "CHAIN_ACTION_SCRIPT_MISSING",
                f"chain action script not found: {self.chain_action_script}",
            )

        cmd = ["node", str(self.chain_action_script), action]
        if confirm_mode:
            cmd.append(confirm_mode)
        result = subprocess.run(
            cmd,
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            check=False,
            env=os.environ.copy(),
        )

        if result.returncode != 0:
            stderr = (result.stderr or "").strip()
            stdout = (result.stdout or "").strip()
            detail = stderr or stdout or f"exit={result.returncode}"
            raise ServiceError(
                502,
                "CHAIN_TX_FAILED",
                f"on-chain {action} failed: {detail}",
                    details={"action": action},
                )

        raw = (result.stdout or "").strip()
        if not raw:
            raise ServiceError(
                502,
                "CHAIN_TX_INVALID_RESPONSE",
                f"on-chain {action} returned empty output",
                    details={"action": action},
                )

        try:
            return json.loads(raw.splitlines()[-1])
        except json.JSONDecodeError as exc:
            raise ServiceError(
                502,
                "CHAIN_TX_INVALID_RESPONSE",
                f"on-chain {action} returned non-json output",
                details={"action": action},
            ) from exc

    def _chain_tx(self, action: str, payload: dict) -> dict[str, str | None]:
        now = _utc_now()
        if not self.live_chain:
            return {
                "tx_hash": _tx_hash(),
                "tx_fee_wei": "0",
                "tx_state": "confirmed",
                "tx_submitted_at": now,
                "tx_confirmed_at": now,
                "tx_error": None,
            }

        payload_out = self._chain_action(
            action, payload, confirm_mode=self.tx_confirm_mode
        )
        tx_hash = payload_out.get("tx_hash")
        if not tx_hash:
            raise ServiceError(
                502,
                "CHAIN_TX_INVALID_RESPONSE",
                f"on-chain {action} missing tx_hash",
                details={"action": action},
            )
        tx_state = _normalize_tx_state(payload_out.get("tx_state"))
        fee_wei = payload_out.get("fee_wei")
        submitted_at = str(payload_out.get("submitted_at") or now)
        confirmed_at = (
            str(payload_out.get("confirmed_at") or now)
            if tx_state == "confirmed"
            else None
        )
        tx_error = payload_out.get("error")
        return {
            "tx_hash": str(tx_hash),
            "tx_fee_wei": str(fee_wei) if fee_wei is not None else None,
            "tx_state": tx_state,
            "tx_submitted_at": submitted_at,
            "tx_confirmed_at": confirmed_at,
            "tx_error": str(tx_error) if tx_error else None,
        }

    def _check_tx(self, tx_hash: str) -> dict[str, str | None]:
        if not self.live_chain:
            now = _utc_now()
            return {
                "tx_state": "confirmed",
                "tx_fee_wei": "0",
                "tx_confirmed_at": now,
                "tx_error": None,
            }
        payload_out = self._chain_action("check_tx", {"tx_hash": tx_hash})
        tx_state = _normalize_tx_state(payload_out.get("tx_state"))
        fee_wei = payload_out.get("fee_wei")
        tx_error = payload_out.get("error")
        confirmed_at = (
            str(payload_out.get("confirmed_at") or _utc_now())
            if tx_state == "confirmed"
            else None
        )
        return {
            "tx_state": tx_state,
            "tx_fee_wei": str(fee_wei) if fee_wei is not None else None,
            "tx_confirmed_at": confirmed_at,
            "tx_error": str(tx_error) if tx_error else None,
        }

    def _update_tx_fields(
        self,
        table: str,
        where_clause: str,
        where_params: tuple,
        state_column: str,
        fee_column: str,
        confirmed_column: str,
        error_column: str,
        tx_result: dict[str, str | None],
    ) -> bool:
        tx_state = _normalize_tx_state(tx_result.get("tx_state"))
        if tx_state == "submitted":
            return False
        fee_wei = tx_result.get("tx_fee_wei")
        confirmed_at = (
            tx_result.get("tx_confirmed_at") if tx_state == "confirmed" else None
        )
        tx_error = tx_result.get("tx_error") if tx_state == "failed" else None

        self.conn.execute(
            f"""
            UPDATE {table}
            SET {state_column} = ?,
                {fee_column} = COALESCE(?, {fee_column}),
                {confirmed_column} = COALESCE(?, {confirmed_column}),
                {error_column} = ?
            WHERE {where_clause}
            """,
            (tx_state, fee_wei, confirmed_at, tx_error, *where_params),
        )
        return True

    def _reconcile_pending_txs(self, event_id: str | None = None) -> None:
        if not self.live_chain or self.tx_confirm_mode != "hybrid":
            return

        tx_cache: dict[str, dict[str, str | None]] = {}

        def cached_check(tx_hash: str) -> dict[str, str | None]:
            cached = tx_cache.get(tx_hash)
            if cached is None:
                cached = self._check_tx(tx_hash)
                tx_cache[tx_hash] = cached
            return cached

        updated = False

        event_rows = self.conn.execute(
            """
            SELECT event_id,tx_hash,tx_state,tx_fee_wei,close_tx_hash,close_tx_state,close_tx_fee_wei
            FROM events
            WHERE (? IS NULL OR event_id = ?)
            """,
            (event_id, event_id),
        ).fetchall()
        for row in event_rows:
            if _tx_needs_reconcile(row["tx_hash"], row["tx_state"], row["tx_fee_wei"]):
                updated = (
                    self._update_tx_fields(
                        "events",
                        "event_id = ?",
                        (row["event_id"],),
                        "tx_state",
                        "tx_fee_wei",
                        "tx_confirmed_at",
                        "tx_error",
                        cached_check(row["tx_hash"]),
                    )
                    or updated
                )
            if _tx_needs_reconcile(
                row["close_tx_hash"], row["close_tx_state"], row["close_tx_fee_wei"]
            ):
                updated = (
                    self._update_tx_fields(
                        "events",
                        "event_id = ?",
                        (row["event_id"],),
                        "close_tx_state",
                        "close_tx_fee_wei",
                        "close_tx_confirmed_at",
                        "close_tx_error",
                        cached_check(row["close_tx_hash"]),
                    )
                    or updated
                )

        proof_rows = self.conn.execute(
            """
            SELECT event_id,site_id,tx_hash,tx_state,tx_fee_wei
            FROM proofs
            WHERE (? IS NULL OR event_id = ?)
            """,
            (event_id, event_id),
        ).fetchall()
        for row in proof_rows:
            if not _tx_needs_reconcile(row["tx_hash"], row["tx_state"], row["tx_fee_wei"]):
                continue
            updated = (
                self._update_tx_fields(
                    "proofs",
                    "event_id = ? AND site_id = ?",
                    (row["event_id"], row["site_id"]),
                    "tx_state",
                    "tx_fee_wei",
                    "tx_confirmed_at",
                    "tx_error",
                    cached_check(row["tx_hash"]),
                )
                or updated
            )

        settlement_rows = self.conn.execute(
            """
            SELECT event_id,site_id,tx_hash,tx_state,tx_fee_wei,claim_tx_hash,claim_tx_state,claim_tx_fee_wei
            FROM settlements
            WHERE (? IS NULL OR event_id = ?)
            """,
            (event_id, event_id),
        ).fetchall()
        for row in settlement_rows:
            if _tx_needs_reconcile(row["tx_hash"], row["tx_state"], row["tx_fee_wei"]):
                updated = (
                    self._update_tx_fields(
                        "settlements",
                        "event_id = ? AND site_id = ?",
                        (row["event_id"], row["site_id"]),
                        "tx_state",
                        "tx_fee_wei",
                        "tx_confirmed_at",
                        "tx_error",
                        cached_check(row["tx_hash"]),
                    )
                    or updated
                )
            if _tx_needs_reconcile(
                row["claim_tx_hash"], row["claim_tx_state"], row["claim_tx_fee_wei"]
            ):
                updated = (
                    self._update_tx_fields(
                        "settlements",
                        "event_id = ? AND site_id = ?",
                        (row["event_id"], row["site_id"]),
                        "claim_tx_state",
                        "claim_tx_fee_wei",
                        "claim_tx_confirmed_at",
                        "claim_tx_error",
                        cached_check(row["claim_tx_hash"]),
                    )
                    or updated
                )

        if updated:
            self.conn.commit()

    def _tx_pipeline_counts(self, event_id: str) -> dict[str, int]:
        by_hash: dict[str, str] = {}

        def register(
            tx_hash: str | None, tx_state: str | None, tx_fee_wei: str | None
        ) -> None:
            if not tx_hash:
                return
            next_state = _normalize_tx_state(tx_state)
            if tx_fee_wei not in (None, "") and next_state == "submitted":
                next_state = "confirmed"
            prev_state = by_hash.get(tx_hash)
            if prev_state is None:
                by_hash[tx_hash] = next_state
                return
            if "failed" in {prev_state, next_state}:
                by_hash[tx_hash] = "failed"
                return
            if "submitted" in {prev_state, next_state}:
                by_hash[tx_hash] = "submitted"
                return
            by_hash[tx_hash] = "confirmed"

        event_rows = self.conn.execute(
            """
            SELECT tx_hash,tx_state,tx_fee_wei,close_tx_hash,close_tx_state,close_tx_fee_wei
            FROM events
            WHERE event_id = ?
            """,
            (event_id,),
        ).fetchall()
        for row in event_rows:
            register(row["tx_hash"], row["tx_state"], row["tx_fee_wei"])
            register(row["close_tx_hash"], row["close_tx_state"], row["close_tx_fee_wei"])

        proof_rows = self.conn.execute(
            """
            SELECT tx_hash,tx_state,tx_fee_wei
            FROM proofs
            WHERE event_id = ?
            """,
            (event_id,),
        ).fetchall()
        for row in proof_rows:
            register(row["tx_hash"], row["tx_state"], row["tx_fee_wei"])

        settlement_rows = self.conn.execute(
            """
            SELECT tx_hash,tx_state,tx_fee_wei,claim_tx_hash,claim_tx_state,claim_tx_fee_wei
            FROM settlements
            WHERE event_id = ?
            """,
            (event_id,),
        ).fetchall()
        for row in settlement_rows:
            register(row["tx_hash"], row["tx_state"], row["tx_fee_wei"])
            register(row["claim_tx_hash"], row["claim_tx_state"], row["claim_tx_fee_wei"])

        counts = {"total": len(by_hash), "submitted": 0, "confirmed": 0, "failed": 0}
        for status in by_hash.values():
            if status == "failed":
                counts["failed"] += 1
            elif status == "confirmed":
                counts["confirmed"] += 1
            else:
                counts["submitted"] += 1
        return counts

    def create_event(self, req: EventCreateRequest) -> EventDTO:
        start_time = _to_rfc3339(req.start_time)
        end_time = _to_rfc3339(req.end_time)
        if start_time >= end_time:
            raise ServiceError(
                400, "INVALID_TIME_WINDOW", "start_time must be < end_time"
            )
        existing = self.conn.execute(
            "SELECT 1 FROM events WHERE event_id = ?",
            (req.event_id,),
        ).fetchone()
        if existing is not None:
            raise ServiceError(409, "EVENT_EXISTS", "event_id already exists")

        now = _utc_now()
        tx_result = self._chain_tx(
            "create_event",
            {
                "event_id": req.event_id,
                "start_time": start_time,
                "end_time": end_time,
                "target_kw": req.target_kw,
                "reward_rate": req.reward_rate,
                "penalty_rate": req.penalty_rate,
            },
        )
        tx_hash = tx_result["tx_hash"]

        try:
            self.conn.execute(
                """
                INSERT INTO events(
                    event_id,start_time,end_time,target_kw,reward_rate,penalty_rate,
                    status,tx_hash,tx_fee_wei,tx_state,tx_submitted_at,tx_confirmed_at,tx_error,created_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    req.event_id,
                    start_time,
                    end_time,
                    req.target_kw,
                    req.reward_rate,
                    req.penalty_rate,
                    "active",
                    tx_hash,
                    tx_result.get("tx_fee_wei"),
                    tx_result.get("tx_state"),
                    tx_result.get("tx_submitted_at"),
                    tx_result.get("tx_confirmed_at"),
                    tx_result.get("tx_error"),
                    now,
                ),
            )
            self.conn.commit()
        except sqlite3.IntegrityError as exc:
            raise ServiceError(409, "EVENT_EXISTS", "event_id already exists") from exc

        return EventDTO(
            event_id=req.event_id,
            start_time=start_time,
            end_time=end_time,
            target_kw=req.target_kw,
            reward_rate=req.reward_rate,
            penalty_rate=req.penalty_rate,
            status="active",
            tx_hash=tx_hash,
            tx_fee_wei=tx_result.get("tx_fee_wei"),
            tx_state=tx_result.get("tx_state"),
            tx_submitted_at=tx_result.get("tx_submitted_at"),
            tx_confirmed_at=tx_result.get("tx_confirmed_at"),
            tx_error=tx_result.get("tx_error"),
        )

    def get_event(self, event_id: str) -> EventDTO:
        self._reconcile_pending_txs(event_id)
        row = self.conn.execute(
            """
            SELECT
                event_id,start_time,end_time,target_kw,reward_rate,penalty_rate,status,
                tx_hash,tx_fee_wei,tx_state,tx_submitted_at,tx_confirmed_at,tx_error,
                close_tx_hash,close_tx_fee_wei,close_tx_state,close_tx_submitted_at,close_tx_confirmed_at,close_tx_error
            FROM events WHERE event_id = ?
            """,
            (event_id,),
        ).fetchone()
        if row is None:
            raise ServiceError(404, "EVENT_NOT_FOUND", "event not found")
        return EventDTO(**dict(row))

    def close_event(self, event_id: str) -> EventDTO:
        row = self.conn.execute(
            """
            SELECT
                event_id,start_time,end_time,target_kw,reward_rate,penalty_rate,status,
                tx_hash,tx_fee_wei,tx_state,tx_submitted_at,tx_confirmed_at,tx_error,
                close_tx_hash,close_tx_fee_wei,close_tx_state,close_tx_submitted_at,close_tx_confirmed_at,close_tx_error
            FROM events WHERE event_id = ?
            """,
            (event_id,),
        ).fetchone()
        if row is None:
            raise ServiceError(404, "EVENT_NOT_FOUND", "event not found")

        if row["status"] == "closed":
            raise ServiceError(409, "EVENT_ALREADY_CLOSED", "event already closed")
        if row["status"] == "settled":
            raise ServiceError(409, "EVENT_ALREADY_SETTLED", "event already settled")
        if row["status"] != "active":
            raise ServiceError(
                409, "INVALID_EVENT_STATE", "event cannot be closed from current state"
            )

        closed_at = _utc_now()
        close_tx_result = self._chain_tx(
            "close_event",
            {
                "event_id": event_id,
            },
        )
        close_tx_hash = close_tx_result["tx_hash"]
        self.conn.execute(
            """
            UPDATE events
            SET status = 'closed',
                closed_at = ?,
                close_tx_hash = ?,
                close_tx_fee_wei = ?,
                close_tx_state = ?,
                close_tx_submitted_at = ?,
                close_tx_confirmed_at = ?,
                close_tx_error = ?
            WHERE event_id = ?
            """,
            (
                closed_at,
                close_tx_hash,
                close_tx_result.get("tx_fee_wei"),
                close_tx_result.get("tx_state"),
                close_tx_result.get("tx_submitted_at"),
                close_tx_result.get("tx_confirmed_at"),
                close_tx_result.get("tx_error"),
                event_id,
            ),
        )
        self.conn.commit()

        return EventDTO(
            event_id=row["event_id"],
            start_time=row["start_time"],
            end_time=row["end_time"],
            target_kw=row["target_kw"],
            reward_rate=row["reward_rate"],
            penalty_rate=row["penalty_rate"],
            status="closed",
            tx_hash=row["tx_hash"],
            tx_fee_wei=row["tx_fee_wei"],
            tx_state=row["tx_state"],
            tx_submitted_at=row["tx_submitted_at"],
            tx_confirmed_at=row["tx_confirmed_at"],
            tx_error=row["tx_error"],
            close_tx_hash=close_tx_hash,
            close_tx_fee_wei=close_tx_result.get("tx_fee_wei"),
            close_tx_state=close_tx_result.get("tx_state"),
            close_tx_submitted_at=close_tx_result.get("tx_submitted_at"),
            close_tx_confirmed_at=close_tx_result.get("tx_confirmed_at"),
            close_tx_error=close_tx_result.get("tx_error"),
        )

    def submit_proof(self, req: ProofSubmitRequest, actor_id: str) -> ProofDTO:
        event = self.conn.execute(
            "SELECT status FROM events WHERE event_id = ?",
            (req.event_id,),
        ).fetchone()
        if event is None:
            raise ServiceError(404, "EVENT_NOT_FOUND", "event not found")
        if event["status"] != "active":
            raise ServiceError(409, "EVENT_NOT_ACTIVE", "event must be active")

        payload_json, computed_hash, reduction_kwh = build_proof_artifacts(
            event_id=req.event_id,
            site_id=req.site_id,
            baseline_kwh=req.baseline_kwh,
            actual_kwh=req.actual_kwh,
            baseline_method=req.baseline_method,
            raw_payload=req.raw_payload,
        )

        if req.proof_hash and req.proof_hash.lower() != computed_hash.lower():
            raise ServiceError(
                400, "PROOF_HASH_MISMATCH", "provided proof_hash does not match payload"
            )

        submitted_at = _utc_now()
        tx_result = self._chain_tx(
            "submit_proof",
            {
                "event_id": req.event_id,
                "site_id": req.site_id,
                "baseline_kwh": req.baseline_kwh,
                "actual_kwh": req.actual_kwh,
                "proof_hash": computed_hash,
                "uri": req.uri,
            },
        )
        tx_hash = tx_result["tx_hash"]

        try:
            self.conn.execute(
                """
                INSERT INTO proofs(
                    event_id,site_id,baseline_kwh,actual_kwh,reduction_kwh,proof_hash,
                    uri,payload,baseline_method,tx_hash,tx_fee_wei,tx_state,tx_submitted_at,tx_confirmed_at,tx_error,submitter,submitted_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    req.event_id,
                    req.site_id,
                    req.baseline_kwh,
                    req.actual_kwh,
                    reduction_kwh,
                    computed_hash,
                    req.uri,
                    payload_json,
                    req.baseline_method,
                    tx_hash,
                    tx_result.get("tx_fee_wei"),
                    tx_result.get("tx_state"),
                    tx_result.get("tx_submitted_at"),
                    tx_result.get("tx_confirmed_at"),
                    tx_result.get("tx_error"),
                    actor_id,
                    submitted_at,
                ),
            )
            self.conn.commit()
        except sqlite3.IntegrityError as exc:
            raise ServiceError(
                409,
                "PROOF_EXISTS",
                "proof already submitted for event_id + site_id",
            ) from exc

        return ProofDTO(
            event_id=req.event_id,
            site_id=req.site_id,
            baseline_kwh=req.baseline_kwh,
            actual_kwh=req.actual_kwh,
            reduction_kwh=reduction_kwh,
            proof_hash=computed_hash,
            uri=req.uri,
            submitted_at=submitted_at,
            tx_hash=tx_hash,
            tx_fee_wei=tx_result.get("tx_fee_wei"),
            tx_state=tx_result.get("tx_state"),
            tx_submitted_at=tx_result.get("tx_submitted_at"),
            tx_confirmed_at=tx_result.get("tx_confirmed_at"),
            tx_error=tx_result.get("tx_error"),
        )

    def settle_event(self, event_id: str, site_ids: list[str]) -> list[SettlementDTO]:
        event = self.conn.execute(
            """
            SELECT event_id,target_kw,reward_rate,penalty_rate,status
            FROM events WHERE event_id = ?
            """,
            (event_id,),
        ).fetchone()
        if event is None:
            raise ServiceError(404, "EVENT_NOT_FOUND", "event not found")

        if event["status"] == "settled":
            raise ServiceError(409, "EVENT_ALREADY_SETTLED", "event already settled")

        if event["status"] != "closed":
            raise ServiceError(
                409, "EVENT_NOT_CLOSED", "event must be closed before settlement"
            )

        if not site_ids:
            rows = self.conn.execute(
                "SELECT site_id FROM proofs WHERE event_id = ? ORDER BY site_id",
                (event_id,),
            ).fetchall()
            site_ids = [r["site_id"] for r in rows]

        # Keep site order stable while removing duplicates.
        deduped_site_ids = list(dict.fromkeys(site_ids))
        site_ids = deduped_site_ids
        if not site_ids:
            raise ServiceError(400, "EMPTY_SITE_IDS", "site_ids cannot be empty")

        target_share = event["target_kw"] // len(site_ids)
        now = _utc_now()
        settlement_rows: list[tuple[str, int]] = []

        for site_id in site_ids:
            proof = self.conn.execute(
                """
                SELECT reduction_kwh FROM proofs
                WHERE event_id = ? AND site_id = ?
                """,
                (event_id, site_id),
            ).fetchone()
            if proof is None:
                raise ServiceError(
                    400,
                    "PROOF_MISSING",
                    "proof missing for one or more site_ids",
                    details={"site_id": site_id},
                )

            existing = self.conn.execute(
                "SELECT 1 FROM settlements WHERE event_id = ? AND site_id = ?",
                (event_id, site_id),
            ).fetchone()
            if existing is not None:
                raise ServiceError(
                    409,
                    "ALREADY_SETTLED",
                    "settlement record already exists",
                    details={"site_id": site_id},
                )

            payout = calculate_payout(
                reduction_kwh=proof["reduction_kwh"],
                target_share=target_share,
                reward_rate=event["reward_rate"],
                penalty_rate=event["penalty_rate"],
            )
            settlement_rows.append((site_id, payout))

        tx_result = self._chain_tx(
            "settle_event",
            {
                "event_id": event_id,
                "site_ids": site_ids,
            },
        )
        tx_hash = tx_result["tx_hash"]

        created: list[SettlementDTO] = []
        try:
            self.conn.execute("BEGIN")
            for site_id, payout in settlement_rows:
                self.conn.execute(
                    """
                    INSERT INTO settlements(
                        event_id,site_id,payout,status,settled_at,
                        tx_hash,tx_fee_wei,tx_state,tx_submitted_at,tx_confirmed_at,tx_error
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        event_id,
                        site_id,
                        payout,
                        "settled",
                        now,
                        tx_hash,
                        tx_result.get("tx_fee_wei"),
                        tx_result.get("tx_state"),
                        tx_result.get("tx_submitted_at"),
                        tx_result.get("tx_confirmed_at"),
                        tx_result.get("tx_error"),
                    ),
                )
                created.append(
                    SettlementDTO(
                        event_id=event_id,
                        site_id=site_id,
                        payout=payout,
                        status="settled",
                        settled_at=now,
                        tx_hash=tx_hash,
                        tx_fee_wei=tx_result.get("tx_fee_wei"),
                        tx_state=tx_result.get("tx_state"),
                        tx_submitted_at=tx_result.get("tx_submitted_at"),
                        tx_confirmed_at=tx_result.get("tx_confirmed_at"),
                        tx_error=tx_result.get("tx_error"),
                    )
                )

            self.conn.execute(
                "UPDATE events SET status = 'settled', settled_at = ? WHERE event_id = ?",
                (now, event_id),
            )
            self.conn.commit()
        except sqlite3.DatabaseError as exc:
            self.conn.rollback()
            raise ServiceError(
                500,
                "SETTLEMENT_TX_FAILED",
                "database transaction failed during settlement",
                retryable=True,
            ) from exc

        return created

    def claim_reward(self, event_id: str, site_id: str, actor_id: str) -> SettlementDTO:
        record = self.conn.execute(
            """
            SELECT
                event_id,site_id,payout,status,settled_at,
                tx_hash,tx_fee_wei,tx_state,tx_submitted_at,tx_confirmed_at,tx_error,
                claim_tx_hash,claim_tx_fee_wei,claim_tx_state,claim_tx_submitted_at,claim_tx_confirmed_at,claim_tx_error
            FROM settlements WHERE event_id = ? AND site_id = ?
            """,
            (event_id, site_id),
        ).fetchone()
        if record is None:
            raise ServiceError(
                404, "SETTLEMENT_NOT_FOUND", "settlement record not found"
            )
        if record["status"] != "settled":
            raise ServiceError(409, "NOT_CLAIMABLE", "settlement is not claimable")

        proof = self.conn.execute(
            "SELECT submitter FROM proofs WHERE event_id = ? AND site_id = ?",
            (event_id, site_id),
        ).fetchone()
        if proof is None:
            raise ServiceError(404, "PROOF_NOT_FOUND", "proof not found")
        if proof["submitter"] != actor_id:
            raise ServiceError(
                403, "NOT_PROOF_SUBMITTER", "claimer is not proof submitter"
            )

        claim_tx_result = self._chain_tx(
            "claim_reward",
            {
                "event_id": event_id,
                "site_id": site_id,
            },
        )
        claim_tx_hash = claim_tx_result["tx_hash"]
        claimed_at = _utc_now()
        self.conn.execute(
            """
            UPDATE settlements
            SET status = 'claimed',
                claimed_at = ?,
                claim_tx_hash = ?,
                claim_tx_fee_wei = ?,
                claim_tx_state = ?,
                claim_tx_submitted_at = ?,
                claim_tx_confirmed_at = ?,
                claim_tx_error = ?
            WHERE event_id = ? AND site_id = ?
            """,
            (
                claimed_at,
                claim_tx_hash,
                claim_tx_result.get("tx_fee_wei"),
                claim_tx_result.get("tx_state"),
                claim_tx_result.get("tx_submitted_at"),
                claim_tx_result.get("tx_confirmed_at"),
                claim_tx_result.get("tx_error"),
                event_id,
                site_id,
            ),
        )
        self.conn.commit()

        return SettlementDTO(
            event_id=record["event_id"],
            site_id=record["site_id"],
            payout=record["payout"],
            status="claimed",
            settled_at=record["settled_at"],
            tx_hash=record["tx_hash"],
            tx_fee_wei=record["tx_fee_wei"],
            tx_state=record["tx_state"],
            tx_submitted_at=record["tx_submitted_at"],
            tx_confirmed_at=record["tx_confirmed_at"],
            tx_error=record["tx_error"],
            claim_tx_hash=claim_tx_hash,
            claim_tx_fee_wei=claim_tx_result.get("tx_fee_wei"),
            claim_tx_state=claim_tx_result.get("tx_state"),
            claim_tx_submitted_at=claim_tx_result.get("tx_submitted_at"),
            claim_tx_confirmed_at=claim_tx_result.get("tx_confirmed_at"),
            claim_tx_error=claim_tx_result.get("tx_error"),
        )

    def list_settlements(self, event_id: str) -> list[SettlementDTO]:
        self._reconcile_pending_txs(event_id)
        rows = self.conn.execute(
            """
            SELECT
                event_id,site_id,payout,status,settled_at,
                tx_hash,tx_fee_wei,tx_state,tx_submitted_at,tx_confirmed_at,tx_error,
                claim_tx_hash,claim_tx_fee_wei,claim_tx_state,claim_tx_submitted_at,claim_tx_confirmed_at,claim_tx_error
            FROM settlements
            WHERE event_id = ?
            ORDER BY site_id
            """,
            (event_id,),
        ).fetchall()

        return [SettlementDTO(**dict(row)) for row in rows]

    def get_audit(self, event_id: str, site_id: str) -> AuditDTO:
        row = self.conn.execute(
            """
            SELECT event_id,site_id,proof_hash,uri,payload
            FROM proofs
            WHERE event_id = ? AND site_id = ?
            """,
            (event_id, site_id),
        ).fetchone()
        if row is None:
            raise ServiceError(404, "PROOF_NOT_FOUND", "proof not found")

        requested_at = _utc_now()
        self.conn.execute(
            """
            INSERT INTO audits(event_id,site_id,requested_at)
            VALUES(?,?,?)
            ON CONFLICT(event_id,site_id) DO UPDATE SET requested_at = excluded.requested_at
            """,
            (event_id, site_id, requested_at),
        )
        self.conn.commit()

        recomputed = recompute_hash(row["payload"])

        return AuditDTO(
            event_id=row["event_id"],
            site_id=row["site_id"],
            proof_hash_onchain=row["proof_hash"],
            proof_hash_recomputed=recomputed,
            match=row["proof_hash"].lower() == recomputed.lower(),
            raw_uri=row["uri"],
        )

    def get_judge_summary(self, event_id: str, network_mode: str) -> JudgeSummaryDTO:
        self._reconcile_pending_txs(event_id)
        event = self.conn.execute(
            """
            SELECT event_id,status,created_at,closed_at,settled_at
            FROM events
            WHERE event_id = ?
            """,
            (event_id,),
        ).fetchone()
        if event is None:
            raise ServiceError(404, "EVENT_NOT_FOUND", "event not found")

        proof_rows = self.conn.execute(
            """
            SELECT site_id,reduction_kwh,submitted_at
            FROM proofs
            WHERE event_id = ?
            ORDER BY site_id
            """,
            (event_id,),
        ).fetchall()
        settlement_rows = self.conn.execute(
            """
            SELECT site_id,payout,status,settled_at,claimed_at
            FROM settlements
            WHERE event_id = ?
            ORDER BY site_id
            """,
            (event_id,),
        ).fetchall()
        audit_row = self.conn.execute(
            """
            SELECT requested_at
            FROM audits
            WHERE event_id = ? AND site_id = 'site-a'
            """,
            (event_id,),
        ).fetchone()

        proof_map = {row["site_id"]: row for row in proof_rows}
        required_sites = self._required_sites()
        if not required_sites:
            required_sites = ["site-a", "site-b"]
        proof_required = len(required_sites)
        proof_submitted = len([site for site in required_sites if site in proof_map])
        proofs_done = all(site in proof_map for site in required_sites)

        event_status = event["status"]
        close_done = event_status in ("closed", "settled")
        settle_done = len(settlement_rows) > 0
        claim_row = next(
            (row for row in settlement_rows if row["site_id"] == "site-a"), None
        )
        claim_status = claim_row["status"] if claim_row is not None else "pending"
        claim_done = claim_status == "claimed"
        audit_requested = audit_row is not None

        current_step = "create"
        if not proofs_done:
            current_step = "proofs"
        elif not close_done:
            current_step = "close"
        elif not settle_done:
            current_step = "settle"
        elif not claim_done:
            current_step = "claim"
        elif not audit_requested:
            current_step = "audit"
        else:
            current_step = "completed"

        completed_steps = [
            True,
            proofs_done,
            close_done,
            settle_done,
            claim_done,
            audit_requested,
        ].count(True)
        progress_total = 6
        progress_pct = round((completed_steps / progress_total) * 100)
        health = (
            "pending"
            if completed_steps == 0
            else "done"
            if current_step == "completed"
            else "in-progress"
        )

        audit_match: bool | None = None
        if audit_requested:
            proof_site_a = proof_map.get("site-a")
            if proof_site_a is not None:
                audit_payload = self.conn.execute(
                    """
                    SELECT proof_hash,payload
                    FROM proofs
                    WHERE event_id = ? AND site_id = 'site-a'
                    """,
                    (event_id,),
                ).fetchone()
                if audit_payload is not None:
                    recomputed = recompute_hash(audit_payload["payload"])
                    audit_match = (
                        audit_payload["proof_hash"].lower() == recomputed.lower()
                    )

        total_reduction_kwh = sum(int(row["reduction_kwh"]) for row in proof_rows)
        total_payout_drt = sum(int(row["payout"]) for row in settlement_rows)

        transition_points = [
            event["created_at"],
            event["closed_at"],
            event["settled_at"],
            *[row["submitted_at"] for row in proof_rows if row["submitted_at"]],
            *[row["settled_at"] for row in settlement_rows if row["settled_at"]],
            *[row["claimed_at"] for row in settlement_rows if row["claimed_at"]],
            audit_row["requested_at"] if audit_row is not None else None,
        ]
        non_null_points = [point for point in transition_points if point]
        last_transition_at = max(non_null_points) if non_null_points else None

        if current_step == "proofs":
            missing_sites = [site for site in required_sites if site not in proof_map]
            blocking_reason = f"Missing proofs: {', '.join(missing_sites)}."
            agent_hint = "Collect required participant proofs to enable settlement lock."
        elif current_step == "close":
            blocking_reason = "Proofs ready. Event must be closed before settlement."
            agent_hint = "Close event to lock payout calculation scope."
        elif current_step == "settle":
            blocking_reason = "Event closed. Settlement execution pending."
            agent_hint = "Trigger settlement to compute payout records."
        elif current_step == "claim":
            blocking_reason = "Settlement done. Participant A claim pending."
            agent_hint = "Complete claim to finalize participant payout."
        elif current_step == "audit":
            blocking_reason = "Claim complete. Audit verification pending."
            agent_hint = "Run audit to verify on-chain and recomputed proof hash."
        elif current_step == "completed":
            blocking_reason = "No blockers."
            agent_hint = "Closed loop finalized with payout and audit evidence."
        else:
            blocking_reason = "Create event to initialize mission."
            agent_hint = "Agent needs event context to start the closed loop."

        tx_pipeline = self._tx_pipeline_counts(event_id)

        return JudgeSummaryDTO(
            event_id=event_id,
            network_mode=network_mode,
            event_status=event_status,
            current_step=current_step,
            health=health,
            blocking_reason=blocking_reason,
            progress_completed=completed_steps,
            progress_total=progress_total,
            progress_pct=progress_pct,
            proof_submitted=proof_submitted,
            proof_required=proof_required,
            total_reduction_kwh=total_reduction_kwh,
            total_payout_drt=total_payout_drt,
            claim_site_a_status=claim_status,
            audit_requested=audit_requested,
            audit_match=audit_match,
            tx_pipeline_total=tx_pipeline["total"],
            tx_pipeline_submitted=tx_pipeline["submitted"],
            tx_pipeline_confirmed=tx_pipeline["confirmed"],
            tx_pipeline_failed=tx_pipeline["failed"],
            last_transition_at=last_transition_at,
            created_at=event["created_at"],
            closed_at=event["closed_at"],
            settled_at=event["settled_at"],
            agent_hint=agent_hint,
        )


def _utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _to_rfc3339(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _tx_hash() -> str:
    # MVP service path currently returns simulated tx hash from local orchestration.
    return "0x" + uuid.uuid4().hex + uuid.uuid4().hex


def _normalize_chain_mode(value: str) -> str:
    return value.strip().lower().replace("_", "-")


def _normalize_tx_confirm_mode(value: str) -> str:
    normalized = value.strip().lower()
    if not normalized:
        return "hybrid"
    if normalized not in {"sync", "hybrid"}:
        raise ValueError(
            f"Invalid DR_TX_CONFIRM_MODE={value!r}; expected 'sync' or 'hybrid'"
        )
    return normalized


def _normalize_tx_state(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"submitted", "confirmed", "failed"}:
        return normalized
    return "submitted"


def _tx_needs_reconcile(
    tx_hash: str | None, tx_state: str | None, tx_fee_wei: str | None
) -> bool:
    if not tx_hash:
        return False
    normalized_state = _normalize_tx_state(tx_state)
    if normalized_state in {"confirmed", "failed"}:
        return False
    return tx_fee_wei in (None, "")


def _is_live_chain_mode(mode: str) -> bool:
    return mode in {"fuji-live", "fuji"}
