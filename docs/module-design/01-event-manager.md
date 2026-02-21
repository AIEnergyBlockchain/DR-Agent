# 模块设计 01 - EventManager

## 职责
1. 管理 DR 事件生命周期。
2. 执行状态机约束：`Active -> Closed -> Settled`。
3. 执行 operator 与 settlement 合约权限控制。

## 合约接口
- `createEvent(bytes32,uint64,uint64,uint256,uint256,uint256)`
- `closeEvent(bytes32)`
- `markSettled(bytes32)`
- `getEventInfo(bytes32)`
- `setSettlementContract(address)`

## 状态机
1. 创建事件后状态为 `Active`。
2. 仅 operator 可 `closeEvent`。
3. `markSettled` 仅允许 settlement 合约或 operator 调用。

## 关键约束
1. `start < end`。
2. `eventId` 唯一。
3. `markSettled` 必须在 `Closed` 状态触发。

## 安全改进
已修复历史漏洞：任何地址可调用 `setEventSettled`。新接口改为 `markSettled` 并加 RBAC。

## 测试关注点
1. 非 operator 创建/关闭事件被拒绝。
2. 非 settlement/operator 标记 settled 被拒绝。
3. 重复 eventId 被拒绝。
