# AI Agent Work Constraints and Collaboration Guide (Detailed Version)

> **Version**: v2.2
> **Last Updated**: 2026-03-07
> **Applicable Scope**: All AI Assistant collaboration scenarios (detailed reference)
> **Core Rules**: See [RULES.md](RULES.md) (authoritative baseline, condensed version)

**Usage Instructions**:

- **Daily Use**: Agent should follow `RULES.md` first.
- **Activation Model**: `dev-rules` loads via direct route and global implicit guardrail; explicit `dev-rules` mentions are mandatory triggers.
- **Detailed Reference**: This document provides complete explanations, examples, and best practices.
- **On-Demand Consultation**: Use this document when a rule needs extended interpretation.

---

## Table of Contents

- [Security Constraint Details](#security-constraint-details)
- [Workflow Constraint Details](#workflow-constraint-details)
- [Defect Prevention Constraint Details](#defect-prevention-constraint-details)
- [Code Quality Constraint Details](#code-quality-constraint-details)
- [Collaboration and Communication Best Practices](#collaboration-and-communication-best-practices)
- [Decision-Making and Planning Guidelines](#decision-making-and-planning-guidelines)
- [Documentation Management Guide](#documentation-management-guide)
- [Detailed Checklist](#detailed-checklist)
- [Exception Handling Process](#exception-handling-process)
- [Reference Resources](#reference-resources)

---

**Note**: `RULES.md` is the authoritative baseline. This document is the detailed companion reference.

---


## Activation Enforcement Addendum

### Mandatory Trigger Rules

- `dev-rules` must load before any tool call when users explicitly mention `dev-rules` (case-insensitive).
- For all `code-mutation`, `git-operation`, and `architecture-decision` tasks, apply `dev-rules` as implicit guardrail even when another skill is primary.
- Skill discovery source of truth is local filesystem path: `/home/user/.codex/skills/dev-rules/SKILL.md`.
- If `dev-rules` cannot be loaded, enforce fail-closed behavior: stop file mutations and git actions, then ask user for confirmation.

## Security Constraint Details

### P0-1: Prohibit Reading Sensitive Files

**Rule**:

- ✗ **Never read** any `.env*` files (including `.env.local`, `.env.production`, etc.)
- ✗ Refuse to read files containing private keys/API keys
- ✓ Auto-reject based on **file name blacklist**, don't rely on user reminders

**Sensitive File Patterns**:

```
.env*
*.key
*.pem
*.p12
*secret*
*private*
*credential*
```

**Handling Method**:

- Auto-reject read requests
- Notify: "For security reasons, cannot read sensitive files. Please use `.env.example` as reference."

### P0-2: Don't Modify Security Policy

**Rule**:

- ✗ Don't delete or modify this constraint file (unless user explicitly requests)
- ✓ Check before each commit whether it's been accidentally modified
- ✓ Security policy changes require explicit user approval

### P0-3: Prohibit Exposing Sensitive Information

**Rule**:

- ✗ Don't expose private keys, API Keys, RPC keys in code, documentation, logs, or screenshots
- ✗ Don't commit `.env` to Git
- ✓ Use `.env.example` as public template (replace real values with placeholders)
- ✓ When interacting with AI, only discuss `.env.example`, use placeholders for descriptions

**Sensitive Information Types**:

- `PRIVATE_KEY`, `MNEMONIC`
- `API_KEY`, `API_SECRET`
- `RPC_URL` (containing keys)
- `.env*` file contents

**Breach Handling Flow**:

1. Immediately revoke that key (transfer funds / rotate API Key)
2. Remove from Git history (`git-filter-branch` or BFG)
3. Notify team and update security records

---

## Workflow Constraint Details

### P1-1: Branch Management

**Rule**:

- ✓ **Before modifying any file**, check if main repo and submodules are on `main` branch
- ✓ If main repo or any submodule is on main, switch all of them to the same branch name
- ✗ Never directly modify on main branch

**Check Steps**:

```bash
# Main repo check
git branch --show-current

# All submodule checks
git submodule foreach 'git branch --show-current'

# Switch main repo to target branch
BRANCH=feature/your-task
git checkout -b "$BRANCH" || git checkout "$BRANCH"

# Switch all submodules to the same branch name
git submodule foreach 'git checkout -b "$BRANCH" || git checkout "$BRANCH"'
```

**Branch Naming Convention**:

- `feature/feature-name` (e.g., `feature/add-metrics-api`)
- `fix/issue-description` (e.g., `fix/typecheck-errors`)
- `docs/doc-type` (e.g., `docs/update-readme`)

### P1-2: Git Commit Convention

**Rule**:

- ✓ Commit message format: `[Type] Brief description` or `Phase X: Operation description`
- ✓ One commit = one complete feature
- ✓ Push immediately after commit (unless network unavailable or user requests otherwise)
- ✗ Don't use vague messages like "WIP", "temp", "fix"

**Commit Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation update
- `refactor`: Refactoring
- `test`: Test-related
- `chore`: Build/tool related

**Examples**:

```
✅ feat: Add metrics API endpoint
✅ fix: Resolve typecheck errors in policy.ts
✅ docs: Update README with deployment guide
❌ WIP: some changes
❌ fix
```

### P1-3: Task Tracking

**Rule**:

- ✓ Use todo tool for multi-step work (3+ steps), explicitly mark status
- ✗ Can't mark multiple TODOs as `in-progress` simultaneously
- ✓ Update status immediately after task completion

**Todo States**:

- `pending`: Not started
- `in-progress`: In progress (only one can be active simultaneously)
- `completed`: Completed
- `cancelled`: Cancelled

### P1-4: Work Log Management

**Rule**:

- ✓ Update `AGENT_WORKLOG.md` immediately after each Phase completion (background, steps, file changes, verification)
- ✓ Each commit has corresponding log entry
- ✓ Auto-compress `AGENT_WORKLOG.md` to 500 lines when reaching 1000 lines

**Log Compression Rules**:

- **Keep**: Phase summary table, current status, run commands, key files, appendix
- **Compress**: Each Phase description to 2-4 key bullet points

---

## Defect Prevention Constraint Details

### P0-4: Choose the Lowest-Noise Development Tier by Default

**Rule**:

- ✓ Routine development should use the least noisy environment tier available
- ✓ Prefer simulated/local dependencies over live dependencies for everyday changes
- ✓ Prefer strict/synchronous confirmation over hybrid/asynchronous confirmation during debugging
- ✗ Don't make hybrid/async confirmation the default development path unless the task is specifically validating that mode

**Recommended Tiering Pattern**:

1. Development baseline: local/simulated + strict confirmation
2. Integration validation: live dependency + strict confirmation
3. Demo/performance validation: live dependency + hybrid/async confirmation

**Why**:

- Lower-noise tiers isolate product logic bugs from timing-window bugs
- Hybrid/async modes optimize experience, but they amplify sequencing noise during development

### P0-5: Encode Explicit Step Preconditions

**Rule**:

- ✓ For any multi-step or stateful workflow, every dependent step must check the prior step's state explicitly
- ✗ Don't assume that `submitted`, `broadcast`, `queued`, or `accepted` means the downstream state is already readable
- ✓ Treat preconditions as code, not operator intuition

**Required Patterns**:

- Adjacent-step guard examples:
  - `proof <- create confirmed`
  - `settle <- close confirmed`
  - `claim <- settle confirmed`
- Guard behavior must do one of these before attempting the downstream action:
  - wait/poll until precondition is satisfied
  - return a domain-level pending error
  - enter a documented waiting state in the UI/job controller

**Error Contract Guidance**:

- Prefer readable domain errors such as `CREATE_TX_PENDING_CONFIRMATION`
- Message should explain both facts:
  - previous transaction is submitted
  - previous transaction is not yet confirmed/readable
- ✗ Don't leak raw adapter, RPC, or revert errors when the real cause is unmet workflow precondition

### P0-6: Every Bug Fix Must Leave a Regression Artifact

**Rule**:

- ✓ Every production or integration bug fix must add at least one regression artifact
- ✓ Automated regression tests are preferred
- ✓ If automation is not yet feasible, add a scripted repro or release-checklist item and state why
- ✗ Don't close a bug fix with only a code change and no regression evidence

**Minimum Bar**:

1. Reproduce the failure mode
2. Assert the protected behavior after the fix
3. Cover the user-visible error contract if one was added

### P1-5: Critical-Path Modules Trigger Smoke Reruns

**Rule**:

- ✓ Rerun smoke whenever a change touches critical-path orchestration modules
- ✓ Critical path includes the modules that move workflow state across system boundaries
- ✗ Don't skip smoke just because the edit "looks small"

**Common Critical-Path Examples**:

- frontend action orchestrators and state-transition handlers
- backend submitter/orchestration services
- chain/RPC adapters, queue consumers, workflow scripts
- DTO or API contract layers that change workflow sequencing semantics

### P1-6: Isolate UI Refactors from Workflow Semantic Changes

**Rule**:

- ✓ Split work into separate passes when possible:
  - UI/presentation changes
  - workflow semantic/orchestration changes
  - regression and smoke hardening
- ✓ If combining them is necessary, document the reason and verify each layer separately
- ✗ Don't mix broad visual churn with core sequencing changes by default

**Why**:

- Mixing visual changes and workflow semantics increases diagnosis cost
- Small regressions become harder to localize when both presentation and orchestration move together

### P1-7: Integration Failure Stops Feature Expansion

**Rule**:

- ✓ If live/integration verification fails, stop adding new features in that path
- ✓ Fix the broken workflow semantics, guards, or environment assumptions first
- ✓ Record the failure mode in the regression checklist before resuming feature work
- ✗ Don't treat a failing end-to-end path as "good enough" while continuing unrelated UI polish

---

## Code Quality Constraint Details

### P0-7: Code Must Be Verified Before Commit

**Rule**:

- ✗ Don't commit code that fails project type check (0 errors required)
- ✗ Don't commit code that fails project-specified test/demo scripts
- ✓ Must re-verify after code modifications

**Verification Steps**:

```bash
# 1. Run project type check command (e.g., pnpm typecheck / npx tsc / etc.)
# 2. Run project-specified test/demo scripts
# 3. Confirm pass before committing
```

**Note**: Specific commands depend on project's package.json / Makefile / documentation. Agent should check project config first.

### P1-8: Type Safety (TypeScript projects)

**Rule**:

- ✓ All `.ts` files pass project type check (0 errors)
- ✗ Don't use `any` (unless no alternative and documented)
- ✓ Use explicit type definitions

**`any` Usage Exceptions**:

```typescript
// ❌ Avoid
const data: any = fetchData();

// ✅ Allowed (requires documentation)
// Third-party library types incomplete, temporarily use any
const data: any = thirdPartyLib.getData();
```

### P1-9: Don't Break Existing Functionality

**Rule**:

- ✓ Ensure previously passing tests still pass during refactoring
- ✗ Can't delete working functionality to simplify other parts
- ✓ Confirm impact scope before modifications

**Verification Methods**:

- Run all demo scripts
- Check related test cases
- Confirm API interface compatibility

---

## Collaboration and Communication Best Practices

### P2-1: Communication Style

**Rule**:

- ✓ Display complex information in **segments**, not long paragraphs at once
- ✓ **Highlight important information with bold and lists**
- ✓ Avoid repeating the same concept
- ✓ Goal: User understands at a glance, no re-reading needed

**Reply Length Recommendations**:

- Single file modification: 1-2 paragraphs
- Multiple file changes: 3-5 paragraphs (segmented display)
- Major refactor: Reply separately for each step

### P2-2: Progress Feedback

**Rule**:

- ✓ After completing key tasks, briefly summarize in 1-2 sentences, then ask "**Can we proceed?**"
- ✓ Don't do everything at once then report
- ✓ Give user opportunity to adjust direction mid-way

**Work Rhythm**:

| Task Scale | Feedback Frequency | Communication Style |
| -------- | ---------- | -------------------------- |
| Single file modification | Report upon completion | "Completed X, next..." |
| Multi-file changes (3+) | Confirm before proceeding | "Plan to do A/B/C, agree?" |
| Major refactor | Ask at each step | "Step 1 done, continue?" |
| Investigation/research | Report when complete | "Research results:..." |

### P2-3: Inquiry-Based Communication

**Rule**:

- ✓ Use "Do you think we should...or...?" style inquiry
- ✗ Don't use assertive "I think we should..." style
- ✓ Provide 3-5 options for selection

**Example Comparison**:

❌ **Bad**:

> I think documentation should be organized as guides/reference/internal. I've already reorganized and pushed to Git.

✅ **Good**:

> Documentation seems disorganized. I suggest three organizational approaches:
>
> 1. By document type (guides/reference/internal) in separate directories
> 2. By role (A/B/C/D) in separate directories
> 3. Keep root directory but use prefix distinction (guide-, ref-, internal-)
>
> Which approach do you prefer?

---

## Decision-Making and Planning Guidelines

### P1-7: Major Decisions Require Confirmation

**Major Decision Definition**:

- Architecture changes (e.g., introducing new framework, changing project structure)
- Large refactoring (affects 5+ files)
- Deleting code or features
- Changing responsibility assignments
- Adding core features

**Decision Process**:

1. **List Options**: Provide 3-5 feasible solutions
2. **Explain Pros/Cons**: Advantages and disadvantages for each option
3. **Await Confirmation**: Execute after user selection
4. **Document**: Record decision in appropriate file

### P2-4: Avoid Over-Planning (Gold Plating)

**Rule**:

- ✓ **MVP projects stay MVP**, don't prepare for "might need" features
- ✓ If user didn't say "needed", **don't write it**
- ✓ **Ask about priority**: Is it "required" or "nice-to-have"?

**Judgment Criteria**:

- User explicitly requested → Required
- User didn't mention but "might be useful" → Ask
- User didn't mention and "might be future" → Don't do

**Example**:

❌ **Over-Planning**:

> I wrote complete guides for 4 scenarios, including features you might need in the future.

✅ **MVP Priority**:

> Which 1-2 scenarios are most critical? Let's start with those.

### P2-5: Time Estimation

**Rule**:

- ✓ For time estimates, **clearly state** "this is my estimate, actual may be X-Y hours"
- ✗ Don't guarantee timelines
- ✓ Provide estimate ranges rather than exact times

**Example**:

```
✅ "Web UI recommended React + Tailwind. I haven't verified actual time, likely 2-4 hours"
❌ "Web UI completed in 2 hours"
```

---

## Documentation Management Guide

### P1-8: Documentation Control

**Rule**:

- ✓ Ask before creating new documents whether truly needed
- ✓ Documentation simple, single purpose, easy to maintain
- ✗ Don't create redundant or one-off documents

**Documentation Judgment Criteria**:

- Target audience clear → Needed
- Information reusable → Needed
- One-time explanation → Not needed (explain in code comments)
- Similar document exists → Not needed (update existing)

### P2-6: Write Concise Documentation

**Rule**:

- ✓ **Delete redundant repetitive content** (don't pile up just to look "complete")
- ✓ Who is **target audience**? Write for them, that's enough
- ✓ Avoid "reference guide" reads like "mandatory requirement" (add "for reference only" disclaimer)
- ✓ Use tables and lists, minimize long paragraphs
- ✓ Golden ratio: 20% essential information, 80% redundant, cut that 80%

**Documentation Structure Suggestion**:

1. **Target Audience** (1 sentence)
2. **Core Content** (table/list)
3. **Examples** (1-2)
4. **Reference Links** (if any)

### P1-9: Document Design Decisions

**Rule**:

- ✓ Record non-trivial technical decisions in appropriate file
- ✗ Can't only explain in conversation
- ✓ Decision record includes: background, options, selection rationale, impact scope

**Document Location**:

- Architecture decisions → `docs/reference/ARCHITECTURE.md`
- Technology selection → `docs/reference/TECH_STACK.md`
- Design patterns → Code comments or design documents

### P1-10: Environment Variable Pattern

**Rule**:

- ✓ All configuration has `.env.example` entry
- ✗ Don't introduce new environment variables undocumented in template
- ✓ Update related documentation after modifying `.env.example`

**Environment Variable Format**:

```bash
# Group comment
# Variable description (optional: default value)
VARIABLE_NAME=default_value_or_placeholder
```

---

## Detailed Checklist

### Pre-Work Checks

**Major Decision Assessment**:

- [ ] Is this an architecture change? (introducing new framework, changing project structure)
- [ ] Is this a large refactor? (affects 5+ files)
- [ ] Is this deleting code or features?
- [ ] Is this adding core features?
- **If any above is yes** → List 3-5 options, await user confirmation

**Branch Check**:

- [ ] Current main repo branch: `git branch --show-current`
- [ ] If on main: `git checkout -b feature/xxx`
- [ ] Submodule check (if any): `cd frontend && git branch --show-current`

**Documentation Redundancy Check**:

- [ ] Target audience clear?
- [ ] Information reusable?
- [ ] Similar document exists? (update rather than create)

### Post-Code Modification Verification

**Type Check**:

```bash
# Run project-specified type check command (must be 0 errors)
```

**Functionality Verification**:

```bash
# Run project-specified test/demo scripts (must pass)
```

**Pre-Commit Check**:

- [ ] No new/modified `.env*` files
- [ ] Commit message format correct (`[Type] description` or `Phase X: operation`)
- [ ] Pushed to remote (`git push`)

### Post-Task Completion Check

**Log Update**:

- [ ] AGENT_WORKLOG updated (if applicable)
- [ ] Includes: background, steps, file changes, verification results

**Documentation**:

- [ ] Important decisions recorded in appropriate file
- [ ] Design decisions include: background, options, selection rationale, impact scope

**Communication Confirmation**:

- [ ] Key tasks asked user "Can we proceed?"
- [ ] User feedback addressed promptly

---

## Exception Handling Process

### Situations Where Constraints Can Be Requested for Modification

Only in following cases can constraint modification be requested:

1. User explicitly requests
2. Constraint causes severe obstruction with no alternative
3. Constraint contains security vulnerabilities

### Modification Process

1. **Agent Proposes**: Explain reason and alternatives
2. **User Approves**: Get explicit consent
3. **Update Constraint**: Modify this file
4. **Commit Note**: Explain reason in commit message

---

## Reference Resources

### Project-Specific Documentation

To be added

### External Resources

- [Cursor Rules Best Practices](https://cursor.com/docs/context/rules)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)

---

## Version History

- **v2.0** (2026-02-08): Integrated `.clinerules` and `HUMAN_CONSTRAINTS_FOR_AGENT.md`, adopted priority classification, optimized structure, renamed to generic format
- **v1.0** (2026-01-30): Initial version (`HUMAN_CONSTRAINTS_FOR_AGENT.md`)

---

**Usage Instructions**:

- **Core Rules**: See [RULES.md](RULES.md) (condensed version, Agent must follow)
- **Detailed Reference**: This document provides supplementary explanations, examples, and best practices
- **On-Demand Consultation**: Refer to this document when detailed guidance needed
