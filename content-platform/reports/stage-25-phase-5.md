# 阶段 25 汇报：FSRS 影子双跑评估（V3 Phase 5）

- **ADR**：ADR-002（数据工程严谨性）、ADR-003（API 版本与错误契约）
- **日期**：2026-10-13
- **前置提交**：`9940e7b`（Phase 4 掌握度与间隔复习）
- **范围**：只做 `ts-fsrs@5.4.2` 影子双跑，不改 `due_at` 的权威来源，不切换线上调度器

## 发现

1. Phase 4 已明确不直接引入 FSRS：现有权威卡只有
   `interval_days / ease / streak / lapses`，缺少 FSRS 的 stability、difficulty
   和完整 review log，直接接管会改变大量历史卡的到期时间。
2. `learning_attempts` 已按用户和题目保留完整作答序列，足够做确定性回放；
   因此本轮不需要重写历史卡，也不需要伪造 FSRS 参数。
3. `ts-fsrs@5.4.2` 为 MIT，依赖 `node >= 20`，项目当前 Node 版本满足；
   本轮固定 `enable_fuzz: false`、`enable_short_term: true`，学习步骤 `1m / 10m`，
   保证同一作答序列可复现。
4. 需要同时支持全局开关和单课程开关：用户可对全部课程关闭影子计算，
   也可以只对某门课关闭；未显式配置时默认继续采集影子状态。

## 改动

### 数据库

- 新增迁移 `db/migrations/074_fsrs_shadow.sql`：
  - `learning_review_cards` 增加 `fsrs_state`、`fsrs_due_at`、`fsrs_stability`、
    `fsrs_difficulty`、`fsrs_last_review_at`、`fsrs_updated_at`；
  - 新增 `learning_review_cards(user_id, fsrs_due_at)` 部分索引；
  - 新增 `learning_scheduler_settings(user_id, track_slug, mode)`，
    `mode ∈ {off, shadow}`，默认 `shadow`；
  - 保留 `sm2-lwb-v2` 对 `due_at` 的独占写入。
- 回滚契约：`db/migrations/down/074_fsrs_shadow.down.sql`。
- 同步更新 `db/schema.sql` 和 `content-platform/db/index-inventory.md`。

### 共享领域层

- `packages/shared/src/learning.ts`
  - 新增 `learningSchedulerModeSchema`；
  - 新增 `learningSchedulerActionSchema`；
  - 新增 7 / 14 / 30 天到期分布、平均绝对偏差、P90、覆盖率、状态计数的评估 schema。

### 服务端

- 新增 `apps/web/lib/fsrs-shadow.ts`：
  - `advanceFsrsShadow` 推进单卡影子状态；
  - `replayFsrsShadows` 按 `questionKey + createdAt` 确定性回放；
  - `evaluateFsrsShadow` 产出 7 / 14 / 30 天 SM-2 / FSRS 到期差异报告。
- 新增 `apps/web/lib/learning-scheduler.ts`：
  - 解析全局与课程级有效开关；
  - `shouldComputeFsrsShadow` 供作答事务直接复用；
  - `learningSchedulerStatus` 优先使用可回放历史，缺少作答时才回退到数据库影子快照；
  - `setLearningSchedulerMode` 用目标状态 upsert，重复调用无副作用。
- 修改 `apps/web/lib/learning.ts`：
  - 作答事务仍先推进 `sm2-lwb-v2`；
  - 随后按用户 / 课程开关推进 FSRS；
  - 关闭影子时 SQL 用 `CASE WHEN` 保留已有 FSRS 状态，不覆盖、不清空；
  - 重复 `clientId` 仍然在推进任何调度状态前直接返回。
- 新增接口 `apps/web/app/api/learning/scheduler/route.ts`：
  - `GET ?track=` 返回当前模式和评估报告；
  - `PATCH { action, trackSlug? }` 设置 `shadow` / `off`；
  - 新接口使用统一错误 envelope 和 `x-request-id`。
- 补登 `content-platform/openapi/learning.md` 与 `content-platform/api/route-inventory.md`。

### 测试

- `apps/web/lib/fsrs-shadow.test.ts`：空卡推进、答错 lapse、回放确定性、
  7 / 14 / 30 天重叠与偏差、零覆盖。
- `apps/web/lib/learning-scheduler-shadow.test.ts`：默认影子、课程级覆盖、
  全局关闭、历史回放优先、存储快照回退、目标状态 upsert。
- `apps/web/app/api/learning/scheduler/route.test.ts`：鉴权、参数校验、读写接口。
- `apps/web/lib/learning.test.ts`：作答事务写入 / 保留影子状态的回归。

## 验证

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型 | `pnpm typecheck` | 7/7 通过 |
| Web | `pnpm --filter web test` | 213 文件通过 / 3 skipped；1431 通过 / 15 skipped |
| 移动端 | `pnpm --filter mobile test` | 66 文件 / 617 通过 |
| Web lint | `pnpm --filter web lint` | 0 error / 56 历史 warning |
| 脚本与工程门禁 | `pnpm test:scripts` | 106 通过；迁移 74；内容质量 0 警告；索引台账 105 表；API 台账 144 路由 3/3；worklet 70 调用 |
| 迁移演练 | `pnpm db:drill` | 074 回滚 8 个对象 → 再正向重新出现；6 个 down 文件全通过 |
| 全新库 | `node scripts/check-schema-fresh.mjs` | `schema.sql` 375 条语句 + 74 个迁移全部通过 |

## 风险

- 当前仍是影子评估，用户看到的到期时间完全由 `sm2-lwb-v2` 决定；
  FSRS 与 SM-2 的偏差只出现在评估报告里，不会触发复习队列变化。
- 评估接口每次会回放该用户的历史作答；个人学习规模下可接受，
  后续数据量明显增大时可加缓存、抽样或离线物化报告。
- `learning_scheduler_settings` 的默认值是 `shadow`，即“未显式关闭就继续采集”；
  这是刻意的数据积累策略，不是自动切换调度器的灰度开关。
- 本轮代码和迁移已在本地全新库、演练库和测试中验证，但尚未把 074 应用到线上数据库；
  线上发布时需要先执行迁移，再部署 Web。

## 回滚

1. 代码回滚：`git revert` 本阶段提交。
2. 数据库回滚：执行 `db/migrations/down/074_fsrs_shadow.down.sql`。
3. 数据兼容：回滚只删除 FSRS 影子列、影子索引和调度开关表；
   `learning_attempts`、`learning_review_cards` 的 SM-2 字段和用户历史回答不受影响。

## 下阶段

Phase 5 的目标不是“切 FSRS”，而是先获得真实数据。下一步应让影子数据积累至少
7 / 14 / 30 天，观察覆盖率、平均绝对偏差和状态迁移分布；只有评估稳定后，
才设计按用户 / 课程切换 `due_at` 的受控灰度和一键回退。
