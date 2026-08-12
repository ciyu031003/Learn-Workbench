# Learn-Workbench · ICT 学习工作台

ICT 学习路线图追踪 + 学习规划工作台（Web + Android 双端），Liquid Glass 液态玻璃 UI + 每日 Bing 风景背景。

## 当前进度
- ✅ **M0 数据层**：PostgreSQL 18.4 本地集群 `.pgdata` + 数据库 `Learn-Workbench`（业务表 + 内容种子 + 认证表）
- ✅ **M1 工程骨架**：pnpm monorepo（apps/web Next.js 16 + apps/mobile Expo + packages/shared/content/ui）
- ✅ **M2 路线图模块**：双端，阶段折叠、主题打勾、进度聚合、资源/项目/验收、**自定义添加学习内容**
- ✅ **M3 仪表盘 + 每日 Bing 背景**：双端仪表盘 + 每日 Bing 壁纸（爬虫 + 双端展示）
- ✅ **M4 任务/专注/日志/设置**：双端基础页 + JSON 导入导出
- ✅ **M5.5 登录系统**：默认账号 `yuanabd / Abd123456.`，数据按用户隔离，匿名数据自动认领
- ✅ **M5.6 自定义内容 + GitHub 记录**：路线图自定义学习内容；仪表盘底部 GitHub 记录卡片
- ✅ **M5.7 数据同步**：Web 与移动端数据一致；移动端「一键同步到云端 / 从云端恢复」
- ✅ **M5.8 Liquid Glass UI**：全站液态玻璃重构（blur 24px + saturate 1.8 + 渐变高光边缘 + 动态文字对比 + 每日一言）
- ✅ **M5.9 职业功能**：ICT（固定）+ 前端 / Java 后端 / 数据分析 / AI / 网络安全，选择职业路线即切换
- ✅ **M5.10 全屏倒计时**：任务页横屏倒计时，4 种数字时钟样式 + 每日一言 + 路线图大类选择 + 分类时长统计
- ✅ **M5.11 账号与日志**：设置页修改密码（登录页不显示默认密码）；日志输入框加大
- ✅ **M5.12 计时界面升级**：Web/移动端全屏居中环形倒计时，三背景模式（纯色/上传/图库），专注打卡分享卡片（分布图/时间轴 + 导出/分享）
- ⏳ **M6 APK 打包**：`expo prebuild` 已完成，因网络下载 Android SDK 受限暂缓，见 PROJECT_PLAN.md §12
- ⏳ 后续：P1 Supabase 云同步、证书/简历/题库；P2 AI

## 快速开始

### 1. 数据库（PostgreSQL）
```powershell
powershell -File scripts\start_pg.ps1     # 启动本地 PostgreSQL
psql -h 127.0.0.1 -p 5432 -U postgres -d Learn-Workbench
```

### 2. Web 端（Next.js）
```powershell
pnpm install
pnpm web          # http://localhost:3000，默认账号 yuanabd / Abd123456.
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

## 目录结构
```
apps/web       Next.js 16 Web 端（登录/仪表盘/路线图/任务/日志/设置 + API 层 + proxy 守卫）
apps/mobile    Expo 移动端（5 个 Tab 页，本地 AsyncStorage + 云同步客户端）
packages/shared  zod 类型/工具函数（双端共用）
packages/content 路线图内容数据（与 db/seed_content.sql 同源）
packages/ui      设计 tokens
db/             schema.sql + seed_content.sql + migrations/002_auth_custom.sql
scripts/       Bing 爬虫 + 数据库启停 + 定时任务
```

详细规划、APK 打包指南（含 commandlinetools 版本说明）见 [PROJECT_PLAN.md](PROJECT_PLAN.md)。
