"""TDD tests for SubmitterService multi-chain integration.

Verifies that the submitter correctly routes transactions based on
ChainConfig (simulated / fuji / custom-l1) and selects the right
chain action script per target.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.chain_config import ChainConfig, ChainTarget, resolve_chain_config
from services.submitter import SubmitterService
from services.dto import EventCreateRequest, ProofSubmitRequest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_event_req(event_id: str = "evt-multichain-001") -> EventCreateRequest:
    return EventCreateRequest(
        event_id=event_id,
        start_time="2026-03-10T10:00:00Z",
        end_time="2026-03-10T11:00:00Z",
        target_kw=200,
        reward_rate=10,
        penalty_rate=5,
    )


# ---------------------------------------------------------------------------
# Tests: chain mode resolution in submitter
# ---------------------------------------------------------------------------

class TestSubmitterChainMode:
    def test_simulated_mode_default(self, tmp_path: Path, monkeypatch):
        monkeypatch.delenv("DR_CHAIN_MODE", raising=False)
        svc = SubmitterService(db_path=str(tmp_path / "test.db"))
        assert svc.chain_mode == "simulated"
        assert svc.live_chain is False

    def test_fuji_live_mode(self, tmp_path: Path, monkeypatch):
        monkeypatch.setenv("DR_CHAIN_MODE", "fuji-live")
        svc = SubmitterService(db_path=str(tmp_path / "test.db"))
        assert svc.chain_mode == "fuji-live"
        assert svc.live_chain is True

    def test_custom_l1_mode(self, tmp_path: Path, monkeypatch):
        monkeypatch.setenv("DR_CHAIN_MODE", "custom-l1")
        svc = SubmitterService(db_path=str(tmp_path / "test.db"))
        assert svc.chain_mode == "custom-l1"
        assert svc.live_chain is True

    def test_dr_l1_alias(self, tmp_path: Path, monkeypatch):
        monkeypatch.setenv("DR_CHAIN_MODE", "dr-l1")
        svc = SubmitterService(db_path=str(tmp_path / "test.db"))
        assert svc.chain_mode == "dr-l1"
        assert svc.live_chain is True


# ---------------------------------------------------------------------------
# Tests: chain action script selection
# ---------------------------------------------------------------------------

class TestSubmitterScriptSelection:
    def test_fuji_uses_fuji_script(self, tmp_path: Path, monkeypatch):
        monkeypatch.setenv("DR_CHAIN_MODE", "fuji-live")
        svc = SubmitterService(db_path=str(tmp_path / "test.db"))
        assert svc.chain_action_script.name == "fuji_chain_action.js"

    def test_custom_l1_uses_l1_script(self, tmp_path: Path, monkeypatch):
        monkeypatch.setenv("DR_CHAIN_MODE", "custom-l1")
        svc = SubmitterService(db_path=str(tmp_path / "test.db"))
        assert svc.chain_action_script.name == "l1_chain_action.js"

    def test_simulated_does_not_call_script(self, tmp_path: Path, monkeypatch):
        monkeypatch.delenv("DR_CHAIN_MODE", raising=False)
        svc = SubmitterService(db_path=str(tmp_path / "test.db"))
        # In simulated mode, _chain_tx returns mock result without calling script
        result = svc.create_event(_create_event_req())
        assert result.tx_hash.startswith("0x")
        assert result.tx_state == "confirmed"


# ---------------------------------------------------------------------------
# Tests: full closed-loop with custom-l1 in simulated fallback
# ---------------------------------------------------------------------------

class TestCustomL1ClosedLoop:
    """Custom L1 in simulated mode should still produce valid results."""

    def test_create_event_simulated(self, tmp_path: Path, monkeypatch):
        monkeypatch.delenv("DR_CHAIN_MODE", raising=False)
        svc = SubmitterService(db_path=str(tmp_path / "test.db"))

        result = svc.create_event(_create_event_req("evt-l1-sim-001"))
        assert result.status == "active"
        assert result.tx_hash.startswith("0x")

    def test_full_loop_simulated(self, tmp_path: Path, monkeypatch):
        monkeypatch.delenv("DR_CHAIN_MODE", raising=False)
        svc = SubmitterService(db_path=str(tmp_path / "test.db"))

        event_id = "evt-l1-full-loop"

        # create
        created = svc.create_event(_create_event_req(event_id))
        assert created.status == "active"

        # proof
        proof = svc.submit_proof(
            ProofSubmitRequest(
                event_id=event_id,
                site_id="site-a",
                baseline_kwh=150,
                actual_kwh=40,
                uri="ipfs://l1-proof-a",
                baseline_method="simple",
            ),
            actor_id="site-a",
        )
        assert proof.tx_hash.startswith("0x")

        # close
        closed = svc.close_event(event_id)
        assert closed.status == "closed"

        # settle
        settlements = svc.settle_event(event_id, ["site-a"])
        assert len(settlements) == 1
        assert settlements[0].tx_hash.startswith("0x")

        # claim
        claimed = svc.claim_reward(event_id, "site-a", actor_id="site-a")
        assert claimed.status == "claimed"


# ---------------------------------------------------------------------------
# Tests: chain config resolve integration
# ---------------------------------------------------------------------------

class TestChainConfigResolveIntegration:
    def test_resolve_simulated(self, monkeypatch):
        monkeypatch.delenv("DR_CHAIN_MODE", raising=False)
        cfg = resolve_chain_config()
        assert cfg.target == ChainTarget.SIMULATED
        assert cfg.is_live is False

    def test_resolve_custom_l1(self, monkeypatch):
        monkeypatch.setenv("DR_CHAIN_MODE", "custom-l1")
        monkeypatch.setenv("DR_L1_RPC_URL", "http://127.0.0.1:9650/ext/bc/dr-l1/rpc")
        monkeypatch.setenv("DR_L1_CHAIN_ID", "99999")

        cfg = resolve_chain_config()
        assert cfg.target == ChainTarget.CUSTOM_L1
        assert cfg.chain_id == 99999
        assert cfg.chain_action_script_name == "l1_chain_action.js"
        assert cfg.hardhat_network == "dr_l1"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
