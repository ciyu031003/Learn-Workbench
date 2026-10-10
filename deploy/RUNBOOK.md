# 运维手册（组三 · H5 可观测与备份）

面向"线上出事了怎么办"。所有命令都在服务器 `ubuntu@106.55.2.197` 上跑，除非另注。

## 1. 可观测

### 1.1 指标端点

```bash
curl -s -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:3001/api/internal/metrics
```

Prometheus 文本格式（`text/plain; version=0.0.4`）。内容：

| 指标 | 含义 | 关注点 |
|---|---|---|
| `lwb_process_uptime_seconds` | 进程存活时长 | 突然归零 = 重启过 |
| `lwb_process_resident_memory_bytes` / `_heap_used_bytes` | 内存 | 持续上涨不回落 → 查泄漏 |
| `lwb_content_knowledge_points` | 内容库知识点数 | 同步后应等于内容包里的知识点数 |
| `lwb_content_question_links` | 题 ↔ 知识点关联数 | 应等于题库总量（当前 400） |
| `lwb_content_import_success_ratio_30d` | 近 30 天导入批次成功率 | < 1 说明有批次 partial/failed |
| `lwb_content_import_batches_30d` | 近 30 天批次数 | 为 0 说明 cron 可能没跑 |
| `lwb_review_due_cards` | 到期复习卡片数（SM-2） | 长期只增不减 → 复习链路有问题 |
| `lwb_audit_log_total` | 审计记录数 | 应为单调增 |
| `lwb_content_import_total{mode,status}` / `lwb_content_import_duration_ms` | 导入计数与耗时（进程内） | 进程重启后清零，属正常 |

### 1.2 日志

结构化 JSON（`pino`），生产 `LOG_LEVEL=info`；`pm2 logs learn-workbench` 查看。
排查时先拿响应体里的 `requestId`（H2）在日志里 grep，即可定位这一次请求的全链路。

### 1.3 告警阈值（建议抓取端配置）

| 告警 | 条件 | 先做什么 |
|---|---|---|
| 服务不可用 | `/login` 非 200/307 连续 3 分钟 | 看 `pm2 status` / 端口占用 |
| 导入持续失败 | `lwb_content_import_success_ratio_30d < 0.8` | 看最近 failed 批次 `report` 字段 |
| cron 没跑 | `lwb_content_import_batches_30d == 0`（且当天应有批次） | 查 crontab 与 `flock` 锁文件 |
| 复习积压 | `lwb_review_due_cards` 持续上升 7 天 | 查 `learning_review_cards` 是否有卡在错误状态 |
| 内存异常 | rss > 1.5GB 且不回落 | 重启进程止血，再查长查询（`statement_timeout` 已有 15s 兜底） |

## 2. 备份与恢复

### 2.1 备份（**手动为主，尚未入 crontab —— 待办**）

```bash
# 在仓库目录下
BACKUP_DIR=/data/learn-workbench/backups KEEP_DAYS=14 bash scripts/backup-db.sh
```

- 归档格式 `-Fc`（自定义格式，可选择性恢复单表）；
- 脚本自带**可恢复性自检**（`pg_restore --list`），坏备份会被删掉并以退出码 1 报警；
- 保留周期默认 14 天，由 `KEEP_DAYS` 控制。

建议的 crontab（**尚未启用**，H5 的收口项）：

```cron
15 3 * * * cd /data/learn-workbench && BACKUP_DIR=/data/learn-workbench/backups bash scripts/backup-db.sh >> /var/log/lwb-backup.log 2>&1
```

### 2.2 恢复演练（每季度至少一次，在临时库上做）

```bash
createdb lwb_restore_drill
pg_restore -d lwb_restore_drill --no-owner --clean --if-exists /data/learn-workbench/backups/Learn-Workbench-<stamp>.dump
psql -d lwb_restore_drill -c "select count(*) from knowledge_points"      # 应等于生产
psql -d lwb_restore_drill -c "select count(*) from question_knowledge_point"
dropdb lwb_restore_drill
```

演练结论写入 `docs/改动记录与任务看板.md`（日期 + 归档文件 + 行数核对结果）。

### 2.3 数据回滚优先级

1. **先用迁移的回滚契约**：`db/migrations/down/NNN_*.down.sql`（已由 `pnpm db:drill` 验证对象级回滚）；
2. 结构回滚不够（数据被改坏）时，才从备份恢复到临时库，再按需搬迁表；
3. 生产库**永远不直接 drop 重来**。

## 3. 秘密轮换

| 秘密 | 轮换方式 | 影响面 |
|---|---|---|
| `CRON_SECRET` | 改服务器 `.env` → 同步 crontab 里的 `x-cron-secret` → 重启进程 | 内部接口与 cron；轮换期间旧值立即失效 |
| `PGPASSWORD` | 改 Postgres 角色密码 → 改 `.env` → 重启 | 全站数据库连接 |
| `AI_API_KEY` / `EMAIL_API_KEY` / `WECHAT_WEB_SECRET` | 换 `.env` → 重启 | 对应功能；无 key 时相关接口返回"未启用" |
| 用户会话 | `DELETE FROM sessions WHERE user_id = $1` | 强制该用户重新登录 |

轮换后立刻验证：`/api/internal/metrics` 能取到、cron 手动触发一次成功。

## 4. 常见故障

| 症状 | 判断 | 处置 |
|---|---|---|
| 502/504 | nginx 到 3001 不通 | `pm2 status` → `pm2 restart learn-workbench` |
| 页面能开、数据不更新 | DB 连接池耗尽 / 慢查询 | 看 `pg_stat_activity` 中 `state='active'` 的长事务 |
| 内容页"可能过时" | 内容版本读不到（`content_version='unknown'`） | 跑 `pnpm sync:content`，再查 `?job=content` |
| 图片不显示 | COS 桶或 `UPLOAD_DIR` | 查桶对象是否存在；本地目录模式看磁盘 |
| 日志里大量 401 | 会话过期或被清 | 正常；若来自异常 IP，看 `auth_attempts` 与 H3 审计 |

## 5. 与门禁的对应关系

| 手册条目 | 对应门禁 |
|---|---|
| 结构回滚 | `node scripts/migration-drill.mjs`（CI + 发版前） |
| 备份可恢复 | `scripts/backup-db.sh` 自带的 `pg_restore --list` 自检 |
| 指标端点可用 | `apps/web/app/api/internal/metrics/route.test.ts` |
| 前端错误可定位 | H2 的 `requestId`（响应体 + 日志） |
