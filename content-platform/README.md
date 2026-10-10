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
| `import-maps/` | 外部来源 → 知识点的归属映射（管线不猜归属，没映射就记 unmapped） | 阶段 10（Phase F） |
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
# 5) 外部来源导入：先 dry-run 看报告，再小批量试导入（物化成 review 草稿）
pnpm import:content -- --source=algorithms-java
pnpm import:content -- --source=algorithms-java --mode=apply --limit=20
```

## 内容库当前规模（2026-10-11 实跑）

| 指标 | 数值 |
|---|---|
| 课程（track） | 10 |
| 阶段（stage） | 40 |
| 知识点（knowledge point） | 120（每课程 12） |
| 题目 | 400 |
| 已绑定知识点的题 | 400（100%） |
| 待分类题 | 0（阶段 12 已清零） |
| 知识点关系（next + related） | 150 |
| 前置边（prerequisite） | 30 |
| 质量分级 | L4 = 120（无 L0/L1/L2/L3 缺口） |
| 估算学习时长合计 | 940 分钟 |

数字来源是 `buildKnowledgeModel(learningTracks)` 的真实统计，不是人工估算；复跑方式见上面第 3 步。
`id-mapping.md` 由 `node scripts/generate-id-mapping.mjs` 从**库里已有数据**再生，同样不是手写。

阶段 11（内容扩容）新增三个方向，每个方向 4 阶段 × 3 知识点 × 2 题：

| 课程 | 分类 | 覆盖主线 |
|---|---|---|
| `database` 数据库基础 | 数据库 | 关系模型与 SQL → 索引与执行计划 → 事务与并发 → 建模、迁移与备份 |
| `cloud-platform` 云平台与容器 | 云平台 | 责任边界与网络/身份 → 容器与编排 → 存储与接入 → 可观测性、IaC、成本安全 |
| `network-engineering` 网络工程 | 网络工程 | 分层与编址 → 交换与路由 → 策略与互联 → 抓包、自动化与分层排障 |
