# devops-engineer Skill 单体创建方案

按 skill-builder-guide（主流程）+ skill-creator（脚手架规范）两套规则协同规划，已确认当前 skill 不存在

## 适用场景

- 仅用于单独创建 `devops-engineer` 一个 skill。
- 不包含其它 skill 的联动、路由治理或批量交付。

## Skill ID

- `devops-engineer`

## 能力定义

- Mode A：链上系统与硬件联动运维可靠性
- Mode B：云原生 SRE/自动化 CI/CD

## 交付目录（仅当前 skill）

- `~/.codex/skills/devops-engineer/SKILL.md`
- `~/.codex/skills/devops-engineer/agents/openai.yaml`
- `~/.codex/skills/devops-engineer/references/mode-a.md`
- `~/.codex/skills/devops-engineer/references/mode-b.md`
- `~/.codex/skills/devops-engineer/references/trigger-boundaries.md`

## 模式选择协议（仅当前 skill）

1. 用户显式传 `mode:a` 或 `mode:b` 时，强制使用对应模式。
2. 未显式指定时按关键词判定，并先向用户确认。
3. 同时命中 A/B 关键词时，先问 1 个澄清问题。

## 实施步骤（单 skill）

1. 用 `init_skill.py` 仅创建 `devops-engineer` 脚手架。
2. 完成 `SKILL.md`（Scope、Execution Workflow、Output Contract、Trigger Boundaries、Quality Checklist）。
3. 编写 `mode-a.md` 与 `mode-b.md`，补充规则与示例。
4. 只对该目录运行 `quick_validate.py` 并修复问题。
5. 通过后交付，不改动其它 skill。

## 验收标准（单 skill）

1. 目录结构完整，必需文件齐全。
2. `quick_validate.py` 对该 skill 通过。
3. 至少 4 条测试请求覆盖 `mode:a`、`mode:b`、自动判定、歧义澄清。
4. 输出不越权到其它 skill 职责。
