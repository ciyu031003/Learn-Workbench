# ICT 学习工作台 · 项目规划与进度记录

> 依据：《ICT学习工作台调研与技术方案.md》《新疆ICT学习规划优化方案.md》
> 当前状态：**M0-M5 基础版 + 全部新增功能已完成并分批提交 git**（登录系统 / 自定义学习内容 / GitHub 记录 / Web-移动端云同步 / Liquid Glass 液态玻璃 UI / 多职业学习路线 / 全屏倒计时 / 修改密码）。**APK 打包因网络下载 Android SDK 受限暂缓，最后处理（见 §12）。**

---

## 0. 已确认的决策

| 项 | 决策 | 状态 |
|---|---|---|
| A. 架构 | monorepo：Next.js Web + Expo Android + shared/content/ui 包 | ✅ 确认 |
| B. 数据 | 本地优先；**先落本地 PostgreSQL 库 Learn-Workbench**；Supabase 云同步 P1 | ✅ 确认（数据库先行） |
| C. MVP 范围 | P0 含专注计时/学习会话/费曼日志（按调研文档 P0） | ✅ 确认 |
| D. AI 功能 | P2，不阻塞 MVP | ✅ 确认 |
| E. 背景图 | 项目内置 Python 爬虫，**每天抓 Bing 每日壁纸**；本地保存 + 数据库记录 + 按日期展示；离线回退纯色/内置池 | ✅ 确认（改为 Bing 每日抓取） |
| F. 内容源 | 初始内容直接采用《新疆ICT学习规划优化方案》（阶段 0-6 + Agent 副线 + 每周节奏 + KPI） | ✅ 已灌入数据库 |
| G. 登录 | 账号密码登录，账号由 scripts/create-admin.mjs 创建（不再内置默认密码）；数据按用户隔离；登录页毛玻璃 | ✅ 已上线 |
| H. UI 风格 | 全站 **Liquid Glass 液态玻璃**（参考 mianbeishiwole/Liquid-Glass-Vue / iOS 26 风格）；暖调黄昏氛围；背景风景图穿透模糊 | ✅ 已重构 |
| I. 自定义内容 | 学习路线图允许用户自定义添加学习内容 | ✅ 已上线 |
| J. 数据一致 | Web 端与移动端数据一致；移动端提供「一键同步到云端」 | ✅ 已上线（同步 API + 客户端） |
| K. APK | 打包 Android 安装包 | ⏳ 暂缓（网络问题，最后处理） |
| L. 职业功能 | 多职业学习路线（ICT 固定不可改 + 前端/Java 后端/数据分析/AI/网络安全），选择后路线切换 | ✅ 已上线 |
| M. 专注计时 | 任务页全屏横屏倒计时，数字时钟样式可切换，下方附每日一言 | ✅ 已上线 |
| N. 账号安全 | 登录页不显示默认密码；设置中可修改密码 | ✅ 已上线 |

---

## 1. 项目目标与设计原则

| 原则 | 说明 |
|---|---|
| 严格遵循调研技术路线 | 按调研文档第 6-9 节：monorepo（Next.js Web + Expo Android + shared）、Supabase P1、AI P2 |
| 数据库先行（M0 已落地） | 本地 PostgreSQL 18.4 数据库 `Learn-Workbench`，全部业务表 + 内容表已建好并灌入初始内容 |
| 简洁大气 | 两端统一视觉语言：毛玻璃卡片、大留白、大字号层级、克制动效 |
| 每日风景背景 | Web + 移动端每天自动换一张 Bing 每日壁纸（Python 爬虫抓取 → 本地文件 + 数据库记录 → 应用按日期取图） |
| 内容即数据 | 路线图/资源/项目/证书全部结构化存库，渲染层零硬编码 |
| 数据一致 | Web（PostgreSQL）与移动端（本地 AsyncStorage + 云同步 API）数据保持一致 |
| 登录隔离 | 每个账号只看到自己的数据；匿名数据在首次登录时自动认领 |
| 轻游戏化 | XP/连续打卡/徽章轻量呈现 |

---

## 2. 总体架构

```text
apps/web (Next.js 16 + Tailwind + shadcn/ui + API Routes 直连 PostgreSQL)
apps/mobile (Expo + React Native + Expo Router；本地 AsyncStorage + 同步 API)
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
          |   - 认证表（accounts / sessions，scrypt 哈希 + Cookie/Bearer 会话）  |
          | 本地缓存：Web localStorage；移动端 AsyncStorage                        |
          | 可选 Supabase（P1）：Auth + Postgres + RLS + Storage                  |
          +-------------------------------------------------------------+
          | 背景图：scripts/fetch_bing_wallpaper.py（每日抓 Bing 壁纸）  |
          +-------------------------------------------------------------+
```

- 仓库形态：pnpm workspace + Turborepo；`apps/web`、`apps/mobile`、`packages/shared`、`packages/content`、`packages/ui`
- 状态：Zustand + persist；业务 store 与平台解耦
- 数据库连接：`127.0.0.1:5432`，库名 `Learn-Workbench`，用户 `postgres`（本地 trust，仅监听 localhost）
- 启停脚本：`scripts/start_pg.ps1` / `scripts/stop_pg.ps1`
- 认证：`apps/web/proxy.ts`（Next 16 proxy 约定）保护 `/dashboard /roadmap /tasks /logs /settings` → 未登录跳 `/login`；API 支持 Cookie 与 `Authorization: Bearer <token>` 双通道

---

## 3. 数据模型（M0 已落地）

### 3.1 落地位置
- DDL：`db/schema.sql`（建表 + 索引 + 触发器，一次性初始化，已在临时库验证可整体重建）
- 认证迁移：`db/migrations/002_auth_custom.sql`（accounts / sessions 表 + 各业务表 user_id 列，已应用）
- 初始内容：`db/seed_content.sql`（幂等灌入）
- 已创建数据库：`Learn-Workbench`（PostgreSQL 18.4，集群目录 `.pgdata`）

### 3.2 表清单
| 表 | 用途 |
|---|---|
| accounts / sessions | 登录账号与会话（scrypt 哈希；本轮新增） |
| content_phases / content_topics | 6 阶段 + Agent 副线阶段与主题（含用户自定义主题 user_defined） |
| content_resources / content_practices | 资源与实操项 |
| content_projects / content_checkpoints | 项目/产出与验收标准 |
| users | 用户（P1 云同步） |
| topic_progress | 主题完成状态 + 备注（父级进度聚合） |
| daily_tasks | 每日任务 |
| focus_sessions | 专注会话 |
| checkins | 打卡（连续打卡由本表聚合） |
| xp_events | 经验值事件 |
| log_entries | 费曼/复盘/项目/面试日志 |
| certificates | 证书（HCIP/ACP）与倒计时 |
| resume_assets | 简历/GitHub 项目资产（本轮新增 GitHub 记录 API） |
| interview_questions | 面试题库 |
| settings | 键值设置（主题/背景/同步） |
| background_images | 每日 Bing 壁纸记录 |
| app_meta | schema 版本等元信息 |

### 3.3 初始内容（已灌入，共 8 阶段 / 33 主题 / 12 资源 / 15 实操 / 7 项目 / 14 验收点）
- 阶段：phase-0 ~ phase-6（基础/网络/系统/安全/数据库/项目）+ agent-track（Agent 副线）
- 主题/资源/实操/项目/验收全部结构化存库，渲染层零硬编码

---

## 4. 功能模块与分期

### P0（第一版，必须）— 已完成
1. 仪表盘：整体进度、本周任务、连续打卡、证书倒计时、快捷入口、**GitHub 记录卡片（底部）**
2. 路线图：6 阶段 + Agent 副线，主题展开/完成打勾/进度聚合，**支持用户自定义添加学习内容**
3. 每日任务 + 专注计时 + 学习会话记录与统计
4. 学习日志：费曼讲稿 / 周复盘 / 项目笔记，导出 Markdown/JSON
5. 每日 Bing 壁纸背景系统（Web + Android）
6. JSON 导入导出，本地持久化
7. **登录系统**（账号由 scripts/create-admin.mjs 创建（不再内置默认密码），数据按用户隔离）
8. **Web / 移动端数据一致 + 移动端一键同步到云端**
9. 双端可运行：Web（已完成）；Android APK（⏳ 暂缓，见 §12）

### P1（第二版）
- Supabase 云同步（Auth + RLS + 冲突处理，表结构复用本地库）
- 证书倒计时、简历资产、面试题库、本地通知/提醒

### P2（可选）
- AI 今日计划生成、复盘总结、费曼讲解批改（Next.js API Route 接 OpenAI-compatible LLM）
- 多设备协作、分享进度卡片；RAG/知识图谱参考 Notebook-Evo（不进入 MVP）

---

## 5. UI/UX 设计方向（Liquid Glass 液态玻璃 + 每日 Bing 背景）

### 5.1 视觉语言（已按 Liquid-Glass-Vue / iOS 26 重构）
- 玻璃卡片：`backdrop-filter: blur(24px)` + `saturate(1.8)`，`background: rgba(255,255,255,.12~.22)`，1px `rgba(255,255,255,.25)` 半透明描边，大圆角 16px+，柔和低透明度 box-shadow
- 渐变高光边缘：`.glass::before` 使用 `mask-composite` 生成边缘渐变高光，模拟液态玻璃折射
- 环境光斑：页面背景 blob 动画，随风景图透出，营造暖调黄昏氛围
- 动态文字对比：`DailyBackground` 用 canvas 读取背景图亮度，偏暗时文字 `#ffffff`、偏亮时 `#111111`，通过 `<html>.bg-dark` 切换 CSS 变量 `--text-on-glass`，保证任何图片下文字清晰
- 字体：正文/标题使用优雅艺术无衬线字体（web 字体引入），支持中英文
- 动效：卡片 hover 上浮 + 模糊度/透明度微调、平滑滚动、模块加载淡入、顶部标题微弱发光
- 进度条：渐变磨砂 + 柔和发光
- 侧边导航：轻度毛玻璃，与整体统一
- 组件：Web 为 shadcn/ui 定制玻璃主题；移动端 RN 原生实现同一 tokens；参考 [Liquid-Glass-Vue](https://github.com/mianbeishiwole/Liquid-Glass-Vue)

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
  3. 全部缺失 → 回退内置纯色/内置风景池
- **可读性保障**：图上叠加渐变遮罩 + 毛玻璃卡片 + 动态文字对比度
- **用户控制**：设置中可换背景源、手动换图（仅当日）、关闭背景图（纯色模式）
- **移动端优化**：expo-image 缓存与降采样，弱网回退纯色

### 5.3 页面清单
| 页面 | Web | Android | 内容 |
|---|---|---|---|
| 登录 | ✔ | ✔ | 毛玻璃登录页，账号由 scripts/create-admin.mjs 创建（不再内置默认密码） |
| 仪表盘 | ✔ | ✔ | 总进度、本周任务、连续打卡、证书倒计时、快捷入口、每日一言、GitHub 记录 |
| 路线图 | ✔ | ✔ | 职业切换、阶段折叠、主题详情、打勾、资源/项目/验收、自定义添加学习内容（毛玻璃弹窗） |
| 任务与专注 | ✔ | ✔ | 每日任务 CRUD（可选路线图大类）、全屏居中环形倒计时（三背景模式 + 励志短句 + 时长预设）、分类专注统计、打卡分享卡片（分布图/时间轴 + 导出/分享） |
| 学习日志 | ✔ | ✔ | 费曼/复盘/项目笔记，导出 |
| 设置 | ✔ | ✔ | 主题、背景、导入导出、登录/退出、修改密码、职业路线、一键同步到云端/从云端恢复 |

---

## 6. 技术选型明细（按调研文档第 6 节落地）

| 层 | 选型 |
|---|---|
| Monorepo | pnpm workspace + Turborepo |
| Web | Next.js 16（App Router）+ TypeScript(strict) + Tailwind CSS + shadcn/ui；proxy.ts 做登录守卫 |
| Android/iOS | Expo + React Native + Expo Router + expo-image / expo-file-system |
| 认证 | 自建：scrypt 密码哈希（apps/web/lib/password.ts）+ Cookie/Bearer 会话（lib/session.ts）；表 accounts/sessions |
| 共享 | packages/shared（类型、工具、API client、zod）、packages/content（内容数据） |
| 状态 | Zustand + persist（双端同构，平台适配器注入） |
| 数据库（已落地） | PostgreSQL 18.4（项目内 conda 环境 `.tools/pg`，集群 `.pgdata`，库 `Learn-Workbench`） |
| 本地缓存 | Web: localStorage；移动端: AsyncStorage |
| 云同步 | 自建同步 API：POST /api/sync/push（全量替换）+ GET /api/sync/pull；移动端 src/lib/sync.ts |
| 背景图 | 项目内置 Python 爬虫 `scripts/fetch_bing_wallpaper.py`（每日 Bing 壁纸） |
| AI（P2）| Next.js API Route 接 OpenAI-compatible LLM |
| 校验/测试 | zod + Vitest |

> 说明：本机自带的 PostgreSQL 13.3 运行时（skpgsql）缺 lib/share 无法使用，MATLAB 内置 PG 二进制缺运行库；因此用 conda 在项目内安装独立 PostgreSQL 18.4（`.tools/pg`），与系统互不影响。

---

## 7. 开发里程碑

| 里程碑 | 内容 | 状态 |
|---|---|---|
| **M0 数据建模** | 建库 Learn-Workbench；建表；灌入《新疆ICT学习规划优化方案》内容；Bing 爬虫脚本内置并测试 | ✅ 完成 |
| M1 工程骨架 | pnpm monorepo 初始化；web dev + expo dev + shared 跑通 | ✅ 完成 |
| M2 路线图模块 | 内容渲染、阶段折叠、主题打勾、进度聚合、资源/项目/验收展示 | ✅ 完成（双端）|
| M3 仪表盘 + 背景系统 | 仪表盘卡片、本周任务、连续打卡；每日 Bing 背景图（双端）+ 遮罩与设置 | ✅ 完成（双端）|
| M4 任务与专注 | 每日任务 CRUD、专注计时、会话统计（双端基础版）| ✅ 完成 |
| M5 日志与导入导出 | 费曼/复盘/项目笔记；JSON 导入导出、备份恢复 | ✅ 完成（Web 全量，移动端本地）|
| M5.5 登录系统 | accounts/sessions、scrypt、登录页、路由守卫、数据按用户隔离、匿名认领 | ✅ 完成 |
| M5.6 自定义内容 + GitHub | 路线图自定义添加学习内容；仪表盘 GitHub 记录（双端） | ✅ 完成 |
| M5.7 数据同步 | 同步 API（push/pull）；移动端一键同步到云端/从云端恢复 | ✅ 完成 |
| M5.8 Liquid Glass UI | 全站液态玻璃重构（blur 24px + saturate 1.8 + 渐变高光边缘 + 动态文字对比 + 每日一言） | ✅ 完成 |
| M5.9 职业功能 | careers 表 + 5 个职业路线（网络整理入库），路线图按职业切换，ICT 锁定 | ✅ 完成 |
| M5.10 全屏倒计时 | 任务页全屏横屏倒计时（4 种时钟样式 + 每日一言 + 大类选择 + 分类时长统计） | ✅ 完成 |
| M5.11 账号与日志 | 设置页修改密码；日志输入框加大 | ✅ 完成 |
| M5.12 计时界面升级 | 全屏居中环形倒计时（Web+移动端）、三背景模式（纯色/上传/图库）、打卡分享卡片 | ✅ 完成 |
| M5.13 职业仪表盘 | 仪表盘整体进度按所选职业过滤；登录后首次进入弹出职业选择小窗 | ✅ 完成 |
| M6 移动端打包 | Android 适配、APK 打包、真机调试、PWA（Web 安装） | ⏳ APK 暂缓（网络），PWA 可做 |
| M7 云同步（P1）| Supabase Auth + 数据表 + RLS + 冲突处理 + 同步开关 | |
| M8 证书/简历/题库（P1）| 倒计时、项目卡片、面试题库、本地提醒 | |
| M9 AI 功能（P2）| 每日计划、复盘总结、费曼批改 | |

---

## 8. 参考开源项目落点（调研文档第 4 节）

| 项目 | 我们借鉴什么 |
|---|---|
| mianbeishiwole/Liquid-Glass-Vue | **液态玻璃 UI**：blur 20px+、saturate 180%、低透明度、渐变高光边缘、环境光斑（已落地） |
| developer-roadmap | 路线图内容结构化、节点点击阅读的信息架构（不照搬其内容/许可）|
| DevRoadmaps | 本地优先 + PWA 离线 + 主题完成/进度 + 成就轻量化 |
| SkillMap | 单一 JSON 数据模型、隐私优先、单文件导入导出 |
| AI Learning Tracker | Next.js 产品形态、内容即数据、XP/进度、可选 Supabase |
| PlanIt | Expo 单代码库跨 Web/Android 的工程组织方式 |
| Skill Quest / IsotopeAI | XP/连击/徽章、专注会话与习惯闭环（轻量取舍）|
| Notebook-Evo | P2 阶段参考 RAG/MCP/多智能体，MVP 不引入 |

---

## 9. 执行记录

### M0 数据建模
1. **环境勘查**：本机 Python 3.9 / Node 24 / pnpm 11；系统 PostgreSQL 13.3 运行时不完整（缺 lib/share，无法建新库），MATLAB 内置 PG 二进制缺运行库
2. **安装独立 PostgreSQL 18.4**：conda 环境 `F:\CodeFiles\Learn-Workbench\.tools\pg`
3. **初始化集群**：`.pgdata`（UTF-8，trust 本地认证，仅监听 127.0.0.1:5432）
4. **创建数据库**：`Learn-Workbench`
5. **建表**：`db/schema.sql` 落地全部表 + 索引 + updated_at 触发器
6. **灌内容**：`db/seed_content.sql`（8 阶段 / 33 主题 / 12 资源 / 15 实操 / 7 项目 / 14 验收点 + 默认设置 + 元信息）
7. **Bing 爬虫**：`scripts/fetch_bing_wallpaper.py` 已内置并通过实测（2026-08-12 壁纸已下载并写入 background_images 表）
8. **启停脚本**：`scripts/start_pg.ps1` / `scripts/stop_pg.ps1`

### 本轮新增功能（已提交 git）
1. **登录系统**：`db/migrations/002_auth_custom.sql`（accounts/sessions + user_id 列）；`apps/web/lib/password.ts`（scrypt）、`lib/session.ts`（Cookie + Bearer 双通道）；`apps/web/proxy.ts` 守卫 5 个页面；`app/login/page.tsx` 毛玻璃登录页；所有数据 API 按登录用户隔离，登录时自动认领匿名数据；不再内置默认账号，请用 scripts/create-admin.mjs 创建
2. **自定义学习内容**：`POST/DELETE /api/roadmap/custom` + Web 表单（选择阶段）+ 移动端选择器
3. **GitHub 记录**：`GET/POST/DELETE /api/github` + 仪表盘底部卡片（双端）
4. **云同步**：`POST /api/sync/push`（全量替换）+ `GET /api/sync/pull`；移动端 `src/lib/sync.ts`；设置页「一键同步到云端 / 从云端恢复 / 退出登录」
5. **Liquid Glass UI**：`apps/web/app/globals.css` 玻璃 tokens（--glass-blur:24px / --glass-saturation:1.8 / 暗亮双主题）；`.glass::before` 渐变高光边缘；环境光斑 blob 动画；动态文字对比（DailyBackground canvas 亮度检测 → `<html>.bg-dark`）；每日一言小组件（修复水合不一致）
6. **移动端配置**：app.json 增加 `android.package: com.yuanabd.learnworkbench`、显示名「ICT学习工作台」、`extra.apiUrl: http://10.0.2.2:3000`（模拟器）；`expo prebuild --platform android` 已生成原生 android/ 目录（gitignore 忽略）

### 验证结果
- Web：typecheck ✅ / lint ✅ / `next build` ✅ / 5 个页面 200 ✅；无 Cookie 访问 /dashboard → 307 /login ✅；POST /api/auth/login 200 ✅；Bearer 可访问数据 API ✅
- 移动端：`tsc --noEmit` ✅、`expo export --platform web` ✅
- 数据库：002_auth_custom.sql 已应用；默认账号可登录

---

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| 双端双栈维护成本高 | shared 只放类型/纯逻辑/内容；UI 各自实现；内容单一数据源（库 + content 包） |
| 每日背景图体积影响性能 | 1920x1080 约 0.3MB/张、expo-image 缓存、分辨率分级、离线回退纯色 |
| Bing 接口偶发不可用 | 回退到最近一天图片/内置池；爬虫可重试与补抓（--idx/--date） |
| 同步是全量替换 | 以最后一次 push 的设备为准；移动端 replaceAll 会覆盖本机数据（注意预期）；P1 改增量/冲突合并 |
| Android SDK 下载网络受限 | 见 §12：任何较新的 commandlinetools-win 均可，官方/镜像多渠道，必要时浏览器手动下载 |
| 本地 PG 环境损坏 | 脚本化重建：conda create → initdb → schema → seed（文档化） |
| 范围膨胀 | P0 严格按里程碑交付，AI/题库/Supabase 同步一律后置 |

---

## 11. 构建进度

**已完成（均已提交 git）**
- M0-M4 基础版：monorepo / 路线图 / 仪表盘+每日 Bing 背景 / 任务+专注 / 日志+导入导出
- M5.5 登录系统（账号由 create-admin 脚本创建，无默认密码）
- M5.6 自定义学习内容 + GitHub 记录
- M5.7 Web-移动端数据同步 + 一键同步到云端
- M5.8 Liquid Glass 液态玻璃 UI 全面重构
- 验证：Web typecheck/lint/build ✅；移动端 tsc ✅；API 冒烟 ✅

**待办**
- M6 APK 打包（⏳ 暂缓，网络恢复后按 §12 执行）
- M6 PWA（Web 安装，可先做）
- M7 云同步（Supabase）→ M8 证书/简历/题库 → M9 AI

**日常命令**
- Web：`pnpm web`（http://localhost:3000）
- 移动端：`pnpm mobile`（Expo）
- 数据库：`powershell -File scripts\start_pg.ps1`
- 抓壁纸：`python scripts\fetch_bing_wallpaper.py --db "host=127.0.0.1 port=5432 dbname=Learn-Workbench user=postgres"`

---

## 12. Android APK 打包指南（M6，网络恢复后执行）

### 12.1 当前进度
- ✅ `expo prebuild --platform android --no-install` 已成功，`apps/mobile/android/` 原生工程已生成（被 gitignore 忽略）
- ✅ 本机已具备 JDK 17.0.18（Zulu）：`F:\CodeFiles\Learn-Workbench\.tools\jdk17\Library`
- ❌ 本机尚无 Android SDK（`.tools/android-sdk` 不存在）→ 这是卡点，因 `dl.google.com` 下载极慢

### 12.2 版本需求（由 react-native/gradle/libs.versions.toml 决定）
| 项 | 版本 |
|---|---|
| compileSdk | 36 |
| buildTools | 36.0.0 |
| minSdk | 24 |
| targetSdk | 36 |
| NDK | 27.1.12297006 |
| AGP | 8.12.0 |
| Gradle | 9.3.1（gradle-wrapper 自动下载） |
| JDK | 17（已就绪） |

### 12.3 手动下载 commandlinetools —— 版本要求说明（FAQ）

**问：是不是必须严格下载 `commandlinetools-win-11076708_latest.zip` 这个版本？**

**答：不是。** `11076708` 只是其中一个历史构建号，不是唯一选择。官方仓库（`https://dl.google.com/android/repository/repository2-3.xml`）当前列出 20+ 个 Windows 版本，例如：

```
commandlinetools-win-6200805 / 6514223 / 6609375 / 6858069 / 7302050 / 7583922
commandlinetools-win-8092744 / 8512546 / 9123335 / 9477386 / 9862592
commandlinetools-win-10406996 / 11076708 / 11379558 / 11391160 / 11479570
commandlinetools-win-12172612 / 12266719 / 12700392 / 12996373 / 13114758
commandlinetools-win-14742923 / 15641748 / 15859902  ← 15859902 为当前最新
```

只要满足以下条件即可，**版本号不必严格等于 11076708**：
1. 必须是 **Windows** 版本（文件名含 `-win-`，例如 `commandlinetools-win-15859902_latest.zip`）；
2. **较新即可**（建议 ≥ 9477386，越新越好，新版本对 Gradle 9.x / SDK 36 兼容性更好）；
3. 解压后目录结构必须是 `cmdline-tools\latest\bin\sdkmanager.bat`（即把 zip 解压出的 `cmdline-tools` 目录放到 `%ANDROID_HOME%\cmdline-tools\latest`）；
4. commandlinetools 本身只是「下载器」，真正的 SDK 组件（platform-tools、platforms;android-36、build-tools;36.0.0、ndk;27.1.12297006、cmake）由 `sdkmanager` 按固定版本号自动下载，与 commandlinetools 的构建号无关。

**下载渠道（按可达性排序，2026-08-12 实测）**
| 渠道 | URL 规律 | 实测 |
|---|---|---|
| 官方 dl.google.com | `https://dl.google.com/android/repository/commandlinetools-win-<build>_latest.zip` | repository 索引可访问，但 zip 下载极慢（约 0.6 KB/s，100MB 需数十小时）❌ |
| 清华 TUNA | `https://mirrors.tuna.tsinghua.edu.cn/android/repository/commandlinetools-win-<build>_latest.zip` | 目录 403 ❌（浏览器直接访问可能成功，需防盗链 Referer） |
| 华为云 | `https://mirrors.huaweicloud.com/android_repository/repository/commandlinetools-win-<build>_latest.zip` | 目录 401 ❌ |
| 阿里云 | 仅 Android 源码镜像，无 commandlinetools | 不适用 |

> 建议：本机命令行下载不通时，用**浏览器手动下载**（浏览器走系统代理通常更快），任选一个较新版本即可；下载后解压到 `.tools\android-sdk\cmdline-tools\latest`。也可用 `curl.exe -L -o` 断点续传或代理软件。

### 12.4 后续构建步骤（网络恢复后执行）
```powershell
# 1) 环境变量
$env:JAVA_HOME  = 'F:\CodeFiles\Learn-Workbench\.tools\jdk17\Library'
$env:ANDROID_HOME = 'F:\CodeFiles\Learn-Workbench\.tools\android-sdk'
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:PATH"

# 2) 安装 SDK 组件（sdkmanager 自动下载，可能较慢）
sdkmanager --sdk_root="$env:ANDROID_HOME" --channel=0 `
  "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1"

# 3) 若改过 app.json（包名等），先重新同步原生工程
cd apps/mobile
pnpm exec expo prebuild --platform android --no-install

# 4) 构建 Debug APK（首次会下载 Gradle 9.3.1 与大量依赖，20-60 分钟）
cd android
.\gradlew.bat assembleDebug --no-daemon -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

- **产物**：`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- **后端地址**：app.json `extra.apiUrl` 目前是 `http://10.0.2.2:3000`（Android 模拟器访问宿主机）；**真机安装需改为电脑局域网 IP**（如 `http://192.168.x.x:3000`）并重新 prebuild/打包，或改为公网地址
- **Web 端需保持运行**：移动端同步依赖 Web 的 `:3000` 同步 API（`/api/sync/push|pull`、`/api/auth/login`）
- **打包成功后**：将 APK 文件放到 `dist/` 或说明路径，并提交一次 git

### 12.5 移动端同步说明
- 「一键同步到云端」：把本机全部数据 POST 到 `/api/sync/push`（全量替换服务器该账号数据）
- 「从云端恢复」：GET `/api/sync/pull` 拉取云端数据覆盖本机
- 默认账号登录后，Web 与移动端看到的是同一份数据（同一 account 的 user_id）
