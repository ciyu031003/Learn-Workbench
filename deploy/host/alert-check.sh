#!/usr/bin/env bash
# =============================================================================
# Learn-Workbench 宿主告警检查（S4-5）—— scripts/alert-check.mjs 的薄包装
#
# 装法（服务器一次性）：
#   1) 仓库内已就位：deploy/host/alert-check.sh
#   2) cp deploy/host/alert.env.example /etc/lwb/alert.env && chmod 600 /etc/lwb/alert.env
#      填 CRON_SECRET（必需）、ALERT_WEBHOOK_URL（可选）
#   3) crontab -e，参考 deploy/host/crontab.example
#
# 本脚本只做三件事：定位仓库根、拼装环境变量、exec node 检查脚本。
# 不写文件、不碰容器；退出码原样透传（0=正常/已投递，1=有告警，2=执行失败）。
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 1) 宿主机统一 env 文件（优先 /etc，其次仓库内 deploy/host/alert.env，均 600）
for f in /etc/lwb/alert.env "$ROOT/deploy/host/alert.env"; do
  if [ -f "$f" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$f"
    set +a
    break
  fi
done

# 2) 兼容 PM2 部署：apps/web/.env.local 里通常已有 CRON_SECRET / PG 配置
#    仅在 CRON_SECRET 缺失时兜底读取（避免覆盖 /etc 里的正式值）
if [ -z "${CRON_SECRET:-}" ] && [ -f "$ROOT/apps/web/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/apps/web/.env.local"
  set +a
fi

# 3) 优先宿主 node；docker 部署的服务器通常没装 node，则退回 web 容器（S4 实测：prod 宿主无 node）
if command -v node >/dev/null 2>&1; then
  exec node "$ROOT/scripts/alert-check.mjs" "$@"
fi

if command -v docker >/dev/null 2>&1 && ( cd "$ROOT" && docker compose version >/dev/null 2>&1 ); then
  # 容器内 127.0.0.1:3001 即 Web 自身；只透传告警需要的变量，避免把无关环境带进容器
  ENV_ARGS=()
  for v in CRON_SECRET ALERT_WEBHOOK_URL ALERT_METRICS_URL ALERT_METRICS_FILE DISK_MIN_FREE_GIB PGPOOL_MAX_RATIO HTTP_5XX_RATIO HTTP_5XX_MIN_SAMPLES ALERT_DB_CHECK PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD; do
    if [ -n "${!v:-}" ]; then ENV_ARGS+=("-e" "$v=${!v}"); fi
  done
  exec docker compose -f "$ROOT/docker-compose.yml" exec -T "${ENV_ARGS[@]}" web node /app/scripts/alert-check.mjs "$@"
fi

echo "[alert-check] 既没有 node，也没有可用的 docker compose；无法执行检查" >&2
exit 2
