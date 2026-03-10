"""TDD tests for pluggable data source adapters.

Adapters normalize meter/energy data from different sources into a
standard DataFrame format (timestamp, kw) for baseline computation.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import pandas as pd
import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.data_adapters import (
    CSVAdapter,
    JSONAdapter,
    DataAdapterRegistry,
    MeterReading,
    validate_readings,
)


# ---------------------------------------------------------------------------
# MeterReading
# ---------------------------------------------------------------------------

class TestMeterReading:
    def test_creation(self):
        r = MeterReading(timestamp="2026-03-10T10:00:00Z", kw=150.5, site_id="site-a")
        assert r.timestamp == "2026-03-10T10:00:00Z"
        assert r.kw == 150.5
        assert r.site_id == "site-a"

    def test_to_dict(self):
        r = MeterReading(timestamp="2026-03-10T10:00:00Z", kw=100.0, site_id="site-a")
        d = r.to_dict()
        assert d["timestamp"] == "2026-03-10T10:00:00Z"
        assert d["kw"] == 100.0


# ---------------------------------------------------------------------------
# CSVAdapter
# ---------------------------------------------------------------------------

class TestCSVAdapter:
    def test_load_standard_csv(self, tmp_path: Path):
        csv_file = tmp_path / "meter.csv"
        csv_file.write_text(
            "timestamp,kw\n"
            "2026-03-10T10:00:00Z,150\n"
            "2026-03-10T10:15:00Z,145\n"
            "2026-03-10T10:30:00Z,160\n"
        )

        adapter = CSVAdapter()
        readings = adapter.load(str(csv_file), site_id="site-a")

        assert len(readings) == 3
        assert readings[0].kw == 150.0
        assert readings[0].site_id == "site-a"

    def test_load_custom_columns(self, tmp_path: Path):
        csv_file = tmp_path / "meter.csv"
        csv_file.write_text(
            "time,power_kw\n"
            "2026-03-10T10:00:00Z,150\n"
        )

        adapter = CSVAdapter(timestamp_col="time", kw_col="power_kw")
        readings = adapter.load(str(csv_file), site_id="site-a")

        assert len(readings) == 1
        assert readings[0].kw == 150.0

    def test_to_dataframe(self, tmp_path: Path):
        csv_file = tmp_path / "meter.csv"
        csv_file.write_text(
            "timestamp,kw\n"
            "2026-03-10T10:00:00Z,150\n"
            "2026-03-10T10:15:00Z,145\n"
        )

        adapter = CSVAdapter()
        df = adapter.load_dataframe(str(csv_file), site_id="site-a")

        assert isinstance(df, pd.DataFrame)
        assert list(df.columns) == ["timestamp", "kw"]
        assert len(df) == 2

    def test_empty_csv_raises(self, tmp_path: Path):
        csv_file = tmp_path / "empty.csv"
        csv_file.write_text("timestamp,kw\n")

        adapter = CSVAdapter()
        readings = adapter.load(str(csv_file), site_id="site-a")
        assert len(readings) == 0


# ---------------------------------------------------------------------------
# JSONAdapter
# ---------------------------------------------------------------------------

class TestJSONAdapter:
    def test_load_json_array(self, tmp_path: Path):
        json_file = tmp_path / "meter.json"
        data = [
            {"timestamp": "2026-03-10T10:00:00Z", "kw": 150},
            {"timestamp": "2026-03-10T10:15:00Z", "kw": 145},
        ]
        json_file.write_text(json.dumps(data))

        adapter = JSONAdapter()
        readings = adapter.load(str(json_file), site_id="site-b")

        assert len(readings) == 2
        assert readings[1].kw == 145.0
        assert readings[1].site_id == "site-b"

    def test_load_nested_json(self, tmp_path: Path):
        json_file = tmp_path / "meter.json"
        data = {
            "readings": [
                {"ts": "2026-03-10T10:00:00Z", "power": 200},
            ]
        }
        json_file.write_text(json.dumps(data))

        adapter = JSONAdapter(
            data_path="readings",
            timestamp_key="ts",
            kw_key="power",
        )
        readings = adapter.load(str(json_file), site_id="site-c")

        assert len(readings) == 1
        assert readings[0].kw == 200.0

    def test_to_dataframe(self, tmp_path: Path):
        json_file = tmp_path / "meter.json"
        data = [{"timestamp": "2026-03-10T10:00:00Z", "kw": 100}]
        json_file.write_text(json.dumps(data))

        adapter = JSONAdapter()
        df = adapter.load_dataframe(str(json_file), site_id="site-a")

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 1


# ---------------------------------------------------------------------------
# DataAdapterRegistry
# ---------------------------------------------------------------------------

class TestDataAdapterRegistry:
    def test_register_and_get(self):
        registry = DataAdapterRegistry()
        adapter = CSVAdapter()
        registry.register("csv", adapter)

        assert registry.get("csv") is adapter

    def test_get_unknown_raises(self):
        registry = DataAdapterRegistry()

        with pytest.raises(KeyError, match="csv"):
            registry.get("csv")

    def test_default_registry_has_csv_and_json(self):
        registry = DataAdapterRegistry.default()

        assert isinstance(registry.get("csv"), CSVAdapter)
        assert isinstance(registry.get("json"), JSONAdapter)

    def test_list_adapters(self):
        registry = DataAdapterRegistry.default()
        names = registry.list_adapters()

        assert "csv" in names
        assert "json" in names


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

class TestValidateReadings:
    def test_valid_readings(self):
        readings = [
            MeterReading("2026-03-10T10:00:00Z", 100.0, "site-a"),
            MeterReading("2026-03-10T10:15:00Z", 110.0, "site-a"),
        ]
        errors = validate_readings(readings)
        assert errors == []

    def test_negative_kw(self):
        readings = [
            MeterReading("2026-03-10T10:00:00Z", -50.0, "site-a"),
        ]
        errors = validate_readings(readings)
        assert len(errors) == 1
        assert "negative" in errors[0].lower()

    def test_missing_timestamp(self):
        readings = [
            MeterReading("", 100.0, "site-a"),
        ]
        errors = validate_readings(readings)
        assert len(errors) == 1

    def test_empty_list_valid(self):
        errors = validate_readings([])
        assert errors == []


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
