# Learn-Workbench · ICT 学习工作台

ICT 学习路线图追踪 + 学习规划工作台（**Web + Android 双端**），Liquid Glass 液态玻璃 UI + 每日 Bing 风景背景。

这是一个面向个人学习管理的全栈应用：内置「ICT 学习规划」等多条职业学习路线，支持按阶段/主题打勾记录进度、每日任务与专注倒计时、学习日志、打卡分享、健康提醒（喝水/站立/休息）、自定义学习内容，以及 Web 与移动端之间的云端数据同步。数据保存在 PostgreSQL，账号密码登录，数据按用户隔离。

## 功能特性

- 📚 **多职业学习路线**：ICT（固定）+ 前端 / Java 后端 / 数据分析 / AI / 网络安全，选择职业即切换路线
- ✅ **路线图追踪**：阶段折叠、主题打勾、进度聚合、资源/项目/验收点、自定义添加学习内容
- 📊 **仪表盘**：所选职业整体进度 + 每日 Bing 风景背景（Python 爬虫每日抓取）
- ⏱️ **专注倒计时**：全屏环形倒计时、三种背景模式、专注打卡分享卡片（分布图/时间轴 + 导出/分享）
- 📝 **任务 / 日志 / 设置**：每日任务、学习日志、密码修改、JSON 导入导出
- 💾 **数据同步**：Web 与移动端数据一致，移动端「一键同步到云端 / 从云端恢复」
- 🧑‍💻 **登录系统**：账号密码登录（scrypt 加密），数据按用户隔离，匿名数据自动认领
- 🖼️ **Liquid Glass UI**：液态玻璃全站设计（blur + saturate + 渐变高光 + 每日一言）

## 技术栈

| 层 | 技术 |
| --- | --- |
| 工程 | pnpm monorepo + Turborepo + Vitest |
| Web 端 | Next.js 16（App Router / Route Handlers）+ React 19 + Tailwind CSS 4 + Zustand + zod |
| 移动端 | Expo SDK 57 / React Native 0.86（5 个 Tab，本地 AsyncStorage + 云同步客户端） |
| 数据层 | PostgreSQL（`db/schema.sql` + `db/seed_content.sql` + `db/migrations/*.sql`） |
| 其他 | Python 3（Bing 壁纸爬虫，仅标准库）、PM2 / Nginx（服务器部署） |

## 目录结构

```
apps/web        Next.js 16 Web 端（登录/仪表盘/路线图/任务/日志/设置/健康 + API 层 + proxy 守卫）
apps/mobile     Expo 移动端（5 个 Tab 页，本地 AsyncStorage + 云同步客户端）
packages/shared   zod 类型 / 工具函数（双端共用）
packages/content  路线图内容数据（与 db/seed_content.sql 同源）
packages/ui        设计 tokens
db/              schema.sql + seed_content.sql + migrations/001~006
scripts/         Bing 爬虫 + 数据库启停 + 管理员账号创建
deploy.sh        服务器一键部署脚本（见下文「服务器部署」）
```

## 当前进度

- ✅ **M0 数据层**：PostgreSQL 18.4 本地集群 `.pgdata` + 数据库 `Learn-Workbench`（业务表 + 内容种子 + 认证表）
- ✅ **M1 工程骨架**：pnpm monorepo（apps/web Next.js 16 + apps/mobile Expo + packages/shared/content/ui）
- ✅ **M2 路线图模块**：双端，阶段折叠、主题打勾、进度聚合、资源/项目/验收、**自定义添加学习内容**
- ✅ **M3 仪表盘 + 每日 Bing 背景**：双端仪表盘 + 每日 Bing 壁纸（爬虫 + 双端展示）
- ✅ **M4 任务/专注/日志/设置**：双端基础页 + JSON 导入导出
- ✅ **M5.5 登录系统**：账号密码登录（账号通过 scripts/create-admin.mjs 创建，不再内置默认密码），数据按用户隔离，匿名数据自动认领
- ✅ **M5.6 自定义内容 + GitHub 记录**：路线图自定义学习内容；仪表盘底部 GitHub 记录卡片
- ✅ **M5.7 数据同步**：Web 与移动端数据一致；移动端「一键同步到云端 / 从云端恢复」
- ✅ **M5.8 Liquid Glass UI**：全站液态玻璃重构（blur 24px + saturate 1.8 + 渐变高光边缘 + 动态文字对比 + 每日一言）
- ✅ **M5.9 职业功能**：ICT（固定）+ 前端 / Java 后端 / 数据分析 / AI / 网络安全，选择职业路线即切换
- ✅ **M5.10 全屏倒计时**：任务页横屏倒计时，4 种数字时钟样式 + 每日一言 + 路线图大类选择 + 分类时长统计
- ✅ **M5.11 账号与日志**：设置页修改密码（登录页不显示默认密码）；日志输入框加大
- ✅ **M5.12 计时界面升级**：Web/移动端全屏居中环形倒计时，三背景模式（纯色/上传/图库），专注打卡分享卡片（分布图/时间轴 + 导出/分享）
- ✅ **M5.13 职业仪表盘**：仪表盘整体进度只统计所选职业；登录后首次进入弹出职业选择小窗
- ⏳ **M6 APK 打包**：`expo prebuild` 已完成，因网络下载 Android SDK 受限暂缓，见 PROJECT_PLAN.md §12
- ⏳ 后续：P1 Supabase 云同步、证书/简历/题库；P2 AI

## 本地开发

环境要求：Node.js ≥ 20、pnpm 11（`corepack enable` 后可用）、PostgreSQL、Python 3。

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

### 2. Web 端（Next.js）

```powershell
pnpm install
pnpm web          # http://localhost:3000（管理员账号通过 scripts/create-admin.mjs 创建）
```

### 3. 移动端（Expo）

```powershell
pnpm mobile       # 启动 Expo，按 a 打开 Android / w 打开 Web
# app.json extra.apiUrl 默认 http://10.0.2.2:3000（Android 模拟器）；真机改为电脑局域网 IP
```

### 4. Bing 每日壁纸

```powershell
python scripts\fetch_bing_wallpaper.py --db "host=127.0.0.1 port=5432 dbname=Learn-Workbench user=postgres"
powershell -ExecutionPolicy Bypass -File scripts\schedule_bing_daily.ps1   # 每日定时（管理员）
```

### 5. 创建管理员账号

```powershell
node scripts\create-admin.mjs --username admin            # 自动生成随机密码并打印一次
node scripts\create-admin.mjs --username admin --password 你的强密码
```

---

## 服务器部署

项目内置一键部署脚本 `deploy.sh`，支持 **Debian / Ubuntu / CentOS / Rocky / AlmaLinux / Fedora**，会自动完成：安装依赖 → 初始化 PostgreSQL → 构建 Web 端 → 创建管理员 → PM2 启动服务。

### 方式一：一键脚本部署（推荐）

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

脚本会依次执行（可重复运行，幂等）：

1. 安装 Node.js 22、pnpm 11.16.0、PostgreSQL、python3、PM2
2. 创建数据库用户 `lwb` 和数据库 `Learn-Workbench`，执行 `db/schema.sql` + `db/seed_content.sql` + `db/migrations/*.sql`
3. `pnpm install` + `pnpm --filter web build` 构建 Web 端
4. 写入 `apps/web/.env.local`（数据库连接配置，已被 .gitignore 忽略）
5. 创建管理员账号（自动生成密码）
6. 用 PM2 启动 Web 服务（端口 3000），并抓取一次今日 Bing 壁纸

部署完成后：

- 浏览器访问 `http://服务器IP:3000`
- 管理员账号密码见项目根目录 `deploy-credentials.txt`（权限 600，确认后建议删除）

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
| APP_PORT | 3000 | Web 服务端口 |
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

示例：自定义端口、自动添加每日壁纸定时任务：

```bash
APP_PORT=8080 SETUP_CRON=1 bash deploy.sh
```

### 方式二：手动部署

如果不想用一键脚本，可按以下步骤手动部署：

```bash
# 1. 安装依赖（Debian/Ubuntu 示例）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get update && sudo apt-get install -y nodejs postgresql postgresql-client python3
sudo npm install -g pnpm@11.16.0 pm2

# 2. 初始化数据库
sudo -u postgres psql -c "CREATE ROLE lwb LOGIN PASSWORD '你的数据库密码';"
sudo -u postgres createdb -O lwb -E UTF8 Learn-Workbench
export PGPASSWORD='你的数据库密码'
psql -h 127.0.0.1 -U lwb -d Learn-Workbench -f db/schema.sql
psql -h 127.0.0.1 -U lwb -d Learn-Workbench -f db/seed_content.sql
for m in db/migrations/*.sql; do psql -h 127.0.0.1 -U lwb -d Learn-Workbench -f "$m"; done

# 3. 安装依赖并构建
pnpm install
pnpm --filter web build

# 4. 写入 Web 端环境变量（apps/web/.env.local）
#    PGHOST=127.0.0.1
#    PGPORT=5432
#    PGDATABASE=Learn-Workbench
#    PGUSER=lwb
#    PGPASSWORD=你的数据库密码

# 5. 启动（PM2）
cd apps/web
pm2 start node_modules/next/dist/bin/next --name learn-workbench -- start -p 3000
pm2 save

# 6. 创建管理员账号
ADMIN_USERNAME=admin ADMIN_PASSWORD='你的管理员密码' \
PGHOST=127.0.0.1 PGDATABASE=Learn-Workbench PGUSER=lwb PGPASSWORD='你的数据库密码' \
node scripts/create-admin.mjs
```

### Nginx 反向代理 + HTTPS

用域名访问时配置 Nginx（把 `your-domain.com` 和端口改成实际的）：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
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

### 数据备份

```bash
# 备份
pg_dump -h 127.0.0.1 -U lwb -d Learn-Workbench -Fc -f learn-workbench-$(date +%F).dump

# 恢复
pg_restore -h 127.0.0.1 -U lwb -d Learn-Workbench --clean --if-exists learn-workbench-2026-08-16.dump
```

### 常见问题（FAQ）

- **端口被占用**：改 `APP_PORT=8080 bash deploy.sh`，或先停掉占用端口的进程。
- **服务器访问不了 3000 端口**：检查云厂商安全组 / 防火墙（`ufw allow 3000` 或安全组放行）。
- **PM2 开机自启**：执行 `pm2 startup`，并按提示用 root 运行它输出的命令。
- **重复运行 deploy.sh**：数据库已初始化会跳过 schema/seed/migrations（用 `app_meta` 中的 `deploy_init` 标记）；已存在的管理员账号不会被重置。
- **新增了 migration 文件**：手动执行 `psql -h 127.0.0.1 -U lwb -d Learn-Workbench -f db/migrations/00X_xxx.sql`。
- **Bing 壁纸抓不到**：服务器需能访问 `www.bing.com`；也可在 Web 端「设置」里手动触发，或运行 `python3 scripts/fetch_bing_wallpaper.py`。
- **数据库连接失败**：确认 `apps/web/.env.local` 里的 `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` 与部署时一致。

## 相关文档

- [PROJECT_PLAN.md](PROJECT_PLAN.md) —— 详细规划、APK 打包指南（含 commandlinetools 版本说明）
- [后台管理系统设计方案.md](后台管理系统设计方案.md) —— 后台管理设计
- [docs/ui-redesign-proposal.md](docs/ui-redesign-proposal.md) —— UI 改版方案
