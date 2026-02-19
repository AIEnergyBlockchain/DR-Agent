# DR-Agent 生产级开发计划（2026-02-19）

## 1. 目标与范围
- 目标：把当前“可演示 MVP”升级为“可上线试点”的生产级系统。
- 范围：合约、后端服务、前端交互、部署与运维、质量与安全。
- 不包含：大规模商业化运营、跨法域完整合规实施、主网资金托管上线。

## 2. 当前基线（As-Is）
- 已有可演示闭环：`create -> proofs -> close -> settle -> claim -> audit`。
- 前端已具备 Judge-first 三模式（Story/Ops/Engineering）与证据导出。
- 合约单测通过（Hardhat 15 passing）。
- API 已包含 `claim`、`judge summary`、`healthz`。
- 当前主要限制：
  - 钱包交互缺失（前端使用 API key）。
  - 服务层仍有模拟交易路径，不是完整链上写入。
  - 缺少生产级鉴权、审计追踪、监控告警和发布回滚体系。

## 3. 目标架构（To-Be）
1. 前端层
- 增加钱包连接（MetaMask/WalletConnect）与链网络校验。
- 角色模式保留：Operator / Participant / Auditor（并支持钱包地址映射）。
- 三模式 UI 保留，用于路演与运维共用。

2. 服务层
- 从“API key 简化鉴权”升级为“JWT + 钱包签名校验 + RBAC”。
- 交易提交走真实 RPC provider（含重试、nonce 管理、失败回滚）。
- 保留 `judge summary` 聚合接口作为展示稳定层。

3. 数据层
- 从 SQLite 升级至 Postgres（事务一致性、审计索引、并发能力）。
- 保留事件、proof、settlement、audit 的统一事件流水表（append-only）。

4. 链上层
- Fuji 先行：部署并固定合约地址、版本、ABI 与迁移记录。
- 完善事件与状态机约束，保证可重放、可审计、可回溯。

## 4. 工作分解（Workstreams）

### WS-A：身份与权限（P0）
- 引入钱包签名登录（SIWE 风格）与会话令牌。
- 后端鉴权升级：JWT + 角色授权 + 资源级校验。
- 管理端支持地址白名单与角色绑定。
- 交付物：
  - `auth` 模块与中间件
  - 身份映射表与权限策略文档
  - 安全测试用例（越权/重放/伪造）

### WS-B：真实链上执行（P0）
- 后端提交器改为真实链交易（替代模拟 tx hash）。
- 实现确认策略：`submitted -> confirmed -> finalized` 状态。
- 加入失败重试与幂等键（避免重复 settle / claim）。
- 交付物：
  - 交易执行服务（含 nonce 管理）
  - Fuji 部署与回归脚本
  - 链上地址与交易证据记录

### WS-C：数据与审计（P0）
- SQLite 迁移到 Postgres，提供迁移脚本与回滚脚本。
- 审计流水增强：请求 trace_id、actor、请求签名、tx hash 全链路关联。
- 审计查询增加分页与时间窗口过滤。
- 交付物：
  - DB migration
  - 审计报表导出接口
  - 数据留存策略与索引策略

### WS-D：前端生产化（P1）
- 增加 Connect Wallet / Network Guard / Tx 状态反馈。
- 区分“演示模式”和“生产模式”配置开关。
- 保留 Story/Ops/Engineering；增加错误恢复引导与空态文案。
- 交付物：
  - 钱包连接与签名流程
  - 交易确认 UI（pending/confirmed/failed）
  - E2E 测试脚本（Playwright）

### WS-E：可观测性与运维（P1）
- 指标：请求成功率、P95 延迟、链上确认耗时、失败率、重试率。
- 日志：结构化日志 + trace_id + tx hash。
- 告警：交易积压、错误率突增、数据库连接池异常。
- 交付物：
  - Dashboard + Alert Rules
  - 故障 Runbook
  - 发布检查清单（Go/No-Go）

### WS-F：安全与质量门（P1）
- 安全扫描：依赖漏洞、静态检查、密钥泄露检测。
- 测试门禁：
  - 合约：单测 + 关键性质测试
  - API：集成 + 鉴权 + 幂等
  - 前端：E2E + 可用性回归
- 交付物：
  - CI Pipeline（lint/test/security gate）
  - 发布前签核模板

## 5. 里程碑与节奏（建议 6 周）
1. Week 1
- 完成身份方案选型与生产数据库设计。
- 完成 Fuji 部署基线与环境模板。

2. Week 2
- 完成钱包签名登录 + 后端 JWT/RBAC 骨架。
- 完成交易执行服务 PoC（真实 tx 提交）。

3. Week 3
- 打通真实链上闭环：create/proof/close/settle/claim/audit。
- 接入 Postgres 与审计流水。

4. Week 4
- 前端接入钱包与交易状态。
- 完成核心 E2E 场景。

5. Week 5
- 可观测性与告警上线。
- 完成安全测试与故障演练。

6. Week 6
- 预发布压测、回滚演练、发布评审。
- 冻结版本并输出试点交付包。

## 6. 关键验收标准（Definition of Done）
- 可在 Fuji 跑通真实闭环，且每步可关联链上 tx hash。
- 钱包连接、网络检查、签名授权流程稳定可复现。
- 审计接口可输出“链上记录 vs 复算结果”的可追踪证据。
- 通过质量门：合约/API/前端测试与安全扫描全部通过。
- 具备告警、回滚、值班 runbook。

## 7. 风险与应对
- 风险：RPC 不稳定导致交易确认波动。
  - 应对：多 RPC provider + 重试退避 + 事务外盒(outbox)。
- 风险：角色越权或密钥泄露。
  - 应对：最小权限、短时令牌、签名挑战一次性 nonce。
- 风险：演示模式与生产模式混用。
  - 应对：显式 `APP_MODE` 配置与启动时强校验。

## 8. 分支与交付策略
- 分支命名建议：
  - `prod/production-grade-plan`（计划基线）
  - `prod/auth-rbac`
  - `prod/real-chain-submitter`
  - `prod/frontend-wallet`
  - `prod/observability-gates`
- 要求主仓库与子模块始终同名分支开发。
- 每个工作流独立 PR，按依赖顺序合并。
