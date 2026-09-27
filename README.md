# Learn-Workbench · ICT 学习工作台

集 **学习路线图、每日任务与专注计时、习惯与健康、求职工作台** 于一体的个人成长全栈应用（**Web + Android 双端**），Liquid Glass 液态玻璃 UI + 每日 Bing 风景背景。

内置「ICT 学习规划」等多条职业学习路线，支持按阶段/主题打勾记录进度；每日任务、全屏专注倒计时、学习日志；习惯打卡与饮水/饮食/体重/训练记录；招聘信息每日抓取（卡片流 + 收藏）、面试题库、简历管理；运动档案图鉴与闪光卡。数据保存在 PostgreSQL，账号密码登录，数据按用户隔离，Web 与移动端云端同步。

## 功能特性

- 📚 **多职业学习路线**：ICT（固定）+ 前端 / Java 后端 / 数据分析 / AI / 网络安全；阶段折叠、主题打勾、进度聚合、资源/项目/验收点、自定义学习内容、大阶段拖拽排序（自动更名 P1/P2/…）
- ✅ **任务 / 专注 / 日志**：每日任务、全屏环形专注倒计时（三背景模式、前台服务保活 + 圆环通知）、专注打卡分享卡片（分布图/时间轴 + 导出/分享）、学习日志、JSON 导入导出
- 💪 **习惯与健康**：习惯打卡与热力趋势、饮水/饮食/体重记录（全局食物营养库 + 自建基准库）、训练动作库、3D 状态球健康总览、健康提醒（喝水/站立/休息）
- 💼 **求职工作台**：每日定时爬取招聘信息（官方信息源 + 互联网平台，Node 双引擎），卡片流 + 详情 + 收藏；面试题库；简历管理（文件上 COS）
- 🏸 **运动档案**：羽毛球/网球等多项目档案图鉴、装备图库、闪光卡（3D 卡面 + 荣誉墙）与公开分享页
- 💾 **数据同步**：Web 与移动端数据一致，移动端「一键同步到云端 / 从云端恢复」；匿名数据登录后自动认领
- 🧑‍💻 **账号系统**：注册 / 登录（scrypt 加密）/ 修改密码，数据按用户隔离
- 🤖 **AI 建议**（可选）：`/api/ai/tip` 环境变量门控（`AI_API_KEY`），未配置自动回落规则版
- 📲 **应用内升级**：安卓 APK OTA 升级（进度条 + sha256 校验），下载页 <https://learn.yuanabd.cn/download.html>
- 🖼️ **Liquid Glass UI**：液态玻璃全站设计（blur + saturate + 渐变高光 + 每日一言），深浅色双主题

## 技术架构

| 层 | 技术 |
| --- | --- |
| 工程 | pnpm monorepo（pnpm 11）+ Turborepo + Vitest + Playwright（e2e） |
| Web 端 | Next.js 16（App Router / Route Handlers）+ React 19 + Tailwind CSS 4 + Zustand + zod |
| 移动端 | Expo SDK 57 / React Native 0.86（5 个 Tab：今日 / 学习 / 职业 / 健康 / 我的，本地 AsyncStorage + 云同步客户端 + OTA） |
| 数据层 | PostgreSQL（`db/schema.sql` + `db/seed_content.sql` + `db/migrations/001~057`） |
| 爬虫 | Node 双引擎（http 引擎 + Playwright 过 WAF）：招聘 / 面试题库 / 装备图库；Python 3 Bing 壁纸（仅标准库） |
| 部署 | PM2 / Nginx 或 Docker Compose（db + init + web）；每日数据管线：宿主机 crontab → `POST /api/internal/cron?job=crawl\|aggregate\|backfill\|maintenance\|interview\|food`（`x-cron-secret` 鉴权） |

### 目录结构

```
apps/web            Next.js 16 Web 端（登录/仪表盘/路线图/任务/习惯/健康/求职 + API 层 + proxy 守卫）
apps/mobile         Expo 移动端（今日/学习/职业/健康/我的 5 个 Tab + OTA 应用内升级）
packages/shared     zod 类型 / 工具函数（双端共用）
packages/content    路线图内容数据（与 db/seed_content.sql 同源）
packages/ui         设计 tokens
packages/config     配置常量
e2e/                Playwright 回归测试
db/                 schema.sql + seed_content.sql + migrations/001~057
scripts/            招聘/题库/装备爬虫、Bing 壁纸爬虫、数据库启停与 schema 校验、字阶护栏、管理员创建
deploy/             Nginx 配置模板
deploy.sh           服务器一键部署脚本（Node + PostgreSQL + PM2）
deploy-docker.sh    Docker 一键部署脚本（docker-compose 包装）
Dockerfile          Web 端 Docker 镜像（多阶段构建）
docker-compose.yml  Docker 编排（db + init + web）
docs/               改动记录与任务看板、第三方许可/署名、上架素材
```

项目规则与协作约定见 [CLAUDE.md](CLAUDE.md)；各工作区的详细说明见各目录内 `CLAUDE.md`。

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

脚本会自动：生成数据库密码与管理员密码 → 写入 `.env` → `docker compose up -d --build` 构建并启动 `db + init + web` 三个容器 → 初始化数据库（幂等）→ 创建管理员账号（密码保存到 `deploy-credentials.txt`）→ 等待 Web 就绪并打印访问地址。

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

### 数据备份（非 Docker 部署）

```bash
# 备份
pg_dump -h 127.0.0.1 -U lwb -d Learn-Workbench -Fc -f learn-workbench-$(date +%F).dump

# 恢复
pg_restore -h 127.0.0.1 -U lwb -d Learn-Workbench --clean --if-exists learn-workbench-2026-08-16.dump
```

### 常见问题（FAQ）

- **端口被占用**：改 `APP_PORT=8080 bash deploy.sh`，或先停掉占用端口的进程。
- **服务器访问不了 3001 端口**：检查云厂商安全组 / 防火墙（`ufw allow 3001` 或安全组放行）。
- **PM2 开机自启**：执行 `pm2 startup`，并按提示用 root 运行它输出的命令。
- **重复运行 deploy.sh**：数据库已初始化会跳过 schema/seed/migrations（用 `app_meta` 中的 `deploy_init` 标记）；已存在的管理员账号不会被重置。
- **新增了 migration 文件**：手动执行 `psql -h 127.0.0.1 -U lwb -d Learn-Workbench -f db/migrations/00X_xxx.sql`。
- **Bing 壁纸抓不到**：服务器需能访问 `www.bing.com`；也可在 Web 端「设置」里手动触发，或运行 `python3 scripts/fetch_bing_wallpaper.py`。
- **pnpm 报错 `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`**：服务器 Node 版本太老，升级到 Node 22.13+（`bash deploy.sh` 已会自动处理）。
- **依赖下载慢**：默认已启用淘宝镜像（`NPM_REGISTRY` 可覆盖）；Docker 部署还可在 Docker daemon 配置 `registry-mirrors` 加速拉取基础镜像。
- **数据库连接失败**：确认 `apps/web/.env.local` 里的 `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` 与部署时一致。

## 相关文档

- [CLAUDE.md](CLAUDE.md) —— 项目规则与协作约定（新会话先读）
- [docs/改动记录与任务看板.md](docs/改动记录与任务看板.md) —— 改动明细、任务看板、踩坑清单（活文档，持续更新）
- [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md) —— 第三方许可记录
- [docs/第三方UI来源与署名.md](docs/第三方UI来源与署名.md) —— UI 技法来源与署名
- [docs/APP端上架素材与隐私说明.md](docs/APP端上架素材与隐私说明.md) —— 安卓市场送审素材（上架前需更新版本信息）
