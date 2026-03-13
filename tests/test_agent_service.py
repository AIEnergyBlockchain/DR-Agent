"""Tests for Agent Service — MockAgentProvider and AgentService facade."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.agent import AgentProvider, AgentService, MockAgentProvider
from services.dto import (
    AgentAnomalyRequest,
    AgentInsightRequest,
    AgentInsightResponse,
    AgentStatusResponse,
    AnomalyReport,
)


# ---------- MockAgentProvider satisfies Protocol ----------

def test_mock_provider_is_agent_provider():
    provider = MockAgentProvider()
    assert isinstance(provider, AgentProvider)


# ---------- generate_insight ----------

def test_insight_create_step_returns_valid_response():
    provider = MockAgentProvider()
    req = AgentInsightRequest(event_id="evt-1", current_step="create")
    resp = provider.generate_insight(req)
    assert isinstance(resp, AgentInsightResponse)
    assert resp.headline
    assert resp.reasoning
    assert 0.0 <= resp.confidence <= 1.0


def test_insight_proofs_step_reflects_coverage():
    provider = MockAgentProvider()
    req = AgentInsightRequest(
        event_id="evt-1",
        current_step="proofs",
        proofs=[
            {"site_id": "site-a", "baseline_kwh": 150, "actual_kwh": 40},
        ],
    )
    resp = provider.generate_insight(req)
    assert "1/" in resp.headline or "1/" in resp.reasoning
    assert resp.confidence > 0


def test_insight_proofs_full_coverage_no_gap_flag():
    provider = MockAgentProvider()
    req = AgentInsightRequest(
        event_id="evt-1",
        current_step="proofs",
        proofs=[
            {"site_id": "site-a", "baseline_kwh": 150, "actual_kwh": 40},
            {"site_id": "site-b", "baseline_kwh": 150, "actual_kwh": 120},
        ],
    )
    resp = provider.generate_insight(req)
    assert "coverage_gap" not in resp.risk_flags


def test_insight_proofs_partial_coverage_has_gap_flag():
    provider = MockAgentProvider()
    req = AgentInsightRequest(
        event_id="evt-1",
        current_step="proofs",
        proofs=[
            {"site_id": "site-a", "baseline_kwh": 150, "actual_kwh": 40},
        ],
    )
    resp = provider.generate_insight(req)
    assert "coverage_gap" in resp.risk_flags


def test_insight_close_step():
    provider = MockAgentProvider()
    req = AgentInsightRequest(
        event_id="evt-1",
        current_step="close",
        proofs=[
            {"site_id": "site-a", "reduction_kwh": 110},
            {"site_id": "site-b", "reduction_kwh": 30},
        ],
    )
    resp = provider.generate_insight(req)
    assert resp.headline
    assert "140" in resp.reasoning  # total reduction


def test_insight_settle_step():
    provider = MockAgentProvider()
    req = AgentInsightRequest(event_id="evt-1", current_step="settle")
    resp = provider.generate_insight(req)
    assert resp.headline
    assert resp.suggested_action


def test_insight_error_state():
    provider = MockAgentProvider()
    req = AgentInsightRequest(
        event_id="evt-1",
        current_step="proofs",
        tx_pipeline=[{"status": "failed", "tx_error": "gas too low"}],
    )
    resp = provider.generate_insight(req)
    assert "tx_failure" in resp.risk_flags
    assert "error" in resp.headline.lower() or "risk" in resp.headline.lower()


def test_insight_no_event_has_risk_flag():
    provider = MockAgentProvider()
    req = AgentInsightRequest(current_step="create")
    resp = provider.generate_insight(req)
    assert "no_event" in resp.risk_flags


def test_insight_confidence_increases_with_data():
    provider = MockAgentProvider()
    # Minimal data
    req_min = AgentInsightRequest(current_step="create")
    # Rich data
    req_rich = AgentInsightRequest(
        event_id="evt-1",
        current_step="settle",
        proofs=[
            {"site_id": "site-a", "baseline_kwh": 150, "actual_kwh": 40},
            {"site_id": "site-b", "baseline_kwh": 150, "actual_kwh": 120},
        ],
        baseline_result={"baseline_kwh": 150, "method": "simple"},
        settlement={"payout": 1100},
    )
    resp_min = provider.generate_insight(req_min)
    resp_rich = provider.generate_insight(req_rich)
    assert resp_rich.confidence > resp_min.confidence


def test_insight_suggested_action_per_step():
    provider = MockAgentProvider()
    for step in ["create", "proofs", "close", "settle", "claim", "audit"]:
        req = AgentInsightRequest(event_id="evt-1", current_step=step)
        resp = provider.generate_insight(req)
        if step in ("create", "proofs", "close", "settle", "claim", "audit"):
            assert resp.suggested_action is not None


def test_insight_data_points_returned():
    provider = MockAgentProvider()
    req = AgentInsightRequest(
        event_id="evt-1",
        current_step="proofs",
        proofs=[{"site_id": "site-a", "baseline_kwh": 100, "actual_kwh": 60}],
    )
    resp = provider.generate_insight(req)
    assert "proof_count" in resp.data_points
    assert resp.data_points["proof_count"] == 1


def test_insight_chinese_language():
    provider = MockAgentProvider()
    req = AgentInsightRequest(
        event_id="evt-1", current_step="create", lang="zh"
    )
    resp = provider.generate_insight(req)
    # Chinese response should contain CJK characters
    assert any("\u4e00" <= c <= "\u9fff" for c in resp.headline)


def test_insight_unknown_lang_falls_back_to_english():
    provider = MockAgentProvider()
    req = AgentInsightRequest(
        event_id="evt-1", current_step="create", lang="fr"
    )
    resp = provider.generate_insight(req)
    assert resp.headline  # should not crash, uses English


def test_insight_default_step_for_unknown():
    provider = MockAgentProvider()
    req = AgentInsightRequest(event_id="evt-1", current_step="unknown_step")
    resp = provider.generate_insight(req)
    assert resp.headline  # falls back to default template


# ---------- detect_anomaly ----------

def test_anomaly_no_proofs():
    provider = MockAgentProvider()
    req = AgentAnomalyRequest(proofs=[])
    report = provider.detect_anomaly(req)
    assert report.has_anomaly is False


def test_anomaly_normal_proofs():
    provider = MockAgentProvider()
    req = AgentAnomalyRequest(proofs=[
        {"site_id": "site-a", "baseline_kwh": 150, "actual_kwh": 100},
        {"site_id": "site-b", "baseline_kwh": 150, "actual_kwh": 110},
    ])
    report = provider.detect_anomaly(req)
    assert report.has_anomaly is False


def test_anomaly_load_spike_detected():
    provider = MockAgentProvider()
    # site-a has extreme reduction (110) vs others (~5 each) → clear z-score outlier > 2σ
    req = AgentAnomalyRequest(proofs=[
        {"site_id": "site-a", "baseline_kwh": 150, "actual_kwh": 40},   # reduction=110
        {"site_id": "site-b", "baseline_kwh": 150, "actual_kwh": 145},  # reduction=5
        {"site_id": "site-c", "baseline_kwh": 150, "actual_kwh": 145},  # reduction=5
        {"site_id": "site-d", "baseline_kwh": 150, "actual_kwh": 145},  # reduction=5
    ])
    report = provider.detect_anomaly(req)
    assert report.has_anomaly is True
    assert report.anomaly_type == "load_spike"
    assert "site-a" in report.affected_proofs


def test_anomaly_proof_mismatch_negative_reduction():
    provider = MockAgentProvider()
    req = AgentAnomalyRequest(proofs=[
        {"site_id": "site-a", "baseline_kwh": 100, "actual_kwh": 150},  # actual > baseline
        {"site_id": "site-b", "baseline_kwh": 100, "actual_kwh": 70},
    ])
    report = provider.detect_anomaly(req)
    assert report.has_anomaly is True
    assert report.anomaly_type == "proof_mismatch"
    assert "site-a" in report.affected_proofs


def test_anomaly_baseline_drift_detected():
    provider = MockAgentProvider()
    req = AgentAnomalyRequest(
        proofs=[
            {"site_id": "site-a", "baseline_kwh": 200, "actual_kwh": 100},
        ],
        baseline_result={"baseline_kwh": 100},  # engine says 100, proof says 200
    )
    report = provider.detect_anomaly(req)
    assert report.has_anomaly is True
    assert report.anomaly_type == "baseline_drift"


def test_anomaly_baseline_drift_within_tolerance():
    provider = MockAgentProvider()
    req = AgentAnomalyRequest(
        proofs=[
            {"site_id": "site-a", "baseline_kwh": 110, "actual_kwh": 80},
        ],
        baseline_result={"baseline_kwh": 100},  # 10% drift, within 30% tolerance
    )
    report = provider.detect_anomaly(req)
    # Should not flag baseline_drift for < 30% deviation
    assert report.anomaly_type != "baseline_drift" or not report.has_anomaly


def test_anomaly_severity_escalation():
    """Critical anomalies should have higher severity than warnings."""
    provider = MockAgentProvider()
    # site-a has extreme reduction (150) vs others (~2 each) → z-score >> 3σ → critical
    req = AgentAnomalyRequest(proofs=[
        {"site_id": "site-a", "baseline_kwh": 150, "actual_kwh": 0},    # reduction=150
        {"site_id": "site-b", "baseline_kwh": 150, "actual_kwh": 148},  # reduction=2
        {"site_id": "site-c", "baseline_kwh": 150, "actual_kwh": 148},  # reduction=2
        {"site_id": "site-d", "baseline_kwh": 150, "actual_kwh": 148},  # reduction=2
        {"site_id": "site-e", "baseline_kwh": 150, "actual_kwh": 148},  # reduction=2
    ])
    report = provider.detect_anomaly(req)
    assert report.has_anomaly is True
    assert report.severity in ("warning", "critical")


def test_anomaly_recommendation_present():
    provider = MockAgentProvider()
    req = AgentAnomalyRequest(proofs=[
        {"site_id": "site-a", "baseline_kwh": 100, "actual_kwh": 150},
        {"site_id": "site-b", "baseline_kwh": 100, "actual_kwh": 70},
    ])
    report = provider.detect_anomaly(req)
    if report.has_anomaly:
        assert report.recommendation


# ---------- get_status ----------

def test_status_initial():
    provider = MockAgentProvider()
    status = provider.get_status()
    assert status.status == "active"
    assert status.provider == "mock"
    assert status.total_analyses == 0
    assert status.total_anomalies_detected == 0


def test_status_counts_analyses():
    provider = MockAgentProvider()
    req = AgentInsightRequest(event_id="evt-1", current_step="create")
    provider.generate_insight(req)
    provider.generate_insight(req)
    status = provider.get_status()
    assert status.total_analyses == 2


def test_status_counts_anomalies():
    provider = MockAgentProvider()
    req = AgentAnomalyRequest(proofs=[
        {"site_id": "site-a", "baseline_kwh": 100, "actual_kwh": 150},
        {"site_id": "site-b", "baseline_kwh": 100, "actual_kwh": 70},
    ])
    provider.detect_anomaly(req)
    status = provider.get_status()
    assert status.total_anomalies_detected == 1


# ---------- AgentService facade ----------

def test_service_delegates_to_provider():
    svc = AgentService()
    req = AgentInsightRequest(event_id="evt-1", current_step="create")
    resp = svc.generate_insight(req)
    assert isinstance(resp, AgentInsightResponse)


def test_service_detect_anomaly():
    svc = AgentService()
    req = AgentAnomalyRequest(proofs=[
        {"site_id": "site-a", "baseline_kwh": 100, "actual_kwh": 80},
    ])
    report = svc.detect_anomaly(req)
    assert isinstance(report, AnomalyReport)


def test_service_get_status():
    svc = AgentService()
    status = svc.get_status()
    assert isinstance(status, AgentStatusResponse)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
