"""TDD tests for multi-chain configuration abstraction.

RED phase: These tests define the expected behavior of ChainConfig
before implementation exists.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.chain_config import (
    ChainConfig,
    ChainTarget,
    ContractAddresses,
    resolve_chain_config,
)


# ---------------------------------------------------------------------------
# ChainTarget enum
# ---------------------------------------------------------------------------

class TestChainTarget:
    def test_simulated_target(self):
        t = ChainTarget.SIMULATED
        assert t.value == "simulated"
        assert t.is_live is False

    def test_fuji_target(self):
        t = ChainTarget.FUJI
        assert t.value == "fuji"
        assert t.is_live is True

    def test_custom_l1_target(self):
        t = ChainTarget.CUSTOM_L1
        assert t.value == "custom-l1"
        assert t.is_live is True

    def test_from_env_string_simulated(self):
        assert ChainTarget.from_env("simulated") == ChainTarget.SIMULATED

    def test_from_env_string_fuji_live(self):
        assert ChainTarget.from_env("fuji-live") == ChainTarget.FUJI

    def test_from_env_string_fuji(self):
        assert ChainTarget.from_env("fuji") == ChainTarget.FUJI

    def test_from_env_string_custom_l1(self):
        assert ChainTarget.from_env("custom-l1") == ChainTarget.CUSTOM_L1

    def test_from_env_string_dr_l1(self):
        assert ChainTarget.from_env("dr-l1") == ChainTarget.CUSTOM_L1

    def test_from_env_string_case_insensitive(self):
        assert ChainTarget.from_env("FUJI-LIVE") == ChainTarget.FUJI
        assert ChainTarget.from_env("Simulated") == ChainTarget.SIMULATED

    def test_from_env_string_with_whitespace(self):
        assert ChainTarget.from_env("  fuji  ") == ChainTarget.FUJI

    def test_from_env_unknown_raises(self):
        with pytest.raises(ValueError, match="unknown chain target"):
            ChainTarget.from_env("mainnet-prod")


# ---------------------------------------------------------------------------
# ContractAddresses
# ---------------------------------------------------------------------------

class TestContractAddresses:
    def test_creation(self):
        addrs = ContractAddresses(
            event_manager="0x1111111111111111111111111111111111111111",
            proof_registry="0x2222222222222222222222222222222222222222",
            drt_token="0x3333333333333333333333333333333333333333",
            settlement="0x4444444444444444444444444444444444444444",
        )
        assert addrs.event_manager == "0x1111111111111111111111111111111111111111"
        assert addrs.settlement == "0x4444444444444444444444444444444444444444"

    def test_from_deployment_json(self, tmp_path: Path):
        deploy_data = {
            "EventManager": "0xAAA",
            "ProofRegistry": "0xBBB",
            "DRToken": "0xCCC",
            "Settlement": "0xDDD",
        }
        deploy_file = tmp_path / "deploy.json"
        deploy_file.write_text(json.dumps(deploy_data))

        addrs = ContractAddresses.from_deployment_file(str(deploy_file))
        assert addrs.event_manager == "0xAAA"
        assert addrs.proof_registry == "0xBBB"
        assert addrs.drt_token == "0xCCC"
        assert addrs.settlement == "0xDDD"

    def test_from_deployment_json_missing_field(self, tmp_path: Path):
        deploy_file = tmp_path / "deploy.json"
        deploy_file.write_text(json.dumps({"EventManager": "0xAAA"}))

        with pytest.raises(KeyError):
            ContractAddresses.from_deployment_file(str(deploy_file))

    def test_none_for_simulated(self):
        """Simulated mode should work with no contract addresses."""
        addrs = ContractAddresses.none()
        assert addrs.event_manager is None
        assert addrs.proof_registry is None
        assert addrs.drt_token is None
        assert addrs.settlement is None


# ---------------------------------------------------------------------------
# ChainConfig
# ---------------------------------------------------------------------------

class TestChainConfig:
    def test_simulated_defaults(self):
        cfg = ChainConfig(target=ChainTarget.SIMULATED)
        assert cfg.target == ChainTarget.SIMULATED
        assert cfg.is_live is False
        assert cfg.rpc_url is None
        assert cfg.chain_id is None

    def test_fuji_config(self):
        cfg = ChainConfig(
            target=ChainTarget.FUJI,
            rpc_url="https://api.avax-test.network/ext/bc/C/rpc",
            chain_id=43113,
            contracts=ContractAddresses(
                event_manager="0xAAA",
                proof_registry="0xBBB",
                drt_token="0xCCC",
                settlement="0xDDD",
            ),
        )
        assert cfg.is_live is True
        assert cfg.chain_id == 43113
        assert cfg.contracts.event_manager == "0xAAA"

    def test_custom_l1_config(self):
        cfg = ChainConfig(
            target=ChainTarget.CUSTOM_L1,
            rpc_url="http://127.0.0.1:9650/ext/bc/dr-l1/rpc",
            chain_id=99999,
            contracts=ContractAddresses(
                event_manager="0xE1",
                proof_registry="0xP1",
                drt_token="0xD1",
                settlement="0xS1",
            ),
        )
        assert cfg.is_live is True
        assert cfg.target == ChainTarget.CUSTOM_L1
        assert cfg.chain_id == 99999
        assert cfg.rpc_url == "http://127.0.0.1:9650/ext/bc/dr-l1/rpc"

    def test_chain_action_script_path_fuji(self):
        cfg = ChainConfig(target=ChainTarget.FUJI)
        assert cfg.chain_action_script_name == "fuji_chain_action.js"

    def test_chain_action_script_path_custom_l1(self):
        cfg = ChainConfig(target=ChainTarget.CUSTOM_L1)
        assert cfg.chain_action_script_name == "l1_chain_action.js"

    def test_chain_action_script_path_simulated(self):
        cfg = ChainConfig(target=ChainTarget.SIMULATED)
        assert cfg.chain_action_script_name is None

    def test_to_dict(self):
        cfg = ChainConfig(
            target=ChainTarget.FUJI,
            rpc_url="https://api.avax-test.network/ext/bc/C/rpc",
            chain_id=43113,
        )
        d = cfg.to_dict()
        assert d["target"] == "fuji"
        assert d["is_live"] is True
        assert d["chain_id"] == 43113

    def test_hardhat_network_name_fuji(self):
        cfg = ChainConfig(target=ChainTarget.FUJI)
        assert cfg.hardhat_network == "fuji"

    def test_hardhat_network_name_custom_l1(self):
        cfg = ChainConfig(target=ChainTarget.CUSTOM_L1)
        assert cfg.hardhat_network == "dr_l1"


# ---------------------------------------------------------------------------
# resolve_chain_config — factory from env
# ---------------------------------------------------------------------------

class TestResolveChainConfig:
    def test_simulated_from_env(self, monkeypatch):
        monkeypatch.setenv("DR_CHAIN_MODE", "simulated")
        monkeypatch.delenv("DR_L1_RPC_URL", raising=False)

        cfg = resolve_chain_config()
        assert cfg.target == ChainTarget.SIMULATED
        assert cfg.is_live is False

    def test_fuji_from_env(self, monkeypatch):
        monkeypatch.setenv("DR_CHAIN_MODE", "fuji-live")

        cfg = resolve_chain_config()
        assert cfg.target == ChainTarget.FUJI
        assert cfg.chain_id == 43113
        assert "avax-test" in cfg.rpc_url

    def test_custom_l1_from_env(self, monkeypatch):
        monkeypatch.setenv("DR_CHAIN_MODE", "custom-l1")
        monkeypatch.setenv("DR_L1_RPC_URL", "http://127.0.0.1:9650/ext/bc/dr-l1/rpc")
        monkeypatch.setenv("DR_L1_CHAIN_ID", "99999")

        cfg = resolve_chain_config()
        assert cfg.target == ChainTarget.CUSTOM_L1
        assert cfg.chain_id == 99999
        assert cfg.rpc_url == "http://127.0.0.1:9650/ext/bc/dr-l1/rpc"

    def test_custom_l1_missing_rpc_url_raises(self, monkeypatch):
        monkeypatch.setenv("DR_CHAIN_MODE", "custom-l1")
        monkeypatch.delenv("DR_L1_RPC_URL", raising=False)

        with pytest.raises(ValueError, match="DR_L1_RPC_URL"):
            resolve_chain_config()

    def test_custom_l1_missing_chain_id_raises(self, monkeypatch):
        monkeypatch.setenv("DR_CHAIN_MODE", "custom-l1")
        monkeypatch.setenv("DR_L1_RPC_URL", "http://localhost:9650")
        monkeypatch.delenv("DR_L1_CHAIN_ID", raising=False)

        with pytest.raises(ValueError, match="DR_L1_CHAIN_ID"):
            resolve_chain_config()

    def test_default_is_simulated(self, monkeypatch):
        monkeypatch.delenv("DR_CHAIN_MODE", raising=False)

        cfg = resolve_chain_config()
        assert cfg.target == ChainTarget.SIMULATED

    def test_contracts_loaded_from_deploy_file(self, monkeypatch, tmp_path):
        deploy_data = {
            "EventManager": "0xEM",
            "ProofRegistry": "0xPR",
            "DRToken": "0xDRT",
            "Settlement": "0xST",
        }
        deploy_file = tmp_path / "fuji-deploy.json"
        deploy_file.write_text(json.dumps(deploy_data))

        monkeypatch.setenv("DR_CHAIN_MODE", "fuji-live")
        monkeypatch.setenv("DR_DEPLOY_OUT", str(deploy_file))

        cfg = resolve_chain_config()
        assert cfg.contracts.event_manager == "0xEM"
        assert cfg.contracts.settlement == "0xST"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
