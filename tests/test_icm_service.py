"""TDD tests for the ICM (Interchain Messaging) service.

Tests the Python-side message relay tracking that monitors cross-chain
messages and orchestrates bridge/settlement actions.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.icm import ICMService, ICMMessage, MessageType, MessageStatus


# ---------------------------------------------------------------------------
# MessageType enum
# ---------------------------------------------------------------------------

class TestMessageType:
    def test_bridge_transfer(self):
        assert MessageType.BRIDGE_TRANSFER.value == "bridge_transfer"

    def test_settlement_sync(self):
        assert MessageType.SETTLEMENT_SYNC.value == "settlement_sync"

    def test_proof_attestation(self):
        assert MessageType.PROOF_ATTESTATION.value == "proof_attestation"


# ---------------------------------------------------------------------------
# ICMService — message lifecycle
# ---------------------------------------------------------------------------

class TestICMService:
    def test_create_message(self, tmp_path: Path):
        svc = ICMService(db_path=str(tmp_path / "icm.db"))

        msg = svc.create_message(
            source_chain="fuji:43113",
            dest_chain="dr-l1:99999",
            message_type=MessageType.BRIDGE_TRANSFER,
            sender="0xOperator",
            payload={"amount": "1000", "recipient": "0xUser"},
        )
        assert msg.message_id is not None
        assert msg.source_chain == "fuji:43113"
        assert msg.dest_chain == "dr-l1:99999"
        assert msg.message_type == MessageType.BRIDGE_TRANSFER
        assert msg.status == MessageStatus.PENDING

    def test_mark_sent(self, tmp_path: Path):
        svc = ICMService(db_path=str(tmp_path / "icm.db"))
        msg = svc.create_message("fuji", "dr-l1", MessageType.BRIDGE_TRANSFER, "0xOp", {})

        updated = svc.mark_sent(msg.message_id, tx_hash="0xSendTx")
        assert updated.status == MessageStatus.SENT
        assert updated.source_tx_hash == "0xSendTx"

    def test_mark_delivered(self, tmp_path: Path):
        svc = ICMService(db_path=str(tmp_path / "icm.db"))
        msg = svc.create_message("fuji", "dr-l1", MessageType.SETTLEMENT_SYNC, "0xOp", {})
        svc.mark_sent(msg.message_id, tx_hash="0xSend")

        updated = svc.mark_delivered(msg.message_id, dest_tx_hash="0xRecvTx")
        assert updated.status == MessageStatus.DELIVERED
        assert updated.dest_tx_hash == "0xRecvTx"

    def test_mark_processed(self, tmp_path: Path):
        svc = ICMService(db_path=str(tmp_path / "icm.db"))
        msg = svc.create_message("dr-l1", "fuji", MessageType.PROOF_ATTESTATION, "0xOp", {})
        svc.mark_sent(msg.message_id, tx_hash="0xS")
        svc.mark_delivered(msg.message_id, dest_tx_hash="0xD")

        updated = svc.mark_processed(msg.message_id)
        assert updated.status == MessageStatus.PROCESSED

    def test_mark_failed(self, tmp_path: Path):
        svc = ICMService(db_path=str(tmp_path / "icm.db"))
        msg = svc.create_message("fuji", "dr-l1", MessageType.BRIDGE_TRANSFER, "0xOp", {})
        svc.mark_sent(msg.message_id, tx_hash="0xS")

        updated = svc.mark_failed(msg.message_id, error="timeout")
        assert updated.status == MessageStatus.FAILED
        assert updated.error == "timeout"

    def test_get_message(self, tmp_path: Path):
        svc = ICMService(db_path=str(tmp_path / "icm.db"))
        msg = svc.create_message("fuji", "dr-l1", MessageType.BRIDGE_TRANSFER, "0xOp", {"x": 1})

        fetched = svc.get_message(msg.message_id)
        assert fetched.payload == {"x": 1}

    def test_get_message_not_found(self, tmp_path: Path):
        svc = ICMService(db_path=str(tmp_path / "icm.db"))
        assert svc.get_message("nonexistent") is None

    def test_list_pending_messages(self, tmp_path: Path):
        svc = ICMService(db_path=str(tmp_path / "icm.db"))

        m1 = svc.create_message("fuji", "dr-l1", MessageType.BRIDGE_TRANSFER, "0xA", {})
        m2 = svc.create_message("dr-l1", "fuji", MessageType.SETTLEMENT_SYNC, "0xB", {})
        svc.mark_sent(m2.message_id, tx_hash="0x1")
        svc.mark_delivered(m2.message_id, dest_tx_hash="0x2")
        svc.mark_processed(m2.message_id)

        pending = svc.list_pending_messages()
        assert len(pending) == 1
        assert pending[0].message_id == m1.message_id

    def test_list_by_type(self, tmp_path: Path):
        svc = ICMService(db_path=str(tmp_path / "icm.db"))

        svc.create_message("fuji", "dr-l1", MessageType.BRIDGE_TRANSFER, "0xA", {})
        svc.create_message("fuji", "dr-l1", MessageType.SETTLEMENT_SYNC, "0xB", {})
        svc.create_message("fuji", "dr-l1", MessageType.BRIDGE_TRANSFER, "0xC", {})

        bridge_msgs = svc.list_by_type(MessageType.BRIDGE_TRANSFER)
        assert len(bridge_msgs) == 2

    def test_full_lifecycle(self, tmp_path: Path):
        svc = ICMService(db_path=str(tmp_path / "icm.db"))

        msg = svc.create_message(
            "fuji:43113", "dr-l1:99999",
            MessageType.BRIDGE_TRANSFER, "0xOp",
            {"amount": "5000", "recipient": "0xUser"},
        )
        assert msg.status == MessageStatus.PENDING

        msg = svc.mark_sent(msg.message_id, "0xSourceTx")
        assert msg.status == MessageStatus.SENT

        msg = svc.mark_delivered(msg.message_id, "0xDestTx")
        assert msg.status == MessageStatus.DELIVERED

        msg = svc.mark_processed(msg.message_id)
        assert msg.status == MessageStatus.PROCESSED

        final = svc.get_message(msg.message_id)
        assert final.source_tx_hash == "0xSourceTx"
        assert final.dest_tx_hash == "0xDestTx"
        assert final.error is None


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
