#!/bin/sh
# =============================================================================
# docker-init-db.sh —— Docker 环境下初始化 Learn-Workbench 数据库（幂等）
# 由 docker-compose 的 init 服务调用（postgres:16-alpine 容器内，sh 解释器）
# 环境变量：PGHOST / PGPORT / PGUSER / PGDATABASE / PGPASSWORD
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

# 幂等：app_meta.deploy_init 标记已存在则跳过
if psql_run -tAc "SELECT to_regclass('public.app_meta')" 2>/dev/null | grep -q app_meta \
  && [ "$(psql_run -tAc "SELECT value->>'v' FROM app_meta WHERE key='deploy_init'")" = "1" ]; then
  echo "[init] 数据库已初始化过，跳过 schema/seed/migrations"
  exit 0
fi

echo "[init] 执行 db/schema.sql ..."
psql_run -f "$INIT_DIR/db/schema.sql" >/dev/null

echo "[init] 执行 db/seed_content.sql ..."
psql_run -f "$INIT_DIR/db/seed_content.sql" >/dev/null

for m in "$INIT_DIR"/db/migrations/*.sql; do
  echo "[init] 执行迁移 $(basename "$m") ..."
  psql_run -f "$m" >/dev/null
done

psql_run -c "INSERT INTO app_meta(key, value) VALUES ('deploy_init','{\"v\":1}'::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()" >/dev/null
echo "[init] 数据库初始化完成"