# =============================================================================
# Learn-Workbench · ICT 学习工作台 —— Web 端（Next.js）Docker 镜像
# 多阶段构建：deps（安装依赖）→ builder（构建）→ runtime（运行）
# 构建：docker build -t learn-workbench-web .
# =============================================================================

# ---------- 基础镜像 ----------
FROM node:22-slim AS base
# 构建参数：npm/pnpm 镜像源（默认淘宝 npmmirror，国内加速；可 --build-arg NPM_REGISTRY=... 覆盖）
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=$NPM_REGISTRY
# 固定 pnpm 版本（与 package.json 的 packageManager 一致）
RUN npm install -g pnpm@11.16.0 --registry="$NPM_REGISTRY"
WORKDIR /app

# ---------- 依赖层：只安装 web 及其工作区依赖，便于缓存 ----------
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/content/package.json packages/content/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter "web..." || pnpm install --filter "web..."

# ---------- 构建层 ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

# ---------- 运行层 ----------
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
# python3：Bing 每日壁纸爬虫依赖（可选功能）；curl：便于容器内排障
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app ./
WORKDIR /app/apps/web
EXPOSE 3001
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3001"]
