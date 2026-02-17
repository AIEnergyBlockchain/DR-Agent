# ADR 0001: DR-Agent MVP Architecture Boundaries

- Date: 2026-02-17
- Status: accepted

## Context

DR-Agent aims to deliver a hackathon-ready demand-response settlement MVP that is easy to demo, verify, and extend. The project must support a fast local feedback loop while preserving auditable settlement semantics.

## Decision

1. Keep event lifecycle and settlement-critical state on-chain using three contracts:
- `EventManager.sol`
- `ProofRegistry.sol`
- `Settlement.sol`

2. Keep high-frequency telemetry and payload assembly off-chain:
- FastAPI/Python services process baseline and proof payloads.
- SQLite stores event/proof/settlement indexes for the MVP loop.

3. Separate deployment readiness from local demo readiness:
- Local loop is the default development path.
- Fuji deployment remains credential-gated (`PRIVATE_KEY`, test AVAX) and tracked in dedicated deployment records.

## Consequences

Positive:
- Fast onboarding and reproducible local walkthrough.
- Clear trust boundary between verifiable on-chain facts and off-chain computation.
- Minimal moving parts for hackathon iteration.

Tradeoffs:
- On-chain proof section in README cannot be completed until real testnet deployment succeeds.
- SQLite is sufficient for MVP but not a production multi-tenant persistence strategy.

## Follow-up

1. Record real Fuji contract addresses and explorer links after successful deployment.
2. Introduce stricter CI checks after first stable release branch.
3. Expand ADR set for auth hardening and production data architecture.
