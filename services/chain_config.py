"""Multi-chain configuration for DR Agent.

Supports simulated, fuji (C-Chain), and custom L1 targets.
Each chain target carries its own RPC URL, chain ID, contract addresses,
and chain action script path.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Chain target enum
# ---------------------------------------------------------------------------

class ChainTarget(Enum):
    SIMULATED = "simulated"
    FUJI = "fuji"
    CUSTOM_L1 = "custom-l1"

    @property
    def is_live(self) -> bool:
        return self != ChainTarget.SIMULATED

    @classmethod
    def from_env(cls, raw: str) -> ChainTarget:
        normalized = raw.strip().lower().replace("_", "-")
        _aliases: dict[str, ChainTarget] = {
            "simulated": cls.SIMULATED,
            "fuji": cls.FUJI,
            "fuji-live": cls.FUJI,
            "custom-l1": cls.CUSTOM_L1,
            "dr-l1": cls.CUSTOM_L1,
        }
        target = _aliases.get(normalized)
        if target is None:
            raise ValueError(
                f"unknown chain target: '{raw}'. "
                f"Valid values: {', '.join(_aliases.keys())}"
            )
        return target


# ---------------------------------------------------------------------------
# Contract addresses
# ---------------------------------------------------------------------------

@dataclass
class ContractAddresses:
    event_manager: Optional[str] = None
    proof_registry: Optional[str] = None
    drt_token: Optional[str] = None
    settlement: Optional[str] = None

    @classmethod
    def none(cls) -> ContractAddresses:
        return cls()

    @classmethod
    def from_deployment_file(cls, path: str) -> ContractAddresses:
        data = json.loads(Path(path).read_text())
        return cls(
            event_manager=data["EventManager"],
            proof_registry=data["ProofRegistry"],
            drt_token=data["DRToken"],
            settlement=data["Settlement"],
        )


# ---------------------------------------------------------------------------
# Chain config
# ---------------------------------------------------------------------------

_SCRIPT_MAP: dict[ChainTarget, Optional[str]] = {
    ChainTarget.SIMULATED: None,
    ChainTarget.FUJI: "fuji_chain_action.js",
    ChainTarget.CUSTOM_L1: "l1_chain_action.js",
}

_HARDHAT_NETWORK_MAP: dict[ChainTarget, Optional[str]] = {
    ChainTarget.SIMULATED: None,
    ChainTarget.FUJI: "fuji",
    ChainTarget.CUSTOM_L1: "dr_l1",
}

FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc"
FUJI_CHAIN_ID = 43113


@dataclass
class ChainConfig:
    target: ChainTarget
    rpc_url: Optional[str] = None
    chain_id: Optional[int] = None
    contracts: ContractAddresses = field(default_factory=ContractAddresses.none)

    @property
    def is_live(self) -> bool:
        return self.target.is_live

    @property
    def chain_action_script_name(self) -> Optional[str]:
        return _SCRIPT_MAP.get(self.target)

    @property
    def hardhat_network(self) -> Optional[str]:
        return _HARDHAT_NETWORK_MAP.get(self.target)

    def to_dict(self) -> dict:
        return {
            "target": self.target.value,
            "is_live": self.is_live,
            "rpc_url": self.rpc_url,
            "chain_id": self.chain_id,
        }


# ---------------------------------------------------------------------------
# Factory: resolve from environment
# ---------------------------------------------------------------------------

def resolve_chain_config() -> ChainConfig:
    raw_mode = os.getenv("DR_CHAIN_MODE", "simulated")
    target = ChainTarget.from_env(raw_mode)

    if target == ChainTarget.SIMULATED:
        return ChainConfig(target=target)

    if target == ChainTarget.FUJI:
        rpc_url = os.getenv("DR_FUJI_RPC_URL", FUJI_RPC_URL)
        contracts = _load_contracts_from_env()
        return ChainConfig(
            target=target,
            rpc_url=rpc_url,
            chain_id=FUJI_CHAIN_ID,
            contracts=contracts,
        )

    if target == ChainTarget.CUSTOM_L1:
        rpc_url = os.getenv("DR_L1_RPC_URL")
        if not rpc_url:
            raise ValueError(
                "DR_L1_RPC_URL is required when DR_CHAIN_MODE=custom-l1"
            )
        chain_id_raw = os.getenv("DR_L1_CHAIN_ID")
        if not chain_id_raw:
            raise ValueError(
                "DR_L1_CHAIN_ID is required when DR_CHAIN_MODE=custom-l1"
            )
        contracts = _load_contracts_from_env()
        return ChainConfig(
            target=target,
            rpc_url=rpc_url,
            chain_id=int(chain_id_raw),
            contracts=contracts,
        )

    return ChainConfig(target=target)


def _load_contracts_from_env() -> ContractAddresses:
    deploy_path = os.getenv("DR_DEPLOY_OUT")
    if deploy_path and Path(deploy_path).exists():
        return ContractAddresses.from_deployment_file(deploy_path)
    return ContractAddresses.none()
