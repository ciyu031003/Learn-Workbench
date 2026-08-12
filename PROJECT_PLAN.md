# ICT 学习工作台 · 项目规划（M0 已执行，待确认后进入 M1）

> 依据：《ICT学习工作台调研与技术方案.md》《新疆ICT学习规划优化方案.md》
> 当前状态：**M0 数据模型已完成**（数据库 Learn-Workbench 已建、表已建、内容已灌入、Bing 爬虫已内置并测试通过）。尚未开始编写 Web/移动端代码。

---

## 0. 已确认的决策

| 项 | 决策 | 状态 |
|---|---|---|
| A. 架构 | monorepo：Next.js Web + Expo Android + shared/content/ui 包 | ✅ 确认 |
| B. 数据 | 本地优先；**M0 先落本地 PostgreSQL 库 Learn-Workbench**；Supabase 云同步 P1 | ✅ 确认（按用户要求调整为数据库先行） |
| C. MVP 范围 | P0 含专注计时/学习会话/费曼日志（按调研文档 P0） | ✅ 确认 |
| D. AI 功能 | P2，不阻塞 MVP | ✅ 确认 |
| E. 背景图 | 项目内置 Python 爬虫，**每天抓 Bing 每日壁纸**；本地保存 + 数据库记录 + 按日期展示；离线回退纯色/内置池 | ✅ 确认（改为 Bing 每日抓取） |
| F. 内容源 | 初始内容直接采用《新疆ICT学习规划优化方案》（阶段 0-6 + Agent 副线 + 每周节奏 + KPI） | ✅ 已灌入数据库 |

---

## 1. 项目目标与设计原则

| 原则 | 说明 |
|---|---|
| 严格遵循调研技术路线 | 按调研文档第 6-9 节：monorepo（Next.js Web + Expo Android + shared）、Supabase P1、AI P2 |
| 数据库先行（M0 已落地） | 本地 PostgreSQL 18.4 数据库 `Learn-Workbench`，全部业务表 + 内容表已建好并灌入初始内容 |
| 简洁大气 | 两端统一视觉语言：中性色 + 单一强调色、卡片式布局、大留白、大字号层级、克制动效 |
| 每日风景背景 | Web + 移动端每天自动换一张 Bing 每日壁纸（Python 爬虫抓取 → 本地文件 + 数据库记录 → 应用按日期取图） |
| 内容即数据 | 路线图/资源/项目/证书全部结构化存库，渲染层零硬编码 |
| 本地优先 | 无登录可用；JSON 导入导出兜底；Supabase 云同步 P1 |
| 轻游戏化 | XP/连续打卡/徽章轻量呈现 |

---

## 2. 总体架构

```text
apps/web (Next.js 16 + Tailwind + shadcn/ui)
apps/mobile (Expo + React Native + Expo Router)
        \                 /
         \   packages/   /
          +-------------+
          | shared      | 类型、API client、工具函数（zod 校验）
          | content     | 内容数据（初始内容来自 db/seed_content.sql 同源）
          | ui          | 跨端设计 tokens / 主题常量
          +-------------+
          | 数据层：PostgreSQL 18.4（本地集群 .pgdata，数据库 Learn-Workbench）|
          |   - 内容表（phase/topic/resource/practice/project/checkpoint）       |
          |   - 业务表（进度/任务/会话/打卡/日志/证书/简历/题库/设置/背景图）     |
          | 本地缓存：Web IndexedDB/localStorage；移动端 AsyncStorage/SQLite      |
          | 可选 Supabase（P1）：Auth + Postgres + RLS + Storage                  |
          +-------------------------------------------------------------+
          | 背景图：scripts/fetch_bing_wallpaper.py（每日抓 Bing 壁纸）  |
          +-------------------------------------------------------------+
```

- 仓库形态：pnpm workspace + Turborepo；`apps/web`、`apps/mobile`、`packages/shared`、`packages/content`、`packages/ui`
- 状态：Zustand + persist；业务 store 与平台解耦
- 数据库连接：`127.0.0.1:5432`，库名 `Learn-Workbench`，用户 `postgres`（本地 trust，仅监听 localhost）
- 启停脚本：`scripts/start_pg.ps1` / `scripts/stop_pg.ps1`

---

## 3. 数据模型（M0 已落地）

### 3.1 落地位置
- DDL：`db/schema.sql`（建表 + 索引 + 触发器，一次性初始化，已在临时库验证可整体重建）
- 初始内容：`db/seed_content.sql`（幂等灌入）
- 已创建数据库：`Learn-Workbench`（PostgreSQL 18.4，集群目录 `.pgdata`）

### 3.2 表清单（13 组）
| 表 | 用途 |
|---|---|
| content_phases / content_topics | 6 阶段 + Agent 副线阶段与主题 |
| content_resources / content_practices | 资源与实操项 |
| content_projects / content_checkpoints | 项目/产出与验收标准 |
| users | 用户（P1 云同步；本地模式 user_id 为空） |
| topic_progress | 主题完成状态 + 备注（父级进度聚合） |
| daily_tasks | 每日任务 |
| focus_sessions | 专注会话 |
| checkins | 打卡（连续打卡由本表聚合） |
| xp_events | 经验值事件 |
| log_entries | 费曼/复盘/项目/面试日志 |
| certificates | 证书（HCIP/ACP）与倒计时 |
| resume_assets | 简历/GitHub 项目资产 |
| interview_questions | 面试题库 |
| settings | 键值设置（主题/背景/同步） |
| background_images | 每日 Bing 壁纸记录 |
| app_meta | schema 版本等元信息 |

### 3.3 初始内容（已灌入，共 8 阶段 / 33 主题 / 12 资源 / 15 实操 / 7 项目 / 14 验收点）
- 阶段 0-6（主轨）：学习机制+Agent 启蒙 → 通信网络 → ETL 数仓 → 云运维 → 售前方案 → 综合实战+证书 → 面试+求职
- Agent 副线（6 级）：认知层 → 最小实现 → 工具与 RAG → 编排层 → 协议与工程化 → 场景化项目

---

## 4. 功能模块与分期

### P0（第一版，必须）
1. 仪表盘：整体进度、本周任务、连续打卡、证书倒计时（占位）、项目资产入口
2. 路线图：6 阶段 + Agent 副线，主题展开/完成打勾/进度聚合
3. 每日任务 + 专注计时 + 学习会话记录与统计
4. 学习日志：费曼讲稿 / 周复盘 / 项目笔记，导出 Markdown/JSON
5. 每日 Bing 壁纸背景系统（Web + Android）
6. JSON 导入导出，本地持久化；无登录可用
7. 双端可运行：Web（含 PWA）+ Android APK

### P1（第二版）
- Supabase 登录 + 云同步（RLS + 冲突处理，表结构复用本地库）
- 证书倒计时、简历资产、GitHub 项目卡片、面试题库
- 本地通知/提醒

### P2（可选）
- AI 今日计划生成、复盘总结、费曼讲解批改（Next.js API Route 接 OpenAI-compatible LLM）
- 多设备协作、分享进度卡片；RAG/知识图谱参考 Notebook-Evo（不进入 MVP）

---

## 5. UI/UX 设计方向（简洁大气 + 每日 Bing 背景）

### 5.1 视觉语言
- 色彩：中性灰底 + 单一强调色（建议靛蓝/青），暗色模式可选
- 布局：卡片式、圆角、大留白；Web 顶部导航，移动端底部 Tab（仪表盘/路线图/任务/日志/设置）
- 字体：大标题层级清晰；正文 16px 起；中文优先 + 数字英文用系统/Inter
- 动效：克制（淡入、展开过渡）
- 组件：shadcn/ui 定制主题；移动端 RN 原生组件实现同一 tokens

### 5.2 每日 Bing 壁纸背景系统（已内置爬虫，M0 完成抓取验证）
- **爬虫脚本**：`scripts/fetch_bing_wallpaper.py`（纯标准库，无第三方依赖）
  - 接口：`https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN`
  - 下载今日壁纸（1920x1080，可 --res UHD）→ `assets/backgrounds/bing/YYYY-MM-DD.jpg`
  - 写入清单 `assets/backgrounds/bing/index.json`（日期→文件/版权/尺寸/md5）
  - 可选 `--db <连接串>`：同步写入 `background_images` 表（含源 URL、本地路径、宽高、md5）
  - 支持 `--date` / `--idx`（补抓历史日期）、`--mkt`
- **每日自动化**：用 Windows 任务计划程序每天定时执行一次（推荐早晨 8:00）
  - 辅助脚本：`scripts/schedule_bing_daily.ps1`（注册任务，需管理员运行一次）
- **应用取图逻辑（双端）**：
  1. 优先读本地 `assets/backgrounds/bing/<今日>.jpg`（manifest/DB 提供元数据）
  2. 当日图缺失 → 取最近一天已有的图
  3. 全部缺失 → 回退内置纯色/内置风景池（后续可选打包少量默认图）
- **可读性保障**：图上叠加渐变遮罩 + 半透明毛玻璃卡片，任何图片下文字对比度达标
- **用户控制**：设置中可换背景源、手动换图（仅当日）、关闭背景图（纯色模式）
- **移动端优化**：expo-image 缓存与降采样，弱网回退纯色

### 5.3 页面清单
| 页面 | Web | Android | 内容 |
|---|---|---|---|
| 仪表盘 | ✔ | ✔ | 总进度、本周任务、连续打卡、证书倒计时、快捷入口 |
| 路线图 | ✔ | ✔ | 阶段折叠、主题详情、打勾、资源/项目/验收 |
| 任务与专注 | ✔ | ✔ | 每日任务 CRUD、专注计时、会话统计 |
| 学习日志 | ✔ | ✔ | 费曼/复盘/项目笔记，导出 |
| 证书与简历（P1）| ✔ | ✔ | 倒计时、GitHub 项目卡片、简历检查项 |
| 面试题库（P1）| ✔ | ✔ | 按模块筛选、答案折叠 |
| 设置 | ✔ | ✔ | 主题、背景、导入导出、数据重置、同步开关 |

---

## 6. 技术选型明细（按调研文档第 6 节落地）

| 层 | 选型 |
|---|---|
| Monorepo | pnpm workspace + Turborepo |
| Web | Next.js 16（App Router）+ TypeScript(strict) + Tailwind CSS + shadcn/ui |
| Android/iOS | Expo + React Native + Expo Router + expo-image / expo-notifications / expo-file-system / expo-sqlite |
| 共享 | packages/shared（类型、工具、API client、zod）、packages/content（内容数据） |
| 状态 | Zustand + persist（双端同构，平台适配器注入） |
| 数据库（已落地） | PostgreSQL 18.4（项目内 conda 环境 `.tools/pg`，集群 `.pgdata`，库 `Learn-Workbench`） |
| 本地缓存 | Web: IndexedDB/localStorage；移动端: AsyncStorage/SQLite |
| 后端（P1）| Supabase：Auth + Postgres + RLS + Storage |
| 背景图 | 项目内置 Python 爬虫 `scripts/fetch_bing_wallpaper.py`（每日 Bing 壁纸） |
| AI（P2）| Next.js API Route 接 OpenAI-compatible LLM |
| 校验/测试 | zod + Vitest |

> 说明：本机自带的 PostgreSQL 13.3 运行时（skpgsql）缺 lib/share 无法使用，MATLAB 内置 PG 二进制缺运行库；因此用 conda 在项目内安装独立 PostgreSQL 18.4（`.tools/pg`），与系统互不影响。

---

## 7. 开发里程碑（M0 已完成，下一步 M1）

| 里程碑 | 内容 | 状态 |
|---|---|---|
| **M0 数据建模** | 建库 Learn-Workbench；建 13 组表；灌入《新疆ICT学习规划优化方案》内容；Bing 爬虫脚本内置并测试 | ✅ 完成 |
| M1 工程骨架 | pnpm monorepo 初始化；web dev + expo dev + shared 跑通；CI 基础 | ✅ 完成 |
| M2 路线图模块 | 内容渲染、阶段折叠、主题打勾、进度聚合、资源/项目/验收展示 | ✅ 完成（Web+移动端）|
| M3 仪表盘 + 背景系统 | 仪表盘卡片、本周任务、连续打卡；每日 Bing 背景图（双端）+ 遮罩与设置 | ✅ 完成（双端）|
| M4 任务与专注 | 每日任务 CRUD、专注计时、会话统计（Web+移动端基础版）| ✅ 完成 |
| M5 日志与导入导出 | 费曼/复盘/项目笔记；JSON 导入导出、备份恢复 | ✅ 完成（Web 全量，移动端本地）|
| M6 移动端打磨 + PWA | Android 适配、离线、PWA（Web 安装）、性能 | ⏳ 待做 |
| M7 云同步（P1）| Supabase Auth + 数据表 + RLS + 冲突处理 + 同步开关 | |
| M8 证书/简历/题库（P1）| 倒计时、项目卡片、面试题库、本地提醒 | |
| M9 AI 功能（P2）| 每日计划、复盘总结、费曼批改 | |

---

## 8. 参考开源项目落点（调研文档第 4 节）

| 项目 | 我们借鉴什么 |
|---|---|
| developer-roadmap | 路线图内容结构化、节点点击阅读的信息架构（不照搬其内容/许可）|
| DevRoadmaps | 本地优先 + PWA 离线 + 主题完成/进度 + 成就轻量化 |
| SkillMap | 单一 JSON 数据模型、隐私优先、单文件导入导出 |
| AI Learning Tracker | Next.js 产品形态、内容即数据、XP/进度、可选 Supabase |
| PlanIt | Expo 单代码库跨 Web/Android 的工程组织方式 |
| Skill Quest / IsotopeAI | XP/连击/徽章、专注会话与习惯闭环（轻量取舍）|
| Notebook-Evo | P2 阶段参考 RAG/MCP/多智能体，MVP 不引入 |

---

## 9. M0 执行记录（本阶段已完成的工作）

1. **环境勘查**：本机 Python 3.9 / Node 24 / pnpm 11；系统 PostgreSQL 13.3 运行时不完整（缺 lib/share，无法建新库），MATLAB 内置 PG 二进制缺运行库
2. **安装独立 PostgreSQL 18.4**：conda 环境 `F:\CodeFiles\Learn-Workbench\.tools\pg`（约 100-200MB，随项目走）
3. **初始化集群**：`.pgdata`（UTF-8，trust 本地认证，仅监听 127.0.0.1:5432）
4. **创建数据库**：`Learn-Workbench`
5. **建表**：`db/schema.sql` 落地 13 组表 + 索引 + updated_at 触发器
6. **灌内容**：`db/seed_content.sql`（8 阶段 / 33 主题 / 12 资源 / 15 实操 / 7 项目 / 14 验收点 + 默认设置 + 元信息）
7. **Bing 爬虫**：`scripts/fetch_bing_wallpaper.py` 已内置并通过实测（2026-08-12 壁纸已下载并写入 background_images 表）
8. **启停脚本**：`scripts/start_pg.ps1` / `scripts/stop_pg.ps1`

---

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| 双端双栈维护成本高 | shared 只放类型/纯逻辑/内容；UI 各自实现；内容单一数据源（库 + content 包） |
| 每日背景图体积影响性能 | 1920x1080 约 0.3MB/张、expo-image 缓存、分辨率分级、离线回退纯色 |
| Bing 接口偶发不可用 | 回退到最近一天图片/内置池；爬虫可重试与补抓（--idx/--date） |
| 用户换设备丢数据 | JSON 导入导出 + schemaVersion 迁移；P1 Supabase 同步 |
| 范围膨胀 | P0 严格按里程碑交付，AI/题库/同步一律后置 |
| 本地 PG 环境损坏 | 脚本化重建：conda create → initdb → schema → seed（文档化） |

---

## 11. 构建进度（M1-M4 基础版已完成）

**已完成**
- M1 工程骨架：pnpm monorepo（apps/web + apps/mobile + packages/shared/content/ui），Turborepo
- M2 路线图：Web + 移动端（阶段折叠、主题打勾、进度聚合、资源/项目/验收）
- M3 仪表盘 + 每日 Bing 背景：双端仪表盘；Web 读取本地爬虫产物，移动端直连 Bing 接口
- M4 任务/专注/日志/设置：双端基础页；Web 接 PostgreSQL，移动端本地 AsyncStorage；JSON 导入导出
- 验证：turbo typecheck 全通过、Web lint 通过、`next build` 成功、Expo web export 打包成功

**待办（P1 起）**
- M6 移动端打磨：Android 真机适配、离线缓存、PWA（Web 安装）
- M7 云同步：Supabase Auth + 数据表 + RLS + 冲突处理
- M8 证书倒计时、简历/GitHub 资产、面试题库、本地通知
- M9 AI：今日计划、复盘总结、费曼批改

**日常命令**
- Web：`pnpm web`（http://localhost:3000）
- 移动端：`pnpm mobile`（Expo）
- 数据库：`powershell -File scripts\start_pg.ps1`
- 抓壁纸：`python scripts\fetch_bing_wallpaper.py --db "host=127.0.0.1 port=5432 dbname=Learn-Workbench user=postgres"`


