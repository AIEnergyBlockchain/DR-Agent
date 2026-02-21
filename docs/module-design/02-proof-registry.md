# 模块设计 02 - ProofRegistry

## 职责
1. 记录站点履约摘要与 proof hash。
2. 对 `eventId + siteId` 执行防重。
3. 仅在事件 `Active` 时接收 proof。

## 合约接口
- `submitProof(bytes32 eventId, bytes32 siteId, uint256 baselineKwh, uint256 actualKwh, bytes32 proofHash, string uri)`
- `getSiteProof(bytes32 eventId, bytes32 siteId)`
- `isSubmitted(bytes32 eventId, bytes32 siteId)`

## 数据结构
`SiteProof`:
- `siteId`
- `baselineKwh`
- `actualKwh`
- `reductionKwh`
- `proofHash`
- `uri`
- `submittedAt`
- `submitter`

## 校验逻辑
1. 通过 EventManager 读取事件状态，必须 `Active`。
2. 同一 `(eventId, siteId)` 仅可提交一次。
3. `reductionKwh = max(baselineKwh - actualKwh, 0)`。

## 测试关注点
1. 重复 proof 提交拒绝。
2. 非 Active 事件提交拒绝。
3. 查询不存在 proof 返回错误。
