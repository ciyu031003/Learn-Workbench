#!/usr/bin/env bash
# 数据库备份 + 保留周期 + 可恢复性自检（组三 · H5）
#
# 为什么要有验证步骤：`pg_dump` 退出码为 0 不代表文件能恢复
# （磁盘写满、管道被截断都会留下一个"看起来成功"的坏备份）。
# 这里用 `pg_restore --list` 读一遍归档目录作为最低限度可恢复性检查。
#
# 用法：
#   scripts/backup-db.sh                      # 备份到 /data/learn-workbench/backups
#   BACKUP_DIR=/tmp/b KEEP_DAYS=3 scripts/backup-db.sh
# 环境变量：PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE；BACKUP_DIR；KEEP_DAYS（默认 14）
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/data/learn-workbench/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DB="${PGDATABASE:-Learn-Workbench}"
STAMP="$(date +%Y%m%d%H%M%S)"
OUT="${BACKUP_DIR}/${DB}-${STAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[backup] pg_dump $DB → $OUT"
pg_dump -Fc -f "$OUT" "$DB"

if ! pg_restore --list "$OUT" >/dev/null 2>&1; then
  echo "[backup] 归档不可读，删除坏备份并退出 1" >&2
  rm -f "$OUT"
  exit 1
fi

SIZE="$(stat -c%s "$OUT")"
echo "[backup] 完成：$(basename "$OUT")  ${SIZE} 字节  （可读性自检通过）"

echo "[backup] 清理 ${KEEP_DAYS} 天前的备份"
find "$BACKUP_DIR" -name "${DB}-*.dump" -type f -mtime "+${KEEP_DAYS}" -print -delete

echo "[backup] 当前保留："
ls -1t "$BACKUP_DIR"/"${DB}"-*.dump | head -20
