#!/usr/bin/env bash
#
# =============================================================================
#  Learn-Workbench · ICT 学习工作台 —— Docker 一键部署脚本
# =============================================================================
#  前置：服务器已安装 Docker 与 Compose v2 插件
#  功能：
#    1. 生成数据库密码 / 管理员密码（未指定时）
#    2. 写入 .env 供 docker compose 读取
#    3. docker compose 构建并启动 db + init + web
#    4. init 服务初始化数据库（幂等，已初始化自动跳过）
#    5. 创建管理员账号并保存凭据到 deploy-credentials.txt
#    6. 等待 Web 就绪并打印访问地址
#
#  用法：
#    bash deploy-docker.sh                # 一键部署（幂等，可重复执行）
#    bash deploy-docker.sh --status       # 查看容器状态
#    bash deploy-docker.sh --restart      # 重启 web 容器
#    bash deploy-docker.sh --stop         # 停止所有容器（保留数据）
#    bash deploy-docker.sh --down         # 停止并删除容器（保留数据卷）
#    bash deploy-docker.sh --logs         # 查看 web 日志
#    bash deploy-docker.sh --help         # 帮助
#
#  可用环境变量（均有默认值，按需覆盖）：
#    APP_PORT=3001          Web 对外端口
#    NPM_REGISTRY=https://registry.npmmirror.com   npm/pnpm 镜像源（构建时下载加速，可改官方源）
#    PG_PASSWORD=<自动生成>  PostgreSQL 密码
#    ADMIN_USERNAME=admin   管理员用户名
#    ADMIN_PASSWORD=<自动生成> 管理员密码
#    CRON_SECRET=<自动生成>  内部 cron 触发密钥（/api/internal/cron）
#    WEB_BASE_URL=<可选>     对外站点地址（邮件链接/微信回跳）
#    SETUP_JOBS_CRON=1      是否添加每日爬虫/聚合/维护 crontab（0/1）
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

APP_PORT="${APP_PORT:-3001}"
PG_PASSWORD="${PG_PASSWORD:-}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
CRON_SECRET="${CRON_SECRET:-}"
WEB_BASE_URL="${WEB_BASE_URL:-}"
SETUP_JOBS_CRON="${SETUP_JOBS_CRON:-1}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"

# ---------------------------------------------------------------- 工具函数
info()  { printf "\033[1;32m[docker]\033[0m %s\n" "$*"; }
warn()  { printf "\033[1;33m[docker][warn]\033[0m %s\n" "$*" >&2; }
error() { printf "\033[1;31m[docker][error]\033[0m %s\n" "$*" >&2; exit 1; }

gen_password() {
  head -c 24 /dev/urandom 2>/dev/null | tr -dc 'A-Za-z0-9' | head -c 16 \
    || openssl rand -base64 12 2>/dev/null | tr -dc 'A-Za-z0-9' | head -c 16 \
    || echo "lwb$(date +%s)$RANDOM"
}

# 探测 HTTP 是否就绪（curl / wget / bash /dev/tcp 均可）
http_ok() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT" 2>/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O /dev/null "http://127.0.0.1:$APP_PORT" 2>/dev/null
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$APP_PORT") 2>/dev/null
  fi
}

# ---------------------------------------------------------------- 子命令
case "${1:-}" in
  --help|-h)
    sed -n "2,42p" "$0" | sed "s/^# \{0,1\}//"
    exit 0
    ;;
  --status)
    docker compose ps
    exit 0
    ;;
  --stop)
    docker compose stop
    exit 0
    ;;
  --down)
    docker compose down
    exit 0
    ;;
  --restart)
    docker compose restart web
    exit 0
    ;;
  --logs)
    docker compose logs --tail=100 web
    exit 0
    ;;
esac

# ---------------------------------------------------------------- 前置检查
command -v docker >/dev/null 2>&1 || error "未找到 docker，请先安装 Docker：https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || error "未找到 docker compose 插件（Compose v2），请先安装"

# ---------------------------------------------------------------- S4-3 部署闸门（fail-fast）
AVAIL_KB="$(df -Pk / | awk 'NR==2{print $4}')"
if [ -n "${AVAIL_KB:-}" ] && [ "$AVAIL_KB" -lt $((10 * 1024 * 1024)) ]; then
  error "根盘可用空间不足 10GiB（当前 $((AVAIL_KB / 1024 / 1024))GiB）。先清理：docker builder prune -af / docker image prune -f"
fi
if [ -d /data ]; then
  if ! grep -qE '[[:space:]]/data(/learn-workbench)?[[:space:]]' /proc/mounts; then
    error "/data 未挂载（COSFS 掉挂载？）。历史事故：掉挂载时 Docker 会在系统盘静默建目录，上传/备份会落到错误位置"
  fi
  if ! ( : > /data/learn-workbench/.write-probe ) 2>/dev/null; then
    error "/data/learn-workbench 不可写（检查 COSFS 健康：cosfs-data.sh health）"
  fi
  rm -f /data/learn-workbench/.write-probe
fi
info "部署闸门通过（磁盘 $((AVAIL_KB / 1024 / 1024))GiB 可用）"

# ---------------------------------------------------------------- 复用已有 .env（避免重复部署改掉数据库密码/密钥）
if [ -f .env ]; then
  # .env 是本脚本生成的简单 KEY=VALUE；用 set -a 导入，不覆盖调用方显式传入的环境变量
  PG_PASSWORD_SAVED="$(grep -E '^PG_PASSWORD=' .env | cut -d= -f2- || true)"
  CRON_SECRET_SAVED="$(grep -E '^CRON_SECRET=' .env | cut -d= -f2- || true)"
  WEB_BASE_URL_SAVED="$(grep -E '^WEB_BASE_URL=' .env | cut -d= -f2- || true)"
  [ -z "$PG_PASSWORD" ] && [ -n "$PG_PASSWORD_SAVED" ] && PG_PASSWORD="$PG_PASSWORD_SAVED"
  [ -z "$CRON_SECRET" ] && [ -n "$CRON_SECRET_SAVED" ] && CRON_SECRET="$CRON_SECRET_SAVED"
  [ -z "$WEB_BASE_URL" ] && [ -n "$WEB_BASE_URL_SAVED" ] && WEB_BASE_URL="$WEB_BASE_URL_SAVED"
  info "检测到已有 .env：复用其中的数据库密码 / CRON_SECRET"
fi

# ---------------------------------------------------------------- 生成密码
if [ -z "$PG_PASSWORD" ]; then
  PG_PASSWORD="$(gen_password)"
  info "已生成数据库密码（见 .env）"
fi
if [ -z "$ADMIN_PASSWORD" ]; then
  ADMIN_PASSWORD="$(gen_password)"
  info "已生成管理员密码（见 deploy-credentials.txt）"
fi
if [ -z "$CRON_SECRET" ]; then
  CRON_SECRET="$(gen_password)$(gen_password)"
  info "已生成内部 cron 触发密钥 CRON_SECRET"
fi

# ---------------------------------------------------------------- 写入 .env
cat > .env << EOF
# 由 deploy-docker.sh 自动生成，请勿提交到 Git（已在 .gitignore 中）
PG_PASSWORD=$PG_PASSWORD
APP_PORT=$APP_PORT
CRON_SECRET=$CRON_SECRET
WEB_BASE_URL=$WEB_BASE_URL
NPM_REGISTRY=$NPM_REGISTRY
EOF
chmod 600 .env
info "已写入 .env（权限 600）"

# ---------------------------------------------------------------- 构建并启动
info "======================================================"
info " 构建并启动容器（db + init + web）..."
info "======================================================"
# S4-1：先在镜像里构建，再用统一执行器跑迁移（单事务 + checksum + 迁移前备份），最后切 web
docker compose build web
info "迁移前备份（docker 模式，BACKUP_TARGET=cos）..."
if ! BACKUP_LINE="$(BACKUP_MODE=docker BACKUP_TARGET=cos bash scripts/backup-db.sh)"; then
  error "迁移前备份失败（保护性中止）。请检查 /data 挂载与 db 容器健康"
fi
info "备份完成：$BACKUP_LINE"
# 入口统一：scripts/migrate.mjs 会先 pg_dump 备份并自检，再应用未登记的迁移
docker compose run --rm -T web node /app/scripts/migrate.mjs </dev/null
# 移除上一次的一次性 init 容器（首次部署仍由 init 负责 schema+seed）
docker compose rm -sf init >/dev/null 2>&1 || true
docker compose up -d --no-build

# ---------------------------------------------------------------- 等待 Web 就绪
# 优先用 /api/health（DB 不可用会 503）；老镜像没有该端点时回退到首页探测
health_ok() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/api/health" 2>/dev/null
  else
    return 1
  fi
}
info "等待 Web 服务就绪 (http://127.0.0.1:$APP_PORT/api/health) ..."
i=0
until health_ok || http_ok; do
  i=$((i+1))
  if [ "$i" -ge 60 ]; then
    warn "等待超时（约 2 分钟），请查看日志：bash deploy-docker.sh --logs"
    docker compose ps
    exit 1
  fi
  sleep 2
done
info "Web 服务已就绪"

# S4-6：部署成功后打印最近备份与校验和（出事时第一时间知道从哪恢复）
LATEST_BACKUP="$(ls -t /data/learn-workbench/backups/*.dump 2>/dev/null | head -1 || true)"
if [ -n "$LATEST_BACKUP" ]; then
  info "最近备份：$LATEST_BACKUP"
  if [ -f "$LATEST_BACKUP.sha256" ]; then info "校验：$(cat "$LATEST_BACKUP.sha256" 2>/dev/null)"; fi
fi

# ---------------------------------------------------------------- 创建管理员
info "检查管理员账号 ..."
if docker compose exec -T -e PGPASSWORD="$PG_PASSWORD" db \
     psql -h 127.0.0.1 -U lwb -d Learn-Workbench \
     -tAc "SELECT 1 FROM accounts WHERE username='$ADMIN_USERNAME'" | grep -q 1; then
  info "管理员账号 $ADMIN_USERNAME 已存在，跳过创建"
else
  info "创建管理员账号 $ADMIN_USERNAME ..."
  docker compose exec -T web node /app/scripts/create-admin.mjs \
    --username "$ADMIN_USERNAME" --password "$ADMIN_PASSWORD"
  CRED_FILE="$ROOT/deploy-credentials.txt"
  {
    echo "Learn-Workbench Docker 部署凭据（生成时间：$(date '+%Y-%m-%d %H:%M:%S')）"
    echo "-----------------------------------------------------"
    echo "Web 地址   : http://<服务器IP>:${APP_PORT}"
    echo "管理员账号 : ${ADMIN_USERNAME}"
    echo "管理员密码 : ${ADMIN_PASSWORD}"
    echo "数据库     : Learn-Workbench（容器 db / 用户 lwb）"
    echo "-----------------------------------------------------"
    echo "请妥善保管，确认后建议删除本文件：rm $CRED_FILE"
  } > "$CRED_FILE"
  chmod 600 "$CRED_FILE"
  info "管理员账号创建完成，凭据已保存到 deploy-credentials.txt（权限 600）"
fi

# ---------------------------------------------------------------- 每日爬虫管线 crontab
# 服务器统一批处理：04:30 抓取（幂等，当天已成功自动跳过）→ 05:40 预聚合 → 06:10 维护
# 宿主机 crontab 通过映射端口触发容器内 /api/internal/cron（x-cron-secret 鉴权）
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
  warn "未检测到 crontab 命令，跳过每日爬虫管线配置（请手动配置）"
fi

# ---------------------------------------------------------------- 汇总
LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
info "======================================================"
info " Docker 部署完成！"
info "  Web 地址 : http://${LOCAL_IP:-<服务器IP>}:${APP_PORT}"
info "  管理员   : $ADMIN_USERNAME（密码见 deploy-credentials.txt）"
info "------------------------------------------------------"
info " 常用命令:"
info "   bash deploy-docker.sh --status    查看容器状态"
info "   bash deploy-docker.sh --restart   重启 web"
info "   bash deploy-docker.sh --stop      停止容器"
info "   bash deploy-docker.sh --logs      查看日志"
info "   docker compose down -v            停止并删除全部（含数据卷，谨慎！）"
info "======================================================"
