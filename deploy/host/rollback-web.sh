#!/usr/bin/env bash
# =============================================================================
# S4-4 一键回滚 / 指定镜像启动（在服务器 /home/ubuntu/learn-workbench 运行）
#
# 用法：
#   bash deploy/host/rollback-web.sh <sha|tag>          # 优先本地镜像，再尝试 GHCR 拉取
#   bash deploy/host/rollback-web.sh <sha> --skip-pull  # 只用本地镜像（离线/Registry 故障时）
#
# 为什么不是 compose down：只重建 web，DB 与迁移保持不动；健康检查失败会明确退出 1。
# =============================================================================
set -euo pipefail

TAG="${1:?用法: rollback-web.sh <sha|tag> [--skip-pull]}"
SKIP_PULL="${2:-}"
cd "$(dirname "$0")/../.."

LOCAL_REF="learn-workbench-web:$TAG"
GHCR_REF="ghcr.io/ciyu031003/learn-workbench-web:$TAG"

if docker image inspect "$LOCAL_REF" >/dev/null 2>&1; then
  IMAGE="$LOCAL_REF"
elif docker image inspect "$GHCR_REF" >/dev/null 2>&1; then
  IMAGE="$GHCR_REF"
elif [ "$SKIP_PULL" = "--skip-pull" ]; then
  echo "[rollback] 本地没有镜像 $LOCAL_REF / $GHCR_REF，且指定了 --skip-pull" >&2
  exit 1
else
  echo "[rollback] 本地无镜像，尝试从 GHCR 拉取 $GHCR_REF"
  docker pull "$GHCR_REF"
  IMAGE="$GHCR_REF"
fi

echo "[rollback] 使用镜像: $IMAGE"
export WEB_IMAGE="$IMAGE"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build web

echo "[rollback] 等待 /api/health ..."
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/api/health || true)
  if [ "$code" = "200" ]; then
    echo "[rollback] 健康检查通过（${i}x2s），当前镜像 $IMAGE"
    exit 0
  fi
  sleep 2
done
echo "[rollback] 失败：30 次健康检查未通过，请查看 docker compose logs web --tail 100" >&2
exit 1
