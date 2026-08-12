# Learn-Workbench · ICT 学习工作台

ICT 学习路线图追踪 + 学习规划工作台（Web + Android 双端）。

## 当前进度（M0-M4 基础版已完成）
- ✅ **M0 数据层**：PostgreSQL 18.4 本地集群 `.pgdata` + 数据库 `Learn-Workbench`（13 组表 + 内容种子）
- ✅ **M1 工程骨架**：pnpm monorepo（apps/web Next.js 16 + apps/mobile Expo + packages/shared/content/ui）
- ✅ **M2 路线图模块**：Web + 移动端，阶段折叠、主题打勾、进度聚合、资源/项目/验收
- ✅ **M3 仪表盘 + 每日 Bing 背景**：双端仪表盘 + 每日 Bing 壁纸（爬虫 + 双端展示）
- ✅ **M4 任务/专注/日志/设置**：双端基础页 + JSON 导入导出
- ⏳ 后续：P1 云同步（Supabase）、证书/简历/题库、P2 AI

## 快速开始

### 1. 数据库（PostgreSQL）
```powershell
# 启动本地 PostgreSQL（首次需已安装：见下）
powershell -File scripts\start_pg.ps1

# 连接
psql -h 127.0.0.1 -p 5432 -U postgres -d Learn-Workbench
```

### 2. Web 端（Next.js）
```powershell
pnpm install
pnpm web          # http://localhost:3000
```

### 3. 移动端（Expo）
```powershell
pnpm mobile       # 启动 Expo，按 a 打开 Android / w 打开 Web
```

### 4. Bing 每日壁纸
```powershell
# 抓取今天并写入数据库
python scripts\fetch_bing_wallpaper.py --db "host=127.0.0.1 port=5432 dbname=Learn-Workbench user=postgres"

# 注册每日定时任务（管理员）
powershell -ExecutionPolicy Bypass -File scripts\schedule_bing_daily.ps1
```

## 目录结构
```
apps/web       Next.js 16 Web 端（仪表盘/路线图/任务/日志/设置 + API 层）
apps/mobile    Expo 移动端（5 个 Tab 页，本地 AsyncStorage）
packages/shared  zod 类型/工具函数（双端共用）
packages/content 路线图内容数据（与 db/seed_content.sql 同源）
packages/ui      设计 tokens
db/             schema.sql + seed_content.sql + migrations
scripts/       Bing 爬虫 + 数据库启停 + 定时任务
```

详细规划见 [PROJECT_PLAN.md](PROJECT_PLAN.md)。
