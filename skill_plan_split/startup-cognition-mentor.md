# startup-cognition-mentor Skill 单体创建方案

## 适用场景

- 仅用于单独创建 `startup-cognition-mentor` 一个 skill。
- 不包含其它 skill 的联动、路由治理或批量交付。

## Skill ID

- `startup-cognition-mentor`

## 能力定义

- 模式形式：圆桌会议模式
- 固定流程：多认知角色交叉辩论 -> 冲突点收敛 -> 统一可执行结论
- 角色镜像来源：Musk/Munger/Jobs/Buffett/Vitalik/CZ/Justin Sun 的公开方法论，不做身份模仿

## 专项边界（导师）

- 输出必须是“多视角策略讨论 + 统一结论”，不做人物扮演口吻复制。

## 交付目录（仅当前 skill）

- `~/.codex/skills/startup-cognition-mentor/SKILL.md`
- `~/.codex/skills/startup-cognition-mentor/agents/openai.yaml`
- `~/.codex/skills/startup-cognition-mentor/references/roundtable-process.md`
- `~/.codex/skills/startup-cognition-mentor/references/trigger-boundaries.md`

## 执行协议（仅当前 skill）

1. 先识别用户问题的核心冲突与目标约束。
2. 按圆桌流程输出多视角论证，再收敛为统一执行结论。
3. 若信息不足，先问 1 个关键澄清问题后再给方案。

## 实施步骤（单 skill）

1. 用 `init_skill.py` 仅创建 `startup-cognition-mentor` 脚手架。
2. 完成 `SKILL.md`（Scope、Execution Workflow、Output Contract、Trigger Boundaries、Quality Checklist）。
3. 编写 `roundtable-process.md`，固化角色交互与结论收敛模板。
4. 只对该目录运行 `quick_validate.py` 并修复问题。
5. 通过后交付，不改动其它 skill。

## 验收标准（单 skill）

1. 目录结构完整，必需文件齐全。
2. `quick_validate.py` 对该 skill 通过。
3. 至少 4 条测试请求覆盖：常规策略讨论、冲突议题收敛、信息不足澄清、最终统一结论。
4. 输出不出现人物扮演口吻复制。
