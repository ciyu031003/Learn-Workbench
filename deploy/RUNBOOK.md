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

### 2.1 备份（**已入 crontab**；主机版脚本在 `scripts/backup-db.sh`）

生产机（`106.55.2.197`）的实际部署：

- crontab：`17 3 * * * /usr/local/bin/backup-db.sh >> /data/backups/backup.log 2>&1`（每日 03:17）；
- 落地脚本 `/usr/local/bin/backup-db.sh`（宿主版，走 `docker exec` 从容器内 dump，不暴露端口）；
  - PG：`pg_dump -Fc` → `/data/backups/learn-workbench/pg-YYYY-MM-DD.dump`，写完立刻
    `cat … | docker exec -i learn-workbench-db-1 pg_restore --list` 做**可恢复性自检**，
    不可读就删除并记 `FAILED`（注意：`pg_restore --list` 读完 TOC 就退出会让上游 `cat` 收 SIGPIPE，
    所以脚本不用 `pipefail`，改读 `PIPESTATUS[1]`）；
  - MySQL（甜途）：`mysqldump | gzip` → `/data/backups/travel-notes/mysql-YYYY-MM-DD.sql.gz`；
  - 保留周期 14 天（`find -mtime +14 -delete`）；
- 目录属主必须是 `ubuntu`：`/data/backups` 曾因 root 属主导致 crontab 连日志都写不出、备份静默失败
  （已 `chown -R ubuntu:ubuntu /data/backups` 修复，并用一次真实运行验证 `pg ok … 自检通过`）。

仓库里的主机版（在**装了 pg_dump 的机器**上手动/另接 cron 使用）：

```bash
BACKUP_DIR=/data/learn-workbench/backups KEEP_DAYS=14 bash scripts/backup-db.sh
```

验证备份是否真的在产出：`ssh ubuntu@106.55.2.197 "tail -5 /data/backups/backup.log; ls -lt /data/backups/learn-workbench | head"`。

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
