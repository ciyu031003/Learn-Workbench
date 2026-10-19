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

## 健康检查

`GET /api/health`（DB up → 200 / down → 503），compose 与 Dockerfile 均配置探活；
nginx/监控/发布脚本都以它作为「就绪」判据。
