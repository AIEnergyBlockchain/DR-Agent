#!/usr/bin/env python3
"""Build a DRT-only Fuji evidence markdown bundle from deployment JSON."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


FUJI_EXPLORER = "https://testnet.snowtrace.io"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render DRT-only evidence bundle from deployment report"
    )
    parser.add_argument(
        "--report",
        default="cache/fuji-drt-deployment-latest.json",
        help="Path to DRT deployment report JSON (default: cache/fuji-drt-deployment-latest.json)",
    )
    parser.add_argument(
        "--output",
        default="guide/docs/Fuji-DRT-Evidence-Bundle-latest.md",
        help="Output markdown path (default: guide/docs/Fuji-DRT-Evidence-Bundle-latest.md)",
    )
    parser.add_argument(
        "--explorer",
        default="",
        help="Override explorer base URL. If empty, auto-select by network.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    if not path.exists():
        print(f"[drt-evidence] deployment report not found: {path}")
        print("[drt-evidence] run: npm run deploy:fuji:drt")
        sys.exit(1)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"[drt-evidence] invalid json in {path}: {exc}")
        sys.exit(1)


def explorer_for(network: str, override: str) -> str:
    if override:
        return override.rstrip("/")
    if network.lower() == "fuji":
        return FUJI_EXPLORER
    return ""


def mk_link(explorer: str, kind: str, value: str) -> str:
    if not value or value == "-" or not explorer:
        return "-"
    if kind == "address":
        return f"{explorer}/address/{value}"
    if kind == "tx":
        return f"{explorer}/tx/{value}"
    return "-"


def fmt_value(value: object) -> str:
    if value is None:
        return "-"
    text = str(value).strip()
    return text if text else "-"


def main() -> None:
    args = parse_args()
    report_path = Path(args.report)
    output_path = Path(args.output)
    report = load_json(report_path)

    network = fmt_value(report.get("network"))
    chain_id = fmt_value(report.get("chain_id"))
    deployed_at = fmt_value(report.get("deployed_at_utc"))
    deployer = fmt_value(report.get("deployer"))

    contracts = report.get("contracts") or {}
    token = report.get("token") or {}
    tx_hashes = report.get("tx_hashes") or {}
    tx_receipts = report.get("tx_receipts") or {}
    receipt = tx_receipts.get("deploy_drt_token") or {}

    drt_token = fmt_value(contracts.get("drt_token"))
    deploy_tx = fmt_value(tx_hashes.get("deploy_drt_token"))
    token_name = fmt_value(token.get("name"))
    token_symbol = fmt_value(token.get("symbol"))
    token_decimals = fmt_value(token.get("decimals"))
    initial_supply_units = fmt_value(token.get("initial_supply_units"))
    initial_supply_wei = fmt_value(token.get("initial_supply_wei"))

    block_number = fmt_value(receipt.get("block_number"))
    gas_used = fmt_value(receipt.get("gas_used"))
    gas_price = fmt_value(receipt.get("effective_gas_price_wei"))
    tx_fee_wei = fmt_value(receipt.get("tx_fee_wei"))

    explorer = explorer_for(network, args.explorer)
    generated_at = (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )

    lines: list[str] = []
    lines.append("# Fuji DRT Evidence Bundle")
    lines.append("")
    lines.append(f"- Generated at (UTC): `{generated_at}`")
    lines.append(f"- Source report: `{report_path}`")
    lines.append(f"- Network: `{network}`")
    lines.append(f"- Chain ID: `{chain_id}`")
    lines.append(f"- Deployed at (UTC): `{deployed_at}`")
    lines.append(f"- Deployer: `{deployer}`")
    lines.append("")
    lines.append("## Token Metadata")
    lines.append("")
    lines.append(f"- Name: `{token_name}`")
    lines.append(f"- Symbol: `{token_symbol}`")
    lines.append(f"- Decimals: `{token_decimals}`")
    lines.append(f"- Initial Supply (units): `{initial_supply_units}`")
    lines.append(f"- Initial Supply (wei): `{initial_supply_wei}`")
    lines.append("")
    lines.append("## Contract and Transaction Evidence")
    lines.append("")
    lines.append("| Item | Value | Explorer |")
    lines.append("| --- | --- | --- |")
    lines.append(
        f"| DRToken | `{drt_token}` | {mk_link(explorer, 'address', drt_token)} |"
    )
    lines.append(
        f"| deploy tx | `{deploy_tx}` | {mk_link(explorer, 'tx', deploy_tx)} |"
    )
    lines.append(f"| deploy block | `{block_number}` | - |")
    lines.append(f"| gas used | `{gas_used}` | - |")
    lines.append(f"| effective gas price (wei) | `{gas_price}` | - |")
    lines.append(f"| deploy fee (wei) | `{tx_fee_wei}` | - |")
    lines.append("")
    lines.append("## Checklist")
    lines.append("")
    lines.append("- [ ] DRToken address opens in explorer.")
    lines.append("- [ ] deploy tx opens in explorer and status is success.")
    lines.append("- [ ] Gas and fee fields are present and non-empty.")
    lines.append("- [ ] README command section reflects DRT-only deploy flow.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[drt-evidence] wrote: {output_path}")


if __name__ == "__main__":
    main()
