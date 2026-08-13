# Travel-Notes → Learn-Workbench 学习笔记迁移 · 第 77 节前 8 步执行报告

> 执行日期：2026-08-13 ｜ 依据：《Travel-Notes × Learn-Workbench 完整优化与迁移实施方案》§77
> 本报告对应步骤 1-8 的完成情况与检验结果。

---

## 步骤 1：备份两个项目 ✅

备份目录：`F:\CodeFiles\Learn-Workbench\.backup\2026-08-13\`（已加入 .gitignore）

### Travel-Notes
- `database.sql`：mysqldump 全库（81 MB，含 PostImage 二进制）
- `content-from-git/`：全部 content/ Markdown（从 git HEAD 提取，见下方说明）
- `public/`：uploads / search-index.json / 静态资源
- `prisma-schema.prisma`、`env.example`、`package.json`
- `repo.bundle`：完整 git 历史（git bundle verify 通过）

### Learn-Workbench
- `database.sql`：pg_dump 全库
- `db/`（schema.sql + seed_content.sql + migrations）、`scripts/`、`packages/shared/`
- `repo.bundle`：完整 git 历史

> 完成标准：数据库 / Markdown / 资源全部备份；git bundle 可完整恢复；git tag 见文末。

⚠️ **重要说明**：本次执行期间发现 Travel-Notes 工作区正被另一个会话（分支 `codex/p0-p1-security-cleanup`）批量 staged 删除学习模块文件（app/notes、content/tech 等）。为保证步骤 3-8 数据完整，本次迁移的数据源取自 Travel-Notes **git HEAD（commit fb9978a）** 提取的内容，未改动 Travel-Notes 工作区，避免与并发会话冲突。

---

## 步骤 2：删除公开默认凭据 ✅

| 位置 | 处理 |
|---|---|
| Learn-Workbench `README.md` | 移除「默认账号 yuanabd / Abd123456.」两处，改为「账号通过 scripts/create-admin.mjs 创建」 |
| Learn-Workbench `PROJECT_PLAN.md` | 5 处默认账号信息全部清除 |
| Learn-Workbench `apps/mobile/src/app/settings.tsx` | 登录框占位文案「账号（默认 yuanabd）」→「账号」 |
| Learn-Workbench `db/migrations/002_auth_custom.sql` | 删除内置默认账号 seed（已知 scrypt 哈希），改为安全说明 |
| Learn-Workbench `scripts/create-admin.mjs` | **新增**管理员创建/重置脚本（未传密码时生成随机密码并仅打印一次） |
| Learn-Workbench 在线账号 | 已将 yuanabd 密码轮换为随机强密码（见下方「新管理员凭据」） |
| Travel-Notes `.env.example` | 移除真实 MySQL 密码（Abd123456. → CHANGE_ME） |
| Travel-Notes `README.md` | 此前会话已改为「无默认账号 + /admin/setup 初始化」 |

**新管理员凭据（Learn-Workbench）**
- 用户名：`yuanabd`
- 密码：`ka0CLNeP877781LY`（随机生成；已保存至 `.local/admin-credentials.txt`，该目录已 gitignore）
- 已验证：新密码可正常登录（POST /api/auth/login 返回 ok:true，用户 6d84b5dd）

> 注意：迁移脚本曾因 display_name 无唯一约束创建了重复 user，已修复并归并到原用户；`create-admin.mjs` 已改为「先查后插」。

---

## 步骤 3：盘点 Travel-Notes 全部学习内容 ✅

报告：`migration/reports/inventory.json` / `inventory.md`

| 类别 | 数量 | 迁移去向 |
|---|---|---|
| 技术博客（blog） | 1 | KnowledgeNote · NOTE |
| 思维导图（mindmap） | 0 | —（目录存在但为空；博客内嵌 1 个 mermaid 流程图） |
| 代码仓库（repo） | 1 | KnowledgeNote · PROJECT_NOTE |
| 旅行/生活（travel/life） | 3 条 MySQL Post + 1 篇 life | 保留在 Travel-Notes |

明细：
1. **Next.js 项目部署到阿里云 ECS 完整指南**（blog，slug=nextjs-deploy，2026-07-25，tags: Next.js/阿里云/部署/Nginx，94 行，7 代码块，1 mermaid）
2. **Network Utils**（repo，slug=network-utils，Python 网络工具：端口扫描/Ping/路由追踪/测速，README + src/port_scanner.py）

---

## 步骤 4：设计 Migration DTO ✅

实现：`migration/lib/dto.mjs`，中间格式（§21）：

```json
{ "sourceId", "title", "slug", "content", "type", "date", "tags", "sourcePath", "metadata" }
```

- type 枚举：NOTE / TUTORIAL / REFERENCE / MINDMAP / REVIEW / PROJECT_NOTE（§12）
- 校验：slug 唯一、标题非空、正文非空；当前 2 条 DTO 全部通过，0 警告

---

## 步骤 5：Learn-Workbench 增加 Knowledge Domain ✅

迁移脚本：`db/migrations/004_knowledge_domain.sql`（已执行，4 张表建表成功）

| 表 | 说明（§12-14） |
|---|---|
| `knowledge_notes` | id/user_id/topic_id/title/slug/content/summary/type/status/source/source_path/source_id/时间戳 |
| `knowledge_tags` | id/user_id/name/slug |
| `knowledge_note_tags` | note_id ↔ tag_id |
| `knowledge_links` | source/target note + type（RELATED/PREREQUISITE/REFERENCE/DERIVED） |

- `db/schema.sql` 同步追加 Knowledge Domain 段
- `packages/shared/src/index.ts` 新增 zod 类型（KnowledgeNote/Tag/Link + 枚举 + 中文标签）
- `apps/web/app/api/notes/route.ts` 新增只读 API（GET /api/notes，含标签聚合）
- shared / web 两个包 `tsc --noEmit` 全部通过
- 匿名模式沿用既有约定（user_id NULL），登录用户按 user 隔离

---

## 步骤 6：编写 Dry-Run Migration ✅

实现：`migration/migrate.mjs`（--dry-run / --execute / --verify / --all）+ `lib/extract|load|verify|drivers.mjs`

Dry-run 输出（`migration/reports/dry-run.json`）：

```text
总内容（学习）: 2
  学习知识 NOTE: 1
  思维导图 MINDMAP: 0
  项目 PROJECT_NOTE: 1
  标签（去重）: 4
MySQL 提取: 可用（Post 表无 blog/mindmap/repo，确认以 Markdown 为准）
```

---

## 步骤 7：执行学习数据迁移 ✅

命令：`node migration/migrate.mjs --execute`（幂等 upsert，可重复执行）

- 目标用户：`6d84b5dd-aefc-4dbe-9433-a4a898955261`（yuanabd）
- `knowledge_notes` 2 条：network-utils（PROJECT_NOTE）、nextjs-deploy（NOTE）
- `knowledge_tags` 4 个：Next.js / 阿里云 / 部署 / Nginx
- `knowledge_note_tags` 4 条关联
- repo 资产已复制：`content/migrated/network-utils/src/port_scanner.py`
- 重复执行验证：再次 --execute 不产生重复（id 保持 1/2），幂等 ✅

---

## 步骤 8：校验迁移结果 ✅（§24 九项全部通过）

命令：`node migration/migrate.mjs --verify`（`migration/reports/verification.json`）

| # | 检查项 | 结果 |
|---|---|---|
| 1 | 标题数量一致 | ✔ 源 2 / 目标 2 |
| 2 | 正文数量一致 | ✔ 源 2 / 目标 2 |
| 3 | 标签数量一致 | ✔ 源 4 / 目标 4（Next.js、阿里云、部署、Nginx） |
| 4 | 图片数量一致 | ✔ 源 0 / 目标 0 |
| 5 | 日期一致 | ✔ 全部一致（nextjs-deploy → 2026-07-25） |
| 6 | Slug 唯一 | ✔ 无重复 |
| 7 | Markdown 可解析（代码围栏成对） | ✔ 全部成对 |
| 8 | Mermaid 正常 | ✔ mermaid 块完整（nextjs-deploy 内含 flowchart） |
| 9 | 特殊字符/正文往返一致 | ✔ 正文逐字符一致（CJK/引号/反斜杠无损） |

**运行态验证**：启动 Web（Next.js 16，localhost:3000）→ 新密码登录成功 → `GET /api/notes` 返回 2 条笔记及标签 ✅

---

## 变更文件清单（Learn-Workbench）

- `db/migrations/004_knowledge_domain.sql`（新增）
- `db/schema.sql`（追加 Knowledge Domain）
- `db/migrations/002_auth_custom.sql`（移除默认账号 seed）
- `packages/shared/src/index.ts`（新增 Knowledge 类型）
- `apps/web/app/api/notes/route.ts`（新增）
- `apps/mobile/src/app/settings.tsx`（占位文案）
- `scripts/create-admin.mjs`（新增）
- `README.md`、`PROJECT_PLAN.md`（清除默认凭据）
- `migration/`（迁移工具 + source + reports）
- `content/migrated/network-utils/src/port_scanner.py`（迁移资产）
- `.gitignore`（加入 .backup/、.local/）

## 遗留与建议

1. **repo → Career/Project 系统化归属**：当前按 §22 落为 KnowledgeNote(PROJECT_NOTE)；后续 Phase 10（Career 系统）再将其转为正式 Project 实体。
2. **Topic 关联**：因无法高置信自动归类，`topic_id` 保持 NULL（§22「不要强行错误归类」），可在 UI 中手工挂接。
3. **Travel-Notes 侧**：并发会话已 staged 删除学习模块（步骤 9），请该会话确认；本报告数据源基于 git HEAD，若需从备份恢复请用 `.backup/2026-08-13/travel-notes/`。
4. **密码轮换**：旧默认密码已公开于 git 历史，建议后续在所有环境使用 `scripts/create-admin.mjs` 重置。
