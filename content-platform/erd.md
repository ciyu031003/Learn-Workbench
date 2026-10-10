# 统一内容模型 ERD（阶段 7 = V3 Phase A）

> 生成依据：`db/schema.sql` + `db/migrations/060_content_model_unification.sql`（结构），
> 与 `packages/content/src/learning/model.ts`（内容包到行的映射）。
> 决策背景见 `adr/ADR-001-内容模型与稳定ID.md`。

## 1. 全图

```text
           ┌───────────── 路线图侧（职业路线：系统种子 + 用户自建） ─────────────┐
           │ content_phases ──1:N──► content_topics ──1:N──► resources /        │
           │  slug (uq)               slug (uq)               practices /        │
           │  status                  status / difficulty     projects /         │
           │  estimated_minutes       quality_level           checkpoints /      │
           │                          estimated_minutes       items              │
           │                          content_version                             │
           │                          stale_after                                 │
           │        ▲                        ▲                                    │
           │        │                        └── topic_progress (user_id, topic_id)│
           └────────┼──────────────────────────────────────────────────────────────┘
                    │     【同一套字段词汇 + 同一套稳定 ID 规则，但不物理合并】
           ┌────────┴───────── 学习库侧（技术课程：版本化公开内容） ─────────────────┐
           │ knowledge_points（内容包的稳定 ID 索引 + 运营元数据）                    │
           │   key PK = <trackSlug>/<stageKey>/<topicKey>                          │
           │   status / quality_level / quality_missing / difficulty /             │
           │   estimated_minutes / fingerprint / content_version / stale_after     │
           │        ▲                    ▲                        ▲                │
           │ question_knowledge_point  knowledge_prerequisite  knowledge_relation  │
           │   （题 ↔ 知识点）            （知识点 → 前置）          （next / related） │
           └────────┬──────────────────────────────────────────────────────────────┘
                    │     【桥：作答统一视图，不搬数据】
                    ▼
      learning_attempts_unified（VIEW）
        domain='library'      ← learning_attempts（+ learning_review_cards 的 SM-2 状态）
        domain='interview:*'  ← interview_attempts（quiz / mock / interview）
```

## 2. 学习库侧表字段

### knowledge_points

| 列 | 类型 | 说明 |
|---|---|---|
| key | text PK | 稳定 ID：`<trackSlug>/<stageKey>/<topicKey>`，禁止用数组下标 |
| track_slug / stage_key / topic_key | text | 三段来源，便于按课程/阶段聚合筛选 |
| track_title / stage_title / title / summary | text | 展示与搜索字段（内容包镜像） |
| sort_order | int | 课程内全局顺序（跨阶段连续）→ next 关系由它推导 |
| stage_order / topic_order | int | 阶段内定位（目录、上一节/下一节） |
| status | text | draft / review / published / archived（CHECK） |
| quality_level | text | L0–L4（CHECK），含义见 templates/（阶段 9 落规范） |
| quality_missing | jsonb | 缺哪些模板字段（校验脚本与 UI 共用） |
| difficulty | text | easy / medium / hard（CHECK） |
| estimated_minutes | int | 阅读时长估算（可复算，见 model.ts） |
| fingerprint | text | 内容指纹：导入去重与"内容是否变化"的判定依据 |
| content_version | text | 内容包版本（git 短 sha） |
| content_updated_at / published_at / stale_after | timestamptz | 时效生命周期（Phase G 的"可能过时"提示） |
| source_key | text | 主来源键（usage='import' 优先） |
| tags | jsonb | 分类标签（课程类别 + 章节名） |
| deleted_at | timestamptz | 软删除位（H1 的一半顺带做掉） |

索引：(track_slug, sort_order)；(track_slug, stage_key, topic_order)；(status, quality_level)；
stale_after 部分索引（WHERE stale_after IS NOT NULL）。

### question_knowledge_point

主键 (question_key, knowledge_point_key)；link_source ∈ {explicit, stage-fallback, curated}。
explicit = 题目自带 topicKey；stage-fallback = 该阶段只有一个知识点；curated = 人工绑定（自动同步不覆盖）。

### knowledge_prerequisite

主键 (knowledge_point_key, prerequisite_key)，禁止自指；relation_source ∈ {derived, curated}，
note 记人工说明。当前 derived 边 = 每阶段首个知识点 → 上一阶段末个知识点。

### knowledge_relation

主键 (from_key, to_key, kind)；kind ∈ {next, related}，禁止自指。
next = 课程内相邻知识点；related = 同阶段兄弟（不含相邻对，避免与 next 重复）。

### learning_attempts_unified（视图）

两套作答字段不同，物理合并会丢语义，因此只暴露最小公共口径：
domain / user_id / track_slug / stage_key / question_key / is_correct / created_at。

## 3. 规模（2026-10-10 实跑：库副本 lwb_drill 同步后的真实计数）

| 表 | 行数 |
|---|---|
| knowledge_points（status='published'） | 84 |
| question_knowledge_point | 168 |
| knowledge_relation | 105 |
| knowledge_prerequisite | 21 |
| learning_attempts_unified | 0（演练库无作答数据；线上有数据后自然出现） |

## 4. 迁移与回滚

- 迁移文件：`db/migrations/060_content_model_unification.sql`（编号连续，db/schema.sql 已同步登记）；
- 幂等：ADD COLUMN IF NOT EXISTS + CREATE TABLE/INDEX IF NOT EXISTS + DO 块吞 duplicate_object；
- 回滚：所有对象都在单事务内创建（索引非 CONCURRENTLY），
  `BEGIN; \i 060; ROLLBACK;` 可完整回到迁移前（演练已证：knowledge_points 回到 NULL、
  content_topics 仍 119 行、topic_progress 3 行不变）。
