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

### 2026-08-25 · feat/ui（薪资区间分布改用「占比分布带」直方图替换）

- **改动**：`/career/market` 的「薪资区间分布」由竖向直方图（HistogramBars）替换为新增的 `SalaryDistributionBand` 组件：①100% 占比分布带（线段宽度=该区间职位占比，最宽=岗位最集中，主流区间高亮描边+百分比）；②值轴刻度叠加「中位 / 平均」薪资标记（K/月）；③图例（区间·数量·占比）+ 摘要（主流区间/平均/中位）。用分布带直观体现「岗位薪资集中在哪些区间」，解决原直方图不易读分布的问题；仅用现有 `salaryDist` + `overview.avgSalary/medianSalary`，无需新增后端字段。
- **涉及文件**：apps/web/components/market/market-charts.tsx（+SalaryDistributionBand）；apps/web/app/career/market/page.tsx（引替换，去 HistogramBars）。
- **原因/决策**：用户反馈原竖向直方图未能直观体现分布区间；改用占比分布带（不同图表类型）+ 中心趋势标注，更符合「分布」语义。
- **验证**：web typecheck/lint/test 全 0。
- **影响**：纯前端换图，无数据/DB 变更；部署后 /career/market 正常渲染。

### 2026-08-25 · feat/ui（招花市场分析 2.0：市场概览 + 四段信息架构 + 技能市场地图接驳学习闭环）

- **改动**：按《招花市场分析-UI优化方案-评审后v2.md》执行 P0 主增量。①市场分析页由"等权卡片堆叠"重构为「市场概览 + 01 市场需求 / 02 技能机会 / 03 人才画像 / 04 我的学习机会」四段信息架构，数据来源/岗位类型从主图降权为「关于数据」说明；②`MarketAnalysis` 新增 `overview`（城市去重数 / 热门技能数 / 整体均薪 + 中位薪资，全部真实取数），首屏 KPI 不再用伪指标；③新增 `SkillMarketMap`（技能市场地图：四象限 X=需求职位数 / Y=均薪 / Size=职位数，冷调 token 着色 + 我的掌握状态描边，点击详情 + 一键加入学习路线），复用现有 `/api/profile/skills` + `/api/skills/gaps` + `/api/jobs/gaps/enroll`；④规则驱动「市场洞察」，全部由 `/api/market` 字段计算，无静态文案。
- **涉及文件**：packages/shared/src/index.ts（+marketOverviewSchema、MarketAnalysis.overview）；apps/web/lib/domains/market/{types,analysis}.ts（overview 计算）；apps/web/lib/market.test.ts（+2 mock + overview 断言）；apps/web/components/market/market-charts.tsx（+SkillMarketMap / SkillMapNode / SKILL_LEVEL_LABELS）；apps/web/app/career/market/page.tsx（重构）；docs/招花市场分析-UI优化方案-评审后v2.md（新增方案稿）。
- **原因/决策**：评审确认「市场×学习闭环」数据层与多数 UI 已建成（aggregateMarketGaps / user_skills / enrollGapsToTasks + /api/skills/gaps 等 + 技能树/首页/职位详情三处缺口卡），缺的只是接到市场页，故把原稿 Phase 5（最后、长期）**前置为 P0**；概览与技能状态改为真实可算，消除「17.4K 整体均薪 / 学习中 62%」等伪指标；图表色板用冷调 token 对齐全站（全站 token 统一留待 P1）。
- **验证**：web vitest 全过（market +2）；`pnpm -F web typecheck` 0 error；`pnpm -F web lint` 0 error；`pnpm -F web build` 通过；部署后 /api/market 返回 overview、/career/market 正常渲染技能地图与闭环、（匿名访问无报错）。
- **影响**：/api/market 新增 overview 字段（向后兼容）；纯前端交互增强，无 DB 变更；匿名用户隐藏「我的技能 / 能力缺口」，仅显示市场统计与登录提示。
- **更正（部署实测 2 处，commit e74b8a4 + 7ae6c5b）**：① `overview.skillCount` 首版写成 `count(DISTINCT jsonb_array_elements_text(tags))`，真库报 Postgres `0A000 aggregate function calls cannot contain set-returning function calls` → 改为子查询先展开 tags 再 `count(DISTINCT tag)`（修复后返回 253）；② `overview.avgSalary` 首版用原始 `salary_max/min` 直接求均值，真库 avgSalary=944（离群值如「面议/极高」占位拉偏）而 medianSalary=20 正常 → 改为按薪资直方图分桶中点加权估算（末桶「30K 以上」封顶 40K），中位数不变（更稳健）。本地 typecheck/lint/market test 均 0；**注**：本地 `pnpm -F web build`（Turbopack）在本机报既有错误（`tsc --showConfig` 解析失败 + 4 条既有动态文件系统警告），基线 HEAD 同样失败→属既有/Windows 环境问题，与本次改动无关；生产在服务器 Linux Docker 内构建，`next build` 正常（TypeScript 12s 通过、74 页生成）。

### 2026-08-25 · docs（规划 + 文档清理）

- **改动**：新增《P3-面试题库与模拟面试-任务清单.md》（P3 题库刷题/答题复盘/求职 Kanban 联动 + 后续笔试/Offer/统计/AI 模拟面试任务的规划稿，不含实现）；删除已完成并已记录于本文档的规划类文档：docs/P0-安全加固与HTTPS部署.md、docs/JOBS_ANTI_CRAWL.md、docs/招花-考公考编央国企-实施方案.md；README.md 与 docs/DEPLOY_LOG_2026-08-23.md 中指向上述已删文档的链接改为指向本文档。
- **涉及文件**：docs/P3-面试题库与模拟面试-任务清单.md（新增）；docs/Learn-Workbench-2.0-改动记录.md（本记录）；README.md；docs/DEPLOY_LOG_2026-08-23.md；删除上述 3 个已完成规划文档。
- **原因/决策**：P3 求职管理（kanban 挂件）已完成，面试题库与模拟面试为待办子功能，先落任务清单；已完成功能的规划/设计文档已由本文档承载，不再保留以免漂移。
- **验证**：无代码改动；文档链接已改指向本文档，无死链。
- **影响**：仅文档层；不影响代码/构建/部署。

### 2026-08-24 · chore（收尾清理：市场缓存失效 + 迁移 012 补档 + /focus 确认）

- **改动**：新增 `invalidateMarketCache()`（DELETE market_stats），两个爬虫脚本写库后调用（市场分析不再读 60s 旧缓存）；迁移 012 补档（idx_jobs_published 发布时间索引，补齐 011→013 跳号）；确认 /focus 无页面/无悬空链接（历史 404 不可复现）。
- **涉及文件**：apps/web/lib/domains/market/analysis.ts(+test)；scripts/jobs_official.mjs、jobs_browser.mjs；db/migrations/012_jobs_published_index.sql。
- **原因/决策**：收尾历史遗留 —— 市场缓存已落地但缺失效钩子；迁移编号跳号影响 verify-migrations；/focus 为旧会话观察。
- **验证**：web vitest 183 全过（+2）；verify-migrations「全部检查通过 ✅」（19 迁移连续）；E2E 11/11；服务器迁移 012 已应用、/api/market 200。
- **影响**：无破坏性改动；爬虫后市场分析最多 60s 内重算。

### 2026-08-24 · feat（移动端接入岗位学习计划 + 发布就绪）

- **改动**：mobile `lib/jobs.ts` 新增 fetchJobPlan/enrollJobGaps；JobDetailModal 新增「岗位学习计划」区块（匹配度/补完收益、按阶段分组缺口、一键加入学习任务）；expo export android 打包验证通过。
- **涉及文件**：apps/mobile/src/lib/jobs.ts；apps/mobile/src/components/job-detail-modal.tsx。
- **原因/决策**：让「整包规划」在手机端可用，与 Web 端能力对齐；发布流程走 EAS（需用户 Expo 账号）。
- **验证**：mobile typecheck/test 22/lint 全过；expo export android 成功（entry-*.hbc 4.8MB）。
- **影响**：纯客户端改动，无需服务器部署；后续发布：eas login → eas build -p android（步骤见 DEPLOY_LOG 十六节）。

### 2026-08-24 · feat（岗位学习计划：整包规划）

- **改动**：新 API `GET /api/jobs/[id]/plan`（岗位信息 + 匹配度 + 按路线图阶段分组的能力缺口计划 + 总时长/预估周数）；职位详情新增「岗位学习计划」区块（补完收益、阶段分组、`roadmap#phase-<id>` 定位、一键加入）；computeSkillGaps 输出阶段信息并支持预计算 missingSkills。
- **涉及文件**：packages/shared/src/index.ts；apps/web/lib/skills.ts；apps/web/app/api/jobs/[id]/plan/route.ts(+test)；apps/web/components/jobs/job-match-section.tsx；e2e/tests/job-plan.spec.ts。
- **原因/决策**：把「选岗位 → 缺口 → 学习」串成整包主流程；按阶段分组让计划直接对应路线图（点阶段可跳转）；复用 computeJobMatch 避免重复查询。
- **验证**：web vitest 181 全过（+3）；E2E 11/11（+2）；线上实测计划 API 结构完整、详情面板展示计划。
- **影响**：纯读 API + 前端展示；「全部缺口加入」复用既有 /api/jobs/gaps/enroll；job.id 已 Number 收口（bigint 序列化问题）。

### 2026-08-24 · feat/db（B5 同步幂等键 + schema.sql 全量对账）

- **改动**：迁移 019 给 `sync_changes` 加 `change_id` + 唯一索引；server applyChanges/recordSyncChanges 按 changeId 去重（重试不重复 apply/记录）；mobile 10 处 pending change 生成点注入 `changeId: uid()`；schema.sql 从迁移 003~017 补齐 23 张表（招花/健康/技能/安全/市场统计）。
- **涉及文件**：db/migrations/019_sync_change_id.sql；db/schema.sql；apps/web/lib/sync-service.ts(+test)；apps/mobile/src/store/app-store.ts(+test)。
- **原因/决策**：网络重试导致重复 apply/审计日志膨胀 → 客户端生成稳定 change_id 幂等；schema.sql 与迁移漂移 23 表 → 全量对账使 verify-migrations 通过。
- **验证**：web 178 / mobile 22 测试全过；线上同 changeId 推送两次 applied 1→0、sync_changes 仅 1 行；verify-migrations 漂移清零。
- **影响**：旧客户端无 changeId 走原逻辑（兼容）；新增审计列不影响现有数据；schema.sql 追加表为 IF NOT EXISTS（幂等）。

### 2026-08-24 · ci（Playwright E2E 接入 GitHub Actions）

- **改动**：`.github/workflows/ci.yml` 新增 `e2e` 作业（docker compose 全栈 + create-admin + Playwright chromium，失败上传报告）；e2e config 支持 `E2E_BROWSER=chromium`；workflow 设 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`（install 跳过下载，不影响显式 install）。
- **涉及文件**：.github/workflows/ci.yml；e2e/playwright.config.ts；e2e/README.md。
- **原因/决策**：把 9 个回归用例变成每次 push 的自动闸门；用 Playwright 自带 chromium 避免依赖 runner 预装 Chrome；docker compose 复用生产部署路径，不另写启动脚本。
- **验证**：本地 9/9 回归通过；YAML 人工核对；首次 CI 运行待 push 后观察（docker 全量构建 10-15 分钟）。
- **影响**：纯 CI 配置，不影响运行时；quality 作业仍 20 分钟超时，e2e 作业 30 分钟。

### 2026-08-24 · feat（缺口→路线图定位 + 技能画像冷启动）

- **改动**：缺口「→ 学习主题」链接到 `/roadmap#phase-<id>`，roadmap 页支持 hash 展开定位；新 API `GET /api/skills/recommend`（按职业推荐技能，自动建库）；技能树页「按职业推荐技能」冷启动卡（一键添加为入门）；shared MarketGapItem 增加阶段字段 + SkillRecommend 类型。
- **涉及文件**：packages/shared/src/index.ts；apps/web/lib/skills.ts；apps/web/app/api/skills/recommend/route.ts(+test)；apps/web/components/skills/market-gaps-card.tsx；apps/web/app/roadmap/page.tsx；apps/web/app/career/skills/page.tsx；e2e/tests/skills-gaps.spec.ts。
- **原因/决策**：把「打通」体验补完整 —— 缺口不仅要能加入任务，还要能跳到路线图对应阶段去学；冷启动按职业推荐技能降低画像录入成本。
- **验证**：web vitest 175 全过；E2E 9/9（新增推荐卡 + hash 定位展开）；lint 0 error。
- **影响**：recommend 会在技能库自动补建缺失技能（幂等）；roadmap hash 定位为纯前端增强。

### 2026-08-24 · feat（学习 × 招聘打通：聚合「市场需求缺口」）

- **改动**：新增 `GET /api/skills/gaps`（市场高频需求技能 × 我的缺失 × 学习建议）；技能树页新增「市场需求缺口」卡（岗位数/我的等级/→主题/一键加入学习）；Dashboard 新增能力缺口入口卡；修复 `enrollGapsToTasks` 用 topicId 当任务标题的 bug；新增 `scripts/backfill_skill_content_links.mjs` 回填技能↔主题映射（服务器 18 条生效）。
- **涉及文件**：packages/shared/src/index.ts；apps/web/lib/skills.ts；apps/web/app/api/skills/gaps/route.ts(+test)；apps/web/components/skills/{market-gaps-card,dashboard-gap-card}.tsx；apps/web/app/career/skills/page.tsx；apps/web/app/dashboard/page.tsx；scripts/backfill_skill_content_links.mjs；e2e/tests/skills-gaps.spec.ts。
- **原因/决策**：按评审 P2「学习×招聘打通」核心价值推进；在既有按岗位匹配/缺口基础上补「聚合视图」，形成 市场→缺口→学习建议→一键加入 闭环；映射用关键词脚本而非静态迁移（名称匹配更稳，可重复执行）。
- **验证**：web vitest 172 全过（+3）；E2E 7/7（新增 2 用例）；服务器实测 API 200 / 技能页 / 首页卡 / 加入学习创建任务（标题含真实主题名）。
- **影响**：/api/skills/gaps 为纯读聚合；新增 daily_tasks 仅用户主动「加入学习」时产生；skill_content_links 新部署需跑回填脚本。

### 2026-08-24 · test（Playwright E2E 回归基线）

- **改动**：新增 `e2e/` 包（@playwright/test + 系统 Chrome，无需下载浏览器），沉淀关键路径无头回归测试：dashboard 水合 #418 与顶栏日期、ICT 学习规划自定义主题增删闭环、职业下拉不被裁切、添加弹窗视口居中、专注页无 404。globalSetup 登录一次写入 storageState，未配置凭据自动跳过；根脚本 `pnpm test:e2e`，不参与 `pnpm -r test`。
- **涉及文件**：e2e/（package.json、playwright.config.ts、global-setup.ts、helpers/*、tests/*.spec.ts、README.md、.env.example）；pnpm-workspace.yaml（+e2e、allowBuilds playwright）；package.json（test:e2e）；pnpm-lock.yaml。
- **原因/决策**：把历轮手工无头验证脚本沉淀为可重复的回归护栏，为后续「学习×招聘」大功能打地基；不引入浏览器下载（channel: chrome），凭据走 env 不进仓库。
- **验证**：对线上 `http://106.55.2.197` 实测 **5/5 通过**；无凭据时 5 用例正确跳过；e2e typecheck 通过；root `pnpm test` 不受影响（web 169 + mobile 全过）。
- **影响**：纯 dev 工具，不影响运行时与部署产物。

### 2026-08-24 · feat（ICT 学习规划支持自定义添加/删除主题）

- **改动**：`/api/roadmap/custom` 移除 `career_key='ict'` 的 403 拦截（改阶段存在性校验）；新增迁移 `018_careers_unlock_ict.sql` 将 ict 的 `is_locked` 置 false；003 seed / schema.sql 同步。ICT 与其它职业路线一致可添加/删除自定义主题。
- **涉及文件**：apps/web/app/api/roadmap/custom/route.ts(+test)；db/migrations/018_careers_unlock_ict.sql；db/migrations/003_careers.sql；db/schema.sql。
- **原因/决策**：需求「ICT 学习规划不要固定，允许自定义添加和删除」；复用既有 is_custom/owner_id 权限模型，删除仍仅限本人自定义主题。
- **验证**：web vitest 169 全过（ICT→201、阶段不存在→400）；服务器实测添加 201→刷新出现→删除 200→消失，0 console error。
- **影响**：在线库经 init 迁移 018 生效（ict is_locked=f）；删除仍仅限 is_custom 且 owner 本人。

### 2026-08-24 · fix（AppShell 顶栏日期 mounted 门控，根治 #418 复发）

- **改动**：`apps/web/components/app-shell.tsx` 顶栏日期 `todayISO()` 改为挂载后再计算（`mounted ? todayISO() : ""`）。
- **原因/决策**：`todayISO()` 在静态预渲染时被烤进所有页面顶栏，与 dashboard #418 同根因；快照过期/时区跨日会复发。
- **验证**：服务器实测 /dashboard 顶栏日期正常，console 0 error。
- **影响**：顶栏日期 SSR 输出空占位，水合后填充（一帧内）。

### 2026-08-24 · fix（/dashboard 水合 #418）

- **改动**：`apps/web/app/dashboard/page.tsx` 标题/副标题的问候与日期改为 `mounted` 后计算，SSR 输出占位文案。
- **原因/决策**：SSR 静态快照把 `new Date()` 烤进 HTML，客户端水合按当前时间重算 → React #418。
- **验证**：SSR HTML 含占位不含时间；水合后显示真实日期/问候；console 0 error。
- **影响**：无。

### 2026-08-23 · fix/ui（导航下拉被裁 + 添加弹窗未居中 + 移除 Google Fonts）

- **改动**：globals.css 恢复 `.glass.absolute/fixed/sticky` 定位语义、`.page-enter` fill-mode 修正；GlassModal 改 createPortal 挂 body；移除 fonts.googleapis 依赖改自包含字体栈。
- **涉及文件**：apps/web/app/globals.css；apps/web/components/ui/modal.tsx。
- **原因/决策**：B 阶段 UI 验收发现的两处布局缺陷 + CSP/国内不可达字体问题。
- **验证**：Playwright 无头实测下拉 y=57.5、弹窗精确居中、字体 CSP 错误消除。
- **影响**：无。

### 2026-08-20 · ui/feat（市场分析页布局重构 —— 上大下小 / 左主右辅 / 多模块分组 + 新增 5 个分析模型）

**改动**：招花市场分析页由 2×2 四宫格重构为现代 B 端数据大屏布局，新增多套数据分析模型。

- **布局重构**：顶部大标题区保留；第一行通栏大卡片（岗位职能方向分布 TOP，总览模型）；第二行左右双列（城市需求 TOP + 技能热度 TOP，原组件保留）；第三行三列（薪资区间分布 / 学历需求环形饼图 / 经验年限要求）；第四行三列（数据来源平台分布 / 岗位类型占比 / 薪资-技能相关性散点）。
- **新增模型**（lib/market.ts）：
  - `byFunction` 岗位职能方向 TOP：按 title 关键词分类（前端/后端/算法AI/测试/运维/数据/产品…），先清洗公司名脏数据（zhilian/liepin 源 title=公司名，仅约 1/3 是真职位）
  - `byPlatform` 数据来源平台分布（拉勾/猎聘/智联/前程无忧…）
  - `byJobType` 岗位类型占比（全职/实习/外包/兼职，按标题+标签识别）
  - `skillSalary` 薪资-技能相关性：job_skill_links JOIN 平均薪资（复用 P2 技能画像表，比 tags 文本匹配更准）
  - 原 byCity/bySkill/salaryDist/byEducation/byExperience 保留
- **图表组件**：纯 SVG/CSS 实现 Donut 环形饼图 + Scatter 散点图（不引图表库）；横向条形图统一青绿→蓝→蓝紫渐变；所有卡片半透明玻璃 + 圆角 12px + 轻微外发光 + 标题小图标 + 右上样本数徽标。

**涉及文件**：apps/web/app/career/market/page.tsx（重写）、apps/web/lib/market.ts(+test)、packages/shared/src/index.ts。

**原因/决策**：按用户「上大下小、左主右辅、多模块分组」布局方案重构；精修 4 点：① 行业分布因无 industry 字段且 title 混公司名，改为职能方向（数据驱动准确）；② 岗位类型样本少（225 个仅 3 实习/1 外包），补充平台分布作可靠渠道维度；③ 职能/类型分类器先清洗公司名；④ 薪资-技能用 job_skill_links 而非 tags 文本。

**验证**：web/mobile `tsc --noEmit` 通过；web vitest（+2 market 新模型）；`next build` 通过。

**影响**：/api/market 响应新增 4 个字段（向后兼容，旧字段不变）；缓存仍 60s；页面布局变化不影响其他页面。

---
### 2026-08-20 · feat/ui（M2.0-P4 招聘市场分析）

**改动**：完成 P4 阶段（市场需要什么 —— 城市/薪资/技能/学历/经验实时聚合 + 图表页）。

- **聚合 lib**：`lib/market.ts` —— analyzeMarket() 实时 SQL 聚合（城市需求 + 平均薪资、技能热度、薪资分桶、学历/经验归一统计）+ **60s 内存缓存**（评审建议 6：数据量小不上结果表，>5 万条再考虑 market_stats 落表）；invalidateMarketCache() 供爬虫后刷新。
- **API**：`/api/market` GET（一次返回全部聚合，含 total/generatedAt）。
- **Web 市场分析页**：`apps/web/app/career/market/page.tsx` —— 专业数据型布局，纯 CSS 横向柱状图（不引图表库）：城市需求 TOP / 技能热度 TOP / 薪资分布 / 学历需求 / 经验需求 / 数据说明。
- **入口**：职业下拉「市场分析」+ 职业画像页新卡片（网格 4→5 列）+ 招花页 hero「市场分析」按钮（三入口）。
- **Mobile**：`apps/mobile/src/app/market.tsx` 精简 Top 排行（城市/技能/薪资/学历经验，复用卡片体系不堆图）；career Hub 新增「市场分析」入口。
- **shared**：marketAnalysis / MarketCityRow / MarketSkillRow / MarketSalaryRow / MarketLabelCount 类型。

**涉及文件**：packages/shared/src/index.ts；apps/web/lib/market.ts(+test)；apps/web/app/api/market/route.ts；apps/web/app/career/market/page.tsx、career/page.tsx；apps/web/app/jobs/page.tsx；apps/web/components/app-shell.tsx；apps/mobile/src/app/market.tsx、career.tsx。

**原因/决策**：按实施路线图 M2.0-P4 验收（回答「市场需要什么」；数据随抓取自动更新）落地；遵循评审建议 6（实时聚合 + 60s 缓存优先，暂不建 market_stats 表）；薪资按 salary_max 分桶近似、学历/经验宽松归一，UI 注明样本量与口径（roadmap §13 风险）。

**验证**：web/mobile `tsc --noEmit` 通过；web vitest 164 项（+2 market）；`next build` 通过。

**影响**：/api/market 为纯读聚合（无新表、无写入）；缓存 60s 内重复请求不查库；公告/考试事件不计入市场统计（只统计 channel=job 的招聘岗位）。

---
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
- [x] P4：市场分析实时聚合 + 缓存（建议 6）—— 2026-08-20 完成（实时 SQL 聚合 + 60s 内存缓存，暂不建 market_stats 表）
- [ ] P5：AI 智能层（数据积累后）
- [ ] 学习子模块：知识库入口（建议 7）、专注独立入口（G10）
