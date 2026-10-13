# 阶段 24 汇报：掌握度与间隔复习（V3 Phase 4）

- **前置提交**：`8e23e44`（Phase 3 内容生产流水线与开源适配）
- **日期**：2026-10-13
- **范围**：掌握度解释、复习调度状态机、延后/暂停/恢复/完成、薄弱知识点、跨设备与离线同步
- **约束**：不改写历史作答和复习卡数据；408 内容仍独立保存在 `exam_408_*`

## 完成结论

Phase 4 的四个验收项均已落地：

1. **掌握度有可解释来源**：继续使用“最近 5 个去重题目的指数加权正确率 × 时间新鲜度”，并新增 `sampleSize`、`questionCount`、`latestAttemptAt`、`method`，Web 与移动端共用 `@learn-workbench/shared`。
2. **复习任务生成稳定**：原 SQL 内嵌 CASE 抽成共享纯函数 `scheduleLearningReview`，保留 `1 / 3 / 7 / interval × ease`、`ease 1.30..3.50`、`interval 7..60`、连续答对 4 次 mastered 的既有口径，标记为 `sm2-lwb-v2`。
3. **用户可以管理复习计划**：新增 `snooze / pause / resume / complete`，移动端复习页和 Web 课程详情均可操作。
4. **Web 与移动端状态一致**：服务端 `learning_review_cards` 是权威状态；移动端在线直接更新，离线按稳定 `clientId` 入队并在恢复后重放。

## 主要改动

### 共享领域层

- `packages/shared/src/learning.ts`
  - 作答输入新增可选 `clientId`；
  - 复习状态新增 `suspended`；
  - 新增 `learningReviewAlgorithmVersion = "sm2-lwb-v2"`；
  - 新增可解释掌握度字段；
  - 新增 `scheduleLearningReview`、`applyLearningReviewAction`、`isLearningReviewDue`、`learningDayKey`。

### 数据库

- 新增迁移 `db/migrations/073_learning_review_plan.sql`：
  - `learning_attempts.client_id` + 用户级唯一部分索引；
  - 复习卡新增 `topic_key / algorithm_version / schedule_reason / suspended_from_status / suspended_at / completed_at / last_attempt_id`；
  - `status` 扩展为 `learning / review / mastered / suspended`；
  - 新增 `learning_review_events`，以 `(user_id, client_id)` 保证管理动作幂等；
  - 回滚契约：`db/migrations/down/073_learning_review_plan.down.sql`。
- 同步更新 `db/schema.sql` 和索引台账。

### 服务端

- `apps/web/lib/learning.ts`
  - 作答写入改为事务：
    - `clientId` 重放只写一条 attempt，不再二次推进卡片；
    - 首次确保卡片存在，再 `SELECT ... FOR UPDATE`，按共享调度器更新；
  - 到期队列支持 `scope=due|all`；
  - 新增薄弱知识点聚合 `weakTopics`；
  - 新增管理动作事务 `mutateLearningReview`。
- `apps/web/app/api/learning/review/route.ts`
  - `GET ?scope=due|all`；
  - `PATCH` 延后/暂停/恢复/完成；
  - 使用统一错误 envelope。
- `apps/web/app/api/learning/progress/route.ts`
  - 接受 `x-timezone`，按用户本地日界统计今日练习。

### Web

- 新增 `apps/web/components/learning/review-plan.tsx`：显示到期、暂停、已掌握和薄弱知识点，并管理同一份服务端计划。
- 课程详情接入复习计划面板。
- 掌握度请求携带浏览器时区。

### 移动端

- 答题会话：
  - 本地 attempt 生成稳定 `clientId`；
  - 在线同步，失败进入待同步队列，恢复后按原 `clientId` 重放。
- 复习页：
  - 显示薄弱知识点；
  - 支持延后 1 天、暂停、恢复、完成；
  - 离线管理动作会排队，联网后重放。
- 离线队列上限：作答 1000 条、复习动作 200 条，避免无限增长。

## FSRS 与开源实现评估

本轮在线复核候选：

| 实现 | 最新版本 | 许可证 | 维护状态 | 结论 |
|---|---:|---|---|---|
| `ts-fsrs` | 5.4.2 | MIT | 2026-10-09 更新 | 可作为后续迁移候选 |
| `fsrs.js` | 1.2.2 | MIT | 最后更新约 2024-01 | 暂不采用，维护活跃度不足 |

**本轮决策：不直接引入 FSRS，也不覆盖现有 SM-2 参数。**

原因：

- 现有生产数据只有 `interval_days / ease / streak / lapses`，没有 FSRS 所需的 stability、difficulty、review logs 等完整参数；
- 直接切换会改变大量历史卡的到期时间，且无法可靠校准；
- 当前先完成可解释、幂等、可暂停和跨设备一致的基础层，后续可基于 `algorithm_version + schedule_reason + last_attempt_id` 做双跑评估后再迁移。

## 验证

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型 | `pnpm typecheck` | 7/7 通过 |
| Web | `pnpm --filter web test` | 210 文件通过 / 3 skipped；1414 通过 / 15 skipped |
| 移动端 | `pnpm --filter mobile test` | 66 文件 / 617 通过 |
| lint | `pnpm lint` | 0 error |
| 脚本与工程门禁 | `pnpm test:scripts` | 106 通过；迁移 73、索引台账、API 台账、worklet 全通过 |
| 迁移回滚演练 | `pnpm db:drill` | 073 回滚 14 个对象，再正向全部复原 |

新增测试覆盖：

- 1 / 3 / 7 / interval × ease 间隔；
- 答错回退与 lapses；
- 暂停后由离线作答恢复；
- 延后、暂停、恢复、完成；
- Asia/Shanghai 日界与非法时区回退；
- 作答 `clientId` 重放不推进卡片；
- 复习管理 `clientId` 重放不二次延后；
- 移动端离线作答和复习动作队列。

## 已知边界

- 本轮没有启用 FSRS；迁移前需要用真实复习日志做离线回放和误差评估。
- `snooze` 的绝对时间由客户端传入，服务端校验为 ISO datetime；用户手工修改设备时间仍可能影响“延后”的绝对值，但服务端状态和幂等键不受影响。
- 离线队列只保证最终同步，不提供多设备同时操作同一卡片的逐行版本冲突提示；服务端事务会以实际到达顺序应用动作。
- `learning_review_cards` 仍未记录完整 FSRS review log；`learning_attempts + learning_review_events` 已足够支持后续迁移评估。

## 回滚

1. 代码回滚：`git revert` 本阶段提交。
2. 数据库回滚：执行 `db/migrations/down/073_learning_review_plan.down.sql`。
3. 数据兼容：回滚只移除本阶段新增列、事件表和索引，不删除历史作答或复习卡。

## 下一阶段建议

Phase 5 可以在当前基础层之上做“双跑评估”：

1. 用 `learning_attempts` 历史回放 SM-2 与 `ts-fsrs`，比较未来 7/14/30 天到期分布；
2. 为卡片补充可选的 FSRS state 字段，但默认继续读 `sm2-lwb-v2`；
3. 评估通过后再按用户或课程灰度切换，保留一键回到 SM-2 的能力。
