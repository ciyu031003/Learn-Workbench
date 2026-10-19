#!/usr/bin/env bash
# =============================================================================
# S4-4 镜像化发布：拉取指定镜像 → 先在容器内跑迁移 → 切换 web → 健康检查
#
# 用法（服务器 /home/ubuntu/learn-workbench）：
#   WEB_IMAGE=ghcr.io/ciyu031003/learn-workbench-web:<sha> bash deploy/host/pull-and-up.sh
#   WEB_IMAGE=... bash deploy/host/pull-and-up.sh --skip-migrate
# =============================================================================
set -euo pipefail

IMAGE="${WEB_IMAGE:?WEB_IMAGE 未设置（例如 ghcr.io/ciyu031003/learn-workbench-web:<sha>）}"
SKIP_MIGRATE="${1:-}"
cd "$(dirname "$0")/../.."
export WEB_IMAGE="$IMAGE"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

echo "[deploy] 拉取镜像: $IMAGE"
"${COMPOSE[@]}" pull web

if [ "$SKIP_MIGRATE" != "--skip-migrate" ]; then
  echo "[deploy] 迁移前备份 + 执行迁移（容器内 scripts/migrate.mjs）"
  # migrate.mjs 内部会先做备份并写 schema_migrations（见 scripts/migrate.mjs）
  "${COMPOSE[@]}" run --rm -T web node /app/scripts/migrate.mjs
else
  echo "[deploy] --skip-migrate：跳过迁移"
fi

echo "[deploy] 切换 web（--no-build，使用镜像）"
"${COMPOSE[@]}" up -d --no-build web

echo "[deploy] 等待 /api/health ..."
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/api/health || true)
  if [ "$code" = "200" ]; then
    echo "[deploy] 就绪（${i}x2s），镜像 $IMAGE"
    exit 0
  fi
  sleep 2
done
echo "[deploy] 失败：健康检查未通过，请查看 docker compose logs web --tail 100；必要时 bash deploy/host/rollback-web.sh <上一版本>" >&2
exit 1
