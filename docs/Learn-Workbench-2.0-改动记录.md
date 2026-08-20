# Learn-Workbench 2.0 · 改动记录（Change Log）

> 本文档是 Learn-Workbench 2.0 阶段**全部改动**的唯一记录台账。
> 约定：任何代码 / 文档 / 数据 / 配置改动完成后，必须在「四、改动记录」追加一条记录（倒序，最新在最上）；**禁止修改历史条目**，如需更正请在原条目下补充「更正」说明。
> 记录模板见「五、记录模板」。

---

## 一、文档用途

1. 作为 2.0 版本全部改动的权威记录，避免改动漂移、重复建设、历史无法追溯。
2. 承载 2.0 设计方案评审结论与后续决策（为何这么改、为何不这么改）。
3. 供后续会话 / 协作者快速了解：当前做到哪、下一步做什么。

---

## 二、基线快照（2026-08-20 评审时点）

### 2.1 项目结构与技术栈

- Monorepo（pnpm + turbo）：`apps/web`（Next.js App Router）、`apps/mobile`（Expo / React Native）、`packages/shared`（zod 共享类型与工具）、`packages/ui`、`packages/content`。
- 数据库：PostgreSQL（本地集群 `.pgdata`），Schema 全量在 `db/schema.sql`，增量迁移在 `db/migrations/001~011`。
- 迁移版本：`001_anon_unique` → `011_job_engagement`（招花订阅/考试日历/通知已落地）。

### 2.2 已有页面与导航（Web / Mobile）

| 端 | 页面 | 备注 |
|---|---|---|
| Web | /dashboard /roadmap /tasks /logs /wellbeing /jobs /settings /login | 侧边栏 7 项：仪表盘/路线图/任务/日志/健康/招花/设置；无顶导 |
| Mobile | 底部 Tab：仪表盘/路线图/任务/日志/招花（设置隐藏） | 与 Web 基本对齐 |

### 2.3 已有数据表（可复用于 2.0）

- 学习：content_phases/topics/resources/practices/projects/checkpoints、careers、topic_progress、daily_tasks、focus_sessions、checkins、xp_events、log_entries、certificates。
- 职业：resume_assets（skill/project/github/certificate）、interview_questions（题库，**无答题记录表**）、`/api/github`。
- 招聘：job_postings（含 content_hash/category/channel/deadline_at/extra/tags）、job_favorites、job_crawler_configs、job_crawler_runs、job_subscriptions、job_notifications、job_exam_events、job_source_health、hosts 注册表（config/job-hosts/sources.json）。
- 用户：users、accounts、sessions、settings（含 career 键）。
- 知识域：knowledge_notes/tags/links（004 迁移 + `/api/notes`，**无任何 UI 页面**）。

### 2.4 招花 2.0 已建成能力（勿重复建设）

hosts 注册表（7 源、周更）· 双引擎爬虫（http 轻量 + Playwright 浏览器）· 公告解析 + 考试日历 · 岗位表 excel 结构化（xlsx-min）· 订阅提醒 + 站内通知铃铛 · 信息源健康度可视化 · 分类体系（internet/gongkao/gongbian/yangqi）· content_hash 同源去重 · 按 user_id 全面隔离。

---

## 三、2.0 设计方案评审结论（2026-08-20）

评审对象：
1. `docs/Learn-Workbench-2.0-下一版本具体改动方向和设计方案.md`（产品/UI/UX 主稿）
2. `docs/Learn-Workbench-2.0-实施路线图-优化版.md`（结合现有代码的落地版）

### 3.1 总体判断

**设计方案总体合理、方向正确、与现有代码库高度契合，可以落地。** 主稿的「先 UI 后功能、先数据关系后 AI、控制范围」策略正确；落地版路线图对现有能力的差距分析非常扎实（招花 2.0、careers/content/resume_assets/interview_questions 等数据基础与 2.0 愿景几乎一一对应）。

核心风险不在方向，而在执行细节（见 3.3/3.4）。

### 3.2 合理之处（保留）

1. **一级导航收敛为 5 入口（首页/学习/招花/职业/设置）**：当前 Web 侧边栏 7 项扁平堆叠，学习模块（路线图/任务/日志/健康）确实该分组；健康收敛为系统级能力方向正确。
2. **Liquid Glass 2.0 三层原则（背景=氛围 / 玻璃=层级 / 内容=信息）**：当前代码大量使用 glass 类导致「全玻璃化」，该原则是真实改进方向。
3. **Dashboard 职业状态卡（职业准备度四维）**：数据来源全部存在（resume_assets/topic_progress/content_projects/interview_questions），无需新表即可出 MVP。
4. **岗位匹配度「先规则后 AI」**：同义词表 + 加权公式先跑通闭环，符合当前数据规模（职位 258 条级）。
5. **能力缺口 → 学习路线闭环**：content 已按 career_key 组织，补 skill_content_links 即可复用，不重建内容体系。
6. **新增 4 张表（012-015）**：skill_taxonomy/user_skills/job_skill_links/skill_content_links + job_clusters + job_applications + market_stats，与现有 schema 风格（bigserial、user_id 隔离、updated_at）一致。
7. **分阶段小步上线 + 明确「不做清单」**：与仓库既有迭代节奏一致。

### 3.3 风险与缺口（需在执行前明确）

| # | 缺口 | 说明 | 建议 |
|---|---|---|---|
| G1 | **面试维度无数据源** | 准备度四维含「面试」，但 interview_questions 仅是题库，**无答题/模拟面试记录表**；log_entries(kind='interview') 只是日志 | P0 用 log_entries 数量近似；P3 求职管理时补轻量表；面试权重初期设低（无数据时为 0） |
| G2 | **知识域（knowledge domain）在 2.0 IA 中缺失** | 已有 knowledge_notes/tags/links 表 + /api/notes + migration/ 内容迁移工具，但 2.0 信息架构完全没给它位置，无 UI | 将「知识库/笔记」纳入「学习」子模块或明确砍掉；**不能既有数据又无入口** |
| G3 | **/api/dashboard 与 /api/summary 重叠** | 路线图新增 /api/dashboard 聚合四区块，但 /api/summary 已是同类聚合接口 | 扩展 /api/summary 或让其被 /api/dashboard 取代，避免双接口并存 |
| G4 | **职业模块 P0 范围过大** | 职业画像/技能树/简历/GitHub/面试 全部新建页面，P0 全做会拖慢 UI 重构 | P0 只做「职业入口 + 职业状态卡 + 职业画像占位」；技能树/简历/面试随 P2/P3 落地 |
| G5 | **wellbeing 收敛有功能丢失风险** | 当前 wellbeing 页面功能完整（饮水环/能量/休息/提醒/日程），直接「收敛为浮层」会丢功能 | 保留 /wellbeing 页面，仅把「提醒」做成全局浮层（toast/通知），页面从学习模块可进入 |
| G6 | **market_stats 结果表可能过早** | 数据量小（258 条），实时 SQL 聚合足够快 | P4 先做实时聚合 + 60s 缓存，数据量大后再上结果表；roadmap 的结果表作为备选 |
| G7 | **skill_taxonomy 无种子数据/维护机制** | roadmap 未说明如何初始化技能表与 topic 映射 | 从 resume_assets(kind=skill) + content_topics 标题 + job_postings.tags 高频词生成初始表，提供管理入口（设置页），沿用 hosts 周更思路 |
| G8 | **文档引用失效** | 路线图依据引用《设计方案-原稿.md》，该文件已删除（git status D）；主稿已更新为《下一版本具体改动方向和设计方案.md》 | 已在本记录中修正路线图引用（见四-1） |
| G9 | **移动端「我的」与 Web「设置」不一致** | 主稿移动端 Tab 为 首页/学习/招花/职业/我的，Web 为 首页/学习/招花/职业/设置 | 明确移动端「我的」= 设置 + 数据入口的映射关系，避免双端体验割裂 |
| G10 | **专注（focus）无独立入口** | 设计将「专注」列入学习子模块，但当前 focus-timer 仅嵌在 dashboard | 学习分组落地时给专注独立子页或浮层入口 |

### 3.4 优化建议（按优先级）

1. **P0 严格瘦身**：P0 只做「导航重构（阶段 A：Web 顶导 5 入口 + /career 占位）+ Liquid Glass 2.0 token + Dashboard 职业状态卡 + /api/dashboard（合并 /api/summary）」，健康浮层、职业全模块、学习分组全部后置，避免 UI 阶段战线过长。
2. **技能体系先建「种子 + 回填」**：012 迁移落地时同步生成初始 skill_taxonomy（从 resume_assets/topics/job tags 抽取），并把已有 job_postings.tags 一次性回填 job_skill_links，P2 一上线就有数据。
3. **job_clusters 去重键规范化**：去重键用「规范化 title + 规范化 company + city」，规范化规则（小写/去括号/去后缀）作为纯函数放 packages/shared 并配单测；保留人工「拆分组」入口。
4. **新鲜度徽标按渠道区分**：job 类职位用 published_at/fetched_at；announcement/event（考公考编）类用 deadline_at 倒计时，两类不可混用同一徽标逻辑。
5. **面试维度轻量化**：新增 interview_attempts（或复用 log_entries 查询），P0 不建表，用「本月 log_entries(kind='interview') 数量 + 自评」近似。
6. **市场分析实时聚合优先**：P4 用 GROUP BY 实时聚合 + 60s 内存缓存；仅当数据量 >5 万条再考虑 market_stats 结果表。
7. **知识域给位置**：将「知识库」纳入学习子模块（学习 → 知识库），复用已有表与 API，补一个列表/详情页即可，性价比高。
8. **所有新 API 沿用仓库测试约定**：仓库每个 route.ts 都有 route.test.ts，新接口（jobs 扩展、readiness、skills、match、gaps、applications、market）必须配套单测。
9. **统一前端筛选组件**：招花多条件筛选（薪资/学历/经验/时间/技能）做成可复用 FilterPanel（Web 侧栏 + Mobile Bottom Sheet 共用一份状态逻辑），避免双端各写一套。
10. **匹配度口径透明**：UI 标注「匹配度为参考建议」，规则版公式（技能 0.7 + 学历 0.1 + 经验 0.1 + 城市 0.1）在共享包内实现 + 单测。

---

## 四、改动记录


### 2026-08-20 · feat/ui/db（M2.0-P3 求职管理）

**改动**：完成 P3 阶段（求职管道：收藏 → 投递 → 笔试/面试 → Offer → 入职 + Kanban 看板）。

- **015 迁移**：`db/migrations/015_job_applications.sql` —— job_applications 表（stage 枚举 favorite/ready/applied/online_test/interview1/interview2/offer/hired/closed + note + applied_at + UNIQUE(user_id, job_id) + 索引）。
- **求职管理 lib**：`lib/job-applications.ts` —— listApplications（JOIN 职位快照）/ addApplication（upsert，投递类阶段自动记 applied_at）/ updateApplicationStage / deleteApplication / applicationStats（九阶段计数）/ getApplicationByJob。
- **API**：`/api/jobs/applications` GET（列表+统计）/ POST（加入求职）；`/api/jobs/applications/:id` PUT（阶段流转+备注）/ DELETE。
- **Web Kanban 看板**：`apps/web/app/career/applications/page.tsx` —— 四列看板（收藏/进行中/Offer/已入职关闭）+ 九阶段统计卡 + 卡片内阶段下拉/前后移/删除 + 备注展示；入口：职业下拉「我的求职」+ 职业画像页新卡片。
- **职位详情「加入求职」**：`job-modal.tsx` / `job-detail-panel.tsx` 操作区新增「加入求职」按钮（POST → favorite 阶段）。
- **Mobile**：`apps/mobile/src/app/applications.tsx` 求职列表（阶段 chips 快速流转 + 删除）；career Hub 新增「我的求职」可点卡片。
- **shared**：`jobApplicationStageSchema` + 标签/颜色 + KANBAN_COLUMNS 分组 + JobApplication 类型（含职位快照）。

**涉及文件**：db/migrations/015_job_applications.sql；packages/shared/src/index.ts；apps/web/lib/job-applications.ts(+test)；apps/web/app/api/jobs/applications/route.ts、applications/[id]/route.ts；apps/web/app/career/applications/page.tsx、career/page.tsx；apps/web/components/jobs/job-modal.tsx、job-detail-panel.tsx；apps/web/components/app-shell.tsx；apps/mobile/src/app/applications.tsx、career.tsx。

**原因/决策**：按实施路线图 M2.0-P3 验收（从收藏到 Offer 全流程可记录）落地；遵循建议 5 前序（面试记录以 note + 阶段体现，interview_attempts 表暂不新增）；job_favorites 保留为「快存」，job_applications 承载完整管道（与 roadmap 一致）。

**验证**：web/mobile `tsc --noEmit` 通过；web vitest 162 项（+5 applications）；`next build` 通过。

**影响**：015 为新增表（幂等）；所有求职操作需登录；与 job_favorites 并存不冲突；看板四列分组是展示层聚合，底层仍按九阶段存储。

---
### 2026-08-20 · ui/fix（招花页职位列表改四列并居中）

**改动**：三列仍不满足视觉效果，改为四列并整体居中。

- `apps/web/components/app-shell.tsx`：主内容容器 `max-w-7xl` → `max-w-[1440px]`（仍 `mx-auto` 居中）。
- `apps/web/app/jobs/page.tsx`：职位卡网格 `xl:grid-cols-3` → `sm:2 xl:3 2xl:4` 并加 `justify-center`；骨架屏 8 项同步；双栏外层由 `2xl:grid-cols-[1fr_360px]` 改为单列全宽（详情面板不再占布局列）。
- `apps/web/components/jobs/job-detail-panel.tsx`：右侧详情面板由布局列改为 `fixed` 悬浮抽屉（右缘、2xl 显示，不挤占职位网格宽度）。

**涉及文件**：apps/web/components/app-shell.tsx、apps/web/app/jobs/page.tsx、apps/web/components/jobs/job-detail-panel.tsx。

**原因/决策**：4 列职位 + 全宽网格 + 详情悬浮抽屉，保证信息密度与居中；桌面详情联动改为浮层方式保留。

**验证**：web `tsc --noEmit` 通过；`next build` 通过。

---
### 2026-08-20 · ui/fix（招花页职位列表改三列）

**改动**：招花页职位列表由两列改为三列（P1 双栏布局后列表过窄，视觉别扭）。

- `apps/web/components/app-shell.tsx`：主内容容器 `max-w-5xl` → `max-w-7xl`（全站内容区加宽，为三列腾出宽度）。
- `apps/web/app/jobs/page.tsx`：职位卡网格 `md:grid-cols-2` → `sm:grid-cols-2 xl:grid-cols-3`；骨架屏同步；双栏布局由 `xl:grid-cols-[1fr_380px]` 改为 `2xl:grid-cols-[1fr_360px]`（桌面详情面板只在超宽屏 2xl 显示，常规桌面直接三列职位）。
- `apps/web/components/jobs/job-detail-panel.tsx`：右侧详情面板断点 `xl:flex` → `2xl:flex`，与父网格对齐。

**涉及文件**：apps/web/components/app-shell.tsx、apps/web/app/jobs/page.tsx、apps/web/components/jobs/job-detail-panel.tsx。

**原因/决策**：P1 双栏（xl 起显示右侧详情面板 380px）挤占列表宽度，两列卡片偏窄；改三列 + 全站加宽容器，详情面板收敛到 2xl 超宽屏才显示，常规桌面优先信息密度。

**验证**：web `tsc --noEmit` 通过；`next build` 通过。

---
### 2026-08-20 · docs（评审与记录机制建立）

- **新增**：本文档（改动记录台账），建立「全部改动必须记录于此」的约定。
- **评审**：通读 2 份 2.0 设计文档并对照当前代码，结论见第三节（总体合理 + G1~G10 缺口 + 10 条优化建议）。
- **修正**：`docs/Learn-Workbench-2.0-实施路线图-优化版.md` 首部「依据」引用由已删除的《设计方案-原稿.md》更新为《下一版本具体改动方向和设计方案.md》。
- **状态**：未开始代码改动；后续所有修改按模板追加到本文档。


### 2026-08-20 · feat/ui（M2.0-P0 信息架构 + Design System + Dashboard）

**改动**：完成 P0 阶段（信息架构 + Design Token + Dashboard 职业状态卡 + wellbeing 系统级浮层 + Mobile Tab 重构）。

- **Web 顶导 5 入口**：`apps/web/components/app-shell.tsx` 由 7 项侧边栏重构为顶导 5 入口（首页/学习▾/招花/职业▾/设置）；学习下拉（路线图/今日任务/专注/日志），职业下拉（画像/技能树/简历/面试）；移动端底部导航 5 入口（首页/学习/招花/职业/我的）。
- **/career 职业模块**：新增 `apps/web/app/career/page.tsx`（职业画像：准备度环 + 四维进度条 + 发现职位）+ `career/skills|resume|interview` P2/P3 占位页；移动端 `apps/mobile/src/app/career.tsx` 职业 Hub。
- **Design Token**：`packages/ui/src/index.ts` 更新为 2.0 规范（色彩 Background/Surface/Glass/Primary/Secondary/...；圆角 sm8 md12 lg16 xl20 2xl28；阴影 sm/md/lg/glass；间距 4/8/12/16/24/32/48/64；字号 xs~4xl）；`apps/web/app/globals.css` 导航布局改为顶导（.app-topnav）。
- **Dashboard 职业状态卡**：`apps/web/app/dashboard/page.tsx` 新增职业准备度卡（复用 readiness 数据），数据源切换为聚合接口。
- **新接口**：`/api/profile/readiness`（四维准备度，规则版：技能40% 项目30% 简历15% 面试15%，数据全部来自现有表）；`/api/dashboard`（一次请求聚合 summary + readiness + jobsTotal，替代前端多请求）；对应 `lib/readiness.ts` 与 route.test.ts。
- **wellbeing 收敛**：`apps/web/components/wellbeing-float.tsx` 全局健康提醒浮层（有提醒时出现，点击进 /wellbeing），页面与数据保留；不再占一级导航。
- **Mobile Tab 重构**：`apps/mobile/src/app/_layout.tsx` 改为 首页/学习/招花/职业/我的；新增 `learn.tsx`（学习 Hub：路线图/任务/日志）、`career.tsx`（职业 Hub：拉取 readiness）。
- **shared 类型**：`packages/shared/src/index.ts` 新增 careerReadiness / dashboardAggregate 类型。

**涉及文件**：apps/web/components/app-shell.tsx、wellbeing-float.tsx；apps/web/app/career/{page,skills/page,resume/page,interview/page}.tsx；apps/web/app/dashboard/page.tsx；apps/web/app/api/{profile/readiness,dashboard}/route.ts(+test)；apps/web/lib/readiness.ts；packages/ui/src/index.ts；packages/shared/src/index.ts；apps/web/app/globals.css；apps/web/app/tasks/page.tsx（#focus 锚点）；apps/mobile/src/app/{_layout,learn,career}.tsx。

**原因/决策**：按实施路线图 M2.0-P0 验收（首页一眼看到职业目标与准备度；导航 5 项清晰；旧功能不回归）落地；遵循评审建议 1（P0 瘦身）、G3（合并 /api/dashboard）、G1（面试用 log_entries 近似）、建议 8（新 API 配单测）。

**验证**：web/mobile `tsc --noEmit` 通过；web vitest 146 项全部通过（含新增 readiness/dashboard 测试）；`next build` 通过。

**影响**：/wellbeing 从导航隐藏但页面保留；旧 URL（/roadmap /tasks /logs /jobs /settings）全部保留可访问；职业/技能树/简历/面试为占位页（P2/P3 落地）；未引入任何新表（P0 数据全部来自现有表）。

### 2026-08-20 · feat/ui/db（M2.0-P1 招花核心增强）

**改动**：完成 P1 阶段（多条件筛选 + 职位新鲜度 + 去重聚类 + Web 双栏 + Mobile Bottom Sheet）。

- **职位新鲜度徽标**：`packages/shared/src/index.ts` 新增 `jobFreshness()`（按渠道区分：job 用 published_at/fetched_at → 🟢刚发布/🔵3天/🟡7天/⚪14天/🔴可能失效；announcement/event 用 deadline_at 倒计时）；Web `components/jobs/freshness-badge.tsx` + 卡片/详情/右侧面板展示；Mobile 卡片 + 详情同步。
- **多条件筛选扩展**：`/api/jobs` 新增 salaryMin/salaryMax/education/experience/publishedWithin/skills 参数；`lib/jobs.ts` queryJobs 条件拼接（薪资区间、学历多选、经验多选、发布时间窗口、技能 tags ?| 匹配）；Web `components/jobs/job-filter-panel.tsx` 可复用筛选面板（薪资预设/学历/经验/时间/技能 + 重置）；Mobile `lib/jobs.ts` 查询构建器同步。
- **职位去重聚类**：新增 `db/migrations/013_job_clusters.sql`（dedup_key 唯一 + job_ids/source_list/primary_job_id）；`lib/job-clusters.ts` 增量聚类（按规范化标题|公司|城市，7 天窗口）；`/api/jobs/cluster` POST 手动触发；shared 新增 `normalizeJobText()` / `jobDedupKey()` 规范化纯函数（小写/去括号/去公司后缀）；列表接口 includeSources=1 附带来源聚合，卡片展示「发现来源：BOSS/猎聘/智联」。
- **Web 双栏布局**：`jobs/page.tsx` 改 xl 双栏（左列表 + 右 `components/jobs/job-detail-panel.tsx` 详情联动，窄屏沿用弹窗）；新增「高级筛选」折叠区 + 「立即去重」按钮。
- **Mobile 对齐**：`apps/mobile/src/app/jobs.tsx` 新增筛选 Bottom Sheet（薪资/学历/经验/时间/技能）、卡片新鲜度与多来源徽标；详情弹窗补充新鲜度/多来源。

**涉及文件**：packages/shared/src/index.ts、p1.test.ts；db/migrations/013_job_clusters.sql；apps/web/lib/jobs.ts、job-clusters.ts(+test)；apps/web/app/api/jobs/route.ts(+test)、cluster/route.ts；apps/web/app/jobs/page.tsx；apps/web/components/jobs/{freshness-badge,job-filter-panel,job-detail-panel}.tsx、job-card.tsx、job-modal.tsx；apps/mobile/src/app/jobs.tsx、src/lib/jobs.ts、src/components/job-detail-modal.tsx。

**原因/决策**：按实施路线图 M2.0-P1 验收（筛选项齐全、无重复职位、卡片信息层级清晰）落地；遵循评审建议 3（去重键规范化纯函数 + 单测）、建议 4（新鲜度按渠道区分）、建议 9（Web/Mobile 共用筛选状态逻辑）；聚类为增量任务不阻塞抓取（roadmap §6.3）。

**验证**：web/mobile `tsc --noEmit` 通过；web vitest 150 项（+4：cluster 3 项、jobs route 筛选 1 项）；shared vitest 7 项（freshness/normalize）；`next build` 通过。

**影响**：/api/jobs 新增参数向后兼容（不带参数行为不变）；job_clusters 为新增表，不影响既有数据；双栏仅桌面端（xl）启用，窄屏仍用弹窗；Mobile 筛选为新增交互，不改既有筛选默认值。
**部署修复（服务器 106.55.2.197）**：
- 首次部署发现 init 幂等标记（app_meta.deploy_init）导致**新迁移被整体跳过**，`013_job_clusters.sql` 未执行、/api/jobs 报 relation not exist → 已手动应用 013 + 改进 `scripts/docker-init-db.sh`：新增 `schema_migrations` 表按文件逐个跟踪迁移，后续部署只执行未应用的新迁移（不再整体跳过）；服务器已回填 001-011 + 013 的跟踪记录并同步改进脚本。
- 验证：/api/jobs 带筛选 200；job_clusters 表存在；`sh -n` 语法通过。

### 2026-08-20 · feat/ui/db（M2.0-P2 学习 × 招聘打通 —— 项目核心价值）

**改动**：完成 P2 阶段（技能体系 + 用户画像 + 岗位匹配 + 能力缺口 + 一键加入学习路线）。

- **014 迁移**：`db/migrations/014_skill_taxonomy.sql` 四张表 —— skill_taxonomy（技能库：规范名/别名/分类）、user_skills（用户画像：level 0-5 + source）、job_skill_links（岗位技能画像）、skill_content_links（技能↔学习主题映射 + 预计时长）。
- **技能种子 + 归一化**：`db/seed_skills.sql` 初始技能库（40+ 技能，基于招花实际岗位 tags 抽取，覆盖 backend/frontend/data/ops/ai/network/security/cloud/soft）；`lib/skills.ts` normalizeSkillTag（规范名/别名/包含三级匹配）+ ensureSkill 自动补库 + backfillJobSkillLinks（job tags → job_skill_links）。
- **用户技能画像**：`/api/profile/skills` GET/POST/DELETE（列表/设置等级/移除）+ 从 resume_assets(kind=skill) 一键回填；Web `career/skills/page.tsx` 由占位页升级为真实技能树（分组展示 + 等级圆点编辑 + 从简历回填 + 手动添加）；Mobile career Hub 增加技能卡片。
- **岗位匹配度（规则版）**：`lib/skills.ts` computeJobMatch —— 匹配度 = 技能命中 70% + 学历 10% + 经验 10% + 城市 10%（技能命中：level≥2 计 1，level=1 计 0.5）；`/api/jobs/:id/match`；`components/jobs/job-match-section.tsx` 在职位详情弹窗 + 桌面详情面板展示匹配度分数 + ✓命中/△部分/缺失技能。
- **能力缺口 + 学习闭环**：`computeSkillGaps`（缺口 = 岗位技能 - 用户技能，经 skill_content_links 映射到学习主题 + 预估时长）；`/api/jobs/:id/gaps`、`/api/jobs/gaps/enroll`（缺口一键生成 daily_tasks 加入今日计划）；详情内「缺口加入我的学习路线」按钮。
- **技能候选**：`/api/jobs/skills` 技能库列表（供筛选/管理选择）。

**涉及文件**：db/migrations/014_skill_taxonomy.sql、db/seed_skills.sql；packages/shared/src/index.ts；apps/web/lib/skills.ts(+test)；apps/web/app/api/{profile/skills,jobs/skills,jobs/[id]/match,jobs/[id]/gaps,jobs/gaps/enroll}/route.ts；apps/web/app/career/skills/page.tsx；apps/web/components/jobs/job-match-section.tsx、job-modal.tsx、job-detail-panel.tsx；apps/mobile/src/app/career.tsx。

**原因/决策**：按实施路线图 M2.0-P2 验收（任意职位可看匹配度与缺口，缺口可转化为学习任务）落地；遵循评审建议 2（技能先建「种子 + 回填」，P2 一上线就有数据）、建议 8（新 API 全配单测）；匹配度按 roadmap §7.3 规则版公式，P5 再上模型。

**验证**：web/mobile `tsc --noEmit` 通过；web vitest 157 项（+7 skills）；shared vitest 7 项；`next build` 通过。
**部署修复（服务器 106.55.2.197）**：
- P2 部署时 init 脚本的 app_meta JSON 写入转义问题：改进版脚本中 `{"v":1}` 的引号被 shell 吞掉导致 init 报错 → 已修正 `scripts/docker-init-db.sh` 第 56 行转义（`\\"` 转义 JSON 引号），并同步服务器；014 迁移与 seed_skills（46 技能）已手动应用并标记。
- 验证：init 正常退出、skill_taxonomy 46 条、schema_migrations 13 条、/api/jobs/skills 200、需登录接口 401 正确、web 无错误日志。

**影响**：014 为新增表 + 种子（幂等）；匹配度/缺口需登录后按用户画像计算，匿名时提示登录；skill_content_links 种子映射将在部署时补数据（后续按需扩充映射）；/career/skills 由占位页升级为可用功能。

---

## 五、记录模板

```markdown
### YYYY-MM-DD · 类型（feat/fix/refactor/ui/docs/db/perf/test/chore）

- **改动**：一句话说明改了什么。
- **涉及文件**：路径列表。
- **原因/决策**：为什么改（可引用评审编号 G# / 建议 #）。
- **验证**：如何验证（测试 / 手工 / 部署）。
- **影响**：对已有功能的影响与回滚说明。
```

---

## 六、待办（源自评审，随实施推进勾选）

- [x] P0：Web 顶导 5 入口 + /career 占位（阶段 A，保留旧 URL）—— 2026-08-20 完成
- [x] P0：Liquid Glass 2.0 Design Token 落地 packages/ui + tailwind —— 2026-08-20 完成
- [x] P0：Dashboard 职业状态卡 + /api/dashboard（合并 /api/summary）—— 2026-08-20 完成（/api/dashboard 为聚合新接口，/api/summary 保留兼容）
- [x] P0：wellbeing 保留页面，提醒收敛为全局浮层 —— 2026-08-20 完成
- [x] P1：招花多条件筛选扩展 + 新鲜度徽标（按渠道区分，见建议 4）—— 2026-08-20 完成
- [x] P1：job_clusters 去重 + 来源聚合展示（规范化键见建议 3）—— 2026-08-20 完成
- [x] P1：Web 双栏布局 + Mobile Bottom Sheet 筛选（共用 FilterPanel，见建议 9）—— 2026-08-20 完成
- [x] P2：skill_taxonomy 种子 + 回填 + user_skills（建议 2）—— 2026-08-20 完成
- [x] P2：岗位匹配度规则版 + 能力缺口 + skill_content_links —— 2026-08-20 完成
- [x] P3：job_applications + 求职 Kanban + 面试记录（note 承载，暂不新增表）—— 2026-08-20 完成
- [ ] P4：市场分析实时聚合 + 缓存（建议 6）
- [ ] P5：AI 智能层（数据积累后）
- [ ] 学习子模块：知识库入口（建议 7）、专注独立入口（G10）
