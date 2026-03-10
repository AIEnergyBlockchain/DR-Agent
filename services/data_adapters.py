"""Pluggable data source adapters for meter/energy data ingestion.

Adapters normalize data from different sources (CSV, JSON, API, IoT)
into a standard format for baseline computation and proof building.
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass
class MeterReading:
    timestamp: str
    kw: float
    site_id: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def validate_readings(readings: list[MeterReading]) -> list[str]:
    errors: list[str] = []
    for i, r in enumerate(readings):
        if not r.timestamp:
            errors.append(f"reading[{i}]: missing timestamp")
        if r.kw < 0:
            errors.append(f"reading[{i}]: negative kw value ({r.kw})")
    return errors


class CSVAdapter:
    def __init__(self, timestamp_col: str = "timestamp", kw_col: str = "kw"):
        self.timestamp_col = timestamp_col
        self.kw_col = kw_col

    def load(self, file_path: str, site_id: str) -> list[MeterReading]:
        readings: list[MeterReading] = []
        with open(file_path, newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                readings.append(
                    MeterReading(
                        timestamp=row[self.timestamp_col],
                        kw=float(row[self.kw_col]),
                        site_id=site_id,
                    )
                )
        return readings

    def load_dataframe(self, file_path: str, site_id: str) -> pd.DataFrame:
        readings = self.load(file_path, site_id)
        return pd.DataFrame(
            [{"timestamp": r.timestamp, "kw": r.kw} for r in readings]
        )


class JSONAdapter:
    def __init__(
        self,
        data_path: str | None = None,
        timestamp_key: str = "timestamp",
        kw_key: str = "kw",
    ):
        self.data_path = data_path
        self.timestamp_key = timestamp_key
        self.kw_key = kw_key

    def load(self, file_path: str, site_id: str) -> list[MeterReading]:
        raw = json.loads(Path(file_path).read_text())

        if self.data_path:
            for key in self.data_path.split("."):
                raw = raw[key]

        readings: list[MeterReading] = []
        for item in raw:
            readings.append(
                MeterReading(
                    timestamp=item[self.timestamp_key],
                    kw=float(item[self.kw_key]),
                    site_id=site_id,
                )
            )
        return readings

    def load_dataframe(self, file_path: str, site_id: str) -> pd.DataFrame:
        readings = self.load(file_path, site_id)
        return pd.DataFrame(
            [{"timestamp": r.timestamp, "kw": r.kw} for r in readings]
        )


class DataAdapterRegistry:
    def __init__(self) -> None:
        self._adapters: dict[str, CSVAdapter | JSONAdapter] = {}

    def register(self, name: str, adapter: CSVAdapter | JSONAdapter) -> None:
        self._adapters[name] = adapter

    def get(self, name: str) -> CSVAdapter | JSONAdapter:
        if name not in self._adapters:
            raise KeyError(f"unknown adapter: {name}")
        return self._adapters[name]

    def list_adapters(self) -> list[str]:
        return list(self._adapters.keys())

    @classmethod
    def default(cls) -> DataAdapterRegistry:
        registry = cls()
        registry.register("csv", CSVAdapter())
        registry.register("json", JSONAdapter())
        return registry
