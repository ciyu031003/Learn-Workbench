# =============================================================================
# Learn-Workbench · ICT 学习工作台 —— Web 端（Next.js）Docker 镜像
# 多阶段构建：deps（安装依赖）→ builder（构建）→ runtime（运行）
# 构建：docker build -t learn-workbench-web .
# =============================================================================

# ---------- 基础镜像 ----------
FROM node:24-slim AS base
# 构建参数：npm/pnpm 镜像源（默认淘宝 npmmirror，国内加速；可 --build-arg NPM_REGISTRY=... 覆盖）
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=$NPM_REGISTRY
# 固定 pnpm 版本（与 package.json 的 packageManager 一致）
RUN npm install -g pnpm@11.16.0 --registry="$NPM_REGISTRY"
WORKDIR /app

# ---------- 依赖层：只安装 web 及其工作区依赖，便于缓存 ----------
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY .npmrc .npmrc
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/content/package.json packages/content/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile || pnpm install

# ---------- 构建层 ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd /app/apps/web && node /app/node_modules/next/dist/bin/next build

# ---------- 运行层 ----------
FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
# python3：Bing 壁纸爬虫 + 招花招聘爬虫依赖；postgresql-client：爬虫经 psql 写库；curl：排障
# 国内镜像：apt 源替换为腾讯云镜像（加速 + 避免 deb.debian.org 卡顿），npm/pnpm 已用 npmmirror
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true \
    && apt-get update \
    && apt-get install -y --no-install-recommends python3 postgresql-client curl ca-certificates chromium fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
# 版本元信息（供 /api/health 与排障使用；构建时 --build-arg APP_VERSION=<tag> 覆盖）
ARG APP_VERSION=0.0.0-dev
ENV APP_VERSION=$APP_VERSION

WORKDIR /app
COPY --from=builder /app ./
# Next 运行时会在 .next/cache 下写图片/ISR 缓存：交给非 root 用户，否则会 EACCES
RUN mkdir -p /app/apps/web/.next/cache /app/public/uploads /app/public/private \
    && chown -R node:node /app/apps/web/.next /app/public/uploads /app/public/private
WORKDIR /app/apps/web
EXPOSE 3001
# S4-2：容器级探活（与 compose healthcheck 二选一，二者都保留便于本地 docker run 也能探活）
HEALTHCHECK --interval=20s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/api/health || exit 1
# S4-4：非 root 运行（node 用户 uid=1000，与宿主机 ubuntu 的 uid 对齐，挂载目录可写）
USER node
CMD ["node", "/app/node_modules/next/dist/bin/next", "start", "-p", "3001"]
