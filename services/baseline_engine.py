"""Upgraded AI baseline engine with multiple computation methods.

Methods:
  - simple: 7-day same-hour average (from original baseline.py)
  - ewma: Exponentially Weighted Moving Average for same-hour values
  - percentile: Percentile-based baseline for same-hour values
  - auto: Selects best method based on data quality/quantity
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any

import pandas as pd


@dataclass
class BaselineResult:
    baseline_kwh: float
    method: str
    confidence: float
    details: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def compute_simple_baseline(history_df: pd.DataFrame, event_hour: int) -> float:
    df = history_df.copy()
    df["hour"] = pd.to_datetime(df["timestamp"]).dt.hour

    cutoff = pd.to_datetime(df["timestamp"]).max() - pd.Timedelta(days=7)
    recent = df[pd.to_datetime(df["timestamp"]) >= cutoff]

    same_hour = recent[recent["hour"] == event_hour]
    if same_hour.empty:
        return float(df["kw"].mean())
    return float(same_hour["kw"].mean())


def compute_ewma_baseline(
    history_df: pd.DataFrame, event_hour: int, span: int = 24
) -> float:
    df = history_df.copy()
    df["hour"] = pd.to_datetime(df["timestamp"]).dt.hour
    same_hour = df[df["hour"] == event_hour].copy()

    if same_hour.empty:
        return float(df["kw"].mean())

    ewma = same_hour["kw"].ewm(span=span, adjust=False).mean()
    return float(ewma.iloc[-1])


def compute_percentile_baseline(
    history_df: pd.DataFrame, event_hour: int, percentile: int = 50
) -> float:
    if percentile < 0 or percentile > 100:
        raise ValueError(f"percentile must be 0-100, got {percentile}")

    df = history_df.copy()
    df["hour"] = pd.to_datetime(df["timestamp"]).dt.hour
    same_hour = df[df["hour"] == event_hour]

    if same_hour.empty:
        return float(df["kw"].quantile(percentile / 100))
    return float(same_hour["kw"].quantile(percentile / 100))


class BaselineEngine:
    _METHODS = {"simple", "ewma", "percentile", "auto"}

    def compute(
        self,
        history_df: pd.DataFrame,
        event_hour: int,
        method: str = "auto",
    ) -> BaselineResult:
        if method not in self._METHODS:
            raise ValueError(
                f"unknown method: '{method}'. Valid: {', '.join(sorted(self._METHODS))}"
            )

        if method == "auto":
            return self._compute_auto(history_df, event_hour)
        if method == "simple":
            return self._compute_simple(history_df, event_hour)
        if method == "ewma":
            return self._compute_ewma(history_df, event_hour)
        if method == "percentile":
            return self._compute_percentile(history_df, event_hour)

        raise ValueError(f"unknown method: {method}")

    def compute_all(
        self, history_df: pd.DataFrame, event_hour: int
    ) -> list[BaselineResult]:
        results = []
        for method in ("simple", "ewma", "percentile"):
            results.append(self.compute(history_df, event_hour, method=method))
        return results

    def available_methods(self) -> list[str]:
        return sorted(self._METHODS)

    def _compute_simple(
        self, df: pd.DataFrame, event_hour: int
    ) -> BaselineResult:
        value = compute_simple_baseline(df, event_hour)
        n_points = len(df[pd.to_datetime(df["timestamp"]).dt.hour == event_hour])
        confidence = min(1.0, n_points / 7)
        return BaselineResult(
            baseline_kwh=value,
            method="simple",
            confidence=confidence,
            details={"same_hour_points": n_points},
        )

    def _compute_ewma(
        self, df: pd.DataFrame, event_hour: int
    ) -> BaselineResult:
        value = compute_ewma_baseline(df, event_hour, span=24)
        n_points = len(df[pd.to_datetime(df["timestamp"]).dt.hour == event_hour])
        confidence = min(1.0, n_points / 7) * 0.95
        return BaselineResult(
            baseline_kwh=value,
            method="ewma",
            confidence=confidence,
            details={"span": 24, "same_hour_points": n_points},
        )

    def _compute_percentile(
        self, df: pd.DataFrame, event_hour: int
    ) -> BaselineResult:
        value = compute_percentile_baseline(df, event_hour, percentile=75)
        n_points = len(df[pd.to_datetime(df["timestamp"]).dt.hour == event_hour])
        confidence = min(1.0, n_points / 7) * 0.9
        return BaselineResult(
            baseline_kwh=value,
            method="percentile",
            confidence=confidence,
            details={"percentile": 75, "same_hour_points": n_points},
        )

    def _compute_auto(
        self, df: pd.DataFrame, event_hour: int
    ) -> BaselineResult:
        all_results = self.compute_all(df, event_hour)
        best = max(all_results, key=lambda r: r.confidence)
        return best
