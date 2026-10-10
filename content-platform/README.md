# 内容平台（组二 · V3 纵轨 Phase A–G）

这个目录放**内容平台的工程工件**（ERD、ID 映射、ADR、模板、开放契约），全部随 git 提交。

> 为什么单独开目录：`docs/*.md` 已被 `.gitignore` 排除（只保留本地改动记录），
> 而 V3 方案要求"每阶段产出可评审工件"，所以工件必须落在 **git 跟踪**的目录里。

| 文件 | 内容 | 对应阶段 |
|---|---|---|
| `erd.md` | 统一内容模型 ERD（路线图侧 / 学习库侧 / 关联表 / 作答统一视图） | 阶段 7（Phase A） |
| `id-mapping.md` | 稳定 ID 规则与全量映射表（课程 → 阶段 → 知识点 → 题目） | 阶段 7（Phase A） |
| `adr/` | 架构决策记录（每次关键选型留痕：决策 / 备选 / 依据 / 影响） | 阶段 7 起持续 |
| `templates/` | 知识点标准模板与质量分级规范 | 阶段 9（Phase C） |
| `openapi/` | 新增接口的契约片段（随接口一起提交，不等 H2） | 阶段 8 起持续 |

## 一分钟上手

```bash
# 1) 结构：迁移 + schema.sql 是否收敛（空库自检）
node scripts/check-schema-fresh.mjs
# 2) 结构：迁移编号 / schema 漂移
node scripts/verify-migrations.mjs
# 3) 内容模型：纯逻辑统计（课程 / 阶段 / 知识点 / 题 / 关联）
pnpm -F @learn-workbench/content test
# 4) 落库：把内容包同步进统一内容模型（幂等；--dry-run 只预览差异）
pnpm sync:content --dry-run
pnpm sync:content
```

## 内容库当前规模（2026-10-10 实跑）

| 指标 | 数值 |
|---|---|
| 课程（track） | 7 |
| 阶段（stage） | 28 |
| 知识点（knowledge point） | 84（每课程 12） |
| 题目 | 328 |
| 已绑定知识点的题 | 168（51%） |
| 待分类题 | 160 |
| 知识点关系（next + related） | 105 |
| 前置边（prerequisite） | 21 |
| 质量分级 | L4 = 84（无 L0/L1/L2/L3 缺口） |
| 估算学习时长合计 | 627 分钟 |

数字来源是 `buildKnowledgeModel(learningTracks)` 的真实统计，不是人工估算；复跑方式见上面第 3 步。
