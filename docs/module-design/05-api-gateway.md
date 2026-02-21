# 模块设计 05 - API Gateway (FastAPI)

## 端点契约
1. `POST /events`
2. `POST /events/{event_id}/close`
3. `POST /proofs`
4. `POST /settle/{event_id}`
5. `POST /claim/{event_id}/{site_id}`
6. `GET /events/{event_id}`
7. `GET /events/{event_id}/records`
8. `GET /audit/{event_id}/{site_id}`
9. `GET /system/chain-mode`

## DTO
1. `EventDTO`: `event_id,start_time,end_time,target_kw,reward_rate,penalty_rate,status`
2. `ProofDTO`: `event_id,site_id,baseline_kwh,actual_kwh,reduction_kwh,proof_hash,uri,submitted_at`
3. `SettlementDTO`: `event_id,site_id,payout,status,settled_at,tx_hash`
4. `AuditDTO`: `event_id,site_id,proof_hash_onchain,proof_hash_recomputed,match,raw_uri`

## 鉴权模型
1. `x-api-key` 映射角色：`operator`、`participant`、`auditor`。
2. 写接口按角色授权：
- operator: events/close/settle
- participant: proofs/claim
- auditor: records/audit
3. participant 通过 `x-actor-id` 绑定 proof submitter 身份。
4. `settle` 必须在事件 `closed` 后执行，不再由服务层隐式 close。

## 可观测性
1. 中间件注入 `trace_id`。
2. 错误统一返回 envelope：`code,message,trace_id,retryable,details`。
3. `GET /system/chain-mode` 暴露当前执行模式（默认 `simulated`）。
