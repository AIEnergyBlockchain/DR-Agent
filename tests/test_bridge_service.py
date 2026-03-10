"""TDD tests for the DRT bridge service layer.

Tests the Python-side bridge orchestration that tracks cross-chain
transfer requests and manages bridge state in SQLite.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.bridge import BridgeService, BridgeTransfer, BridgeDirection
from services.db import connect


# ---------------------------------------------------------------------------
# BridgeDirection enum
# ---------------------------------------------------------------------------

class TestBridgeDirection:
    def test_home_to_remote(self):
        d = BridgeDirection.HOME_TO_REMOTE
        assert d.value == "home_to_remote"

    def test_remote_to_home(self):
        d = BridgeDirection.REMOTE_TO_HOME
        assert d.value == "remote_to_home"


# ---------------------------------------------------------------------------
# BridgeService — transfer tracking
# ---------------------------------------------------------------------------

class TestBridgeService:
    def test_initiate_transfer(self, tmp_path: Path):
        svc = BridgeService(db_path=str(tmp_path / "bridge.db"))

        transfer = svc.initiate_transfer(
            sender="0xUserA",
            amount_wei="1000000000000000000",
            direction=BridgeDirection.HOME_TO_REMOTE,
        )
        assert transfer.transfer_id is not None
        assert transfer.sender == "0xUserA"
        assert transfer.amount_wei == "1000000000000000000"
        assert transfer.direction == BridgeDirection.HOME_TO_REMOTE
        assert transfer.status == "initiated"
        assert transfer.source_tx_hash is None
        assert transfer.dest_tx_hash is None

    def test_mark_source_submitted(self, tmp_path: Path):
        svc = BridgeService(db_path=str(tmp_path / "bridge.db"))
        transfer = svc.initiate_transfer(
            sender="0xUserA",
            amount_wei="1000",
            direction=BridgeDirection.HOME_TO_REMOTE,
        )

        updated = svc.mark_source_submitted(
            transfer.transfer_id, source_tx_hash="0xABC123"
        )
        assert updated.status == "source_submitted"
        assert updated.source_tx_hash == "0xABC123"

    def test_mark_source_confirmed(self, tmp_path: Path):
        svc = BridgeService(db_path=str(tmp_path / "bridge.db"))
        transfer = svc.initiate_transfer(
            sender="0xUserA",
            amount_wei="1000",
            direction=BridgeDirection.HOME_TO_REMOTE,
        )
        svc.mark_source_submitted(transfer.transfer_id, source_tx_hash="0xABC")

        updated = svc.mark_source_confirmed(transfer.transfer_id)
        assert updated.status == "source_confirmed"

    def test_mark_dest_submitted(self, tmp_path: Path):
        svc = BridgeService(db_path=str(tmp_path / "bridge.db"))
        transfer = svc.initiate_transfer(
            sender="0xUserA",
            amount_wei="1000",
            direction=BridgeDirection.HOME_TO_REMOTE,
        )
        svc.mark_source_submitted(transfer.transfer_id, source_tx_hash="0xABC")
        svc.mark_source_confirmed(transfer.transfer_id)

        updated = svc.mark_dest_submitted(
            transfer.transfer_id, dest_tx_hash="0xDEF456"
        )
        assert updated.status == "dest_submitted"
        assert updated.dest_tx_hash == "0xDEF456"

    def test_mark_completed(self, tmp_path: Path):
        svc = BridgeService(db_path=str(tmp_path / "bridge.db"))
        transfer = svc.initiate_transfer(
            sender="0xUserA",
            amount_wei="1000",
            direction=BridgeDirection.HOME_TO_REMOTE,
        )
        svc.mark_source_submitted(transfer.transfer_id, source_tx_hash="0xABC")
        svc.mark_source_confirmed(transfer.transfer_id)
        svc.mark_dest_submitted(transfer.transfer_id, dest_tx_hash="0xDEF")

        updated = svc.mark_completed(transfer.transfer_id)
        assert updated.status == "completed"

    def test_get_transfer(self, tmp_path: Path):
        svc = BridgeService(db_path=str(tmp_path / "bridge.db"))
        transfer = svc.initiate_transfer(
            sender="0xUserA",
            amount_wei="5000",
            direction=BridgeDirection.REMOTE_TO_HOME,
        )

        fetched = svc.get_transfer(transfer.transfer_id)
        assert fetched is not None
        assert fetched.transfer_id == transfer.transfer_id
        assert fetched.amount_wei == "5000"

    def test_get_transfer_not_found(self, tmp_path: Path):
        svc = BridgeService(db_path=str(tmp_path / "bridge.db"))
        assert svc.get_transfer("nonexistent") is None

    def test_list_pending_transfers(self, tmp_path: Path):
        svc = BridgeService(db_path=str(tmp_path / "bridge.db"))

        svc.initiate_transfer("0xA", "100", BridgeDirection.HOME_TO_REMOTE)
        t2 = svc.initiate_transfer("0xB", "200", BridgeDirection.HOME_TO_REMOTE)
        svc.mark_source_submitted(t2.transfer_id, source_tx_hash="0x1")
        svc.mark_source_confirmed(t2.transfer_id)
        svc.mark_dest_submitted(t2.transfer_id, dest_tx_hash="0x2")
        svc.mark_completed(t2.transfer_id)

        pending = svc.list_pending_transfers()
        assert len(pending) == 1
        assert pending[0].sender == "0xA"

    def test_full_lifecycle(self, tmp_path: Path):
        svc = BridgeService(db_path=str(tmp_path / "bridge.db"))

        # Initiate
        t = svc.initiate_transfer("0xUser", "1000", BridgeDirection.HOME_TO_REMOTE)
        assert t.status == "initiated"

        # Source submitted
        t = svc.mark_source_submitted(t.transfer_id, "0xSrcTx")
        assert t.status == "source_submitted"

        # Source confirmed
        t = svc.mark_source_confirmed(t.transfer_id)
        assert t.status == "source_confirmed"

        # Dest submitted
        t = svc.mark_dest_submitted(t.transfer_id, "0xDstTx")
        assert t.status == "dest_submitted"

        # Completed
        t = svc.mark_completed(t.transfer_id)
        assert t.status == "completed"

        # Verify final state
        final = svc.get_transfer(t.transfer_id)
        assert final.source_tx_hash == "0xSrcTx"
        assert final.dest_tx_hash == "0xDstTx"
        assert final.status == "completed"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
