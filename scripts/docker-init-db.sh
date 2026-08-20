#!/bin/sh
# =============================================================================
# docker-init-db.sh —— Docker 环境下初始化 Learn-Workbench 数据库（幂等）
# 由 docker-compose 的 init 服务调用（postgres:16-alpine 容器内，sh 解释器）
# 环境变量：PGHOST / PGPORT / PGUSER / PGDATABASE / PGPASSWORD
#
# 2.0 改进：迁移按文件逐个跟踪（schema_migrations 表），
#   - 首次部署：全量执行 schema + seed + 全部迁移
#   - 后续部署：只执行尚未应用的新迁移文件（不再整体跳过）
# =============================================================================
set -eu

export PGCLIENTENCODING=UTF8
PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-lwb}"
PGDATABASE="${PGDATABASE:-Learn-Workbench}"
# SQL 文件所在目录（容器内由 compose 挂载到 /init，本地测试可覆盖）
INIT_DIR="${INIT_DIR:-/init}"

psql_run() {
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 "$@"
}

# 创建迁移跟踪表（幂等）
psql_run -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)" >/dev/null

# 判断是否全新初始化（app_meta 或核心表不存在）
is_fresh() {
  psql_run -tAc "SELECT to_regclass('public.app_meta')" 2>/dev/null | grep -q app_meta || return 0
  return 1
}

if is_fresh; then
  echo "[init] 全新初始化：执行 db/schema.sql + seed_content.sql ..."
  psql_run -f "$INIT_DIR/db/schema.sql" >/dev/null
  psql_run -f "$INIT_DIR/db/seed_content.sql" >/dev/null
fi

# 逐个应用未执行的迁移（幂等：已应用的文件跳过）
for m in "$INIT_DIR"/db/migrations/*.sql; do
  base="$(basename "$m")"
  applied="$(psql_run -tAc "SELECT 1 FROM schema_migrations WHERE filename='$base'" 2>/dev/null | tr -d '[:space:]')"
  if [ "$applied" = "1" ]; then
    echo "[init] 跳过已应用的迁移 $base"
    continue
  fi
  echo "[init] 执行迁移 $base ..."
  psql_run -f "$m" >/dev/null
  psql_run -c "INSERT INTO schema_migrations(filename) VALUES ('$base')" >/dev/null
done

psql_run -c "INSERT INTO app_meta(key, value) VALUES ('deploy_init','{\"v\":1}'::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()" >/dev/null
echo "[init] 数据库初始化完成"
