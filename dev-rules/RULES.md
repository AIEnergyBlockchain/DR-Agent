# Dev Rules Core Constraints

> Condensed baseline for daily enforcement.
> Detailed explanations are in [GUIDELINES.md](GUIDELINES.md).

## Scope and Activation

- `direct-route`: use `dev-rules` as primary skill for explicit coding rules/commits/branches/git requests, and always trigger when users explicitly mention `dev-rules` (case-insensitive).
- `implicit-guardrail`: auto-apply during execution for:
  - `code-mutation`
  - `git-operation`
  - `architecture-decision`
- Implicit guardrail does not replace the primary domain skill.

## Forced Trigger Policy (Mandatory)

1. If users explicitly mention `dev-rules` (case-insensitive), load this skill before any tool call.
2. For any `code-mutation`, `git-operation`, or `architecture-decision`, auto-apply this skill as a guardrail even when another primary skill is active.
3. Use local filesystem as discovery source of truth for this skill: `/home/user/.codex/skills/dev-rules/SKILL.md`.
4. If this skill cannot be loaded, fail-closed: stop file mutations and git operations, then ask user confirmation before proceeding.

## P0 Security (Mandatory)

1. Never read sensitive files:
   - `.env*`, `*.key`, `*.pem`, `*.p12`, `*secret*`, `*private*`, `*credential*`
2. Never expose secrets in code/docs/logs (for example `PRIVATE_KEY`, `API_KEY`, `MNEMONIC`).
3. Never commit `.env` files.

## P1 Workflow (Mandatory)

1. Before modifying files, check main repo and submodule branches:
   - `git branch --show-current`
   - `git submodule foreach 'git branch --show-current'`
   - If main repo or any submodule is on `main`, create/switch all to the same feature branch name.
   - Branch names must stay consistent across main repo and submodules during the task.
2. Major decisions (architecture change, 5+ file refactor, deletions, core features):
   - provide 3-5 options with tradeoffs
   - wait for user confirmation before execution
3. Pre-commit validation gates:
   - typecheck must be zero errors
   - project test/demo commands must pass
   - if unvalidated, explicitly state that it is untested
4. Defect prevention gates for stateful workflows:
   - default routine development to the lowest-noise environment tier available
   - do not treat `submitted`/`broadcast` as equivalent to `confirmed`/`readable`
   - dependent steps must wait, poll, or return a domain-level pending-precondition error
   - every shipped bug fix needs a regression test or scripted repro check
   - rerun smoke when critical-path orchestrators/adapters/UI flow modules change
   - avoid mixing UI refactor and workflow semantics in one pass unless user approves
   - if live/integration flow fails, stop new feature work and fix the broken semantics first

## P2 Collaboration (Recommended)

1. Keep progress visible for key tasks and ask confirmation before major continuation.
2. Avoid over-planning; implement only requested scope unless user approves expansion.
3. Use clear commit messages; avoid vague messages like `WIP` or `temp`.

## Quick Checklist

Before work:
- [ ] Main repo and submodules are not on `main` and share the same branch name
- [ ] Major decision confirmed if applicable
- [ ] Development environment tier is appropriate for the task (routine vs integration vs demo)

After changes:
- [ ] Regression coverage added for bug fixes
- [ ] Smoke rerun completed if critical-path files/modules changed
- [ ] typecheck passed
- [ ] tests/demo passed
- [ ] commit format is clear

After completion:
- [ ] key-task confirmation requested
