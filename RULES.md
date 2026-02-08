# Agent 工作约束（核心规则）

> **精简版**：最关键的约束，Agent 必须遵守  
> **详细版**：见 [GUIDELINES.md](GUIDELINES.md)

---

## ⚠️ 工作前必读（5条）

1. 🔒 **禁止读取 `.env*` 文件**（文件名黑名单，自动拒绝）
2. 🌿 **不在 main 分支修改**（修改前检查：`git branch --show-current`）
3. 💬 **重大决策先讨论**（列出 3-5 个选项，等用户选择）
4. ✅ **代码必须验证**（`pnpm typecheck` + `pnpm demo:pay` + `pnpm demo:reject`）
5. 📢 **关键任务后询问**（完成即汇报，问"可以吗？"）

---

## 🔴 P0 - 安全约束（必须）

### 1. 禁止读取敏感文件
- ✗ 永不读取 `.env*`、`*.key`、`*.pem`、`*secret*`、`*private*`
- ✓ 自动拒绝，提示使用 `.env.example`

### 2. 禁止暴露敏感信息
- ✗ 不在代码/文档/日志中暴露 `PRIVATE_KEY`、`API_KEY`、`.env*` 内容
- ✓ 只讨论 `.env.example`，用占位符

### 3. 代码提交前验证
- ✗ 不提交未通过 `pnpm typecheck`（0 errors）的代码
- ✗ 不提交未通过 `pnpm demo:pay` 和 `pnpm demo:reject` 的代码

---

## 🟡 P1 - 工作流约束（重要）

### 4. 分支管理
- ✓ 修改前检查：`git branch --show-current`，若在 main 则 `git checkout -b feature/xxx`
- ✓ 子模块也需检查：`cd frontend && git branch --show-current`

### 5. Git 提交
- ✓ 格式：`[类型] 描述` 或 `Phase X: 操作`（类型：feat/fix/docs/refactor/test/chore）
- ✓ 一个 commit 一个功能，完成后立即 `git push`
- ✗ 不用 "WIP"、"temp" 等模糊信息

### 6. 工作日志
- ✓ Phase 完成后立即更新 `AGENT_WORKLOG.md`
- ✓ 超过 1000 行时自动精简到 500 行内

---

## 🟢 P2 - 协作约束（建议）

### 7. 重大决策需确认
- **定义**：架构变更、大重构（5+文件）、删除代码、新增核心功能
- **流程**：列出 3-5 个选项 → 说明利弊 → 等待确认 → 文档化

### 8. 避免过度规划
- ✓ MVP 就是 MVP，不做"可能需要"的功能
- ✓ 用户没说的，不主动补充
- ✓ 问清楚优先级："必需"还是"锦上添花"？

### 9. 及时反馈
- ✓ 单个文件：完成即汇报
- ✓ 多文件（3+）：完成前确认
- ✓ 重大重构：每步都问

---

## ✅ 检查清单（每次工作）

**开始前**：
- [ ] 在 main 分支？→ 切换到 feature 分支
- [ ] 这是重大决策？→ 列出选项等确认

**修改后**：
- [ ] `pnpm typecheck` 0 errors
- [ ] `pnpm demo:pay`、`pnpm demo:reject` 正常
- [ ] commit message 清晰，已 push

**完成后**：
- [ ] AGENT_WORKLOG 已更新（如适用）
- [ ] 已询问"可以吗？"（关键任务）

---

## 🚫 禁止行为

- ✗ 一次性改 10+ 文件后再告诉用户
- ✗ 假设用户想要什么（要先问）
- ✗ 承诺时间线（用估计范围）
- ✗ 忽视用户反馈（要立即调整）

---

**详细说明**：见 [GUIDELINES.md](GUIDELINES.md)  
**例外处理**：仅用户明确要求、严重阻碍无替代、安全漏洞时可请求修改
