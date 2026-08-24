# 招花 · 招聘信息 反爬破解与服务器部署交付记录

- 交付日期：2026-08-23（Asia/Shanghai）
- 服务器：106.55.2.197（腾讯云轻量，SSH: ubuntu@106.55.2.197）
- 部署方式：Docker Compose（/home/ubuntu/learn-workbench），Dockerfile 多阶段构建
- 关联文档：docs/JOBS_ANTI_CRAWL.md

## 一、背景与目标
服务器部署后招聘页只显示"成都"、猎聘/前程无忧/国聘/成都事业单位(cdhrss) 返回空。
目标：在多城市基础上增加成都数据，破解各站反爬，恢复多城市数据源。

## 二、本次交付内容

### 1) 城市筛选：11 城选项常驻显示
- packages/shared/src/index.ts：新增 `SUPPORTED_CITIES`（北京/上海/广州/深圳/杭州/成都/西安/乌鲁木齐/南京/武汉/苏州）
- apps/web/app/jobs/page.tsx：城市 chip 初始化为 SUPPORTED_CITIES，不再只跟随已有数据

### 2) 前程无忧 / 智联：代理支持（根治云 IP 风控）
- scripts/jobs_browser.mjs：新增 `--proxy` / 环境变量 `JOBS_PROXY`；登录态 `storageState` 自动加载（默认 config/job-hosts/storageState.json，`--storage-state`/`JOBS_STORAGE_STATE` 可覆盖）
- scripts/jobs_official.mjs：官方源 browser 引擎同样支持 proxy + storageState
- docker-compose.yml：透传 `JOBS_PROXY`/`JOBS_STORAGE_STATE`，只读挂载 `config/job-hosts`
- 实测（本地住宅 IP）：51job 成都·前端工程师 headless 未登录抓到 157 条 → 服务器空返回确认为云 IP 被 WAF 标记，需住宅代理

### 3) 猎聘：登录态采集受阻（已放弃）
- 猎聘风控会把"被自动化控制的浏览器"清空成 about:blank（采集器窗口、真实 Chrome 的 CDP 标签页、F12 均触发）
- Chrome 151 v20 App-Bound 加密阻止从本地 Profile 直接导出 cookie（实测 3086 条全部 v20，复制 Profile 后 Chrome 直接清空）
- scripts/harvest_cookies.mjs：新增采集器 + 登录态检测 + 手动导出备用说明（docs/JOBS_ANTI_CRAWL.md）
- 结论：猎聘登录态暂无法自动化获取，依赖干净 IP/代理 + 服务器 headless 历史可用记录

### 4) 国聘网（iguopin）成都职位：API 破解
- 实测接口：POST https://gp-api.iguopin.com/api/jobs/v1/recom-job，成都过滤 `district:["000000.510000.510100"]`
- scripts/jobs_official.mjs：新增 `crawlIguopinApi`（拦截接口注入成都 district，解析 JSON 入库）
- config/job-hosts/sources.json：iguopin 增加 api 配置（11 城 district 码，默认成都）
- 详情 URL：https://www.iguopin.com/job/detail?id=<jobId>（已验证）
- 实测：服务器抓取 10 条、全部 city=成都

### 5) 成都事业单位（cdhrss）
- 实测 cdhrss.chengdu.gov.cn 被 WAF 403（真实浏览器也 403）；改用成都人事考试网
- config/job-hosts/sources.json 新增：
  - `cdpta-recruit`（成都人事考试网·事业单位考试公告，列表 ortherlist_all.do?id=989，选择器 ul li:has(> span)，city=成都）→ 已启用，实测服务器抓 10 条全部成都
  - `cdhrss-sydw`（成都市人社局·事业单位招聘，c109905）→ 默认关闭（WAF 403，服务器可达后再启用）

## 三、部署步骤（已完成）
1. scp 变更文件到服务器（scripts/*.mjs、config/job-hosts/*、docker-compose.yml、apps/web/app/jobs/page.tsx、packages/shared/src/index.ts、docs/*）
2. .env 追加 `JOBS_PROXY=`（留空，注释模板供填真实住宅代理）
3. `docker compose up -d --build`（重建 web 镜像，依赖层有缓存）
4. 容器内 `node scripts/update_job_hosts.mjs` 落库 10 个信息源（version=2）
5. 容器内验证抓取：`node scripts/jobs_official.mjs --sources cdpta-recruit,iguopin --limit 10`
6. 最终镜像重建固化修复（docker cp 修正运行中容器后，再 docker compose up -d --build）

## 四、验证结果（服务器实测）
- 数据库 job_postings：`iguopin` 10 条（city=成都）、`cdpta-recruit` 10 条（city=成都），写库 20 行、新增 20
- 样例：成都市青羊区教育局 46 名高级职称教师考核招聘、成都市体育局少年儿童业余体育学校、成华区教育局中小学教师、国聘 成都锦江人才技术支持服务岗等
- update_job_hosts dry-run 校验通过（10 个源）

## 五、登录态（storageState）
- config/job-hosts/storageState.json：37 cookie + 5 组 localStorage
  - 前程无忧：51job/guid/JSESSIONID + localStorage token/userInfo ✅
  - 国聘网：__token__ + localStorage userInfo ✅
  - 猎聘：lt_auth 缺失（放弃，见上）

## 六、待办 / 注意事项
1. **JOBS_PROXY**：当前 .env 中留空。填入真实住宅代理后执行 `bash deploy-docker.sh --restart`（或 docker compose up -d）即生效。这是 51job/智联在服务器恢复数据的关键。
2. **cdhrss-sydw**（人社局）：默认关闭，若服务器可达可改为 enabled=true 后 update_job_hosts。
3. 猎聘：依赖代理/干净 IP，服务器 headless 曾有成功记录，配置代理后建议先跑一次。
4. storageState.json 含登录会话，已 gitignore，禁止提交/外泄。

## 七、回滚
- 代码回滚：保留服务器 /home/ubuntu/learn-workbench 原文件备份（如需要可 scp 覆盖回旧版后 docker compose up -d --build）
- 数据库：update_job_hosts 幂等；job_postings 按 (source, source_job_id) upsert，可 DELETE FROM job_postings WHERE source IN ('iguopin','cdpta-recruit')

## 八、B 阶段 UI 修复部署（2026-08-23 23:20 前后）
> 对应 commit：`b4a580e`(UI 定位修复)、`86ee7cf`(去 Google Fonts)。用户手动推送 git，本机领先 origin 5 个提交。

### 改动
1. `apps/web/app/globals.css`
   - `.glass.absolute / .glass.fixed / .glass.sticky` 组合选择器恢复定位语义：修复职业/学习导航下拉顶部被裁（unlayered `.glass{position:relative}` 覆盖 Tailwind utilities）。
   - `.page-enter` 动画 `fill-mode: both → backwards`：消除结束后残留 transform，避免成为 `position:fixed` 的非视口包含块。
   - 移除 `fonts.googleapis.com` 的 `@import`，`--font-sans` 改为 `ui-sans-serif/system-ui + 中文字体栈`。
2. `apps/web/components/ui/modal.tsx`：`GlassModal` 改用 `createPortal` 挂到 `document.body`。

### 验证（Playwright 无头，服务器 http://106.55.2.197 实测）
- 导航下拉：`position:absolute; top:36px; box y=57.5`（修复前 y=-73.5 被裁），在 header(64px) 下方展开。
- 添加弹窗：`box=(520.5,294.5,448x322)`，viewport 1489×911 → 水平/垂直精确居中；overlay 铺满视口；`htmlTransform:none`。
- 字体 CSP 违规已消除（构建产物无 fonts.googleapis，console 不再报 fonts 相关错误）。

### 已知遗留（另查，非本次引入）
- `/dashboard` React #418 水合不匹配（预存，疑与 render 内 Date.now() 相关）。
- `/focus` 一个 404 资源加载失败。

---

## 九、/dashboard React #418 水合不一致修复（2026-08-24，commit `74506e0`）

> 对应提交：`74506e0`. 服务器 `/home/ubuntu/learn-workbench` 同步 `apps/web/app/dashboard/page.tsx`，备份 `.bak-dash.page.tsx-20260824184003`，docker compose up -d --build 重建，web 容器重启通过.

### 根因
`/dashboard` 为静态预渲染页（无 dynamic/revalidate），build/SSR 时 `new Date()` 被烤进静态 HTML 快照（`2026-08-23 / 下午好`），而客户端水合按当前时间（`2026-08-24`）重算 → 标题/副标题文本不一致 → React 报 #418.

### 修复
`apps/web/app/dashboard/page.tsx`：
- 新增 `const [mounted, setMounted] = useState(false)` + `useEffect(() => setMounted(true), [])`.
- `today = mounted ? new Date().toISOString().slice(0,10) : ""`，`greet = mounted ? greeting() : ""`.
- h1/p 按 `mounted` 切换：SSR 输出占位（`你好，继续今天的 …` / `… · 当前职业路线：…`），水合后展示真实日期+问候.

### 验证（Playwright 无头，服务器实测）
- SSR 原始 HTML 含占位 `你好，继续今天的 ICT 学习规划`、`… · 当前职业路线：ICT 学习规划`，**不含** `晚上好`.
- 水合后 DOM 显示 `2026 年 8 月 24 日 · 当前职业路线：前端开发工程师`、`晚上好，继续今天的 前端开发工程师`.
- console **无任何 error**（React #418 已消除）；字体 CSP 错误仍为 0.

### 已知遗留（另查，非本次引入）
- `/focus` 一个 404 资源加载失败（低）.
- `AppShell` 顶栏日期 `todayISO()` 亦用 `new Date()`（`今日 2026-08-24`），与 #418 同根因；静态快照过期或构建机/客户端时区跨日时会复发，建议后续同样用 mounted 门控（P1）.

---

## 十、AppShell 顶栏日期门控 + ICT 学习规划自定义（2026-08-24，commit `30737fe` / `f305c66`）

> 服务器 `/home/ubuntu/learn-workbench` 同步 app-shell.tsx / roadmap/custom/route.ts / db/migrations/018 / 003 / schema.sql，备份 `.bak-20260824191246`，docker compose up -d --build 重建；init 应用迁移 018（`schema_migrations` 已记录）.

### 1) AppShell 顶栏日期门控（根治 #418 复发）
- 根因：`todayISO()` 在静态预渲染时把日期烤进 HTML，所有页面顶栏（`今日 2026-08-24`）与 dashboard 同根因，快照过期/时区跨日会复发 React #418.
- 修复：`const [mounted, setMounted] = useState(false)` + `useEffect(() => setMounted(true), [])`，`date = mounted ? todayISO() : ""`.

### 2) ICT 学习规划支持自定义添加/删除
- `/api/roadmap/custom` 移除 `career_key='ict'` 的 403 拦截；改为阶段存在性校验（不存在返回 400）.
- 新增迁移 `018_careers_unlock_ict.sql`：`UPDATE careers SET is_locked=false WHERE career_key='ict'`（在线库已生效）.
- `003_careers.sql` seed 与 `schema.sql` 同步：ict 默认 `is_locked=false`，全新部署即解锁.
- 测试：ICT 自定义主题返回 201；新增"阶段不存在 400"用例；web 全量 169 测试通过.

### 验证（Playwright 无头，服务器实测）
- /dashboard：console 0 error，顶栏显示 `今日 2026-08-24`，无 #418.
- /roadmap（ICT）：显示"可自定义添加主题"、自定义主题按钮，无"ICT 规划固定"badge.
- 添加自定义主题到 ICT P1 阶段 → 201（id=893，is_custom=true），重载后出现在列表；删除 → 200，重载后消失；全程 0 console error.
- /tasks（专注组件）：0 error / 0 404.

### 已知遗留
- 历史提到的 "/focus 一个 404 资源" 在本轮 dashboard/roadmap/tasks 三页均未复现（web 端无 /focus 页面路由，疑为历史缓存观察，暂无法复现）.

---

## 十一、学习 × 招聘打通：聚合「市场需求缺口」（2026-08-24，commit `3e0d4ab` / `9b2c92d`）

> 服务器同步 7 个文件（route.ts / skills.ts / skills-page.tsx / dashboard page / 两个 gap 组件 / shared index.ts），备份 `.bak-gaps-20260824193751` + 二次修正同名 page.tsx 覆盖问题；docker compose up -d --build 重建。数据回填：`node scripts/backfill_skill_content_links.mjs`（容器内 -w /app）→ skill_content_links 18 条映射生效。

### 新增能力
1. **API** `GET /api/skills/gaps?limit=N`：市场高频需求技能（job_skill_links 聚合）× 我的缺失（user_skills level < 2），附 skill_content_links 学习建议，按岗位数降序。
2. **技能树页**（/career/skills）新增「市场需求缺口」卡：技能 + 分类 + 岗位数 + 我的等级 + 学习建议（→ 主题 · 约 Xh）+ 一键「加入学习」。
3. **Dashboard** 新增能力缺口入口卡（TOP3 + 去补齐入口，无缺口/未登录不渲染）。
4. **修复** `enrollGapsToTasks` 任务标题 bug：旧实现把 topicId 当标题（`学习「vue」：813`），改为查 content_topics 用真实主题标题（`学习「vue」：Vue 3 或 React 框架`）。

### 验证（服务器实测）
- `/api/skills/gaps` 200：totalJobs=89；top3 = vue(26岗)→Vue 3 或 React 框架、python(20)→Python 编程、javascript(18)→JavaScript 核心语法，均 enrollable。
- /career/skills：市场需求缺口 / 在招岗位统计 / 加入学习 / 岗位要求 全部渲染，console 0 error。
- /dashboard：能力缺口入口卡渲染，console 0 error。
- 加入学习：创建 daily_tasks（标题含真实主题名）；验证后已删除测试任务。
- E2E 全量 7/7 通过（新增 skills-gaps 2 用例）。

### 数据说明
- skill_content_links 由脚本回填（幂等，ON CONFLICT DO NOTHING）；新部署后需在容器内执行 `node scripts/backfill_skill_content_links.mjs`。
- 未匹配到主题的 niche 技能（webgl/terraform/c++/stm32/flink/spark 等）仍可「加入学习」（生成通用任务），待内容扩充后补映射。

---

## 十二、缺口→路线图定位 + 技能画像冷启动（2026-08-24，commit `207be9c` / `6f17dc9`）

> 服务器同步 6 文件（recommend route / skills.ts / market-gaps-card / roadmap page / skills page / shared index.ts），备份 `.bak-20260824200600`；docker compose up -d --build 重建。

### 新增能力
1. **缺口→路线图定位**：市场需求缺口的「→ 学习主题」改为链接 `/roadmap#phase-<id>`；roadmap 页支持 `#phase-<id>` 进入时展开对应阶段并滚动定位（仅前端，无 SSR 水合影响）。
2. **技能画像冷启动**：新 API `GET /api/skills/recommend`（按 settings.career 读取职业 → CAREER_SKILL_MAP 6 职业推荐技能，不存在自动建库）；技能树页新增「按职业推荐技能」卡，点击一键添加为「入门」等级。
3. shared：MarketGapItem 增加 phaseId/phaseTitle/phaseKey；新增 SkillRecommend 类型。

### 验证（服务器实测 + E2E）
- E2E **9/9 通过**（新增：推荐技能卡、#phase-<id> 展开定位）。
- web vitest 175 全过（+3 recommend 用例）；lint 0 error；typecheck 全绿。
- 缺口主题链接点击后 roadmap 定位到对应 P 阶段并展开（截图见 e2e/test-results）。

---

## 十三、CI 接入 Playwright E2E（2026-08-24，commit `22bb1e3`，纯 dev 工具，无服务器部署）

- `.github/workflows/ci.yml` 新增 `e2e` 作业：docker compose 起全栈（db+init+web，`NPM_REGISTRY=https://registry.npmjs.org`）→ `create-admin.mjs` 建测试管理员（密码 Secret `E2E_PASSWORD`，缺省 `ci-e2e-password`）→ `playwright install --with-deps chromium` + `E2E_BROWSER=chromium` 跑 9 用例 → 失败上传 `playwright-report` 产物。
- workflow env `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`：install 阶段跳过浏览器自动下载（已验证该 env 不影响显式 `playwright install`，见 playwright-core 源码 installBrowsersForNpmInstall 分支）。
- `e2e/playwright.config.ts` 支持 `E2E_BROWSER=chromium`（CI 用 Playwright 自带 chromium，不依赖 runner 预装 Chrome）；本地/服务器仍用系统 Chrome。
- 本地回归 9/9 通过（config 改动不破坏系统 Chrome 路径）。
- 待首次 CI push 后观察：docker 全量构建约 10-15 分钟（在 30 分钟 timeout 内）；若镜像构建过慢可后续改为 service-container + 直启 next（P2 优化）。

---

## 十四、B5 同步幂等键 + schema.sql 全量对账（2026-08-24，commit `1672bba` / `c3f122c`）

> 服务器同步 3 文件（sync-service.ts / 迁移 019 / schema.sql），备份 `.bak-20260824203806`；docker compose up -d --build 重建，init 应用迁移 019。

### 1) B5 同步幂等键（change_id 去重）
- 迁移 `019_sync_change_id.sql`：`sync_changes` 增加 `change_id` + `(user_id, change_id)` 部分唯一索引。
- server：`applyChanges` 按 changeId 跳过已应用（重试不重复 apply）；`recordSyncChanges` 带 changeId 用 `ON CONFLICT DO NOTHING`（重试不重复审计日志）；无 changeId 旧客户端保持兼容。
- mobile：`SyncChange` 增加 changeId，10 处 pending change 生成点注入 `changeId: uid()`（随 AsyncStorage 持久化，重试稳定）。
- 验证：web 178 + mobile 22 测试全过；线上实测同 changeId 推送两次 → **applied 1→0**、`sync_changes` 仅 1 行、`daily_tasks` 仅 1 行（测试数据已清理）。

### 2) schema.sql 全量对账
- 从迁移 003~017 原样提取 **23 张表**（招花/健康/技能/安全/市场统计等）追加到 schema.sql（按迁移顺序，保 FK 依赖），`scripts/verify-migrations.mjs` 漂移检查通过（51 表）。
- 索引/触发器仍保留在迁移中（全新部署由 schema.sql + 全部迁移共同建库，IF NOT EXISTS 幂等）。

---

## 十五、岗位学习计划（整包规划）（2026-08-24，commit `1870fb2` / `78acbe3`）

> 服务器同步 4 文件（plan route / skills.ts / job-match-section / shared index.ts），备份 `.bak-20260824205236`；docker compose up -d --build 重建（含一次 job.id bigint 修复重建）。

### 新增能力
1. **API** `GET /api/jobs/[id]/plan`：岗位信息 + 当前匹配度 + 按路线图阶段分组的能力缺口学习计划（每阶段含技能/主题/时长），+ 总时长 + 预估周数（每周 10h 假设）。
2. **职位详情 JobMatchSection** 新增「岗位学习计划」区块：补完收益（+X% 匹配度）、总缺口数/时长/周数、按阶段分组的计划（每阶段链接 `/roadmap#phase-<id>` 定位）、「全部缺口加入学习路线」一键入学。
3. lib/skills：computeSkillGaps 输出阶段信息 + 支持预计算 missingSkills（避免整包规划重复 computeJobMatch）；buildJobLearningPlan 组装整包计划。

### 验证
- web vitest 181 全过（+3 plan 用例，SQL 内容分发 mock 顺序无关）；lint 0 error。
- E2E **11/11 通过**（新增 2 用例：计划 API 结构、详情面板展示匹配度+计划）。
- 修两个实测问题：pg bigint id 序列化为字符串（API 内 Number 收口）；1489px 视口下 JobDetailPanel 为 2xl-only，可见的是 JobModal（E2E 改定位 .last()）。

---

## 十六、移动端接入岗位学习计划 + 发布就绪验证（2026-08-24，commit `27ccf92`）

> 纯客户端改动（apps/mobile），**无需服务器部署**（后端 /api/jobs/[id]/plan 与 /api/jobs/gaps/enroll 已在前一轮上线）。

### 改动
1. `apps/mobile/src/lib/jobs.ts`：新增 `fetchJobPlan` / `enrollJobGaps`（复用 apiRequest + Bearer token）。
2. `apps/mobile/src/components/job-detail-modal.tsx`：详情加载时并行拉取计划（未登录/无画像返回 null 不阻断详情）；底部弹层新增「📋 岗位学习计划」区块：匹配度 + 补完收益、总缺口/时长/预估周数、按阶段分组（P# · 阶段 + 技能→主题 + 时长）、「全部缺口加入学习任务」一键入学（toast 反馈）。

### 发布就绪验证
- `npx expo export --platform android` **成功**：产出 entry-*.hbc（4.8MB）+ metadata，Metro 打包无解析/导入错误。
- mobile typecheck 通过；vitest 22 全过；expo lint 0 error（顺手清理存量 JobSource 未用导入）。

### 后续发布步骤（需用户 Expo 账号，本环境无法代跑）
```bash
cd apps/mobile
npx eas login                       # 用户 Expo 账号
npx eas build:configure             # 生成 eas.json（如无）
npx eas build -p android --profile preview   # 产出 APK（测试）
npx eas build -p android            # 产出 AAB（上架 Google Play）
```

---

## 十七、收尾清理（2026-08-24，commit `1d3558b`）

> 服务器同步 4 文件（迁移 012 / analysis.ts / 两个爬虫脚本），备份 `.bak-20260824212722`；docker compose up -d --build 重建，init 应用迁移 012。

### 1) 市场统计接入实际统计（补缓存失效）
- 根因：`analyzeMarket` 已用 `market_stats` 表做 60s DB 缓存（多实例共享/重启不丢），但**爬虫写入后从未失效** → 爬虫后 60s 内市场分析读到旧数据。
- 修复：`analysis.ts` 新增 `invalidateMarketCache()`（DELETE market_stats）；`jobs_official.mjs` / `jobs_browser.mjs` 写库后调用（容器内已确认含该逻辑）。+2 单测。

### 2) 迁移 012 补档
- `db/migrations/012_jobs_published_index.sql`：`idx_jobs_published(job_postings.published_at DESC)`（列表发布时间筛选/排序加速）；011→013 编号跳号补齐。
- `scripts/verify-migrations.mjs`：**19 迁移连续（1~19）+ 漂移清零，全部检查通过 ✅**。

### 3) /focus 遗留确认
- 复核 web/mobile：均无 `/focus` 页面路由与悬空链接（仅 `/api/focus/*` API）；历史「/focus 一个 404 资源」不可复现，判定为旧会话缓存观察，已关闭。

### 验证
- web vitest 183 全过（+2 invalidate 用例）；typecheck/lint 全绿；E2E 11/11。
- 服务器：迁移 012 已应用（schema_migrations + idx_jobs_published 存在）；/api/market 200。
