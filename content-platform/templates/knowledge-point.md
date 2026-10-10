# 知识点标准模板与质量分级（阶段 9 = V3 纵轨 Phase C）

> 内容正文写在 `packages/content/src/learning/<track>.ts`，DB 侧只存稳定 ID 索引与运营元数据。
> 本文是**模板规范**（写内容时照这个填）与**分级口径**（审核时照这个判）的单一来源；
> 自动化校验见 `packages/content/src/learning/quality.test.ts`（进 CI）与
> `scripts/check-content-quality.mjs`（库侧，无库时自动跳过）。

## 1. 模板字段（映射 V3 的"20 字段"到现有模型）

| V3 需求字段 | 现有字段（`LearningTopic` / `LearningTopicLesson`） | 必填 | 说明 |
|---|---|---|---|
| 标题 | `topic.title` | ✅ | 同一课程内不得重复（校验：归一化标题去重） |
| 一句话摘要 | `topic.summary` | ✅ | 出现在列表与目录 |
| 概念 | `topic.concepts[]` | ✅ | 3–6 条为宜 |
| 原理 | `topic.principles[]` | ✅ | |
| 应用场景 | `topic.applications[]` | ✅ | |
| 常见误区 | `topic.pitfalls[]` | ✅ | UI 用警示色呈现 |
| 怎么做/怎么学 | `topic.method` | ✅ | |
| 动手练习 | `topic.exercise` | ✅ | |
| 掌握检查 | `topic.checkpoint` | ✅ | 一句话可自测 |
| 讲解总览 | `topic.lesson.overview[]` | ✅ | 一屏一知识点阅读的正文骨架 |
| 运作机制 | `topic.lesson.mechanism[]` | ✅ | |
| 代码/操作示例 | `topic.lesson.example{title,language,code,explanation}` | ✅ | `language` 必须小写且在允许集合内 |
| 练习路径 | `topic.lesson.practiceSteps[]` | ✅ | |
| 掌握清单 | `topic.lesson.masteryChecklist[]` | ✅ | |
| 对比 / 边界 | 并入 `principles` / `pitfalls`（不再单开字段） | — | 避免字段膨胀 |
| 记忆卡片 | **不建字段** | — | 复习卡片由 SM-2（`learning_review_cards`）驱动，不重复造 |
| 来源与版本 | `track.sources[]` + 库侧 `content_version` | ✅ | 来源必须 https 且带许可；版本来自 git 提交 |

## 2. 质量分级（L0–L4）

| 等级 | 判定 | 是否进学习列表 | UI 角标 |
|---|---|---|---|
| L0 | 缺标题或摘要（占位） | ❌ | 占位 |
| L1 | 只有摘要级内容（深度字段 < 3） | ❌ | 仅摘要 |
| L2 | 概念层齐（concepts/principles/applications/pitfalls ≥ 3 项），但还没有 lesson | ✅ | 待补讲解 |
| L3 | 有 lesson，但模板仍有缺项（见 `quality_missing`） | ✅ | 待补全 |
| L4 | 模板全齐 + ≥2 道关联题 + 来源许可已知 | ✅ | **已审核** |

实现：`gradeKnowledgeTopic()` / `qualityOfTopic()`（`packages/content/src/learning/model.ts`），
Web 与移动端共用同一函数，**不存在第二套口径**。

## 3. 自动化校验清单（V3 Phase C 全部覆盖）

| 校验项 | 位置 |
|---|---|
| 必填字段 | `quality.test.ts` 必填与模板完整性 + 库侧空标题/摘要 |
| 代码块语言标记 | `quality.test.ts`（小写 + 允许集合） |
| 链接合法 | `quality.test.ts`（来源 url 必须 https） |
| 来源与许可合规 | `quality.test.ts`（每个课程至少一个 `usage='import'` 来源且有 license） |
| 重复识别 | `quality.test.ts`（标题归一化去重 + 内容指纹去重） |
| 题目关联存在 | `quality.test.ts`（每知识点 ≥2 题）+ 库侧孤儿知识点检查 |
| 排序无冲突 | `quality.test.ts`（阶段/知识点 key 唯一、sort_order 连续）+ DB 索引/自指约束 |
| 危险 HTML / 脚本 | `quality.test.ts`（正文与代码都不允许 `<script>`/`onerror=`/`javascript:`） |
| 过时内容复查日期 | `quality.test.ts`（内容包提交时间 + 180 天）→ 库侧 `stale_after` 过期清单 |
| L0/L1 不进正式列表 | `quality.test.ts`（`isLearnable` 门槛）+ 移动/Web 列表过滤 |

## 4. 怎么跑

```bash
pnpm -F @learn-workbench/content test      # TS 侧内容契约（CI 会跑）
pnpm test:scripts                          # 含库侧门禁（无库时自动跳过）
pnpm check:content                         # 库侧门禁 --strict（警告也算失败，发布前用）
pnpm sync:content --dry-run                # 内容包 → 统一内容模型（预览差异）
```

## 5. 加一条新知识点的最小流程

1. 在对应课程文件里按上表补一个 `LearningTopic`（含 `lesson`），题目用 `topicQuestionPair(topicKey, stageKey, …)` 生成 ≥2 道；
2. `pnpm -F @learn-workbench/content test` 过（模板/语言/重复/危险 HTML/题量一次全查）；
3. `pnpm sync:content` 把新知识点与题关联落进 `knowledge_points` / `question_knowledge_point`；
4. `pnpm check:content` 过（库侧：占位未发布、孤儿知识点、悬空关联、过期章节）；
5. 移动端课程列表与 Web 课程页会自动出现（L0/L1 会被过滤掉，不会误发布）。
