# Learn-Workbench · ICT 学习工作台

集 **学习路线图、每日任务与专注计时、习惯与健康、求职工作台** 于一体的个人成长全栈应用（**Web + Android 双端**），Liquid Glass 液态玻璃 UI + 每日 Bing 风景背景。

内置「ICT 学习规划」等多条职业学习路线，支持按阶段/主题打勾记录进度；每日任务、全屏专注倒计时、学习日志；习惯打卡与饮水/饮食/体重/训练记录；招聘信息每日抓取（卡片流 + 收藏）、面试题库、简历管理；运动档案图鉴与闪光卡。数据保存在 PostgreSQL，账号密码登录，数据按用户隔离；匿名设备数据登录后自动认领。按用户隔离，Web 与移动端云端同步。

## 功能特性

- 📚 **多职业学习路线**：ICT（固定）+ 前端 / Java 后端 / 数据分析 / AI / 网络安全；阶段折叠、主题打勾、进度聚合、资源/项目/验收点、自定义学习内容、大阶段拖拽排序（自动更名 P1/P2/…）
- ✅ **任务 / 专注 / 日志**：每日任务、全屏环形专注倒计时（三背景模式、前台服务保活 + 圆环通知）、专注打卡分享卡片（分布图/时间轴 + 导出/分享）、学习日志、JSON 导入导出
- 🧠 **学习与复习**：技术题库、知识点阅读、408 考研专区、练习记录与 SM-2 间隔复习；服务端同时运行 FSRS 影子双跑评估，但到期时间仍由 SM-2 决定
- 💪 **习惯与健康**：习惯打卡与热力趋势、饮水/饮食/体重记录（全局食物营养库 + 自建基准库）、训练动作库、3D 状态球健康总览、健康提醒（喝水/站立/休息）
- 💼 **求职工作台**：每日定时爬取招聘信息（官方信息源 + 互联网平台，Node 双引擎），卡片流 + 详情 + 收藏；面试题库；简历管理（文件上 COS）
- 🏸 **运动档案**：羽毛球/网球等多项目档案图鉴、装备图库、闪光卡（3D 卡面 + 荣誉墙）与公开分享页
- 💾 **数据同步**：Web 与移动端数据一致，移动端「一键同步到云端 / 从云端恢复」；匿名数据登录后自动认领
- 🧑‍💻 **账号系统**：注册 / 登录（scrypt 加密）/ 修改密码，数据按用户隔离
- 🤖 **AI 建议**（可选）：`/api/ai/tip` 环境变量门控（`AI_API_KEY`），未配置自动回落规则版
- 📲 **应用内升级**：安卓 APK OTA 升级（清单 Ed25519 签名验签 + sha256 必填 + 按设备灰度 + 最低支持版本），下载页 <https://learn.yuanabd.cn/download.html>
- 🖼️ **Liquid Glass UI**：液态玻璃全站设计（blur + saturate + 渐变高光 + 每日一言），深浅色双主题

## 技术架构

| 层 | 技术 |
| --- | --- |
| 工程 | pnpm monorepo（pnpm 11）+ Turborepo + Vitest + Playwright（e2e） |
| Web 端 | Next.js 16（App Router / Route Handlers / RSC）+ React 19 + Tailwind CSS 4 + Zustand |
| 移动端 | Expo SDK 57 / React Native 0.86（5 个 Tab：今日 / 学习 / 职业 / 健康 / 我的，本地持久化 + 同步协议 v2 + 签名 OTA） |
| 数据层 | PostgreSQL 16（`db/schema.sql` + `db/seed_content.sql` + `db/migrations/001~081`，迁移台账带 checksum） |
| 爬虫 | Node 双引擎（http 引擎 + Playwright 过 WAF）：招聘 / 面试题库 / 装备图库；Python 3 Bing 壁纸（仅标准库） |
| 部署 | Docker Compose（db + init + web，web 非 root）+ Nginx/HTTPS；镜像化发布：GHCR workflow + 一键回滚（`deploy/host/rollback-web.sh`）。历史 PM2 路径保留作逃生。每日数据管线：宿主机 crontab → `POST /api/internal/cron?job=crawl\|aggregate\|backfill\|maintenance\|interview\|food`（`x-cron-secret` 鉴权） |
| 可观测 | `/api/health`（DB 探活 + 迁移版本）、`/api/internal/metrics`（进程/连接池/请求计数）、Web Vitals 聚合、`scripts/alert-check.mjs` 四规则告警、三类演练脚本 |

### 目录结构

```
apps/web            Next.js 16 Web 端（登录/仪表盘/路线图/任务/习惯/健康/求职 + API 层 + proxy 守卫）
apps/mobile         Expo 移动端（今日/学习/职业/健康/我的 5 个 Tab + OTA 应用内升级）
packages/shared     zod 类型 / 工具函数（双端共用）
packages/content    路线图内容数据（与 db/seed_content.sql 同源）
packages/ui         设计 tokens
packages/config     配置常量
e2e/                Playwright 回归测试
db/                 schema.sql + seed_content.sql + migrations/001~081（migrations 只追加，含 down/）
scripts/            爬虫、内容同步、迁移执行器(migrate.mjs)、备份/恢复演练、告警检查、发布与门禁脚本
deploy/             部署说明 + 宿主资产快照（ops/：crontab/nginx/备份/磁盘清理/COSFS）+ 回滚与发布脚本
deploy.sh           历史一键部署（Node + PostgreSQL + PM2，逃生路径）
deploy-docker.sh    Docker 一键部署：磁盘闸门 → 备份 → 构建 → 迁移 → up（幂等）
docker-compose.prod.yml  生产覆盖层：用不可变镜像 + 一键回滚
Dockerfile          Web 镜像（node:24-slim，多阶段，非 root，HEALTHCHECK）
docker-compose.yml  Docker 编排（db + init + web，web 健康检查）
content-platform/   ADR、API 契约、索引台账、阶段报告（仅本地保留，不入 Git）
```

本仓库的 Git 只保留 README；架构设计、ADR、改动记录、运行手册、阶段报告和发布取证继续保存在本地工作区，但不会上传 GitHub。

## 本地开发

环境要求：Node.js ≥ 22.13（pnpm 11 依赖内置 `node:sqlite` 模块）、pnpm 11（`corepack enable` 后可用）、PostgreSQL、Python 3。

### 1. 数据库（PostgreSQL）

本地开发使用项目内 conda 安装的 PostgreSQL 集群（`.pgdata`）：

```powershell
powershell -File scripts\start_pg.ps1     # 启动本地 PostgreSQL
psql -h 127.0.0.1 -p 5432 -U postgres -d Learn-Workbench
```

数据库连接默认值（可通过环境变量 `PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD` 覆盖）：

| 变量 | 默认值 |
| --- | --- |
| PGHOST | 127.0.0.1 |
| PGPORT | 5432 |
| PGDATABASE | Learn-Workbench |
| PGUSER | postgres |
| PGPASSWORD | （空，本地 trust 认证） |

改动 `db/schema.sql` 或 `db/migrations/` 后跑 `node scripts/check-schema-fresh.mjs`（对空库全量回放，报告漂移）。

### 2. Web 端（Next.js）

```powershell
pnpm install
pnpm web          # http://localhost:3001
```

### 3. 移动端（Expo）

```powershell
pnpm mobile       # 启动 Expo，按 a 打开 Android / w 打开 Web
# app.json extra.apiUrl 默认 http://10.0.2.2:3001（Android 模拟器）；真机改为电脑局域网 IP
```

### 4. 创建管理员账号

```powershell
node scripts\create-admin.mjs --username admin            # 自动生成随机密码并打印一次
node scripts\create-admin.mjs --username admin --password 你的强密码
```

### 5. Bing 每日壁纸

```powershell
python scripts\fetch_bing_wallpaper.py --db "host=127.0.0.1 port=5432 dbname=Learn-Workbench user=postgres"
powershell -ExecutionPolicy Bypass -File scripts\schedule_bing_daily.ps1   # 每日定时（管理员）
```

### 6. 招聘信息爬虫（Node 双引擎）

```bash
# 官方信息源（考公/考编/央国企）：http 引擎 + Playwright 浏览器引擎 + iguopin API
node scripts/jobs_official.mjs [--sources a,b] [--limit 20] [--dry-run]
# 互联网平台（拉勾/猎聘/智联/前程无忧）：Playwright 真实浏览器过 WAF
node scripts/jobs_browser.mjs [--limit 60] [--dry-run]
```

关键参数：`--dry-run`（不写库）、`--limit`、`--proxy http://user:pass@host:port`（住宅/干净代理，环境变量 `JOBS_PROXY`）、`--storage-state`（登录态 Cookie 文件，环境变量 `JOBS_STORAGE_STATE`，含会话勿提交）。

> ⚠️ 云服务器 IP 会被 51job/智联 WAF 标记返回空，需住宅/干净代理；猎聘对自动化浏览器识别最严，需登录态或接受部分缺失。官方源 hosts 注册表：`config/job-hosts/sources.json` → `node scripts/update_job_hosts.mjs` 落库。服务器上由每日 crontab 触发（也可在 Web 端「立即抓取」，管理员权限）。

---

## 服务器部署

项目内置两种一键部署方式：

- **`deploy.sh`（直接部署）**：支持 **Debian / Ubuntu / CentOS / Rocky / AlmaLinux / Fedora**，自动完成：安装依赖 → 初始化 PostgreSQL → 构建 Web 端 → 创建管理员 → PM2 启动服务；已安装的工具会自动跳过下载。
- **`deploy-docker.sh`（Docker 部署）**：服务器只需装好 Docker + Compose v2，一条命令容器化运行。

### 方式一：一键脚本部署

#### 1. 上传项目到服务器

将项目上传到服务器（例如 `/opt/learn-workbench`），**不要**上传本地目录：`node_modules`、`.git`、`.pgdata`、`.tools`、`.backup`、`.local`、`coverage`、`dist`。

```bash
# 本地（示例）：
rsync -av --exclude node_modules --exclude .git --exclude .pgdata --exclude .tools \
      --exclude .backup --exclude .local --exclude coverage --exclude dist \
      ./ root@你的服务器IP:/opt/learn-workbench/
```

> 注意：`pnpm-lock.yaml`、`apps/`、`packages/`、`db/`、`scripts/`、`deploy.sh` 必须上传。

#### 2. 一键运行

```bash
cd /opt/learn-workbench
bash deploy.sh
```

脚本会依次执行（幂等，可重复运行）：

1. 安装 Node.js 22、pnpm 11.16.0、PostgreSQL、python3、PM2
2. 创建数据库用户 `lwb` 和数据库 `Learn-Workbench`，执行 `db/schema.sql` + `db/seed_content.sql` + `db/migrations/*.sql`
3. `pnpm install` + `pnpm --filter web build` 构建 Web 端
4. 写入 `apps/web/.env.local`（数据库连接配置，已被 .gitignore 忽略）
5. 创建管理员账号（自动生成密码）
6. 用 PM2 启动 Web 服务（端口 3001），并抓取一次今日 Bing 壁纸

部署完成后：浏览器访问 `http://服务器IP:3001`；管理员账号密码见项目根目录 `deploy-credentials.txt`（权限 600，确认后建议删除）。

#### 3. 常用命令

```bash
bash deploy.sh --status     # 查看服务状态
bash deploy.sh --restart    # 重启 Web 服务
bash deploy.sh --stop       # 停止 Web 服务
bash deploy.sh --logs       # 查看 Web 服务日志
bash deploy.sh --help       # 查看帮助
```

#### 4. 可配置环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| APP_PORT | 3001 | Web 服务端口 |
| PG_HOST | 127.0.0.1 | PostgreSQL 地址 |
| PG_PORT | 5432 | PostgreSQL 端口 |
| PG_DB | Learn-Workbench | 数据库名 |
| PG_USER | lwb | 应用数据库用户（自动创建） |
| PG_PASSWORD | 自动生成 | 数据库用户密码 |
| ADMIN_USERNAME | admin | 管理员用户名 |
| ADMIN_PASSWORD | 自动生成 | 管理员密码（留空自动生成） |
| PROCESS_MANAGER | pm2 | pm2 或 nohup |
| FETCH_BING | 1 | 部署后是否抓取今日 Bing 壁纸（0/1） |
| SETUP_CRON | 0 | 是否添加每日 6 点抓取 Bing 壁纸的 crontab（0/1） |
| SKIP_DEPS | 0 | 跳过系统依赖安装（0/1） |
| SKIP_BUILD | 0 | 跳过构建（0/1） |
| NPM_REGISTRY | https://registry.npmmirror.com | npm/pnpm 镜像源（国内加速，改官方源：https://registry.npmjs.org） |

示例：自定义端口、自动添加每日壁纸定时任务：`APP_PORT=8080 SETUP_CRON=1 bash deploy.sh`

### 方式二：Docker 部署（推荐新服务器）

不需要手动装 Node / PostgreSQL，容器化一条命令跑起来（需要服务器已安装 **Docker + Compose v2 插件**，并让当前用户有 docker 权限，例如 `sudo usermod -aG docker 你的用户名` 后重新登录）。

```bash
cd /opt/learn-workbench
bash deploy-docker.sh
```

脚本会自动（幂等，可重复执行）：**磁盘闸门**（根盘 <30GiB 自动清构建缓存，清理后仍 <20GiB 直接中止）→ 生成/复用数据库密码与管理员密码 → 写入 `.env` → **迁移前备份**（失败即中止）→ 构建镜像 → 运行统一迁移执行器 `scripts/migrate.mjs`（逐文件台账 + checksum + 单事务）→ `up -d` 启动 `db + init + web` → 创建管理员账号（`deploy-credentials.txt`）→ 等待 `/api/health` 通过并打印访问地址与最近备份。

发布后检查：`curl -fsS http://127.0.0.1:3001/api/health`（应 200 且 `migrations` 为最新迁移文件）；容器应为 `healthy`（compose/Dockerfile 双探活）。

升级与回滚（推荐走镜像，不在服务器现场构建）：

```bash
# CI：推 v* tag 或手动触发 Deploy Image (GHCR) → 生成 ghcr.io/<owner>/learn-workbench-web:<sha>
# 服务器一次性登录：echo <PAT> | docker login ghcr.io -u <user> --password-stdin
WEB_IMAGE=ghcr.io/<owner>/learn-workbench-web:<sha> bash deploy/host/pull-and-up.sh
bash deploy/host/rollback-web.sh <上一版本 sha|tag>   # 本地/远端镜像 + 健康检查，失败 exit 1
```

常用命令：

```bash
bash deploy-docker.sh --status     # 查看容器状态
bash deploy-docker.sh --restart    # 重启 web
bash deploy-docker.sh --stop       # 停止容器（保留数据）
bash deploy-docker.sh --down       # 停止并删除容器（保留数据卷）
bash deploy-docker.sh --logs       # 查看 web 日志
```

可配置环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| APP_PORT | 3001 | Web 对外端口 |
| PG_PASSWORD | 自动生成 | PostgreSQL 密码 |
| ADMIN_USERNAME | admin | 管理员用户名 |
| ADMIN_PASSWORD | 自动生成 | 管理员密码 |
| NPM_REGISTRY | https://registry.npmmirror.com | npm/pnpm 镜像源（构建时下载加速） |
| APP_VERSION | git short sha | 写入 /api/health 的版本号（部署脚本自动取） |
| WEB_IMAGE | — | 配合 `docker-compose.prod.yml`：指定不可变镜像 tag（镜像化发布/回滚） |

数据持久化与备份：

- 数据卷：`pgdata`（PostgreSQL 数据）、`bing`（每日 Bing 壁纸）；删除/重建容器不丢数据。
- 备份数据库：

```bash
docker compose exec -T db pg_dump -U lwb -d Learn-Workbench -Fc -f /tmp/lwb.dump
docker compose cp db:/tmp/lwb.dump ./lwb.dump
```

- 彻底删除（含数据卷，谨慎）：`docker compose down -v`
- 手动 compose：`export PG_PASSWORD=你的数据库密码 && docker compose up -d --build`

> 提示：手机端 app.json 的 `extra.apiUrl` 需指向服务器：`http://<服务器IP>:<APP_PORT>`。

### Nginx 反向代理 + HTTPS

当前生产：**https://learn.yuanabd.cn**（Nginx 反代 127.0.0.1:3001，配置模板见 `deploy/nginx/`）。

用域名访问时配置 Nginx（把 `your-domain.com` 和端口改成实际的）：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

HTTPS 可用 Let's Encrypt 免费证书：

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 备份与恢复演练

统一入口（自动 sha256 + `pg_restore --list` 自检 + 保留周期 + 机读 `BACKUP_OK` 行）：

```bash
bash scripts/backup-db.sh                        # 默认写 /data/learn-workbench/backups（COSFS）
BACKUP_TARGET=local bash scripts/backup-db.sh    # 写本地盘
BACKUP_MODE=docker bash scripts/backup-db.sh     # 宿主机无 pg 客户端时走 db 容器
node scripts/restore-drill.mjs --latest /data/learn-workbench/backups   # 恢复演练（临时库，自动 DROP）
bash deploy/host/restore-drill-docker.sh         # docker 环境演练（db 容器内 pg_restore，版本一致）
```

**磁盘红线**：`/data` 是 COSFS 挂载（`ensure_diskfree=10240`），根盘可用 <10GiB 时 `/data` 写入会 EIO（上传/备份一起失败）。发布前根盘 **≥20GiB**，构建前先 `docker builder prune -af`（`deploy-docker.sh` 已内置该闸门）。

### 质量门禁

合并/发布前（CI 与本地同一套）：

```bash
pnpm -F web typecheck && pnpm -F web lint && pnpm -F web test
pnpm -F mobile typecheck && pnpm -F mobile test
node scripts/check-schema-fresh.mjs && node scripts/migration-drill.mjs   # 改 db 时
node scripts/api-inventory.mjs --check                                   # 改 route 时
node scripts/check-bundle-budget.mjs --check                             # 首载体积预算（需先 build）
node scripts/check-anon-tables.mjs && node scripts/check-worklet-calls.mjs
node scripts/check-font-scale.mjs && node scripts/check-mobile-ui-matrix.mjs && node scripts/check-motion-budget.mjs
node scripts/mobile-sync-matrix.mjs && node scripts/sync-parity.mjs      # 同步一致性
pnpm test:scripts                                                        # 上面大部分脚本 + 内容/发布/迁移门禁
node scripts/drill.mjs                                                   # 备份/回滚/告警 三类演练（S7）
```

### 常见问题（FAQ）

- **端口被占用**：改 `APP_PORT=8080 bash deploy.sh`，或先停掉占用端口的进程。
- **服务器访问不了 3001 端口**：检查云厂商安全组 / 防火墙（`ufw allow 3001` 或安全组放行）。
- **PM2 开机自启**：执行 `pm2 startup`，并按提示用 root 运行它输出的命令。
- **重复运行 deploy.sh**：数据库已初始化会跳过 schema/seed/migrations（用 `app_meta` 中的 `deploy_init` 标记）；已存在的管理员账号不会被重置。
- **新增了 migration 文件**：不要手写 psql 逐条执行，统一跑 `node scripts/migrate.mjs`（单事务 + 台账 checksum + 迁移前自动备份）；docker 环境用 `docker compose run --rm -T web node /app/scripts/migrate.mjs`。已应用的迁移文件**禁止修改**（checksum 不一致会直接失败），要改结构请新增迁移。
- **构建/发布时磁盘打满**：先 `docker builder prune -af` + 清理旧镜像（保留最近一代 `pre-*`）；根盘 <20GiB 时 `deploy-docker.sh` 会中止。COSFS 掉挂载时 `/data` 写入报 EIO，用 `dd if=/dev/zero of=/data/learn-workbench/.probe bs=1M count=4` 自检。
- **服务异常/更新失败如何回滚**：`bash deploy/host/rollback-web.sh <上一版本 sha|tag>`（自动健康检查，失败 exit 1）；数据库迁移回滚用 `db/migrations/down/` 或备份恢复（见备份演练）。
- **Bing 壁纸抓不到**：服务器需能访问 `www.bing.com`；也可在 Web 端「设置」里手动触发，或运行 `python3 scripts/fetch_bing_wallpaper.py`。
- **pnpm 报错 `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`**：服务器 Node 版本太老，升级到 Node 22.13+（`bash deploy.sh` 已会自动处理）。
- **依赖下载慢**：默认已启用淘宝镜像（`NPM_REGISTRY` 可覆盖）；Docker 部署还可在 Docker daemon 配置 `registry-mirrors` 加速拉取基础镜像。
- **数据库连接失败**：确认 `apps/web/.env.local` 里的 `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` 与部署时一致。

## 文档策略

- Git 仓库只保留 `README.md`，用于项目介绍、技术栈、安装部署和常用命令。
- 架构设计、ADR、改动记录、运行手册、发布清单、阶段报告等文档只保存在本地工作区，默认被 `.gitignore` 忽略，不会上传 GitHub。
- 后续新增文档也遵循同一规则；如果文档需要对外发布，应先把稳定结论回写到 README，再单独评估是否将文档放入其他发布渠道。
