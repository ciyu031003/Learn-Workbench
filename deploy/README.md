# 部署方式（S4-4 落地后）

本项目有两种上线通道：

## A. 现场构建（当前默认，短期保留）

```bash
cd /home/ubuntu/learn-workbench
bash deploy-docker.sh          # 或 bash deploy.sh（PM2）
```

优点：不依赖镜像仓库；缺点：每次构建吃 6-10GB 磁盘、构建失败会占着服务器资源、回滚只能重建。
**S4-4 后这条通道只作为逃生路径**（Registry 不可用 / 紧急热修）。

## B. CI 构建不可变镜像 + 服务器只 pull（目标态）

1. 推 `v*` tag（或手动触发 `Deploy Image (GHCR)` workflow）→ CI 构建并推送：
   `ghcr.io/ciyu031003/learn-workbench-web:<sha>`、`:<tag>`、`:latest`；
2. 服务器一次性准备：`echo <PAT> | docker login ghcr.io -u <user> --password-stdin`（PAT 需 read:packages）；
3. 发布：`WEB_IMAGE=ghcr.io/ciyu031003/learn-workbench-web:<sha> bash deploy/host/pull-and-up.sh`
   或手动：
   ```bash
   WEB_IMAGE=ghcr.io/ciyu031003/learn-workbench-web:<sha> \
     docker compose -f docker-compose.yml -f docker-compose.prod.yml pull web
   WEB_IMAGE=... docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build web
   ```
4. 回滚：`bash deploy/host/rollback-web.sh <sha>`（自动健康检查，失败 exit 1）。

## 迁移

- 统一执行器：`node scripts/migrate.mjs`（在 web 容器内跑；docker-init-db.sh 与 deploy 脚本共用同一语义）；
- 迁移前自动 `pg_dump`；恢复演练：`node scripts/restore-drill.mjs --dump <file>`；
- **路由目录/页面删除后，服务器旧文件必须同步删除**（2026-10-19 的构建失败根因；镜像化后天然解决）。


## 发布检查单（S7-1，每次发布照单执行）

### 0) 发布前（本地/CI）
- [ ] `main` 通过：`pnpm -F web typecheck && lint && test`；改移动端再跑 4 套棘轮；改 db 跑 `check-schema-fresh` + `migration-drill`；改 route 跑 `api-inventory --check`
- [ ] 首载体积预算：`node scripts/check-bundle-budget.mjs --check`（公开页 ≤160/170KB、应用页 ≤300KB、重型页 ≤400KB；超了先查 zod/大依赖是否又进客户端）
- [ ] 迁移只追加不改历史（checksum 会拦）；新迁移有 down 或文件头写明原因
- [ ] APK/OTA（若发版）：版本单一源 bump → `build-android-release.ps1` → `check-release-hygiene` → 权限白名单断言 → apksigner 证书 MD5 → **用私钥重签 `mobile-update.json`**（新客户端要求 Ed25519 签名，缺签名不下发）
- [ ] 记录本次 sha/tag 到发布记录（看板）

### 1) 发布（服务器）
- [ ] 磁盘：`df -h /` ≥20GiB（<30GiB 脚本会自动 prune）；`/data` 可写探测通过（`dd ... .probe`）
- [ ] `bash deploy-docker.sh`（或镜像通道 `pull-and-up.sh`）；观察输出：磁盘闸门 → 备份 `BACKUP_OK` → 构建 → 迁移（或在最新）→ up
- [ ] `curl -fsS http://127.0.0.1:3001/api/health` 200，`migrations` 为新迁移；`docker compose ps` web 为 `healthy`
- [ ] 冒烟 6 条：`/login` 200、`/share/sport/1` 200、`/dashboard` 307、`/api/health` 200、`/api/auth/me` 200、静态资源 200
- [ ] 打版本 tag：`docker tag learn-workbench-web:latest learn-workbench-web:<date|sha>`；保留上一代 `pre-*` 作回滚

### 2) 发布后（15 分钟观察）
- [ ] 5xx：`/api/internal/metrics` 的 `lwb_http_requests_total{status=~"5.."}` 无突增；容器日志无 `[api] database error`
- [ ] Vitals：`/api/internal/vitals`（GET，internal-guard）能抓到聚合；页面无 hydration 报错（浏览器 console）
- [ ] 告警静默：如发布窗口要静默，先在 `deploy/host/alert.env` 加静默标记/停 cron，发布后恢复并跑一次 `alert-check.sh --dry-run`
- [ ] 记录版本 + 发布结果到看板；异常立即回滚

## 故障回滚决策树（S7-1）

| 症状 | 首选动作 | 时限 |
|---|---|---|
| 新版本 5xx / 白屏 / hydration 崩 | `bash deploy/host/rollback-web.sh <上一版本>`（健康检查失败会 exit 1） | 10 分钟内 |
| 迁移后接口 500（缺表/缺列） | 停发版 → 用 `db/migrations/down/` 回滚迁移或恢复备份 → 回滚代码 | 30 分钟内 |
| 发布时构建失败（磁盘/网络） | 先 `df -h` + `docker builder prune -af`，保留旧镜像不动；修复后重试 | 30 分钟内 |
| `/data` 写入 EIO（COSFS） | `cosfs-data.sh health` → 重挂载 → 验证 dd 探测；期间备份走 `BACKUP_TARGET=local` | 30 分钟内 |
| APK 闪退率上升 | OTA 清单回上一版（同一私钥重签）+ 下载页回退 | 1 小时内 |
| DB 数据误删/误改 | 停写 → 最新 dump 恢复到临时库 → 按行搬迁（`restore-drill` 验证过的流程） | 2 小时内 |
## 健康检查

`GET /api/health`（DB up → 200 / down → 503），compose 与 Dockerfile 均配置探活；
nginx/监控/发布脚本都以它作为「就绪」判据。
