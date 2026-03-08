---
name: dev-rules
description: "Enforces secure development guardrails for code changes and git workflows, including sensitive-file blocking, branch safety, validation gates, and explicit/implicit trigger control."
---

# Development Workflow Rules

Universal AI agent collaboration constraints for all development projects.

## Activation Model

### Dual-Channel Enforcement

- `direct-route`: when user intent explicitly targets coding rules, commits/push/merge/rebase/submodule actions, branches, git operations, or explicitly mentions `dev-rules` (case-insensitive)
- `implicit-guardrail`: automatically applies during execution when request involves:
  - `code-mutation`
  - `git-operation`
  - `architecture-decision`

Direct routing and implicit guardrails can co-exist. Implicit guardrails do not replace the primary domain skill.

### Forced Trigger Policy (Mandatory)

1. If user explicitly mentions `dev-rules` (any case variant), this skill **must be loaded before any tool call**.
2. For any `code-mutation`, `git-operation`, or `architecture-decision`, this skill **must be auto-applied** as a guardrail even when another primary domain skill is active.
3. Skill discovery for `dev-rules` must use local filesystem as source of truth (`/home/user/.codex/skills/dev-rules/SKILL.md`) instead of relying only on pre-listed skill summaries.
4. If this skill cannot be loaded, execution is **fail-closed**: stop file mutations/git actions and request user confirmation before proceeding.

## Trigger Boundaries

### In Scope

- code modification and refactoring tasks
- git workflow actions (branching, commit planning, push sequencing, merge/rebase/submodule handling)
- architecture decisions that impact implementation workflow
- validation and release-readiness checks for code changes

### Out of Scope

- market-only evaluation or fundraising analysis
- legal interpretation or compliance rulings
- learning-path and personal growth planning
- non-technical strategy discussions without code/git/architecture execution impact

***

## Core Rules at a Glance (8 Rules)

1. **Never read `.env*` files** (filename blacklist, auto-reject)
2. **Never modify main branch; keep main repo + submodules on the same branch name**
3. **Default development to the lowest-noise environment tier**
4. **Dependent workflow steps need explicit state guards** (`submitted` is not `confirmed`)
5. **Every production bug fix needs a regression check**
6. **Critical-path module changes require smoke rerun**
7. **Major decisions need approval** (present 3-5 options, wait for selection)
8. **Code must be validated** (typecheck + project-specified test/demo scripts)

***

## P0 - Security Constraints (Mandatory)

### Sensitive File Blacklist

Never read files matching these patterns:

```
.env*  *.key  *.pem  *.p12  *secret*  *private*  *credential*
```

- Auto-reject with suggestion to use `.env.example`
- Never expose `PRIVATE_KEY`, `API_KEY`, `MNEMONIC`, etc. in code/docs/logs
- Never commit `.env` to Git

### Pre-Commit Code Validation

- typecheck must be 0 errors
- Project-specified test/demo scripts must pass
- When unvalidated, state explicitly: "This part is not actually tested"

***

## P1 - Workflow Constraints (Important)

### Branch Management

```bash
# main repo
git branch --show-current
# submodules
git submodule foreach 'git branch --show-current'

# if on main (or branch mismatch), switch all to the same branch name
git checkout -b feature/xxx || git checkout feature/xxx
git submodule foreach 'git checkout -b feature/xxx || git checkout feature/xxx'
```

Naming convention: `feature/name`, `fix/description`, `docs/type`

### Git Commits

- Format: `[type] description` (types: feat/fix/docs/refactor/test/chore)
- One commit per feature, push immediately after completion
- Never use vague messages like "WIP", "temp", etc.

### Task Tracking

- For multi-step tasks (3+), use todo tool
- Only one task can be `in-progress` at a time

### Environment Variables

- All configs must have entries in `.env.example`
- New variables must update `.env.example`

### Defect Prevention Guardrails

- Default day-to-day development to the lowest-noise environment tier available:
  - prefer local/simulated dependencies over live ones
  - prefer strict/synchronous confirmation over hybrid/asynchronous confirmation
  - reserve live + hybrid/async paths for dedicated integration or final demo validation
- For stateful or multi-step workflows, encode adjacent-step prerequisites in code:
  - do not treat `submitted`, `broadcast`, or `accepted` as equivalent to `confirmed`, `mined`, or `readable`
  - dependent actions must either wait, poll, or return a domain-level pending error before calling the next step
  - surface readable errors such as `*_PENDING_CONFIRMATION` instead of leaking raw downstream revert/adapter errors
- Every bug fix that reaches implementation must add at least one regression artifact:
  - automated test preferred
  - scripted repro / smoke checklist item acceptable only if automation is not feasible
- If a change touches critical-path modules, rerun project smoke before closing the task:
  - frontend action orchestration / state transitions
  - backend workflow orchestration / submitter services
  - external system adapters, chain/RPC callers, queue consumers, or workflow scripts
- Do not mix UI refactor, workflow semantic changes, and regression hardening in one pass unless user explicitly approves
- If live/integration verification fails, pause new feature work and fix workflow semantics first

***

## P2 - Collaboration Constraints (Recommended)

### Major Decisions Require Confirmation

**Definition**: architecture changes, large refactors (5+ files), code deletion, new core features

**Process**: present 3-5 options -> explain tradeoffs -> wait for approval -> document

### Communication Style

- Segment output, bold key points, use lists/tables
- Single file change -> report upon completion
- Multiple files (3+) -> confirm plan before execution
- Major refactor -> ask at every step

### Avoid Over-Planning

- MVP is MVP, don't build "might need" features
- Don't add features the user didn't ask for
- Ask: "required" or "nice-to-have"?

***

## Prohibited Behaviors

- Change 10+ files at once then inform user
- Assume what user wants (ask first)
- Make time commitments (use estimate ranges)
- Ignore user feedback (adjust immediately)

***

## Checklist

**Before starting**:
- [ ] Main repo and submodules are not on `main` and use the same branch name?
- [ ] Is this a major decision? -> present options and wait

**After making changes**:
- [ ] Regression coverage added for any bug fix?
- [ ] Smoke rerun completed if critical-path modules changed?
- [ ] typecheck 0 errors
- [ ] test/demo scripts pass
- [ ] commit message is clear, pushed

**After completion**:
- [ ] Asked "OK?" for key tasks

***

## Detailed Reference

- Daily enforcement baseline: see [RULES.md](RULES.md)
- Full constraints, examples, and best practices: see [GUIDELINES.md](GUIDELINES.md)
