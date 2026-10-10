# 阶段 15 汇报：数据工程严谨性（组三 · H1）

- **ADR**：ADR-002
- **日期**：2026-10-11
- **提交**：`7caa964`

## 发现

在 `check-schema-fresh` 造出的全量库上用 `pg_catalog` 体检（不靠读文档猜）：

- **13 条外键没有支撑索引**（`accounts.user_id`、`daily_tasks.phase_id/topic_id`、`focus_sessions.task_id`、
  `interview_attempts.phase_id`、`job_notifications.job_id/subscription_id`、`job_skill_links.skill_id`、
  `knowledge_note_tags.tag_id`、`meal_entries.food_id`、`skill_content_links.topic_id`、`user_skills.skill_id`、
  `workout_items.user_id`）；
- 运营可编辑的四张内容表没有审计列、没有乐观锁；
- 63 个迁移文件**全部是正向**，没有任何可执行的回滚契约。

## 改动

- `db/migrations/064_h1_data_hardening.sql`：四张内容表补 `created_by`/`updated_by`/`version`（+ `CHECK (version > 0)`），补 13 条外键索引；
- `db/migrations/down/064_h1_data_hardening.down.sql`：回滚契约（放 `down/` 子目录，正向扫描天然跳过）；
- `db/schema.sql`：同步登记（全新库与既有库收敛到同一结构）；
- `scripts/db-index-inventory.mjs` → `content-platform/db/index-inventory.md`（从 DDL 再生，92 张表 / 288 索引 / 132 约束）；
- `scripts/migration-drill.mjs`：一次性演练库上跑「正向 → 回滚 → 再正向」，断言逐条解析自 down 文件；
- `content-platform/db/README.md`、`content-platform/adr/ADR-002-数据工程严谨性.md`。

## 验证

```bash
node scripts/verify-migrations.mjs      # 64 个迁移，编号连续，新表已登记
node scripts/check-schema-fresh.mjs     # schema.sql + 全部迁移零失败
pnpm db:drill                           # ✔ 回滚 29 个对象 → 再正向 → 全部复原
node scripts/db-index-inventory.mjs --check   # 工件最新（已进 test:scripts）
```

## 风险

- 应用层乐观锁写入路径**尚未接**（当前没有面向运营的编辑入口，先落数据层与契约）；
- 回滚只保证对象级消失，不还原数据（`down` 文件里已注明"回填不可逆"）；
- 生产 `Learn-Workbench` 库仍缺 022–065 的历史迁移（见看板），上线前需先补齐。

## 下阶段

H2：API 治理（错误契约 / 台账门禁 / 内部接口前门）。
