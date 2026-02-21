# 模块设计 03 - Settlement

## 职责
1. 读取 proof 计算 payout。
2. 写入 settlement 记录并支持 claim。
3. 事件级结算完成后驱动 EventManager 进入 `Settled`。

## 合约接口
- `settleEvent(bytes32 eventId, bytes32[] siteIds)`
- `claimReward(bytes32 eventId, bytes32 siteId)`
- `getSettlement(bytes32 eventId, bytes32 siteId)`
- `setAuthorizedService(address,bool)`

## 公式与单位
- 单位统一 `kWh`
- `targetShare = targetKw / siteCount`
- `if reduction >= targetShare: payout = targetShare * rewardRate`
- `else: payout = reduction * rewardRate - (targetShare - reduction) * penaltyRate`
- 全部整数运算，向下取整。

## 幂等与权限
1. 同一 `(eventId, siteId)` 只允许结算一次。
2. `settleEvent` 仅 operator 或授权服务可调用。
3. `claimReward` 仅 proof submitter 可调用。
4. 服务/API侧仅允许 `Closed` 事件触发结算，不再自动从 `Active` 隐式转 `Closed`。

## 事务与回滚
1. 结算流程采用单事务提交：任一站点写入失败则整体回滚。
2. 结算失败不改变事件状态，允许修复后重试。
3. 异常统一返回结构化错误码（含重试语义）。

## 测试关注点
1. 未关闭事件不可结算。
2. 非 submitter 不可 claim。
3. 重复 settle 拒绝。
4. 授权服务可代 operator 触发结算。
