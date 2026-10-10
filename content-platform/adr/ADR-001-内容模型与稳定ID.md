# ADR-001：统一内容模型与稳定 ID（不合并，只统一词汇与 ID 规则）

- **状态**：已采纳
- **日期**：2026-10-10
- **阶段**：组二 · 阶段 7（V3 纵轨 Phase A，P0 红线）
- **相关文件**：`db/migrations/060_content_model_unification.sql`、`db/schema.sql`、
  `packages/content/src/learning/model.ts`、`apps/web/lib/content/knowledge-model.ts`、
  `content-platform/erd.md`、`content-platform/id-mapping.md`

## 1. 背景（真实代码依据）

仓库里并存两套内容模型（V3 §0.2 实测确认）：

1. **路线图侧（DB）**：`content_phases` → `content_topics`（+ resources / practices / projects / checkpoints），
   服务 `/roadmap` 与移动端路线图；进度落 `topic_progress`，且被 `daily_tasks.topic_id`、
   `skill_content_links.topic_id` 引用。
2. **学习库侧（TS 内容包）**：`LearningTrack → LearningStage → LearningTopic → LearningQuestion`，
   含深内容字段（concepts / principles / applications / pitfalls / method / exercise / checkpoint / lesson），
   由 `/learn`、`/quiz/*` 消费，作答落 `learning_attempts` + `learning_review_cards`（SM-2）。

两套都缺"知识点级稳定 ID"这一层：路线图侧只有 `topic_key` 且缺 slug/status/难度/时长/版本；
学习库侧只有 TS 字符串 key、没有任何持久化索引。于是"题 ↔ 知识点"、"知识点 ↔ 知识点"、
"内容时效 / 质量分级"都无处可存。

## 2. 决策

**不对两套模型做物理合并；给两套用上同一套字段词汇与稳定 ID 规则，用三张关联表 + 一个作答统一视图搭桥。**

1. 路线图侧补齐同构字段：slug、status、difficulty、quality_level、estimated_minutes、
   content_version、content_updated_at、published_at、stale_after、deleted_at；
   slug 由 BEFORE INSERT 触发器兜底 = phase_key / topic_key（种子脚本不必改）。
2. 学习库侧新建 `knowledge_points`：只存稳定 ID 索引 + 运营元数据，正文仍以 `packages/content` 为准。
3. 新建 `question_knowledge_point`、`knowledge_prerequisite`、`knowledge_relation`。
4. 作答记录用视图 `learning_attempts_unified` 桥接（不搬数据）。
5. 稳定 ID：知识点 = `<trackSlug>/<stageKey>/<topicKey>`；题目沿用内容包里已全局唯一的 questionKey。
6. 落库由 `POST /api/internal/content/sync`（+ `pnpm sync:content` / cron `?job=content`）幂等完成。

## 3. 备选方案与为什么不选

| 备选 | 说明 | 否决理由 |
|---|---|---|
| A. 把学习库内容灌进 content_topics（V3 建议的"作为持久化载体"） | 复用一张表，进度天然共享 | ① 路线图页按 phase_id 渲染 content_topics，灌进去会让 84 个技术知识点直接污染职业路线图；② 生命周期不同：路线图内容可由用户自建（is_custom / owner_id），学习库内容是版本化公开内容（license / 内容版本 / 审核状态）；③ 混表做"内容升级归档"会连带影响用户自建数据 |
| B. 反向：把路线图内容并进学习库 | 单一来源 | 路线图是个人职业规划（用户可增删改），学习库是公共内容，更新节奏与权限完全不同 |
| C. 再造第三套"课程/章节/小节"表 | 最省事 | 违反 V3 明令；且 7 门课程内容在 TS 里已写好，重写一遍纯属浪费 |
| D. 只统一文档、不加表 | 零风险 | question_knowledge_point / 前置图 / 质量分级 / 时效（Phase C/D/E/G）全部无处落地，后面还得补 |

## 4. 影响与代价

- **好处**：两套模型字段词汇一致；知识点有稳定 ID 与关联表；历史数据零迁移
  （topic_progress / learning_attempts 原样保留）；迁移可整套回滚。
- **代价**：content_topics 与 knowledge_points 存在字段同构的冗余。接受它 —— 两者语义不同
  （职业路线 vs 版本化课程），冗余只是列名一致，不是数据复制。
- **红线**：知识点 ID 一旦发布不再修改（改 ID = 断掉用户作答与复习卡片）；
  内容演进只能改正文（指纹变化 → updated）或新增知识点（旧知识点软归档）。

## 5. 验证

- `node scripts/check-schema-fresh.mjs` ✅（schema.sql + 60 个迁移，空库自检）；
  `node scripts/verify-migrations.mjs` ✅（编号连续、无 schema 漂移）。
- 真实数据副本演练（lwb_drill：119 个 content_topics / 3 行 topic_progress）：
  `BEGIN; \i 058; \i 060; ROLLBACK;` → 结构完整回到迁移前、行数不变 ✅；
  正式应用后 119 行不变、slug 0 空值、topic_progress 3 行不变 ✅。
- 落库演练（`LWB_DB_DRILL=1 PGDATABASE=lwb_drill` 跑 integration test）✅：
  首次写 84 / 重复同步 84 unchanged / 指纹变化识别为 updated / 消失知识点软归档 /
  curated 边保留 / dryRun 不写库。
