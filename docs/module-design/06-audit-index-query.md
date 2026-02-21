# 模块设计 06 - Audit Index & Query

## 存储实现
MVP 使用 SQLite，默认库路径：`cache/dr_agent.db`。

## 数据表
1. `events`
- 事件主数据与状态
2. `proofs`
- proof 摘要、payload 原文、baseline_method、submitter
3. `settlements`
- payout、状态、时间戳、tx_hash

## 查询能力
1. `GET /events/{event_id}`：事件状态。
2. `GET /events/{event_id}/records`：结算明细。
3. `GET /audit/{event_id}/{site_id}`：proof hash 复算一致性。

## 审计输出
`AuditDTO`:
- `proof_hash_onchain`
- `proof_hash_recomputed`
- `match`
- `raw_uri`

## 兼容策略
1. SQL 语句与 schema 保持 Postgres 友好字段命名。
2. 后续切 Postgres 时只替换存储适配层，不改 API 契约。
