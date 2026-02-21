# 模块设计 04 - Off-chain Data Pipeline

## 模块职责
1. `collector.py`：模拟/采集负荷曲线。
2. `baseline.py`：生成 baseline，支持 `prophet -> simple` 回退。
3. `proof_builder.py`：构造规范 payload，生成 proof hash。
4. `submitter.py`：编排事件、proof、settlement 写入与审计查询。
5. `scorer.py`：复用结算公式。

## payload 规范
核心字段：
- `event_id`
- `site_id`
- `baseline_kwh`
- `actual_kwh`
- `reduction_kwh`
- `baseline_method`
- `raw_payload`
- `created_at`

## hash 策略
1. payload 采用 canonical JSON（key 排序）。
2. hash 优先 keccak，环境缺失时回退 `sha3_256`。
3. 审计查询使用同一算法复算。

## 异常策略
1. Prophet 异常时回退 simple baseline。
2. 记录 `baseline_method` 到 proof 索引表。
3. 所有写失败统一抛出 `ServiceError`，返回错误码与 trace_id。
