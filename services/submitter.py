"""Service orchestration for DR Agent MVP API.

This module centralizes event/proof/settlement workflows and maintains
an auditable SQLite index for query and hash re-check.
"""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone

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

    def create_event(self, req: EventCreateRequest) -> EventDTO:
        start_time = _to_rfc3339(req.start_time)
        end_time = _to_rfc3339(req.end_time)
        if start_time >= end_time:
            raise ServiceError(400, "INVALID_TIME_WINDOW", "start_time must be < end_time")

        now = _utc_now()
        tx_hash = _tx_hash()

        try:
            self.conn.execute(
                """
                INSERT INTO events(event_id,start_time,end_time,target_kw,reward_rate,penalty_rate,status,tx_hash,created_at)
                VALUES(?,?,?,?,?,?,?,?,?)
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
        )

    def get_event(self, event_id: str) -> EventDTO:
        row = self.conn.execute(
            """
            SELECT event_id,start_time,end_time,target_kw,reward_rate,penalty_rate,status
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
            SELECT event_id,start_time,end_time,target_kw,reward_rate,penalty_rate,status
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
            raise ServiceError(409, "INVALID_EVENT_STATE", "event cannot be closed from current state")

        closed_at = _utc_now()
        self.conn.execute(
            "UPDATE events SET status = 'closed', closed_at = ? WHERE event_id = ?",
            (closed_at, event_id),
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
            raise ServiceError(400, "PROOF_HASH_MISMATCH", "provided proof_hash does not match payload")

        submitted_at = _utc_now()

        try:
            self.conn.execute(
                """
                INSERT INTO proofs(
                    event_id,site_id,baseline_kwh,actual_kwh,reduction_kwh,proof_hash,
                    uri,payload,baseline_method,submitter,submitted_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
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
            raise ServiceError(409, "EVENT_NOT_CLOSED", "event must be closed before settlement")

        if not site_ids:
            rows = self.conn.execute(
                "SELECT site_id FROM proofs WHERE event_id = ? ORDER BY site_id",
                (event_id,),
            ).fetchall()
            site_ids = [r["site_id"] for r in rows]

        if not site_ids:
            raise ServiceError(400, "EMPTY_SITE_IDS", "site_ids cannot be empty")

        target_share = event["target_kw"] // len(site_ids)
        now = _utc_now()

        created: list[SettlementDTO] = []
        try:
            self.conn.execute("BEGIN")
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

                tx_hash = _tx_hash()
                self.conn.execute(
                    """
                    INSERT INTO settlements(event_id,site_id,payout,status,settled_at,tx_hash)
                    VALUES(?,?,?,?,?,?)
                    """,
                    (event_id, site_id, payout, "settled", now, tx_hash),
                )

                created.append(
                    SettlementDTO(
                        event_id=event_id,
                        site_id=site_id,
                        payout=payout,
                        status="settled",
                        settled_at=now,
                        tx_hash=tx_hash,
                    )
                )

            self.conn.execute(
                "UPDATE events SET status = 'settled', settled_at = ? WHERE event_id = ?",
                (now, event_id),
            )
            self.conn.commit()
        except ServiceError:
            self.conn.rollback()
            raise
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
            SELECT event_id,site_id,payout,status,settled_at,tx_hash
            FROM settlements WHERE event_id = ? AND site_id = ?
            """,
            (event_id, site_id),
        ).fetchone()
        if record is None:
            raise ServiceError(404, "SETTLEMENT_NOT_FOUND", "settlement record not found")
        if record["status"] != "settled":
            raise ServiceError(409, "NOT_CLAIMABLE", "settlement is not claimable")

        proof = self.conn.execute(
            "SELECT submitter FROM proofs WHERE event_id = ? AND site_id = ?",
            (event_id, site_id),
        ).fetchone()
        if proof is None:
            raise ServiceError(404, "PROOF_NOT_FOUND", "proof not found")
        if proof["submitter"] != actor_id:
            raise ServiceError(403, "NOT_PROOF_SUBMITTER", "claimer is not proof submitter")

        claimed_at = _utc_now()
        self.conn.execute(
            """
            UPDATE settlements
            SET status = 'claimed', claimed_at = ?
            WHERE event_id = ? AND site_id = ?
            """,
            (claimed_at, event_id, site_id),
        )
        self.conn.commit()

        return SettlementDTO(
            event_id=record["event_id"],
            site_id=record["site_id"],
            payout=record["payout"],
            status="claimed",
            settled_at=record["settled_at"],
            tx_hash=record["tx_hash"],
        )

    def list_settlements(self, event_id: str) -> list[SettlementDTO]:
        rows = self.conn.execute(
            """
            SELECT event_id,site_id,payout,status,settled_at,tx_hash
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
        proof_required = 2
        proof_submitted = len(proof_rows)
        proofs_done = ("site-a" in proof_map) and ("site-b" in proof_map)

        event_status = event["status"]
        close_done = event_status in ("closed", "settled")
        settle_done = len(settlement_rows) > 0
        claim_row = next((row for row in settlement_rows if row["site_id"] == "site-a"), None)
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

        completed_steps = [True, proofs_done, close_done, settle_done, claim_done, audit_requested].count(True)
        progress_total = 6
        progress_pct = round((completed_steps / progress_total) * 100)
        health = "pending" if completed_steps == 0 else "done" if current_step == "completed" else "in-progress"

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
                    audit_match = audit_payload["proof_hash"].lower() == recomputed.lower()

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
            missing_sites = [site for site in ("site-a", "site-b") if site not in proof_map]
            blocking_reason = f"Missing proofs: {', '.join(missing_sites)}."
            agent_hint = "Collect both participant proofs to enable settlement lock."
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
            last_transition_at=last_transition_at,
            created_at=event["created_at"],
            closed_at=event["closed_at"],
            settled_at=event["settled_at"],
            agent_hint=agent_hint,
        )


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _to_rfc3339(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _tx_hash() -> str:
    # MVP service path currently returns simulated tx hash from local orchestration.
    return "0x" + uuid.uuid4().hex + uuid.uuid4().hex
