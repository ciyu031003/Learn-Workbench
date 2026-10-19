#!/usr/bin/env bash
# =============================================================================
# 数据库备份 + sha256 校验 + 保留周期 + 可恢复性自检（S4-6 增强版）
#
# 为什么有自检：pg_dump 退出码为 0 不代表文件能恢复（磁盘写满、管道被截断都会留下
# 一个"看起来成功"的坏备份）。现在发布前用 pg_restore --list 读一遍归档目录，
# 并落 .sha256 供恢复演练/离线校验。
#
# 用法：
#   bash scripts/backup-db.sh                       # 默认 cos：写 /data/learn-workbench/backups
#   BACKUP_TARGET=local bash scripts/backup-db.sh   # 本地盘：写 /var/backups/learn-workbench
#   BACKUP_MODE=docker bash scripts/backup-db.sh    # 宿主机无 pg_dump：docker compose exec -T db
#   BACKUP_DIR=/tmp/b KEEP_DAYS=3 bash scripts/backup-db.sh
#
# 环境变量：
#   PGDATABASE（默认 Learn-Workbench）/ PGHOST / PGPORT / PGUSER / PGPASSWORD
#   BACKUP_TARGET=cos|local（默认 cos；cos = 写已有 /data COSFS 挂载目录，不引入 SDK）
#   BACKUP_MODE=host|docker（默认 host）
#   BACKUP_DIR（覆盖默认目录）   KEEP_DAYS（保留天数，默认 14）
#   PG_DUMP_BIN / PG_RESTORE_BIN（默认 pg_dump / pg_restore；docker 模式忽略）
#   COMPOSE_CMD（docker 模式的 compose 命令，默认 "docker compose"）
#
# 机读输出（stdout 仅这一行，供 deploy/监控解析）：
#   BACKUP_OK <path> <bytes> <sha256>
# 人类日志一律写 stderr。退出码：0 成功 / 1 备份或自检失败 / 2 参数或环境错误
# =============================================================================
set -euo pipefail

log() { printf '[backup] %s\n' "$*" >&2; }

usage() { sed -n '2,27p' "$0" | sed 's/^# *//'; }
case "${1:-}" in
  -h|--help) usage; exit 0 ;;
esac

DB="${PGDATABASE:-Learn-Workbench}"
KEEP_DAYS="${KEEP_DAYS:-14}"
BACKUP_TARGET="${BACKUP_TARGET:-cos}"
BACKUP_MODE="${BACKUP_MODE:-host}"
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

die() { printf '[backup] %s\n' "$*" >&2; exit 2; }
fail() { printf '[backup] 失败：%s\n' "$*" >&2; exit 1; }

case "$BACKUP_TARGET" in
  cos)   DEFAULT_BACKUP_DIR="/data/learn-workbench/backups" ;;
  local) DEFAULT_BACKUP_DIR="/var/backups/learn-workbench" ;;
  *) die "BACKUP_TARGET 只能是 cos|local（当前：$BACKUP_TARGET）" ;;
esac
case "$BACKUP_MODE" in
  host|docker) ;;
  *) die "BACKUP_MODE 只能是 host|docker（当前：$BACKUP_MODE）" ;;
esac
case "$KEEP_DAYS" in
  ''|*[!0-9]*) die "KEEP_DAYS 必须是正整数（当前：$KEEP_DAYS）" ;;
esac

# sha256 工具：优先 sha256sum（Linux / Git Bash），其次 shasum（macOS），再次 openssl
if command -v sha256sum >/dev/null 2>&1; then
  SHA_CMD="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  SHA_CMD="shasum -a 256"
elif command -v openssl >/dev/null 2>&1; then
  SHA_CMD="openssl"
else
  die "缺少 sha256sum / shasum / openssl，无法计算校验和"
fi
sha256_file() {
  if [ "$SHA_CMD" = "openssl" ]; then
    openssl dgst -sha256 "$1" | awk '{print $NF}'
  else
    # shellcheck disable=SC2086
    # 文件名含反斜杠/换行时 GNU sha256sum 会给整行加 "\\" 前缀；去掉它只留哈希。
    $SHA_CMD "$1" | awk '{print $1}' | tr -d '\\'
  fi
}

if [ "$BACKUP_MODE" = "host" ]; then
  command -v "$PG_DUMP_BIN" >/dev/null 2>&1 \
    || fail "找不到 pg_dump（$PG_DUMP_BIN）：安装 postgresql-client、设 PG_DUMP_BIN，或改用 BACKUP_MODE=docker"
  command -v "$PG_RESTORE_BIN" >/dev/null 2>&1 \
    || fail "找不到 pg_restore（$PG_RESTORE_BIN）：安装 postgresql-client 或设 PG_RESTORE_BIN"
else
  command -v "${COMPOSE_CMD%% *}" >/dev/null 2>&1 \
    || fail "找不到 docker（BACKUP_MODE=docker 需要 docker compose）"
fi

BACKUP_DIR="${BACKUP_DIR:-$DEFAULT_BACKUP_DIR}"
STAMP="$(date +%Y%m%d%H%M%S)"
OUT="$BACKUP_DIR/$DB-$STAMP.dump"
[ -e "$OUT" ] && OUT="$BACKUP_DIR/$DB-$STAMP-$$.dump"
TMP="$OUT.tmp"
LIST="$TMP.list"
STARTED_AT="$(date +%s)"

rm -f "$TMP" "$TMP.list" "$TMP.sha256" 2>/dev/null || true
mkdir -p "$BACKUP_DIR" || fail "无法创建备份目录 $BACKUP_DIR"

log "target=$BACKUP_TARGET mode=$BACKUP_MODE dir=$BACKUP_DIR db=$DB keepDays=$KEEP_DAYS"
log "开始备份 $DB → $OUT"

if [ "$BACKUP_MODE" = "docker" ]; then
  # 用 docker exec（而不是 compose exec）承接二进制流：
  # compose exec 在部分版本下对大输出会报 "write /dev/stdout: input/output error"（S4 实测）。
  # shellcheck disable=SC2086
  DB_CONTAINER="$($COMPOSE_CMD ps -q db 2>/dev/null | head -1 || true)"
  [ -n "$DB_CONTAINER" ] || fail "找不到 db 容器（$COMPOSE_CMD ps -q db 为空）"
  docker exec -i "$DB_CONTAINER" pg_dump -Fc -U "${PGUSER:-lwb}" "$DB" > "$TMP" \
    || { rm -f "$TMP"; fail "docker exec db pg_dump 失败"; }
else
  # 用 stdout 重定向而不是 -f：Linux/macOS/Git Bash 行为一致，
  # 也绕开个别 Windows conda 构建的 pg_dump 对 -f 打开文件的权限问题。
  "$PG_DUMP_BIN" -Fc "$DB" > "$TMP" \
    || { rm -f "$TMP"; fail "pg_dump 失败（$DB）"; }
fi

[ -s "$TMP" ] || { rm -f "$TMP"; fail "备份文件为空，pg_dump 可能被截断"; }
SIZE="$(stat -c%s "$TMP" 2>/dev/null || stat -f%z "$TMP")" || fail "无法读取备份大小"

log "dump 完成：$SIZE 字节；开始可恢复性自检（pg_restore --list）"
if [ "$BACKUP_MODE" = "docker" ]; then
  # shellcheck disable=SC2086
  if ! docker exec -i "$DB_CONTAINER" pg_restore --list < "$TMP" > "$LIST" 2>/dev/null; then
    rm -f "$TMP" "$LIST"
    fail "归档不可读（pg_restore --list 失败），已删除坏备份"
  fi
else
  if ! "$PG_RESTORE_BIN" --list "$TMP" > "$LIST" 2>/dev/null; then
    rm -f "$TMP" "$LIST"
    fail "归档不可读（pg_restore --list 失败），已删除坏备份"
  fi
fi

ENTRIES="$(grep -c . "$LIST" || true)"
# TABLE 段（排除 TABLE DATA 段，否则会重复计数）
TABLES="$(grep -E ';[[:space:]]+[0-9]+[[:space:]]+[0-9]+[[:space:]]+TABLE[[:space:]]' "$LIST" | grep -vc ' TABLE DATA ' || true)"
TABLE_DATA="$(grep -cE ';[[:space:]]+[0-9]+[[:space:]]+[0-9]+[[:space:]]+TABLE DATA[[:space:]]' "$LIST" || true)"
[ "${TABLES:-0}" -gt 0 ] || { rm -f "$TMP" "$LIST"; fail "归档里没有任何 TABLE（空库/截断备份），拒绝发布"; }
log "自检通过：归档条目 $ENTRIES 条，表 $TABLES 张，表数据段 $TABLE_DATA 段"

SHA="$(sha256_file "$TMP")" || { rm -f "$TMP" "$LIST"; fail "sha256 计算失败"; }
case "$SHA" in
  [0-9a-fA-F]*) [ ${#SHA} -eq 64 ] || { rm -f "$TMP" "$LIST"; fail "sha256 长度异常：$SHA"; } ;;
  *) rm -f "$TMP" "$LIST"; fail "sha256 输出异常：$SHA" ;;
esac
printf '%s  %s\n' "$SHA" "$(basename "$OUT")" > "$TMP.sha256"

# 先写 .tmp、校验通过后再原子改名：目录里不会出现"半截"的正式备份
mv "$TMP" "$OUT" || fail "发布备份失败（mv）"
mv "$TMP.sha256" "$OUT.sha256" || fail "发布 sha256 失败（mv）"
rm -f "$LIST"

log "清理 $KEEP_DAYS 天前的备份（含 .sha256）"
find "$BACKUP_DIR" -maxdepth 1 -type f -name "$DB-*.dump" -mtime "+$KEEP_DAYS" -print -delete 1>&2 2>/dev/null || true
find "$BACKUP_DIR" -maxdepth 1 -type f -name "$DB-*.dump.sha256" -mtime "+$KEEP_DAYS" -print -delete 1>&2 2>/dev/null || true
# 清理上次崩溃遗留的 .tmp（超过 1 天）
find "$BACKUP_DIR" -maxdepth 1 -type f -name "$DB-*.dump.tmp*" -mtime +1 -print -delete 1>&2 2>/dev/null || true
# 清理没有对应 dump 的孤儿 .sha256
for f in "$BACKUP_DIR"/"$DB"-*.dump.sha256; do
  [ -e "$f" ] || continue
  [ -f "${f%.sha256}" ] || rm -f "$f"
done

ELAPSED=$(( $(date +%s) - STARTED_AT ))
KEPT="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "$DB-*.dump" | wc -l | tr -d ' ')"
log "完成：$OUT（$SIZE 字节，sha256=$SHA，用时 ${ELAPSED}s，当前保留 $KEPT 份）"

# 唯一一行机读摘要（deploy/监控按 4 个字段解析）
echo "BACKUP_OK $OUT $SIZE $SHA"
