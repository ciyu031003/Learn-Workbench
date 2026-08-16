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
#    APP_PORT=3000          Web 对外端口
#    NPM_REGISTRY=https://registry.npmmirror.com   npm/pnpm 镜像源（构建时下载加速，可改官方源）
#    PG_PASSWORD=<自动生成>  PostgreSQL 密码
#    ADMIN_USERNAME=admin   管理员用户名
#    ADMIN_PASSWORD=<自动生成> 管理员密码
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

APP_PORT="${APP_PORT:-3000}"
PG_PASSWORD="${PG_PASSWORD:-}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
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

# ---------------------------------------------------------------- 生成密码
if [ -z "$PG_PASSWORD" ]; then
  PG_PASSWORD="$(gen_password)"
  info "已生成数据库密码（见 .env）"
fi
if [ -z "$ADMIN_PASSWORD" ]; then
  ADMIN_PASSWORD="$(gen_password)"
  info "已生成管理员密码（见 deploy-credentials.txt）"
fi

# ---------------------------------------------------------------- 写入 .env
cat > .env << EOF
# 由 deploy-docker.sh 自动生成，请勿提交到 Git（已在 .gitignore 中）
PG_PASSWORD=$PG_PASSWORD
APP_PORT=$APP_PORT
NPM_REGISTRY=$NPM_REGISTRY
EOF
chmod 600 .env
info "已写入 .env（权限 600）"

# ---------------------------------------------------------------- 构建并启动
info "======================================================"
info " 构建并启动容器（db + init + web）..."
info "======================================================"
# 移除上一次的一次性 init 容器，确保本次重新执行初始化（幂等，已初始化会跳过）
docker compose rm -sf init >/dev/null 2>&1 || true
docker compose up -d --build

# ---------------------------------------------------------------- 等待 Web 就绪
info "等待 Web 服务就绪 (http://127.0.0.1:$APP_PORT) ..."
i=0
until http_ok; do
  i=$((i+1))
  if [ "$i" -ge 60 ]; then
    warn "等待超时（约 2 分钟），请查看日志：bash deploy-docker.sh --logs"
    docker compose ps
    exit 1
  fi
  sleep 2
done
info "Web 服务已就绪"

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