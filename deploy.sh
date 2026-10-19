#!/usr/bin/env bash
#
# =============================================================================
#  Learn-Workbench · ICT 学习工作台 —— 服务器一键部署脚本
# =============================================================================
#  支持：Debian / Ubuntu / CentOS / Rocky / AlmaLinux / Fedora
#  功能：
#    1. 安装 Node.js 22 + pnpm + PostgreSQL + python3（Bing 壁纸爬虫需要）
#    2. 创建数据库角色 / 数据库，执行 db/schema.sql + seed + migrations
#    3. pnpm install + 构建 Web 端（Next.js）
#    4. 写入 apps/web/.env.local（数据库连接配置，自动 gitignore）
#    5. 创建管理员账号（自动生成密码，保存到 deploy-credentials.txt）
#    6. 用 PM2 启动 Web 服务（无 PM2 时降级为 nohup）
#    7. 可选：抓取今日 Bing 壁纸、配置每日定时任务
#    8. 依赖智能检测：已安装的工具（Node/pnpm/PostgreSQL/python3/curl/PM2）自动跳过下载与安装；
#       PostgreSQL 已在运行或服务端已装也会跳过，重复执行不会重复下载
#
#  用法：
#    bash deploy.sh                 # 一键部署（可重复执行，幂等）
#    bash deploy.sh --status        # 查看服务状态
#    bash deploy.sh --restart       # 重启 Web 服务
#    bash deploy.sh --stop          # 停止 Web 服务
#    bash deploy.sh --logs          # 查看 Web 服务日志
#    bash deploy.sh --help          # 帮助
#
#  可用环境变量（均有默认值，按需覆盖）：
#    APP_PORT=3001            Web 服务端口
#    NPM_REGISTRY=https://registry.npmmirror.com   npm/pnpm 镜像源（国内加速，可改为官方源）
#    PG_HOST=127.0.0.1        PostgreSQL 地址
#    PG_PORT=5432             PostgreSQL 端口
#    PG_DB=Learn-Workbench    数据库名
#    PG_USER=lwb              应用数据库用户
#    PG_PASSWORD=<自动生成>   应用数据库用户密码
#    CRON_SECRET=<自动生成>   内部 cron 触发密钥（/api/internal/cron）
#    WEB_BASE_URL=<自动推断>  对外站点地址（https://learn.yuanabd.cn），用于邮件链接/微信回跳
#    SETUP_JOBS_CRON=1        是否添加每日招聘爬虫+聚合+维护的 crontab（0/1）
#    ADMIN_USERNAME=admin     管理员用户名
#    ADMIN_PASSWORD=<自动生成> 管理员密码（留空自动生成）
#    PROCESS_MANAGER=pm2      进程管理方式：pm2 | nohup
#    FETCH_BING=1             部署完成后是否抓取今日 Bing 壁纸（0/1）
#    SETUP_CRON=0             是否添加每日 6 点抓取 Bing 壁纸的 crontab（0/1）
#    SKIP_DEPS=0              跳过系统依赖安装（0/1）
#    SKIP_BUILD=0             跳过构建（0/1）
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# ---------------------------------------------------------------- 默认配置
APP_PORT="${APP_PORT:-3001}"
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_DB="${PG_DB:-Learn-Workbench}"
PG_USER="${PG_USER:-lwb}"
PG_PASSWORD="${PG_PASSWORD:-}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
PROCESS_MANAGER="${PROCESS_MANAGER:-pm2}"
FETCH_BING="${FETCH_BING:-1}"
SETUP_CRON="${SETUP_CRON:-0}"
SKIP_DEPS="${SKIP_DEPS:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
CRON_SECRET="${CRON_SECRET:-}"
WEB_BASE_URL="${WEB_BASE_URL:-}"
SETUP_JOBS_CRON="${SETUP_JOBS_CRON:-1}"
# npm/pnpm 镜像源（默认淘宝 npmmirror，国内下载加速；NPM_REGISTRY=https://registry.npmjs.org 可切回官方）
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"

# ---------------------------------------------------------------- 工具函数
info()  { printf "\033[1;32m[deploy]\033[0m %s\n" "$*"; }
warn()  { printf "\033[1;33m[deploy][warn]\033[0m %s\n" "$*" >&2; }
error() { printf "\033[1;31m[deploy][error]\033[0m %s\n" "$*" >&2; exit 1; }

maybe_sudo() {
  if [ "$(id -u)" = "0" ]; then echo; else echo "sudo"; fi
}
SUDO="$(maybe_sudo)"

# 使用镜像源 + 提高下载重试容忍度（已安装工具不受影响）
export npm_config_registry="$NPM_REGISTRY"
export npm_config_fetch_retries=5
export npm_config_fetch_timeout=120000

run_as_postgres() {
  if [ "$(id -un)" = "postgres" ]; then
    "$@"
  elif [ "$(id -u)" = "0" ]; then
    su - postgres -c "$(printf '%q ' "$@")"
  else
    sudo -u postgres "$@"
  fi
}

# 生成随机密码（字母数字，16 位）
gen_password() {
  head -c 24 /dev/urandom 2>/dev/null | tr -dc 'A-Za-z0-9' | head -c 16 \
    || openssl rand -base64 12 2>/dev/null | tr -dc 'A-Za-z0-9' | head -c 16 \
    || echo "lwb$(date +%s)$RANDOM"
}

# ---------------------------------------------------------------- 子命令
case "${1:-}" in
  --help|-h)
    sed -n "2,60p" "$0" | sed "s/^# \{0,1\}//"
    exit 0
    ;;
  --status)
    if command -v pm2 >/dev/null 2>&1 && pm2 describe learn-workbench >/dev/null 2>&1; then
      pm2 describe learn-workbench | grep -E "status|name|script|restarts|uptime" || true
    elif [ -f "$ROOT/server.pid" ] && kill -0 "$(cat "$ROOT/server.pid")" 2>/dev/null; then
      echo "learn-workbench 运行中 (PID $(cat "$ROOT/server.pid"), 端口 $APP_PORT)"
    else
      echo "learn-workbench 未运行"
    fi
    exit 0
    ;;
  --stop)
    if command -v pm2 >/dev/null 2>&1 && pm2 describe learn-workbench >/dev/null 2>&1; then
      pm2 stop learn-workbench && pm2 delete learn-workbench
      echo "已停止 learn-workbench (PM2)"
    elif [ -f "$ROOT/server.pid" ]; then
      kill "$(cat "$ROOT/server.pid")" 2>/dev/null || true
      rm -f "$ROOT/server.pid"
      echo "已停止 learn-workbench (nohup)"
    else
      echo "learn-workbench 未在运行"
    fi
    exit 0
    ;;
  --restart)
    "$0" --stop || true
    exec bash "$0"
    ;;
  --logs)
    if command -v pm2 >/dev/null 2>&1 && pm2 describe learn-workbench >/dev/null 2>&1; then
      pm2 logs learn-workbench --lines 50 --nostream
    elif [ -f "$ROOT/server.log" ]; then
      tail -n 50 "$ROOT/server.log"
    else
      echo "没有找到日志文件"
    fi
    exit 0
    ;;
esac

# ---------------------------------------------------------------- S4-3 部署前置闸门
# 目的：把「磁盘打满 / 备份目录不可写」这类事故挡在部署开始之前（历史事故：根盘 100% 后全站写失败）
check_deploy_gates() {
  local avail_kb
  avail_kb="$(df -Pk / | awk 'NR==2{print $4}')"
  if [ -n "$avail_kb" ] && [ "$avail_kb" -lt $((10 * 1024 * 1024)) ]; then
    error "根盘可用空间不足 10GiB（当前 $((avail_kb / 1024 / 1024))GiB）。请先清理：docker builder prune -af / 清理旧 release"
  fi
  local backup_dir="${BACKUP_DIR:-}"
  if [ -z "$backup_dir" ]; then
    if [ -d /data ]; then backup_dir="/data/backups/learn-workbench"; else backup_dir="$ROOT/.backup"; fi
  fi
  mkdir -p "$backup_dir" 2>/dev/null || true
  if ! ( : > "$backup_dir/.write-probe" ) 2>/dev/null; then
    error "备份目录不可写：$backup_dir（检查属主/挂载）"
  fi
  rm -f "$backup_dir/.write-probe"
  info "部署闸门通过（磁盘 $((avail_kb / 1024 / 1024))GiB 可用，备份目录 $backup_dir）"
}
check_deploy_gates

info "======================================================"
info " Learn-Workbench 一键部署"
info " 项目目录: $ROOT"
info "======================================================"

# ---------------------------------------------------------------- 系统检测
detect_os() {
  OS_ID=""
  PKG_MGR=""
  if [ -f /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    OS_ID="${ID:-}"
  fi
  case "$OS_ID" in
    debian|ubuntu)                            PKG_MGR="apt" ;;
    centos|rhel|rocky|almalinux|fedora|amzn)  PKG_MGR="dnf" ;;
    *)                                        PKG_MGR="" ;;
  esac
  if [ -z "$PKG_MGR" ]; then
    if command -v apt-get >/dev/null 2>&1; then PKG_MGR="apt"
    elif command -v dnf >/dev/null 2>&1; then PKG_MGR="dnf"
    elif command -v yum >/dev/null 2>&1; then PKG_MGR="yum"
    fi
  fi
}
detect_os

if [ -z "$PKG_MGR" ]; then
  error "无法识别的 Linux 发行版，请手动安装 Node.js 22+ / pnpm / PostgreSQL / python3 后，设置 SKIP_DEPS=1 重试。"
fi
info "检测到系统: ${OS_ID:-unknown} (包管理器: $PKG_MGR)"

# ---------------------------------------------------------------- 安装依赖
# pnpm 11 需要 Node >= 22.13（内部使用 node:sqlite 内置模块，Node 20 会报
# ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite）。这里按 >= 22.13 校验。
node_ok() {
  local ver major minor
  ver="$(node -v 2>/dev/null | sed 's/^v//')" || return 1
  major="${ver%%.*}"
  minor="$(printf '%s' "$ver" | cut -d. -f2)"
  if [ "$major" -gt 22 ]; then return 0; fi
  if [ "$major" -eq 22 ] && [ "$minor" -ge 13 ]; then return 0; fi
  return 1
}

install_node() {
  if command -v node >/dev/null 2>&1 && node_ok; then
    info "Node.js $(node -v) 已就绪"
    return
  fi
  info "安装 Node.js 22 LTS（当前 $(command -v node >/dev/null 2>&1 && node -v || echo 无) 不满足 Node >= 22.13 要求）..."
  if [ "$PKG_MGR" = "apt" ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash -
  else
    curl -fsSL https://rpm.nodesource.com/setup_22.x | $SUDO bash -
  fi
  $SUDO "$PKG_MGR" install -y nodejs
  hash -r
  if ! node_ok; then
    error "Node.js 升级后仍为 $(node -v)，仍未满足 >= 22.13。请手动处理：删除旧版 node（如 /usr/local/bin/node、nvm 等）后重试，或用 nvm：curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && nvm install 22"
  fi
  info "Node.js 已升级到 $(node -v)"
}

install_pnpm() {
  if command -v pnpm >/dev/null 2>&1 && [ "$(pnpm --version 2>/dev/null | cut -d. -f1)" -ge 11 ]; then
    info "pnpm $(pnpm --version) 已就绪"
    return
  fi
  info "安装 pnpm@11.16.0 ..."
  if command -v npm >/dev/null 2>&1; then
    $SUDO npm install -g pnpm@11.16.0 --registry="$NPM_REGISTRY"
    hash -r
  elif command -v corepack >/dev/null 2>&1; then
    $SUDO corepack enable
    $SUDO corepack prepare pnpm@11.16.0 --activate
  else
    error "未找到 npm / corepack，无法安装 pnpm"
  fi
}

# PostgreSQL 服务端是否已安装（psql 只是客户端，不能代表服务端已装）
pg_server_installed() {
  command -v postgres >/dev/null 2>&1 && return 0
  command -v pg_ctl >/dev/null 2>&1 && return 0
  [ -n "$(ls /usr/lib/postgresql/*/bin/postgres 2>/dev/null | head -1)" ] && return 0
  return 1
}

install_postgres() {
  # 目标端口已有 PostgreSQL 在运行（含系统自启 / 远程 / Docker），跳过安装与启动
  if pg_isready -h "$PG_HOST" -p "$PG_PORT" -q 2>/dev/null; then
    info "PostgreSQL 已在 $PG_HOST:$PG_PORT 运行，跳过安装与启动"
    return
  fi
  if pg_server_installed; then
    info "PostgreSQL 服务端已安装"
  else
    info "安装 PostgreSQL ..."
    $SUDO "$PKG_MGR" install -y postgresql postgresql-client 2>/dev/null \
      || $SUDO "$PKG_MGR" install -y postgresql-server postgresql
    hash -r
  fi
  # RHEL 系首次初始化数据目录
  if [ -x /usr/bin/postgresql-setup ] && [ ! -f /var/lib/pgsql/data/PG_VERSION ]; then
    info "初始化 PostgreSQL 数据目录 ..."
    $SUDO /usr/bin/postgresql-setup --initdb || true
  fi
  # 启动并设为开机自启（仅在未运行时）
  if ! pg_isready -h "$PG_HOST" -p "$PG_PORT" -q 2>/dev/null; then
    if command -v systemctl >/dev/null 2>&1; then
      $SUDO systemctl enable --now postgresql >/dev/null 2>&1 || $SUDO systemctl restart postgresql
    else
      $SUDO service postgresql start || true
    fi
  fi
  # 等待就绪
  local i=0
  while ! pg_isready -h "$PG_HOST" -p "$PG_PORT" -q 2>/dev/null; do
    i=$((i+1))
    if [ "$i" -ge 30 ]; then error "PostgreSQL 启动超时，请检查系统日志"; fi
    sleep 1
  done
  info "PostgreSQL 已就绪 ($PG_HOST:$PG_PORT)"
}

if [ "$SKIP_DEPS" != "1" ]; then
  info "---------- 步骤 1/6：安装系统依赖 ----------"
  # 先判断是否真的需要安装，已装好的工具一律跳过下载/安装
  need_install=0
  if ! command -v node >/dev/null 2>&1 || ! node_ok; then need_install=1; fi
  if ! command -v pnpm >/dev/null 2>&1 || [ "$(pnpm --version 2>/dev/null | cut -d. -f1)" -lt 11 ]; then need_install=1; fi
  if ! command -v curl >/dev/null 2>&1; then need_install=1; fi
  if ! command -v python3 >/dev/null 2>&1; then need_install=1; fi
  if ! pg_isready -h "$PG_HOST" -p "$PG_PORT" -q 2>/dev/null && ! pg_server_installed; then need_install=1; fi
  if [ "$PROCESS_MANAGER" = "pm2" ] && ! command -v pm2 >/dev/null 2>&1; then need_install=1; fi

  # 只有确实要装东西时才执行 apt-get update，避免无谓的网络刷新
  if [ "$need_install" = "1" ] && [ "$PKG_MGR" = "apt" ]; then
    $SUDO apt-get update -y
  fi
  if [ "$need_install" = "0" ]; then
    info "所需依赖均已就绪，跳过系统依赖安装"
  fi

  install_node
  install_pnpm
  install_postgres
  if ! command -v curl >/dev/null 2>&1; then
    info "安装 curl ..."
    $SUDO "$PKG_MGR" install -y curl
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    info "安装 python3（Bing 壁纸爬虫依赖）..."
    $SUDO "$PKG_MGR" install -y python3
  fi
  if [ "$PROCESS_MANAGER" = "pm2" ] && ! command -v pm2 >/dev/null 2>&1; then
    info "安装 PM2 进程管理器 ..."
    $SUDO npm install -g pm2 --registry="$NPM_REGISTRY" || warn "PM2 安装失败，将降级为 nohup 启动"
  fi
else
  info "SKIP_DEPS=1，跳过系统依赖安装"
fi
hash -r
# ---------------------------------------------------------------- PostgreSQL 配置
if [ -z "$PG_PASSWORD" ]; then
  PG_PASSWORD="$(gen_password)"
  info "已生成数据库用户 $PG_USER 的密码"
fi
# 内部 cron 触发密钥（/api/internal/cron 鉴权用，写入 crontab 与运行时配置）
if [ -z "$CRON_SECRET" ]; then
  CRON_SECRET="$(gen_password)$(gen_password)"
  info "已生成内部 cron 触发密钥 CRON_SECRET"
fi

info "---------- 步骤 2/6：初始化数据库 ----------"
export PGCLIENTENCODING=UTF8
psql_cmd() { PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 "$@"; }

# 创建数据库角色（如不存在）
if ! run_as_postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'" | grep -q 1; then
  info "创建数据库用户 $PG_USER ..."
  run_as_postgres psql -v ON_ERROR_STOP=1 -c "SET password_encryption='scram-sha-256'; CREATE ROLE \"$PG_USER\" LOGIN PASSWORD '$PG_PASSWORD'" >/dev/null
else
  info "数据库用户 $PG_USER 已存在，更新密码 ..."
  run_as_postgres psql -v ON_ERROR_STOP=1 -c "SET password_encryption='scram-sha-256'; ALTER ROLE \"$PG_USER\" WITH LOGIN PASSWORD '$PG_PASSWORD'" >/dev/null
fi

# 创建数据库（如不存在）
if ! run_as_postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" | grep -q 1; then
  info "创建数据库 $PG_DB ..."
  run_as_postgres createdb -O "$PG_USER" -E UTF8 --lc-collate=C --lc-ctype=C --template=template0 "$PG_DB"
else
  info "数据库 $PG_DB 已存在"
fi

# 确保 127.0.0.1 上允许密码登录（RHEL 系默认可能是 ident，需要放行）
HBA_FILE="$(run_as_postgres psql -tAc "SHOW hba_file" | tr -d '[:space:]')"
if [ -n "$HBA_FILE" ] && [ -f "$HBA_FILE" ]; then
  if ! run_as_postgres grep -Eq '^host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1/32[[:space:]]+(scram-sha-256|md5|trust)' "$HBA_FILE"; then
    info "更新 pg_hba.conf 允许 127.0.0.1 密码登录 ..."
    run_as_postgres sed -i '1i host all all 127.0.0.1/32 scram-sha-256' "$HBA_FILE"
    run_as_postgres psql -c "SELECT pg_reload_conf()" >/dev/null
  fi
fi

# ---------------------------------------------------------------- 数据库初始化与迁移（S4-1）
# 与 docker 路径统一语义：逐文件台账 + checksum + 单事务；不再用 deploy_init 一刀切跳过。
psql_cmd -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)" >/dev/null
psql_cmd -c "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text" >/dev/null

FRESH="$(psql_cmd -tAc "SELECT CASE WHEN to_regclass('public.app_meta') IS NULL THEN '1' ELSE '0' END")"
if [ "$FRESH" = "1" ]; then
  info "执行 db/schema.sql ..."
  psql_cmd -f db/schema.sql >/dev/null
  info "执行 db/seed_content.sql ..."
  psql_cmd -f db/seed_content.sql >/dev/null
fi

# 旧 PM2 机器（曾经 deploy_init=1、台账从未建立）：一次性登记存量迁移，避免重放历史迁移。
LEDGER_COUNT="$(psql_cmd -tAc "SELECT count(*) FROM schema_migrations")"
if [ "$LEDGER_COUNT" = "0" ] && [ "$FRESH" = "0" ]; then
  warn "检测到旧库（已初始化但迁移台账为空）：按「存量迁移视为已应用」登记（不重新执行）。"
  warn "如怀疑生产缺过迁移，请手动核对 schema_migrations 与 db/migrations/。"
  for m in db/migrations/*.sql; do
    base="$(basename "$m")"
    sum="$(sha256sum "$m" | cut -d' ' -f1)"
    psql_cmd -c "INSERT INTO schema_migrations(filename, checksum) VALUES ('$base','$sum') ON CONFLICT (filename) DO NOTHING" >/dev/null
  done
fi

# 计算待应用清单 + 校验已应用文件的 checksum
PENDING=""
for m in db/migrations/*.sql; do
  base="$(basename "$m")"
  sum="$(sha256sum "$m" | cut -d' ' -f1)"
  row="$(psql_cmd -tAc "SELECT coalesce(checksum,'') FROM schema_migrations WHERE filename='$base'" | tr -d '[:space:]')"
  if [ -n "$row" ]; then
    if [ "$row" != "$sum" ]; then
      error "已应用的迁移 $base 内容被修改（checksum 不一致）。如确需变更请新增迁移文件。"
    fi
    continue
  fi
  PENDING="$PENDING $m"
done

if [ -z "$PENDING" ]; then
  info "数据库已是最新（schema_migrations 覆盖全部迁移）"
else
  # 迁移前强制备份（S4-1/S4-6）
  BACKUP_DIR="${BACKUP_DIR:-}"
  if [ -z "$BACKUP_DIR" ]; then
    if [ -d /data ]; then BACKUP_DIR="/data/backups/learn-workbench"; else BACKUP_DIR="$ROOT/.backup"; fi
  fi
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/pre-migrate-$(date +%Y%m%d-%H%M%S).dump"
  info "迁移前备份：$BACKUP_FILE"
  PGPASSWORD="$PG_PASSWORD" pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -Fc -f "$BACKUP_FILE"
  PGPASSWORD="$PG_PASSWORD" pg_restore --list "$BACKUP_FILE" >/dev/null || error "备份自检失败（归档不可读），已中止迁移"
  info "备份自检通过（$BACKUP_FILE）"
  for m in $PENDING; do
    base="$(basename "$m")"
    sum="$(sha256sum "$m" | cut -d' ' -f1)"
    info "执行迁移 $base ..."
    if grep -qiE '^[[:space:]]*BEGIN[[:space:]]*;' "$m"; then
      psql_cmd -f "$m" >/dev/null
    else
      psql_cmd -1 -f "$m" >/dev/null
    fi
    psql_cmd -c "INSERT INTO schema_migrations(filename, checksum) VALUES ('$base','$sum') ON CONFLICT (filename) DO UPDATE SET checksum=EXCLUDED.checksum" >/dev/null
  done
fi
psql_cmd -c "INSERT INTO app_meta(key, value) VALUES ('deploy_init','{\"v\":1}'::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()" >/dev/null
info "数据库初始化/迁移完成"

# ---------------------------------------------------------------- 安装依赖 + 构建
info "---------- 步骤 3/6：安装项目依赖 ----------"
if command -v pnpm >/dev/null 2>&1; then
  if pnpm install --frozen-lockfile --reporter=append-only 2>/dev/null; then
    :
  else
    info "lockfile 校验未通过，改用 pnpm install ..."
    pnpm install --reporter=append-only
  fi
else
  error "未找到 pnpm，请检查步骤 1 是否成功"
fi

if [ "$SKIP_BUILD" != "1" ]; then
  info "---------- 步骤 4/6：构建 Web 端 ----------"
  export NEXT_TELEMETRY_DISABLED=1
  pnpm --filter web build
else
  info "SKIP_BUILD=1，跳过构建"
fi

# ---------------------------------------------------------------- 运行时配置
info "---------- 步骤 5/6：写入运行时配置 ----------"
ENV_FILE="apps/web/.env.local"
cat > "$ENV_FILE" << EOF
# 由 deploy.sh 自动生成，请勿提交到 Git（已在 .gitignore 中）
PGHOST=$PG_HOST
PGPORT=$PG_PORT
PGDATABASE=$PG_DB
PGUSER=$PG_USER
PGPASSWORD=$PG_PASSWORD
CRON_SECRET=$CRON_SECRET
WEB_BASE_URL=$WEB_BASE_URL
EOF
info "已写入 $ENV_FILE"

# ---------------------------------------------------------------- 创建管理员
info "---------- 步骤 6/6：创建管理员账号 ----------"
if PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc "SELECT 1 FROM accounts WHERE username='$ADMIN_USERNAME'" | grep -q 1; then
  info "管理员账号 $ADMIN_USERNAME 已存在，跳过创建（如需重置密码，请手动运行 scripts/create-admin.mjs）"
else
  if [ -z "$ADMIN_PASSWORD" ]; then
    ADMIN_PASSWORD="$(gen_password)"
  fi
  ADMIN_USERNAME="$ADMIN_USERNAME" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  PGHOST="$PG_HOST" PGPORT="$PG_PORT" PGDATABASE="$PG_DB" PGUSER="$PG_USER" PGPASSWORD="$PG_PASSWORD" \
    node scripts/create-admin.mjs
  CRED_FILE="$ROOT/deploy-credentials.txt"
  {
    echo "Learn-Workbench 部署凭据（生成时间：$(date '+%Y-%m-%d %H:%M:%S')）"
    echo "-----------------------------------------------------"
    echo "Web 地址 : http://<服务器IP>:${APP_PORT}"
    echo "管理员账号 : ${ADMIN_USERNAME}"
    echo "管理员密码 : ${ADMIN_PASSWORD}"
    echo "CRON_SECRET : ${CRON_SECRET}（每日爬虫 cron 触发密钥，勿泄露）"
    echo "数据库   : ${PG_DB} (${PG_HOST}:${PG_PORT} / ${PG_USER})"
    echo "-----------------------------------------------------"
    echo "请妥善保管，确认后建议删除本文件：rm $CRED_FILE"
  } > "$CRED_FILE"
  chmod 600 "$CRED_FILE"
  info "管理员账号创建完成，凭据已保存到 deploy-credentials.txt（权限 600）"
fi

# ---------------------------------------------------------------- 启动服务
start_service() {
  local use_pm2=0
  if [ "$PROCESS_MANAGER" = "pm2" ] && command -v pm2 >/dev/null 2>&1; then
    use_pm2=1
  fi
  ( cd "$ROOT/apps/web"
    if [ "$use_pm2" = "1" ]; then
      info "通过 PM2 启动 Web 服务 (端口 $APP_PORT) ..."
      pm2 describe learn-workbench >/dev/null 2>&1 && pm2 delete learn-workbench
      pm2 start node_modules/next/dist/bin/next --name learn-workbench --max-memory-restart 1G -- start -p "$APP_PORT"
      pm2 save
      info "PM2 已保存进程列表"
      if [ "$(id -u)" != "0" ]; then
        warn "如需开机自启，请执行：pm2 startup 并按提示运行输出的命令"
      fi
    else
      info "通过 nohup 启动 Web 服务 (端口 $APP_PORT) ..."
      if [ -f "$ROOT/server.pid" ] && kill -0 "$(cat "$ROOT/server.pid")" 2>/dev/null; then
        warn "服务已在运行 (PID $(cat "$ROOT/server.pid"))，跳过启动"
        return
      fi
      nohup node node_modules/next/dist/bin/next start -p "$APP_PORT" >> "$ROOT/server.log" 2>&1 &
      echo $! > "$ROOT/server.pid"
      info "已启动，PID $(cat "$ROOT/server.pid")，日志：server.log"
    fi )
}
start_service

# ---------------------------------------------------------------- Bing 壁纸（可选）
if [ "$FETCH_BING" = "1" ] && command -v python3 >/dev/null 2>&1; then
  info "抓取今日 Bing 壁纸（失败不影响部署）..."
  ( cd "$ROOT" && python3 scripts/fetch_bing_wallpaper.py \
      --db "host=$PG_HOST port=$PG_PORT dbname=$PG_DB user=$PG_USER password=$PG_PASSWORD" ) || \
    warn "Bing 壁纸抓取失败，可稍后在 Web 端「设置」中手动触发，或执行 python3 scripts/fetch_bing_wallpaper.py"
fi

if [ "$SETUP_CRON" = "1" ] && command -v crontab >/dev/null 2>&1; then
  info "添加每日 6 点抓取 Bing 壁纸的 crontab ..."
  ( crontab -l 2>/dev/null | grep -v "fetch_bing_wallpaper.py"; \
    echo "0 6 * * * cd $ROOT && python3 scripts/fetch_bing_wallpaper.py >> $ROOT/bing.log 2>&1" ) | crontab -
  info "crontab 已配置"
fi

# 每日招聘爬虫管线（P1 并发优化）：服务器统一批处理，用户请求只读预聚合数据
#   04:30 抓取（幂等守卫：当天已成功则跳过；12:30 补跑同样无害）
#   05:40 聚合（市场分析 + 公开统计快照落库，此后用户读单行快照）
#   06:10 维护（清理过期会话/审计/重置令牌）
if [ "$SETUP_JOBS_CRON" = "1" ] && command -v crontab >/dev/null 2>&1; then
  info "添加每日爬虫/聚合/回填/维护/面试题 crontab（04:30 / 05:40 / 12:50 / 06:10 / 06:20）..."
  CRON_URL="http://127.0.0.1:${APP_PORT}/api/internal/cron"
  ( crontab -l 2>/dev/null | grep -v "api/internal/cron"; \
    echo "30 4 * * * flock -n /tmp/lwb-cron-crawl.lock curl -fsS -m 60 -X POST -H 'x-cron-secret: ${CRON_SECRET}' '${CRON_URL}?job=crawl' >> $ROOT/cron-jobs.log 2>&1 || true"; \
    echo "30 12 * * * flock -n /tmp/lwb-cron-crawl.lock curl -fsS -m 60 -X POST -H 'x-cron-secret: ${CRON_SECRET}' '${CRON_URL}?job=crawl' >> $ROOT/cron-jobs.log 2>&1 || true"; \
    echo "40 5 * * * flock -n /tmp/lwb-cron-agg.lock curl -fsS -m 300 -X POST -H 'x-cron-secret: ${CRON_SECRET}' '${CRON_URL}?job=aggregate' >> $ROOT/cron-jobs.log 2>&1 || true"; \
    echo "50 12 * * * flock -n /tmp/lwb-cron-backfill.lock curl -fsS -m 300 -X POST -H 'x-cron-secret: ${CRON_SECRET}' '${CRON_URL}?job=backfill' >> $ROOT/cron-jobs.log 2>&1 || true"; \
    echo "10 6 * * * flock -n /tmp/lwb-cron-maint.lock curl -fsS -m 120 -X POST -H 'x-cron-secret: ${CRON_SECRET}' '${CRON_URL}?job=maintenance' >> $ROOT/cron-jobs.log 2>&1 || true"; \
    echo "20 6 * * * flock -n /tmp/lwb-cron-interview.lock curl -fsS -m 120 -X POST -H 'x-cron-secret: ${CRON_SECRET}' '${CRON_URL}?job=interview' >> $ROOT/cron-jobs.log 2>&1 || true" ) | crontab -
  info "crontab 已配置（每日爬虫管线）"
elif [ "$SETUP_JOBS_CRON" = "1" ]; then
  warn "未检测到 crontab 命令，跳过每日爬虫管线配置（请手动配置或改用容器调度）"
fi

# ---------------------------------------------------------------- 汇总
LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
info "======================================================"
info " 部署完成！"
info "  Web 地址 : http://${LOCAL_IP:-<服务器IP>}:${APP_PORT}"
info "  管理员   : $ADMIN_USERNAME （密码见 deploy-credentials.txt）"
info "  数据库   : $PG_DB（用户 $PG_USER）"
info "------------------------------------------------------"
info " 常用命令 :"
info "   bash deploy.sh --status    查看状态"
info "   bash deploy.sh --restart   重启"
info "   bash deploy.sh --stop      停止"
info "   bash deploy.sh --logs      查看日志"
info "------------------------------------------------------"
info " 如需通过域名访问，请配置 Nginx 反向代理（示例见 README.md）："
cat << "NGINX_EOF"
  server {
      listen 80;
      server_name your-domain.com;
      location / {
          proxy_pass http://127.0.0.1:PORT;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
NGINX_EOF
info "======================================================"
