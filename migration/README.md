# 迁移工具：Travel-Notes → Learn-Workbench 学习内容

按《Travel-Notes × Learn-Workbench 完整优化与迁移实施方案》§19-§24、§77 步骤 3-8 实现。

## 结构

- `lib/dto.mjs`      —— Migration DTO（§21 中间格式）
- `lib/inventory.mjs` —— 步骤 3：内容盘点
- `lib/extract.mjs`  —— 提取层：Markdown（主）+ MySQL Post（可选）
- `lib/load.mjs`     —— 加载层：写入 PostgreSQL（幂等 upsert）
- `lib/verify.mjs`   —— 校验层（§24 九项检查）
- `migrate.mjs`      —— CLI
- `source/travel-notes/` —— 从 Travel-Notes git HEAD 提取的原始内容
- `reports/`         —— inventory / dry-run / migration / verification 报告

## 用法（仓库根目录执行）

```bash
node migration/migrate.mjs --dry-run    # 试运行，不写入
node migration/migrate.mjs --execute    # 执行迁移（幂等）
node migration/migrate.mjs --verify     # 校验（§24）
node migration/migrate.mjs --all        # dry-run → execute → verify
```

依赖 `pg` 从 `apps/web/node_modules` 解析；`mysql2` 可选（缺失时跳过 MySQL 提取）。

## 目标数据模型

- `knowledge_notes` / `knowledge_tags` / `knowledge_note_tags` / `knowledge_links`
- 迁移映射（§22）：Blog → NOTE；Mindmap → MINDMAP；Repository → PROJECT_NOTE（Career/Project 系统化归属为后续阶段）
- 标签 → KnowledgeTag；无法确认的 Topic 关联保持 `topic_id = NULL`（不强行归类）
