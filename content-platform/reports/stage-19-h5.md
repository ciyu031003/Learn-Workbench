# 阶段 19 汇报：可观测与备份（组三 · H5）

- **ADR**：无
- **日期**：2026-10-11
- **提交**：`1a89921`

## 发现

- 只有 `apps/web/lib/logger.ts`（pino 基础日志）+ `apps/web/lib/diagnostics-store.ts`，
  没有指标端点，也没有"导入成功率 / 复习到期量 / 内容规模"的可查数字；
- `deploy.sh` 只管安装与进程管理，**没有任何数据库备份逻辑**（全仓无 `pg_dump` 引用）。

## 改动

- `apps/web/lib/metrics.ts`：进程内 counter/gauge/histogram + Prometheus 文本渲染
  （标签键排序、标签值转义、输出稳定、基数纪律写在文件头）；
- `apps/web/app/api/internal/metrics/route.ts`：进程指标 + 业务 gauge
  （知识点数 / 题目关联数 / 导入成功率 30d / 复习到期量 / 审计量）；**任一条 DB 查询失败只降级不 500**；
- 内容导入接入 `lwb_content_import_total{mode,status}` 与 `lwb_content_import_duration_ms`；
- `scripts/backup-db.sh`：`pg_dump -Fc` + `pg_restore --list` 可恢复性自检（坏备份即删并退出 1）+ 保留周期清理；
- `deploy/RUNBOOK.md`：指标清单与告警阈值、备份/恢复演练、秘密轮换、故障处置、与门禁的对应关系。

## 验证

```bash
pnpm --filter web exec vitest run lib/metrics.test.ts app/api/internal/metrics
# 13 例通过：渲染格式/转义/直方图桶/降级/限流/403
```

## 风险

- 进程内指标**重启即清零**（多实例下不聚合）；只有业务 gauge 来自 DB，是跨实例可信的；
- 备份**尚未入 crontab**（RUNBOOK 里已给出建议行并标注为待办）——这是 H5 明确的未闭合项；
- 未接外部错误追踪（Sentry 之类）；当前靠 `requestId` + 结构化日志把问题定位到单次请求。

## 下阶段

H6：过程治理与文档（ADR 序列 / 阶段汇报 / 手册索引）。
