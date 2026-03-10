"""TDD tests for upgraded AI baseline engine.

Tests multiple baseline computation methods and integration with
data adapters for a pluggable baseline pipeline.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.baseline_engine import (
    BaselineEngine,
    BaselineResult,
    compute_ewma_baseline,
    compute_percentile_baseline,
    compute_simple_baseline,
)
from services.data_adapters import CSVAdapter


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_history(hours: int = 168, base_kw: float = 100.0) -> pd.DataFrame:
    """Generate 7 days of hourly data with a daily pattern."""
    timestamps = pd.date_range("2026-03-03T00:00:00Z", periods=hours, freq="h")
    kw_values = [base_kw + (10 * (i % 24 - 12)) for i in range(hours)]
    return pd.DataFrame({"timestamp": timestamps.astype(str), "kw": kw_values})


# ---------------------------------------------------------------------------
# Simple baseline (existing)
# ---------------------------------------------------------------------------

class TestSimpleBaseline:
    def test_same_hour_average(self):
        df = _make_history()
        result = compute_simple_baseline(df, event_hour=14)
        assert isinstance(result, float)
        assert result > 0

    def test_returns_overall_mean_if_no_same_hour(self):
        # Only 1 hour of data
        df = pd.DataFrame({
            "timestamp": ["2026-03-10T10:00:00Z"],
            "kw": [200.0],
        })
        result = compute_simple_baseline(df, event_hour=22)
        assert result == 200.0


# ---------------------------------------------------------------------------
# EWMA baseline (new)
# ---------------------------------------------------------------------------

class TestEWMABaseline:
    def test_ewma_returns_float(self):
        df = _make_history()
        result = compute_ewma_baseline(df, event_hour=14, span=24)
        assert isinstance(result, float)
        assert result > 0

    def test_ewma_with_short_span(self):
        df = _make_history()
        result_short = compute_ewma_baseline(df, event_hour=14, span=6)
        result_long = compute_ewma_baseline(df, event_hour=14, span=48)
        # Both should be valid
        assert result_short > 0
        assert result_long > 0

    def test_ewma_weights_recent_data_more(self):
        # Create data with gradual increase — EWMA should track the trend
        df = _make_history(hours=168, base_kw=100.0)
        # Add upward trend
        for i in range(len(df)):
            df.loc[i, "kw"] = df.loc[i, "kw"] + i * 0.5
        result_short = compute_ewma_baseline(df, event_hour=10, span=3)
        result_long = compute_ewma_baseline(df, event_hour=10, span=48)
        # Short span EWMA should be higher (more responsive to recent trend)
        assert result_short > result_long


# ---------------------------------------------------------------------------
# Percentile baseline (new)
# ---------------------------------------------------------------------------

class TestPercentileBaseline:
    def test_percentile_50(self):
        df = _make_history()
        result = compute_percentile_baseline(df, event_hour=14, percentile=50)
        assert isinstance(result, float)
        assert result > 0

    def test_percentile_90_higher_than_50(self):
        df = _make_history()
        p50 = compute_percentile_baseline(df, event_hour=14, percentile=50)
        p90 = compute_percentile_baseline(df, event_hour=14, percentile=90)
        assert p90 >= p50

    def test_invalid_percentile_raises(self):
        df = _make_history()
        with pytest.raises(ValueError, match="percentile"):
            compute_percentile_baseline(df, event_hour=14, percentile=101)


# ---------------------------------------------------------------------------
# BaselineResult
# ---------------------------------------------------------------------------

class TestBaselineResult:
    def test_creation(self):
        result = BaselineResult(
            baseline_kwh=120.5,
            method="ewma",
            confidence=0.85,
            details={"span": 24},
        )
        assert result.baseline_kwh == 120.5
        assert result.method == "ewma"
        assert result.confidence == 0.85

    def test_to_dict(self):
        result = BaselineResult(
            baseline_kwh=100.0,
            method="simple",
            confidence=0.7,
            details={},
        )
        d = result.to_dict()
        assert d["baseline_kwh"] == 100.0
        assert d["method"] == "simple"


# ---------------------------------------------------------------------------
# BaselineEngine — multi-method orchestrator
# ---------------------------------------------------------------------------

class TestBaselineEngine:
    def test_compute_with_simple(self):
        df = _make_history()
        engine = BaselineEngine()

        result = engine.compute(df, event_hour=14, method="simple")
        assert result.method == "simple"
        assert result.baseline_kwh > 0

    def test_compute_with_ewma(self):
        df = _make_history()
        engine = BaselineEngine()

        result = engine.compute(df, event_hour=14, method="ewma")
        assert result.method == "ewma"
        assert result.baseline_kwh > 0

    def test_compute_with_percentile(self):
        df = _make_history()
        engine = BaselineEngine()

        result = engine.compute(df, event_hour=14, method="percentile")
        assert result.method == "percentile"
        assert result.baseline_kwh > 0

    def test_compute_auto_selects_best(self):
        df = _make_history()
        engine = BaselineEngine()

        result = engine.compute(df, event_hour=14, method="auto")
        assert result.method in {"simple", "ewma", "percentile"}
        assert result.baseline_kwh > 0
        assert result.confidence > 0

    def test_unknown_method_raises(self):
        df = _make_history()
        engine = BaselineEngine()

        with pytest.raises(ValueError, match="unknown method"):
            engine.compute(df, event_hour=14, method="neural_net")

    def test_available_methods(self):
        engine = BaselineEngine()
        methods = engine.available_methods()
        assert "simple" in methods
        assert "ewma" in methods
        assert "percentile" in methods
        assert "auto" in methods

    def test_compute_all_methods(self):
        df = _make_history()
        engine = BaselineEngine()

        results = engine.compute_all(df, event_hour=14)
        assert len(results) >= 3
        assert all(r.baseline_kwh > 0 for r in results)

    def test_integration_with_csv_adapter(self, tmp_path: Path):
        """End-to-end: CSV → adapter → engine → baseline result."""
        csv_file = tmp_path / "meter.csv"
        rows = []
        for h in range(168):  # 7 days
            ts = pd.Timestamp("2026-03-03") + pd.Timedelta(hours=h)
            kw = 100 + 10 * (h % 24 - 12)
            rows.append(f"{ts.isoformat()}Z,{kw}")
        csv_file.write_text("timestamp,kw\n" + "\n".join(rows) + "\n")

        adapter = CSVAdapter()
        df = adapter.load_dataframe(str(csv_file), site_id="site-a")

        engine = BaselineEngine()
        result = engine.compute(df, event_hour=14, method="auto")

        assert result.baseline_kwh > 0
        assert result.method in {"simple", "ewma", "percentile"}


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
