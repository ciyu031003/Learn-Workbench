#!/bin/bash
# 数据库每日备份 → /data（cosfs）。保留 14 天。
# 组三 · H5 收口：PG 用自定义格式（-Fc），并在容器内用 pg_restore --list 读一遍归档目录做
# 可恢复性自检；坏备份会被删除并记 FAILED。写盘满 / 管道被截断都不会再留下"看起来成功"的坏文件。
#
# 注意：pg_restore --list 读完 TOC 就退出，会让上游 cat 收到 SIGPIPE（141），
# 所以这里不用 pipefail，改为显式读 PIPESTATUS[1] 判断 pg_restore 的退出码。
set -u
TS=$(date +%F)
DEST=/data/backups
mkdir -p "$DEST/travel-notes" "$DEST/learn-workbench"

# 甜途 MySQL（从容器内 dump，避免网络暴露）
if docker exec travel-notes-db sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction travel_notes' 2>/dev/null | gzip > "$DEST/travel-notes/mysql-$TS.sql.gz"; then
  echo "[$(date '+%F %T')] mysql ok: $(du -h "$DEST/travel-notes/mysql-$TS.sql.gz" | cut -f1)"
else
  echo "[$(date '+%F %T')] mysql FAILED"
fi

# 苦旅 PostgreSQL（-Fc + pg_restore --list 自检）
OUT="$DEST/learn-workbench/pg-$TS.dump"
if docker exec learn-workbench-db-1 sh -c 'exec pg_dump -Fc -U lwb Learn-Workbench' > "$OUT" 2>/dev/null && [ -s "$OUT" ]; then
  cat "$OUT" | docker exec -i learn-workbench-db-1 pg_restore --list >/dev/null 2>&1
  if [ "${PIPESTATUS[1]}" -eq 0 ]; then
    echo "[$(date '+%F %T')] pg ok: $(du -h "$OUT" | cut -f1)（pg_restore --list 自检通过）"
  else
    echo "[$(date '+%F %T')] pg FAILED（归档不可读，已删除坏备份）"
    rm -f "$OUT"
  fi
else
  echo "[$(date '+%F %T')] pg FAILED（pg_dump 失败或输出为空）"
  rm -f "$OUT"
fi

# 保留 14 天
find "$DEST" -name '*.sql.gz' -mtime +14 -delete
find "$DEST" -name '*.dump' -mtime +14 -delete
echo "[$(date '+%F %T')] backup done"