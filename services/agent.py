"""AI Agent service for DR Agent — insight generation and anomaly detection.

Implements a provider-based architecture:
- MockAgentProvider: rule engine with template variation (no external API)
- Future: LLMAgentProvider for real LLM integration
"""

from __future__ import annotations

import hashlib
import json
import os
import random
from typing import Any, Protocol, runtime_checkable

import httpx

from services.dto import (
    AgentAnomalyRequest,
    AgentInsightRequest,
    AgentInsightResponse,
    AgentStatusResponse,
    AnomalyReport,
)


@runtime_checkable
class AgentProvider(Protocol):
    """Interface for agent insight providers."""

    def generate_insight(self, request: AgentInsightRequest) -> AgentInsightResponse: ...
    def detect_anomaly(self, request: AgentAnomalyRequest) -> AnomalyReport: ...
    def get_status(self) -> AgentStatusResponse: ...


# ---------------------------------------------------------------------------
# Template pools for MockAgentProvider — used to produce varied responses
# ---------------------------------------------------------------------------

_INSIGHT_TEMPLATES: dict[str, dict[str, list[dict[str, str]]]] = {
    "en": {
        "create": [
            {
                "headline": "Event created — awaiting proof submissions.",
                "reasoning": "The demand response event is now active. No participant proofs have been submitted yet. The agent is monitoring for incoming data to begin analysis.",
            },
            {
                "headline": "New DR event initialized successfully.",
                "reasoning": "Event parameters are set. The settlement pipeline is idle until participant proofs arrive. Consider notifying participants to submit their meter data.",
            },
        ],
        "proofs": [
            {
                "headline": "Proof coverage at {coverage} — {gap_status}.",
                "reasoning": "Current proof submissions cover {proof_count} of {required_count} required participants. Total reported reduction is {reduction_kwh} kWh. {coverage_detail}",
            },
            {
                "headline": "Analyzing submitted proofs — {coverage} coverage achieved.",
                "reasoning": "The agent has evaluated {proof_count} proof(s). Aggregate reduction stands at {reduction_kwh} kWh. {coverage_detail}",
            },
        ],
        "close": [
            {
                "headline": "Event closed — ready for settlement calculation.",
                "reasoning": "The event window is now sealed. Total verified reduction is {reduction_kwh} kWh across {proof_count} participant(s). The payout model can now be finalized.",
            },
            {
                "headline": "Event window sealed — settlement unlocked.",
                "reasoning": "All proof submissions are locked. The agent has verified {proof_count} proofs with a combined {reduction_kwh} kWh reduction. Proceeding to settlement is recommended.",
            },
        ],
        "settle": [
            {
                "headline": "Settlement computed — payouts ready for distribution.",
                "reasoning": "The payout calculation is complete. DRT rewards have been allocated based on verified reduction data. Participants can now claim their rewards.",
            },
            {
                "headline": "Payout allocation finalized.",
                "reasoning": "Settlement has been processed. Each participant's reward is proportional to their verified demand reduction. The claim window is now open.",
            },
        ],
        "claim": [
            {
                "headline": "Claim phase active — monitoring reward distribution.",
                "reasoning": "Participants are claiming their DRT rewards. The agent is tracking claim transactions to ensure all payouts are distributed correctly.",
            },
        ],
        "audit": [
            {
                "headline": "Audit verification complete — {audit_status}.",
                "reasoning": "The proof hash re-computation has been performed. On-chain and off-chain hashes have been compared for integrity verification. {audit_detail}",
            },
        ],
        "error": [
            {
                "headline": "Execution risk detected at {step} step.",
                "reasoning": "A blocking issue has occurred: {error_msg}. This may delay the settlement pipeline. Review the error details and retry or escalate as needed.",
            },
        ],
        "default": [
            {
                "headline": "Settlement pipeline complete.",
                "reasoning": "The full demand response cycle has been executed: event creation, proof collection, settlement, claims, and audit. All steps have been verified.",
            },
        ],
    },
    "zh": {
        "create": [
            {
                "headline": "事件已创建 — 等待参与者提交证明。",
                "reasoning": "需求响应事件已激活。目前尚无参与者提交证明数据。智能体正在监控传入数据以开始分析。",
            },
            {
                "headline": "新DR事件初始化成功。",
                "reasoning": "事件参数已设定。结算管线处于空闲状态，等待参与者证明到达。建议通知参与者提交计量数据。",
            },
        ],
        "proofs": [
            {
                "headline": "证明覆盖率 {coverage} — {gap_status}。",
                "reasoning": "当前已提交 {proof_count}/{required_count} 个参与者证明。总报告削减量为 {reduction_kwh} kWh。{coverage_detail}",
            },
        ],
        "close": [
            {
                "headline": "事件已关闭 — 可进行结算计算。",
                "reasoning": "事件窗口已封闭。已验证 {proof_count} 个参与者的总削减量为 {reduction_kwh} kWh。可以进行结算。",
            },
        ],
        "settle": [
            {
                "headline": "结算已完成 — 奖励待分配。",
                "reasoning": "支付计算已完成。DRT奖励已根据验证的削减数据分配。参与者现在可以领取奖励。",
            },
        ],
        "claim": [
            {
                "headline": "领取阶段进行中 — 监控奖励分配。",
                "reasoning": "参与者正在领取DRT奖励。智能体正在跟踪领取交易以确保所有支付正确分配。",
            },
        ],
        "audit": [
            {
                "headline": "审计验证完成 — {audit_status}。",
                "reasoning": "证明哈希重新计算已完成。链上和链下哈希已进行完整性比对。{audit_detail}",
            },
        ],
        "error": [
            {
                "headline": "在 {step} 步骤检测到执行风险。",
                "reasoning": "发生阻塞问题：{error_msg}。这可能延迟结算管线。请检查错误详情并重试或升级处理。",
            },
        ],
        "default": [
            {
                "headline": "结算管线已完成。",
                "reasoning": "完整的需求响应周期已执行：事件创建、证明收集、结算、领取和审计。所有步骤已验证。",
            },
        ],
    },
}

_SUGGESTED_ACTIONS: dict[str, dict[str, str]] = {
    "en": {
        "create": "Notify participants to submit their meter proofs.",
        "proofs": "Submit remaining proofs to achieve full coverage.",
        "close": "Close the event to lock the settlement scope.",
        "settle": "Run settlement to calculate and distribute payouts.",
        "claim": "Participants should claim their DRT rewards.",
        "audit": "Review audit results for compliance verification.",
    },
    "zh": {
        "create": "通知参与者提交计量证明。",
        "proofs": "提交剩余证明以达到完整覆盖。",
        "close": "关闭事件以锁定结算范围。",
        "settle": "执行结算以计算和分配支付。",
        "claim": "参与者应领取DRT奖励。",
        "audit": "审查审计结果以进行合规验证。",
    },
}


def _extract_signals(req: AgentInsightRequest) -> dict[str, Any]:
    proof_count = len(req.proofs)
    required_count = max(proof_count, 2)  # default assumption: 2 sites
    reduction_kwh = sum(
        p.get("reduction_kwh", p.get("baseline_kwh", 0) - p.get("actual_kwh", 0))
        for p in req.proofs
    )
    coverage = f"{proof_count}/{required_count}"
    gap_status = "full coverage" if proof_count >= required_count else "gaps remain"
    if req.lang == "zh":
        gap_status = "完整覆盖" if proof_count >= required_count else "存在缺口"

    coverage_detail = ""
    if proof_count < required_count:
        if req.lang == "zh":
            coverage_detail = f"还需 {required_count - proof_count} 个证明以完成覆盖。"
        else:
            coverage_detail = f"{required_count - proof_count} more proof(s) needed for full coverage."
    else:
        if req.lang == "zh":
            coverage_detail = "所有参与者证明已提交。可以继续结算。"
        else:
            coverage_detail = "All participant proofs submitted. Ready to proceed."

    has_error = bool(req.tx_pipeline and any(
        tx.get("status") == "failed" or tx.get("tx_state") == "failed"
        for tx in req.tx_pipeline
    ))

    return {
        "step": req.current_step,
        "event_id": req.event_id or "none",
        "event_exists": req.event_id is not None,
        "proof_count": proof_count,
        "required_count": required_count,
        "reduction_kwh": reduction_kwh,
        "coverage": coverage,
        "proof_coverage": proof_count / required_count if required_count > 0 else 0,
        "gap_status": gap_status,
        "coverage_detail": coverage_detail,
        "has_baseline": req.baseline_result is not None,
        "has_settlement": req.settlement is not None,
        "has_error": has_error,
        "error_msg": next(
            (tx.get("tx_error", "unknown error") for tx in req.tx_pipeline
             if tx.get("status") == "failed" or tx.get("tx_state") == "failed"),
            "",
        ),
        "audit_status": "integrity verified" if req.lang == "en" else "完整性已验证",
        "audit_detail": "Hash match confirmed." if req.lang == "en" else "哈希匹配已确认。",
    }


class MockAgentProvider:
    """Rule-engine mock that simulates LLM agent behavior without external API calls.

    Uses template pools with context-aware selection and randomization to produce
    varied but deterministic-testable responses.
    """

    def __init__(self) -> None:
        self._analysis_count = 0
        self._anomaly_count = 0

    @property
    def analysis_count(self) -> int:
        return self._analysis_count

    @property
    def anomaly_count(self) -> int:
        return self._anomaly_count

    def generate_insight(self, request: AgentInsightRequest) -> AgentInsightResponse:
        self._analysis_count += 1
        lang = request.lang if request.lang in _INSIGHT_TEMPLATES else "en"
        signals = self._extract_signals(request)
        confidence = self._compute_confidence(signals)
        risk_flags = self._scan_risks(signals)
        step_key = self._resolve_step_key(request, signals)
        template = self._select_template(lang, step_key, signals)
        headline = template["headline"].format(**signals)
        reasoning = template["reasoning"].format(**signals)
        suggested = _SUGGESTED_ACTIONS.get(lang, _SUGGESTED_ACTIONS["en"]).get(
            request.current_step
        )

        return AgentInsightResponse(
            headline=headline,
            reasoning=reasoning,
            confidence=confidence,
            suggested_action=suggested,
            risk_flags=risk_flags,
            data_points={
                k: v
                for k, v in signals.items()
                if k in ("proof_count", "required_count", "reduction_kwh", "coverage", "step")
            },
        )

    def detect_anomaly(self, request: AgentAnomalyRequest) -> AnomalyReport:
        proofs = request.proofs
        if not proofs:
            return AnomalyReport(has_anomaly=False, description="No proofs to analyze.")

        anomalies: list[AnomalyReport] = []

        # 1. Load spike detection (z-score based)
        anomalies.extend(self._detect_load_spikes(proofs))

        # 2. Proof consistency check
        anomalies.extend(self._detect_proof_mismatch(proofs))

        # 3. Baseline drift detection
        if request.baseline_result:
            anomalies.extend(self._detect_baseline_drift(proofs, request.baseline_result))

        if anomalies:
            self._anomaly_count += 1
            worst = max(anomalies, key=lambda a: {"info": 0, "warning": 1, "critical": 2}[a.severity])
            return worst

        return AnomalyReport(
            has_anomaly=False,
            description="All proofs within normal parameters.",
        )

    def get_status(self) -> AgentStatusResponse:
        return AgentStatusResponse(
            status="active",
            provider="mock",
            total_analyses=self._analysis_count,
            total_anomalies_detected=self._anomaly_count,
        )

    # ---- Signal extraction ----

    def _extract_signals(self, req: AgentInsightRequest) -> dict[str, Any]:
        return _extract_signals(req)

    def _compute_confidence(self, signals: dict[str, Any]) -> float:
        score = 0.0
        if signals.get("event_exists"):
            score += 0.20
        coverage = signals.get("proof_coverage", 0)
        score += float(coverage) * 0.30
        if signals.get("has_baseline"):
            score += 0.20
        if signals.get("has_settlement"):
            score += 0.15
        if not signals.get("has_error"):
            score += 0.15
        return min(round(score, 2), 1.0)

    def _scan_risks(self, signals: dict[str, Any]) -> list[str]:
        flags: list[str] = []
        if signals.get("has_error"):
            flags.append("tx_failure")
        coverage = signals.get("proof_coverage", 0)
        if 0 < coverage < 1.0:
            flags.append("coverage_gap")
        if not signals.get("event_exists"):
            flags.append("no_event")
        return flags

    def _resolve_step_key(self, req: AgentInsightRequest, signals: dict[str, Any]) -> str:
        if signals.get("has_error"):
            return "error"
        if req.current_step in _INSIGHT_TEMPLATES.get("en", {}):
            return req.current_step
        return "default"

    def _select_template(
        self, lang: str, step_key: str, signals: dict[str, Any]
    ) -> dict[str, str]:
        templates = _INSIGHT_TEMPLATES.get(lang, _INSIGHT_TEMPLATES["en"])
        pool = templates.get(step_key, templates["default"])
        # Deterministic selection based on signal hash for reproducibility in tests
        seed = hashlib.md5(
            f"{signals.get('event_id', '')}:{signals.get('step', '')}:{signals.get('proof_count', 0)}".encode()
        ).hexdigest()
        idx = int(seed, 16) % len(pool)
        return pool[idx]

    # ---- Anomaly detection methods ----

    def _detect_load_spikes(self, proofs: list[dict[str, Any]]) -> list[AnomalyReport]:
        reductions = []
        for p in proofs:
            r = p.get("reduction_kwh")
            if r is None:
                r = p.get("baseline_kwh", 0) - p.get("actual_kwh", 0)
            reductions.append((p.get("site_id", "unknown"), r))

        if len(reductions) < 3:
            return []

        values = sorted([r for _, r in reductions])
        median = values[len(values) // 2]
        # Median Absolute Deviation (MAD) — robust to outliers in small samples
        mad = sorted([abs(v - median) for v in values])[len(values) // 2]

        if mad == 0:
            # All values near median; flag anything far from it
            mad = max(abs(median) * 0.1, 1)

        anomalies = []
        for site_id, reduction in reductions:
            modified_z = abs(reduction - median) / mad
            if modified_z > 3.0:
                severity = "critical" if modified_z > 5.0 else "warning"
                anomalies.append(
                    AnomalyReport(
                        has_anomaly=True,
                        anomaly_type="load_spike",
                        severity=severity,
                        description=f"Unusual reduction of {reduction} kWh at {site_id} (deviation: {modified_z:.1f}x MAD).",
                        affected_proofs=[site_id],
                        recommendation=f"Verify meter data for {site_id}. Check for equipment malfunction or data entry error.",
                    )
                )
        return anomalies

    def _detect_proof_mismatch(self, proofs: list[dict[str, Any]]) -> list[AnomalyReport]:
        if len(proofs) < 2:
            return []

        anomalies = []
        for p in proofs:
            baseline = p.get("baseline_kwh", 0)
            actual = p.get("actual_kwh", 0)
            if baseline > 0 and actual > baseline:
                anomalies.append(
                    AnomalyReport(
                        has_anomaly=True,
                        anomaly_type="proof_mismatch",
                        severity="warning",
                        description=f"Actual usage ({actual} kWh) exceeds baseline ({baseline} kWh) at {p.get('site_id', 'unknown')}. Negative reduction detected.",
                        affected_proofs=[p.get("site_id", "unknown")],
                        recommendation="Verify baseline calculation method and meter readings.",
                    )
                )
        return anomalies

    def _detect_baseline_drift(
        self, proofs: list[dict[str, Any]], baseline_result: dict[str, Any]
    ) -> list[AnomalyReport]:
        expected_baseline = baseline_result.get("baseline_kwh", 0)
        if not expected_baseline:
            return []

        anomalies = []
        for p in proofs:
            proof_baseline = p.get("baseline_kwh", 0)
            if proof_baseline and expected_baseline:
                drift_pct = abs(proof_baseline - expected_baseline) / expected_baseline
                if drift_pct > 0.3:
                    anomalies.append(
                        AnomalyReport(
                            has_anomaly=True,
                            anomaly_type="baseline_drift",
                            severity="warning" if drift_pct < 0.5 else "critical",
                            description=f"Proof baseline ({proof_baseline} kWh) deviates {drift_pct:.0%} from engine baseline ({expected_baseline} kWh) at {p.get('site_id', 'unknown')}.",
                            affected_proofs=[p.get("site_id", "unknown")],
                            recommendation="Re-run baseline calculation with latest historical data.",
                        )
                    )
        return anomalies


_LLM_SYSTEM_PROMPT = (
    "You are DR Agent, a settlement and audit assistant for demand response events. "
    "Return JSON only with keys: headline, reasoning, confidence (0-1), suggested_action, risk_flags (list). "
    "Use the requested language and keep the response concise."
)


def _build_llm_messages(req: AgentInsightRequest, signals: dict[str, Any]) -> list[dict[str, str]]:
    context = {
        "lang": req.lang,
        "current_step": req.current_step,
        "event_id": req.event_id,
        "proof_count": signals.get("proof_count"),
        "required_count": signals.get("required_count"),
        "reduction_kwh": signals.get("reduction_kwh"),
        "coverage": signals.get("coverage"),
        "has_baseline": signals.get("has_baseline"),
        "has_settlement": signals.get("has_settlement"),
        "has_error": signals.get("has_error"),
        "error_msg": signals.get("error_msg"),
    }
    return [
        {"role": "system", "content": _LLM_SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
    ]


def _parse_llm_payload(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(content[start : end + 1])


def _coerce_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.5
    return max(0.0, min(confidence, 1.0))


class LLMAgentProvider:
    """LLM-backed agent provider with Mock fallback for reliability."""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        *,
        timeout_s: float = 12.0,
        client: httpx.Client | None = None,
        fallback: AgentProvider | None = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = client or httpx.Client(
            base_url=self._base_url,
            timeout=timeout_s,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        self._fallback = fallback or MockAgentProvider()
        self._analysis_count = 0
        self._anomaly_count = 0

    def _chat_path(self) -> str:
        if self._base_url.endswith("/v1"):
            return "/chat/completions"
        return "/v1/chat/completions"

    def generate_insight(self, request: AgentInsightRequest) -> AgentInsightResponse:
        signals = _extract_signals(request)
        payload = {
            "model": self._model,
            "messages": _build_llm_messages(request, signals),
            "temperature": 0.3,
        }
        try:
            resp = self._client.post(self._chat_path(), json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            parsed = _parse_llm_payload(content)
            headline = str(parsed.get("headline", "")).strip()
            reasoning = str(parsed.get("reasoning", "")).strip()
            if not headline or not reasoning:
                raise ValueError("LLM response missing required fields")

            confidence = _coerce_confidence(parsed.get("confidence", 0.5))
            risk_flags = parsed.get("risk_flags", [])
            if isinstance(risk_flags, str):
                risk_flags = [risk_flags]
            if not isinstance(risk_flags, list):
                risk_flags = []

            suggested = parsed.get("suggested_action")
            if not suggested:
                suggested = _SUGGESTED_ACTIONS.get(request.lang, _SUGGESTED_ACTIONS["en"]).get(
                    request.current_step
                )

            self._analysis_count += 1
            return AgentInsightResponse(
                headline=headline,
                reasoning=reasoning,
                confidence=confidence,
                suggested_action=str(suggested) if suggested else None,
                risk_flags=[str(flag) for flag in risk_flags],
                data_points={
                    k: v
                    for k, v in signals.items()
                    if k in ("proof_count", "required_count", "reduction_kwh", "coverage", "step")
                },
            )
        except Exception:
            self._analysis_count += 1
            return self._fallback.generate_insight(request)

    def detect_anomaly(self, request: AgentAnomalyRequest) -> AnomalyReport:
        report = self._fallback.detect_anomaly(request)
        if report.has_anomaly:
            self._anomaly_count += 1
        return report

    def get_status(self) -> AgentStatusResponse:
        return AgentStatusResponse(
            status="active",
            provider="llm",
            total_analyses=self._analysis_count,
            total_anomalies_detected=self._anomaly_count,
        )


def _safe_float_env(key: str, default: float) -> float:
    raw = os.getenv(key, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def resolve_agent_provider() -> AgentProvider:
    provider = os.getenv("DR_AGENT_PROVIDER", "mock").strip().lower()
    if provider != "llm":
        return MockAgentProvider()

    api_key = os.getenv("DR_LLM_API_KEY", "").strip()
    if not api_key:
        return MockAgentProvider()

    base_url = os.getenv("DR_LLM_BASE_URL", "https://api.openai.com/v1").strip()
    model = os.getenv("DR_LLM_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    timeout_s = _safe_float_env("DR_LLM_TIMEOUT_SEC", 12.0)
    return LLMAgentProvider(
        api_key=api_key,
        base_url=base_url,
        model=model,
        timeout_s=timeout_s,
    )


class AgentService:
    """Facade that delegates to an AgentProvider and tracks statistics."""

    def __init__(self, provider: AgentProvider | None = None) -> None:
        self._provider: AgentProvider = provider if provider else MockAgentProvider()

    @classmethod
    def from_env(cls) -> "AgentService":
        return cls(provider=resolve_agent_provider())

    def generate_insight(self, request: AgentInsightRequest) -> AgentInsightResponse:
        return self._provider.generate_insight(request)

    def detect_anomaly(self, request: AgentAnomalyRequest) -> AnomalyReport:
        return self._provider.detect_anomaly(request)

    def get_status(self) -> AgentStatusResponse:
        return self._provider.get_status()
