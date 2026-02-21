# 模块设计 07 - Test & Acceptance

## 合约测试矩阵
1. EventManager
- 权限控制
- 状态流转
- 重复 event 防重
2. ProofRegistry
- 重复 proof 防重
- 非 Active 拒绝
3. Settlement
- 结算权限
- 幂等
- claim 身份校验

## API 集成测试矩阵
1. 正常链路：create -> proofs -> close -> settle -> claim -> audit
2. 异常链路：重复 proof、非 operator settle、错误 claim
3. 审计链路：payload hash 复算一致

## 验收标准
1. `npx hardhat test` 全绿。
2. API 测试覆盖闭环与关键失败路径。
3. 文档中定义的 API 契约全部可用（含 close 与 chain-mode 端点）。
4. 演示脚本可在 5 分钟内跑通闭环。
