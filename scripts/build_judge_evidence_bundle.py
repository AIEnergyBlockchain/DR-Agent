#!/usr/bin/env python3
"""Build a judge-facing Fuji evidence markdown bundle.

This script converts deployment JSON evidence into a markdown file that is easy
to paste into submission materials and demo docs.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


FUJI_EXPLORER = "https://testnet.snowtrace.io"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render judge evidence bundle from deployment report"
    )
    parser.add_argument(
        "--report",
        default="cache/fuji-deployment-latest.json",
        help="Path to deployment report JSON (default: cache/fuji-deployment-latest.json)",
    )
    parser.add_argument(
        "--output",
        default="guide/docs/Fuji-Evidence-Bundle-latest.md",
        help="Output markdown path (default: guide/docs/Fuji-Evidence-Bundle-latest.md)",
    )
    parser.add_argument(
        "--explorer",
        default="",
        help="Override explorer base URL. If empty, auto-select by network.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    if not path.exists():
        print(f"[evidence] deployment report not found: {path}")
        print("[evidence] run: npm run deploy:fuji")
        sys.exit(1)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"[evidence] invalid json in {path}: {exc}")
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
    tx_hashes = report.get("tx_hashes") or {}
    explorer = explorer_for(network, args.explorer)
    generated_at = (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )

    event_manager = fmt_value(contracts.get("event_manager"))
    proof_registry = fmt_value(contracts.get("proof_registry"))
    settlement = fmt_value(contracts.get("settlement"))
    set_settlement_tx = fmt_value(tx_hashes.get("set_settlement_contract"))

    lines: list[str] = []
    lines.append("# Fuji Judge Evidence Bundle")
    lines.append("")
    lines.append(f"- Generated at (UTC): `{generated_at}`")
    lines.append(f"- Source report: `{report_path}`")
    lines.append(f"- Network: `{network}`")
    lines.append(f"- Chain ID: `{chain_id}`")
    lines.append(f"- Deployed at (UTC): `{deployed_at}`")
    lines.append(f"- Deployer: `{deployer}`")
    lines.append("")
    lines.append("## Contract Evidence")
    lines.append("")
    lines.append("| Item | Value | Explorer |")
    lines.append("| --- | --- | --- |")
    lines.append(
        f"| EventManager | `{event_manager}` | {mk_link(explorer, 'address', event_manager)} |"
    )
    lines.append(
        f"| ProofRegistry | `{proof_registry}` | {mk_link(explorer, 'address', proof_registry)} |"
    )
    lines.append(
        f"| Settlement | `{settlement}` | {mk_link(explorer, 'address', settlement)} |"
    )
    lines.append(
        f"| setSettlementContract tx | `{set_settlement_tx}` | {mk_link(explorer, 'tx', set_settlement_tx)} |"
    )
    lines.append("")
    lines.append("## Judge Submission Checklist")
    lines.append("")
    lines.append("- [ ] Explorer links open correctly and match contract addresses.")
    lines.append(
        "- [ ] `EventManager.settlementContract` points to Settlement address."
    )
    lines.append("- [ ] At least one full flow demo is recorded with these addresses.")
    lines.append(
        "- [ ] Walkthrough and README are updated with this evidence bundle link."
    )
    lines.append("")
    lines.append("## Optional Runtime Evidence (fill manually if available)")
    lines.append("")
    lines.append("- `create tx`:")
    lines.append("- `proof A tx`:")
    lines.append("- `proof B tx`:")
    lines.append("- `close tx`:")
    lines.append("- `settle tx`:")
    lines.append("- `claim tx`:")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[evidence] wrote: {output_path}")


if __name__ == "__main__":
    main()
