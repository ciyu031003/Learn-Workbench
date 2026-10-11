# 阶段 21 汇报：回归与验收（双轨 · V3 Phase 10）

- **ADR**：ADR-003（错误契约与版本策略，本阶段复用其 envelope 口径）
- **日期**：2026-10-11
- **提交**：组三收口批次（见 `docs/改动记录与任务看板.md` 2026-10-11「组三收口 + 数据结构扩容」）

## 发现

动手前把组三（H1–H6）「未闭合项」逐条实测，发现两条其实已经在生产闭环，两条只差一个动作，两条是真欠账。

生产库迁移（实测）：

```sql
-- SELECT filename FROM schema_migrations ORDER BY 1
-- 001_anon_unique.sql … 065_roles_and_audit.sql … 070_content_source_runoob.sql   （共 70 条，001–070 全在）
-- information_schema.columns: users 有 role / updated_at
-- to_regclass: audit_log / knowledge_points / learning_questions 都存在
```

→ **未闭合项 5（生产缺 022–065）是看板过期信息**：`schema_migrations` 里 001–070 一条不少，065 的角色/审计列也已落地。

备份实测：

```text
crontab -l                       → 17 3 * * * /usr/local/bin/backup-db.sh >> /data/backups/backup.log 2>&1
ls -ld /data/backups             → drwxr-xr-x root root     （ubuntu 的 crontab 连日志都写不出）
ls -la /data/backups/learn-workbench → 只有 pg-2026-09-06.sql.gz（9 月 6 日之后静默失败）
```

→ **未闭合项 4（备份未入 crontab）名义上已入，实际静默失败**：目录 root 属主 + 脚本用普通 `pg_dump`、没有可恢复性自检。

真正没有代码落地的只有两项：H1 的**应用层乐观锁写入路径**（`version` 列建了却没人用）、H2 的**统一错误 envelope 存量迁移**（140 条路由里 117 条还是裸 `{ error }`）。

## 改动

- **H1 乐观锁写入路径（新代码）**
  - `apps/web/lib/content/knowledge-point-write.ts`：`getKnowledgePoint` / `updateKnowledgePoint`（`UPDATE … WHERE key=$1 AND version=$2`，命中 0 行分清「不存在」与「版本冲突」，成功 `version+1` 并记 `updated_by`）+ 纯函数 `normalizeKnowledgePointPatch`（白名单字段校验）。
  - `apps/web/app/api/internal/content/knowledge-point/route.ts`：`GET ?key=` 读快照、`POST` 乐观锁写入；走 `guardInternalRequest`（先限流后验密钥）+ 内容角色；403/404/409/429/500 全用 `apiError`。
  - 测试：`knowledge-point-write.test.ts`（11 例）+ `route.test.ts`（6 例），共 17 例。
  - 契约：`content-platform/openapi/learning.md` 新增两条路由与错误表；`conventions.md` 补棘轮说明。
- **H2 错误 envelope 棘轮**
  - `scripts/api-inventory.mjs`：新增「已用统一错误 envelope」指标 + 第 3 节「未迁移清单」+ 台账「信封」列；新增第 ④ 条硬门槛——未迁移数不得超过 `api/test-exceptions.json` 的 `unmigratedErrorEnvelopeBaseline`（当前 **117**）。
  - `content-platform/api/route-inventory.md` 重新生成（140 条路由）。
- **H5 备份收口（服务器侧，非仓库文件；仓库内同步文档）**
  - `/usr/local/bin/backup-db.sh` 换成带 `-Fc` + `pg_restore --list` 自检的版本；`chown -R ubuntu:ubuntu /data/backups` 修掉「crontab 写不出日志」的根因。
  - `deploy/RUNBOOK.md` §2.1 改写为实际部署说明（含 SIGPIPE / `PIPESTATUS` 坑）。
- **内容（本轮主交付，见看板）**：`packages/content/src/learning/ds-expansion.ts`（数据结构十章 39 知识点 / 78 题）+ `algorithm-animations.ts`（15 组算法 SVG 动图 / 94 帧）+ Web/移动端动图播放器。

## 验证

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型 | `pnpm typecheck` | 7/7 通过 |
| 内容契约 | `pnpm -F @learn-workbench/content test` | 4 文件 / 34 例通过 |
| Web | `pnpm -F web test` | 1388 通过 / 15 skipped |
| 移动端 | `pnpm -F mobile test` | 546 通过 |
| 脚本与台账 | `pnpm test:scripts` | 全绿（迁移 70 文件 / 发布卫生 / 索引清单 93 表 / API 台账 140 路由 3/3） |
| 移动端三门槛 | `lint:fontscale` / `lint:ui-matrix` / `lint:motion` | 均 0 例外 |
| Lint | `pnpm lint` | 2 error / 57 warn（均为历史遗留：`learn/[slug]/page.tsx` 深链 effect、`point-states.tsx` 拉取 effect 的 setState） |
| 备份可恢复 | `ssh … /usr/local/bin/backup-db.sh` | `pg ok: 7.9M（pg_restore --list 自检通过）`，落地 `/data/backups/learn-workbench/pg-2026-10-11.dump` |
| 生产迁移 | 见「发现」 | 001–070 全在；065 角色/审计列在 |

内容侧口径：tracks 21 / stages 101 / 知识点 321+39 / 题 2059（全部 L4，`check-content-quality` 无警告）。

## 风险

- **统一错误 envelope 仍有 117 条存量未迁移**：显式登记的欠账，棘轮只保证「不变多」；一次性机械改写 117 个路由风险高于收益（每个路由的错误形状与测试断言不同），按路由逐个迁移。
- **依赖漏洞 4 critical / 33 high 未偿**：本轮尝试用 pnpm `overrides` 上顶传递依赖，实测两条被拦——`braces@3.0.4`、`node-forge@1.4.1` 在镜像源上尚未发布（advisory 的 `patched_versions` 领先于实际发版），且 `next` 升到 16.4.0 因 lockfile 与镜像重解析异常未能稳定落地，**已整体回退**，避免破坏在跑的 Web 构建。现状由 `scripts/check-deps-audit.mjs` 棘轮守住（未超过基线）。触发条件：上游发布补丁版本后重跑上顶。
- **备份脚本是服务器侧文件**，不在仓库版本控制内；仓库内 `scripts/backup-db.sh` 是主机版，两者用途不同（RUNBOOK 已写明）。回滚：`git revert` 本轮提交；服务器侧恢复旧脚本并保留 crontab 行即可。
- **动图渲染**：Web 走 `dangerouslySetInnerHTML`、移动端走 `react-native-svg` 的 `SvgXml`（均不依赖 SMIL）。内容由 `packages/content` 自产且过危险片段门禁；回滚触发条件是内容侧出现非自产 SVG。

## 下阶段

1. 逐个迁移存量路由到统一 envelope（每迁一条把 `unmigratedErrorEnvelopeBaseline` 减一），优先 `/api/auth/**` 与 `/api/learning/**`。
2. 依赖补丁发布后重做上顶（保留本轮「先验证再上顶」的做法）。
3. 继续内容扩容（计算机网络连接管理、操作系统进程与内存管理等专题），按「一个版本一层」推进；新内容一律要求知识点 ≥2 题 + L4，动图按 `algorithm-animations.ts` 注册表追加。