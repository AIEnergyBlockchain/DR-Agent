# DR-Agent 代码评审 - 修订版

> 日期: 2026-02-23
> 方法: 全量源码审计（不依赖旧版指南文档）
> 范围: 全部后端服务、智能合约、前端、脚本

---

## 背景

此前的评审文档（2026-02-17 ~ 2026-02-20）基于更早的代码快照。
本次修订评审反映**代码经过多轮开发后的真实现状**。

---

## 逐项对比：旧评审 vs 当前代码

### 1. 链上真实性缺口

| 项目 | 旧评审结论 | 当前代码实态 |
|------|-----------|-------------|
| API 默认模式 | simulated（UUID） | simulated（未变） |
| fuji-live 支持 | 未集成 | **已完整集成**，通过 `fuji_chain_action.js` |
| 服务层调用合约 | 否 | **是** -- `submitter.py._chain_tx()` 在 `DR_CHAIN_MODE=fuji-live` 时分发到 `fuji_chain_action.js` |
| 真实 tx hash | 否 | **是** -- ethers.js 钱包签名、真实合约调用、真实 gas 费 |
| 双模式架构 | 仅概念 | **已运作** -- simulated/fuji-live 在 `_normalize_chain_mode()` 切换 |

**代码证据：**
- `services/submitter.py` 51-58行: 链模式检测
- `services/submitter.py` 72-163行: `_chain_action()` -> `_chain_tx()` 双模式分发
- `scripts/fuji_chain_action.js` 241-315行: ethers.js 合约调用（create_event, close_event, submit_proof, settle_event, claim_reward）

**结论: 已打通** -- fuji-live 模式下可真正调用链上合约。默认保持 simulated 以便本地开发。

---

### 2. AI Agent / Prophet 集成

| 项目 | 旧评审结论 | 当前代码实态 |
|------|-----------|-------------|
| Prophet 代码是否存在 | 不明确 | **存在** -- `services/baseline.py` 39-82行 |
| API 是否自动调用 Prophet | 否 | **否**（未变） |
| baseline_method 在 API 响应中 | 否 | **是** -- 存入 DB，通过 DTO 返回 |
| baseline_model_version | 否 | **否**（仍在计划中） |
| baseline_confidence | 否 | **否**（仍在计划中） |
| Agent Insight | 规则生成文本 | **规则生成文本**（未变） |

**代码证据：**
- `services/baseline.py` 39-82行: `compute_baseline_prophet()` 函数存在，导入 Prophet 库，按日/周季节性预测
- `services/submitter.py` 597行: baseline_method 从客户端透传，**非**服务端计算
- `frontend/app.js` 1700-1860行: `buildAgentInsight()` 用模式匹配规则，非 ML 推理

**结论: 部分修复** -- Prophet 基础设施已有但未在证据提交流程中自动调用。Agent Insight 仍是规则引擎。

---

### 3. 商业图表

| 项目 | 旧评审结论 | 当前代码实态 |
|------|-----------|-------------|
| 基线 vs 实际对比图 | 未实现 | **已实现** |
| 支付分解图 | 未实现 | **已实现** |
| 图表库 | 无 | DOM CSS 柱状条渲染（无外部库） |

**代码证据：**
- `frontend/app.js` 1936-2025行: `renderVisualInsights()`
- 1963-2001行: `renderProofBars()` -- 每站点的基线/实际水平柱状条，显示削减百分比
- 2007-2024行: `renderPayout()` -- 正/负支付柱状条，颜色编码（绿/红/灰）
- 双语 i18n 支持（中/英）

**结论: 已完全修复**

---

### 4. 实际价值转移（claimReward）

| 项目 | 旧评审结论 | 当前代码实态 |
|------|-----------|-------------|
| claimReward 是否转账 | 否 | **否**（未变） |
| ERC-20 代币集成 | 否 | **否**（未变） |
| 合约状态更新 | 是 | 是（未变） |

**代码证据：**
- `contracts/Settlement.sol` 179-193行: `claimReward()` 仅更新 `record.status = SettlementStatus.Claimed` 并触发 `RewardClaimed` 事件
- 无 `transfer()`、`transferFrom()` 或 AVAX 发送

**结论: 未修复** -- 这是唯一与"结算平台"定位直接矛盾的功能缺口。

---

### 5. 链上证据 / 浏览器链接

| 项目 | 旧评审结论 | 当前代码实态 |
|------|-----------|-------------|
| 数据库 TX 追踪 | 部分 | **完整** -- tx_hash、tx_fee_wei、时间戳存入所有表 |
| 持久化缓存文件 | 否 | **否** |
| Snowtrace / 浏览器链接 | 否 | **否** |
| 前端 TX 展示 | 仅 hash | `shortHash()` 展示，不可点击 |

**结论: 部分修复** -- TX 追踪已改善，但无浏览器链接或持久化证据。

---

### 6. 前端 UX 功能

| 项目 | 旧评审结论 | 当前代码实态 |
|------|-----------|-------------|
| Judge Mode（裁判模式） | 未实现 | **已实现**，含 localStorage 持久化 |
| Camera Mode（演示模式） | 未实现 | **已实现**，CSS 类切换 |
| 主题切换 | 未实现 | **已实现**（cobalt / neon） |
| 快照导出 | 不完整 | **完整** -- Judge/Engineer 双模式，剪贴板 + 降级方案 |
| 国际化（中/英） | 部分 | **完整**，覆盖所有功能 |

**代码证据：**
- `frontend/app.js` 2121-2127行: Judge Mode 开关
- `frontend/app.js` 2112-2119行: Camera Mode 开关
- `frontend/app.js` 1211-1220行: 主题切换（cobalt/neon）
- `frontend/app.js` 1267-1396行: `buildJudgeSnapshot()` 含完整证据链

**结论: 已完全修复**

---

## 修订评分

| 维度 | 旧评分 | 修订评分 | 变化 | 理由 |
|------|--------|---------|------|------|
| 问题真实性与市场匹配 | 8.0 | 8.0 | 0 | 未变 -- 问题定义扎实 |
| Avalanche 生态对齐度 | 6.0 | 7.0 | +1.0 | fuji-live 模式是真实的；但无 Avalanche 专属特性（AWM、Teleporter、Subnet） |
| 技术架构与代码质量 | 8.0 | 8.5 | +0.5 | 双模式链集成，服务层成熟度高 |
| 创新与差异化 | 6.0 | 7.0 | +1.0 | Prophet 代码存在但未闭环；Agent Insight 仍是规则引擎 |
| 完整性与 Demo 就绪度 | 8.0 | 9.0 | +1.0 | 图表、Judge/Camera Mode、快照导出、完整 i18n |
| Builder 背景 | 7.0 | 8.5 | +1.5 | 单人开发速度令人印象深刻 |
| **加权平均** | **7.3** | **7.9** | **+0.6** | |

---

## 剩余核心缺口（按优先级排序）

### P0: Avalanche 差异化（生态评分天花板）
整个合约层是通用 EVM Solidity，未使用：
- Avalanche Warp Messaging（AWM）
- Teleporter 跨链
- Subnet / L1 架构
- 自定义预编译合约
- HyperSDK

这将 Avalanche 生态对齐度评分封顶在 ~7.0，无论其他方面如何改善。

### P1: claimReward 价值转移
一个"结算平台"的 `claim` 不转钱，是逻辑矛盾。
最小可行修复：部署 ERC-20 模拟代币（DRT），给合约充值，在 `claimReward()` 中加 `token.transfer()`。

### P2: Prophet 自动调用
`compute_baseline_prophet()` 存在但 API 从未调用。
修复方案：当 `baseline_method=prophet` 且未提供 `baseline_kwh` 时，`submit_proof` 在服务端自动计算基线。

### P3: 前端浏览器链接
TX hash 在 fuji-live 模式下应链接到 `https://testnet.snowtrace.io/tx/{hash}`。
仅需约 10 行前端代码，但 demo 效果显著。
