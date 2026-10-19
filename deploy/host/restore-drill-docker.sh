#!/usr/bin/env bash
# =============================================================================
# restore-drill-docker.sh —— docker 环境的恢复演练（S4-6 补充）
#
# 为什么单独有宿主版：正式库不向宿主机暴露端口，web 容器里的 pg_restore 是 PG15
# （node:24-slim / Debian 12 自带），对 PG16 的 dump 会报版本不匹配；
# 而 db 容器自带与服务器同主版本的 pg_restore，因此演练走 db 容器。
#
# 用法（服务器 /home/ubuntu/learn-workbench）：
#   bash deploy/host/restore-drill-docker.sh                 # 自动取最新 dump
#   bash deploy/host/restore-drill-docker.sh --dump /data/learn-workbench/backups/x.dump
#   bash deploy/host/restore-drill-docker.sh --keep          # 保留临时库（排查用）
#   bash deploy/host/restore-drill-docker.sh --min-tables 40
#
# 输出（机器可读最后一行）：
#   RESTORE_DRILL_OK ...   /  RESTORE_DRILL_FAIL reason=...
# 退出码：0 成功 / 1 断言失败 / 2 参数或环境错误
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/data/learn-workbench/backups}"
DUMP=""
KEEP=0
MIN_TABLES="${MIN_TABLES:-50}"
DB_NAME="Learn-Workbench"
# 本项目的 db 容器用 POSTGRES_USER=lwb（超级用户就是 lwb），没有 postgres 角色；
# 需要时用 ADMIN_USER=postgres 覆盖（官方镜像默认配置的机器）。
ADMIN_USER="${ADMIN_USER:-lwb}"

while [ $# -gt 0 ]; do
  case "$1" in
    --dump) shift; DUMP="${1:-}" ;;
    --latest) shift; BACKUP_DIR="${1:-}" ;;
    --keep) KEEP=1 ;;
    --min-tables) shift; MIN_TABLES="${1:-50}" ;;
    -h|--help) sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "未知参数：$1" >&2; exit 2 ;;
  esac
  shift || true
done

die() { echo "[drill] $*" >&2; exit 2; }
fail() { echo "[drill] 失败：$*" >&2; echo "RESTORE_DRILL_FAIL reason=$*"; exit 1; }

cd "$(dirname "$0")/../.." || die "无法定位仓库根"

if [ -z "$DUMP" ]; then
  DUMP="$(ls -t "$BACKUP_DIR"/*.dump 2>/dev/null | head -1 || true)"
fi
[ -n "$DUMP" ] && [ -f "$DUMP" ] || die "找不到 dump（--dump 或 $BACKUP_DIR/*.dump）"
[ -s "$DUMP" ] || fail "dump 为空文件：$DUMP"

if [ -f "$DUMP.sha256" ]; then
  ( cd "$(dirname "$DUMP")" && sha256sum -c "$(basename "$DUMP").sha256" >/dev/null ) || fail "sha256 校验失败：$DUMP"
  echo "[drill] sha256 校验通过"
else
  echo "[drill] 警告：没有 .sha256 sidecar，跳过校验和（建议用 scripts/backup-db.sh 重新备份）" >&2
fi

DC="$(docker compose ps -q db 2>/dev/null | head -1 || true)"
[ -n "$DC" ] || die "找不到 db 容器"

TS="$(date +%Y%m%d%H%M%S)"
TMPDB="lwb_restore_drill_${TS}"
cleanup() {
  if [ "$KEEP" = "1" ]; then
    echo "[drill] --keep：临时库保留为 $TMPDB" >&2
    return
  fi
  docker exec -i "$DC" psql -U "$ADMIN_USER" -d postgres -c "DROP DATABASE IF EXISTS \"${TMPDB}\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[drill] 创建临时库 $TMPDB ..."
docker exec -i "$DC" psql -U "$ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${TMPDB}\"" >/dev/null || fail "建临时库失败（ADMIN_USER=$ADMIN_USER）"

echo "[drill] 恢复 dump（pg_restore --exit-on-error）..."
if ! docker exec -i "$DC" pg_restore -U "$ADMIN_USER" -d "$TMPDB" --no-owner --no-privileges --exit-on-error < "$DUMP" >/tmp/lwb-drill-restore.log 2>&1; then
  tail -5 /tmp/lwb-drill-restore.log >&2 || true
  fail "pg_restore 恢复失败"
fi

TABLES="$(docker exec -i "$DC" psql -U "$ADMIN_USER" -d "$TMPDB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'" | tr -d '[:space:]')"
echo "[drill] public 表数：$TABLES（阈值 $MIN_TABLES）"
[ "${TABLES:-0}" -ge "$MIN_TABLES" ] || fail "表数不足（$TABLES < $MIN_TABLES）"

echo "[drill] 关键表行数："
for t in accounts users job_postings learning_questions daily_tasks sessions; do
  cnt="$(docker exec -i "$DC" psql -U "$ADMIN_USER" -d "$TMPDB" -tAc "SELECT count(*) FROM $t" 2>/dev/null | tr -d '[:space:]' || echo "MISSING")"
  echo "  $t = $cnt"
  [ "$cnt" != "MISSING" ] || fail "关键表缺失：$t"
done

echo "RESTORE_DRILL_OK mode=docker dump=$DUMP tables=$TABLES temp_db=$TMPDB"
