# Learn-Workbench 2.0 实施路线图（结合现有代码的落地优化版）

> 依据：《Learn-Workbench-2.0-下一版本具体改动方向和设计方案.md》（同目录）+ 当前项目实际代码状态
> 日期：2026-08-19
> 定位：在原稿"先 UI 后功能、先数据关系后 AI"的原则上，结合已建成代码给出可执行的差距分析、数据模型、API 与分阶段计划。

---

## 一、现状盘点（已建成，避免重复建设）

### 1.1 现有页面与模块

| 端 | 页面 | 状态 |
|---|---|---|
| Web | /dashboard（首页） | 已有统计卡 + 背景壁纸 + 每日金句 |
| Web | /roadmap /tasks /logs /wellbeing | 学习路线 / 今日任务 / 学习日志 / 健康提醒 |
| Web | /jobs（招花） | 已含分类 Tab、公告卡、考试日历、通知铃铛、截止排序 |
| Web | /settings | 已含账号、爬虫配置、信息源健康度、订阅管理、hosts 更新 |
| Mobile | 底部 Tab：仪表盘 / 路线图 / 任务 / 日志 / 招花 | 与 Web 基本对齐 |

### 1.2 招花 2.0 已落地能力（本仓库已完成）

- hosts 信息源注册表（config/job-hosts/sources.json，7 个源，每周一自动更新）
- 双引擎爬虫：http 轻引擎（国资委/人事考试网/军队人才网）+ Playwright 浏览器引擎（人社部/江苏/国聘）
- 公告解析 + 考试日历（job_exam_events）+ 岗位表 excel 结构化（xlsx-min 零依赖）
- 订阅提醒（job_subscriptions + job_notifications + 铃铛面板）
- 信息源健康度可视化（job_source_health + 设置页进度条）
- 分类体系（internet / gongkao / gongbian / yangqi）+ 公告卡 + 截止倒计时
- 按 user_id 全面隔离（配置/收藏/订阅/通知）

### 1.3 已有数据基础（2.0 可复用的"数据关系"）

- careers（职业路线）、content_phases/topics/resources/practices/projects/checkpoints（学习内容，按 career_key 组织）
- topic_progress / focus_sessions / log_entries / xp_events（学习行为数据）
- resume_assets（skill / project / github / certificate 四类资产）→ 技能画像的现成来源
- interview_questions（面试题库）
- job_postings / job_favorites / job_crawler_*（招聘数据 + 爬虫治理）
- 用户/账号/会话隔离体系

结论：原稿的"学习 × 招聘打通"（P2）与"职业模块"并非从零开始，**大量数据关系已经存在**，2.0 的关键是"建模 + 打通 + 呈现"，而非"从零新建"。

---

## 二、2.0 愿景 → 差距分析

| 原稿要求 | 现状 | 差距 | 落地方式 |
|---|---|---|---|
| 一级导航 5 入口（首页/学习/招花/职业/设置） | Web 无统一顶导；Mobile 5 Tab 但学习未分组、职业缺失 | 信息架构重构 | 见第三节 |
| 健康提醒系统级化 | wellbeing 是独立页面 | 收敛为全局浮层 | 保留数据，UI 并入系统层 |
| Liquid Glass 2.0 | 全玻璃化，层级不清 | 三层原则 + Design Token | 见第四节 |
| Dashboard 职业状态卡 | 统计卡堆叠 | 职业准备度驾驶舱 | 见第五节 |
| 招花=职业机会中心 | 已有分类/公告/日历/订阅 | 缺匹配/缺口/求职/市场/去重/新鲜度 | 见第六~九节 |
| 职位新鲜度 | 无 | 状态徽标 | 基于 published_at/fetched_at |
| 职位去重 | 无（多平台重复可见） | 归一化聚类 | job_clusters |
| 岗位匹配度 | 无 | 技能体系 + 规则匹配 | P2 |
| 能力缺口 → 学习路线 | content 已有 career_key 结构 | skill↔topic 映射 | P2 |
| 求职 Kanban | 仅收藏 | 阶段化求职管理 | P3 |
| 招聘市场分析 | 仅 stats 汇总 | 城市/薪资/技能/趋势聚合 | P4 |
| AI 智能层 | 无 | 数据积累后接入 | P5 |

---

## 三、信息架构调整（P0）

### 3.1 Web 顶导（5 项）

```text
🏠 首页     📚 学习     🌸 招花     🚀 职业     ⚙️ 设置
            └ 路线图/今日任务/专注/日志/项目      └ 职业画像/技能树/简历/GitHub/面试
```

- 学习：将 roadmap / tasks / logs / wellbeing 收敛为「学习」下一级 Tab；wellbeing 改为系统级提醒浮层（久坐/喝水/休息），不再占一级导航。
- 职业：新模块，路由建议 /career（画像）、/career/skills（技能树）、/career/resume、/career/interview。
- 设置：保留（含账号/爬虫/订阅/hosts）。

### 3.2 Mobile 底部 Tab（5 项）

```text
🏠 首页    📚 学习    🌸 招花    🚀 职业    👤 我的
```
- 学习 = 路线图/任务/日志 分组；职业 = 画像/技能/面试；我的 = 设置 + 数据。
- 保持单手操作：主 Tab 5 个以内，次级页面用堆栈导航。

### 3.3 迁移策略（避免一次性大改）

- 阶段 A：仅新增「职业」入口 + Web 顶导壳（保留旧 URL 可访问，/wellbeing 隐藏导航）。
- 阶段 B：学习分组落地，wellbeing 收敛为浮层。
- 阶段 C：移动端 Tab 对齐。

---
## 四、Liquid Glass 2.0 设计规范（P0）

### 4.1 三层原则

```text
背景层：氛围 / 品牌 / 沉浸（风景、渐变、光斑、模糊）—— 不影响阅读
玻璃层：卡片层级 / 内容分组 / 浮层 / 导航 —— 只承担结构，不滥用
内容层：信息 / 数据 / 操作 / 状态 —— 高对比度，视觉主体
```

落地检查清单（每个页面评审时对照）：
- 背景不叠加过多装饰元素
- 非重点元素（按钮/标签/列表）弱化玻璃，用纯 surface
- 文字对比度满足 WCAG AA（正文 ≥4.5:1）

### 4.2 Design Token（落在 packages/ui + tailwind）

```text
色彩：Background / Surface / Glass / Primary / Secondary / Success / Warning / Danger / Text / Muted
圆角：sm(8) md(12) lg(16) xl(20) 2xl(28)
阴影：shadow-sm / md / lg / glass-shadow
间距：4 8 12 16 24 32 48 64
字号：xs sm base lg xl 2xl 3xl 4xl（+ tabular-nums 用于数字）
```

### 4.3 页面视觉密度矩阵

| 页面 | 方向 | 密度 |
|---|---|---|
| 首页 | 沉浸、视觉优先 | 低 |
| 学习 | 效率、任务优先 | 中 |
| 招花 | 信息密度型 | 高 |
| 职业 | 数据、结构化 | 中高 |
| 市场分析 | 专业数据型 | 高 |
| 设置 | 简洁 | 低 |

### 4.4 动效规范

- 页面切换 / 弹窗：150-300ms（fade + 4-8px 位移）
- 微交互：hover / press / focus / card / modal transition
- 数据变化：count-up、进度条动画、skeleton、fade（复用现有 StatValue count-up）
- 遵循 prefers-reduced-motion
- 不引入长页面动画与花哨入场

---

## 五、Dashboard 职业状态卡（P0 核心组件）

### 5.1 职业准备度 = 四维评分

```text
职业准备度 76% = w1*技能 + w2*项目 + w3*简历 + w4*面试
技能：resume_assets(kind=skill) 数量与等级 + topic_progress 完成度
项目：resume_assets(kind=project) + content_projects 完成数
简历：简历资产完整度（目标岗位/技能/项目/GitHub 是否齐全）
面试：interview_questions 答题记录 + 模拟面试次数
```

- 权重初始建议：技能 40% / 项目 30% / 简历 15% / 面试 15%（可配置）
- 数据来自现有表，无需新表（或轻量缓存表 career_readiness）

### 5.2 首页区块

```text
Good Evening，今天，继续向你的职业目标前进
[ 职业状态卡：目标岗位 + 准备度 + 四维进度条 + 发现 N 个适合你的职位 ]
[ 今日计划：从 daily_tasks 聚合，完成打勾 ]
[ 今日推荐：job_postings × 技能画像 匹配 Top N，点击进招花 ]
[ 学习概览：本周时长 / 完成任务 / 连续天数 ]
```

### 5.3 新接口

- GET /api/profile/readiness —— 返回准备度 + 四维明细
- GET /api/dashboard —— 聚合首页四区块（一次请求，减少前端并发）

---

## 六、招花模块增强（P1，建立在已建成的招花 2.0 之上）

### 6.1 职位新鲜度徽标

```text
🟢 刚发布（<1 天）  🔵 3 天内  🟡 7 天内  ⚪ 超过 14 天  🔴 可能已失效（>30 天且非公告）
```
- 依据：published_at（缺失时用 fetched_at）
- 前端工具函数 + 职位卡展示，后端无需新字段（计算即可）

### 6.2 多条件筛选扩展（现 API 已支持 q/city/category/platforms/sort，补齐）

```text
薪资区间：salary_min/salary_max 参数（10K以下 / 10-20K / 20K+）
学历：education 多选
经验：experience 多选
发布时间：published_within（今天/3天/7天）
技能：skill 标签多选（归一化后）
```
- GET /api/jobs 扩展对应 query 参数 + lib/jobs.ts 条件拼接

### 6.3 数据来源展示与去重

- 职位卡展示来源徽标（已有 jobSourceLabel）+ 多来源聚合
- 去重：job_clusters 表（见第八节），同一 canonical_title+canonical_company 聚合，卡片显示「发现来源：猎聘/智联/官网」
- 去重时机：爬虫写库后触发聚类任务（增量），不阻塞抓取

### 6.4 职位详情页增强

- 保留现有弹窗（portal 居中），Web 端额外支持右侧详情面板（双栏）
- 详情内新增：匹配度区块（P2 上线后）、能力缺口（P2）、来源与更新时间、新鲜度
- 收藏按钮保留，新增「加入求职」入口（P3）

### 6.5 Web 双栏布局（招花页）

```text
┌─────────────┬──────────────────────────┐
│ 筛选侧栏     │ 职位列表                  │
│ 城市/薪资/    │ 卡片流（信息密度高）       │
│ 学历/经验/    │ + 新鲜度/匹配度/来源      │
│ 技能/分类     │                          │
└─────────────┴──────────────────────────┘
点击卡片 → 右侧详情面板（不弹窗）或保持弹窗（窄屏）
```
- 移动端：筛选用 Bottom Sheet，详情用沉浸式整页

---

## 七、数据标准化与技能体系（P2 前置）

### 7.1 技能归一化

- 新建 skill_taxonomy 表（skill_id, name, aliases jsonb, category）
- 示例：FastAPI = fastapi（别名：FastAPI/Fast Api）；Redis = redis（别名：Redis 缓存）
- 爬虫产出 tags → 归一化脚本映射到 skill_id（规则 + 同义词表，P5 再上模型）
- 职位技能画像：job_postings.tags 经归一化后存 job_skill_links(job_id, skill_id, weight)

### 7.2 用户技能画像

- 来源自动推导：resume_assets(kind=skill) + 学习路线已完成主题（content_topics 的技能标签）+ 手动维护
- 表：user_skills(user_id, skill_id, level 0-5, source, updated_at)
- 默认从 resume_assets 一次性回填，之后用户可手动增删改

### 7.3 匹配度算法（MVP 规则版，不依赖 AI）

```text
匹配度 = Σ(skill 命中权重) / Σ(岗位技能权重) * 0.7
      + 学历满足 0.1 + 经验满足 0.1 + 城市匹配 0.1
```
- skill 命中权重：用户 level ≥ 岗位要求（或 ≥2）计 1，部分命中计 0.5
- 输出：总分 + 命中/缺失技能明细（文档中「✓/△」样式）
- 计算位置：API 实时算（职位量小时）或预处理缓存；P5 可换模型

### 7.4 能力缺口 → 学习路线

- 缺口 = 岗位技能 - 用户技能
- 映射：skill↔content 主题映射表 skill_content_links(skill_id, topic_id, 预计学习时长)
- 「加入我的学习路线」→ 生成计划任务（插入 daily_tasks 或 content 进度）

---

## 八、数据模型（新增表，迁移 012-015）

### 012_skill_taxonomy.sql
```sql
CREATE TABLE IF NOT EXISTS skill_taxonomy (
  id bigserial PRIMARY KEY,
  name text NOT NULL UNIQUE,            -- 规范名，如 redis
  aliases jsonb NOT NULL DEFAULT '[]',  -- 别名列表
  category text NOT NULL DEFAULT '',    -- backend/frontend/ops/ai/...
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_skills (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id bigint NOT NULL REFERENCES skill_taxonomy(id) ON DELETE CASCADE,
  level int NOT NULL DEFAULT 2,         -- 0-5
  source text NOT NULL DEFAULT 'manual',-- manual/resume/topic
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);
CREATE TABLE IF NOT EXISTS job_skill_links (
  job_id bigint NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  skill_id bigint NOT NULL REFERENCES skill_taxonomy(id) ON DELETE CASCADE,
  weight numeric(3,2) NOT NULL DEFAULT 1,
  PRIMARY KEY (job_id, skill_id)
);
CREATE TABLE IF NOT EXISTS skill_content_links (
  skill_id bigint NOT NULL REFERENCES skill_taxonomy(id) ON DELETE CASCADE,
  topic_id bigint NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
  estimate_hours int NOT NULL DEFAULT 8,
  PRIMARY KEY (skill_id, topic_id)
);
```

### 013_job_clusters.sql（职位去重）
```sql
CREATE TABLE IF NOT EXISTS job_clusters (
  id bigserial PRIMARY KEY,
  canonical_title text NOT NULL,
  canonical_company text NOT NULL,
  city text NOT NULL DEFAULT '',
  job_ids bigint[] NOT NULL DEFAULT '{}',   -- 成员职位 id
  source_list jsonb NOT NULL DEFAULT '[]',  -- 发现来源
  primary_job_id bigint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canonical_title, canonical_company, city)
);
```

### 014_job_applications.sql（求职管理）
```sql
CREATE TABLE IF NOT EXISTS job_applications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id bigint NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'favorite',   -- favorite/applied/online_test/interview1/interview2/offer/hired/closed
  note text NOT NULL DEFAULT '',
  applied_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_job_app_user ON job_applications(user_id, stage);
```

### 015_market_stats.sql（市场分析，聚合结果表）
```sql
CREATE TABLE IF NOT EXISTS market_stats (
  id bigserial PRIMARY KEY,
  stat_key text NOT NULL,                -- city_demand / salary_by_exp / skill_demand / edu_demand
  dimension text NOT NULL,               -- 城市 / 技能 / 学历 ...
  value jsonb NOT NULL DEFAULT '{}',     -- {count, avg_min, avg_max, ...}
  period text NOT NULL DEFAULT 'week',   -- 统计周期
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stat_key, dimension, period)
);
```
- 由定时任务（每日爬虫后）或手动触发聚合写入，前端只读结果表

---
## 九、API 设计

| 接口 | 方法 | 说明 |
|---|---|---|
| /api/jobs | GET | 扩展 salary/edu/exp/published/skill 筛选 |
| /api/jobs/skills | GET | 技能标签（归一化后）候选列表 |
| /api/jobs/:id/match | GET | 匹配度明细（总分 + 命中/缺失技能） |
| /api/jobs/gaps | GET | 能力缺口列表 + 预估学习时长 + 可加入学习路线 |
| /api/jobs/gaps/enroll | POST | 缺口技能加入学习路线（生成任务） |
| /api/profile/readiness | GET | 职业准备度（四维） |
| /api/profile/skills | GET/PUT | 用户技能画像 |
| /api/jobs/applications | GET/POST | 求职管理（Kanban） |
| /api/jobs/applications/:id | PUT/DELETE | 更新阶段 / 删除 |
| /api/market/:stat | GET | 市场分析（cities/skills/salary/edu） |
| /api/dashboard | GET | 首页聚合（状态卡 + 今日计划 + 推荐 + 概览） |

统一约定：全部按 user_id 隔离；列表类带分页；时间用 ISO；错误返回 {error}。

---

## 十、Web / Mobile UI 落地要点

### 10.1 Web 招花页（双栏）

- 左栏筛选（分类/城市/薪资/学历/经验/技能/发布时间 + 重置）
- 右栏列表（卡片密度高：标题/公司/薪资/城市/标签/新鲜度/匹配度/来源）
- 点击卡片：>1024px 右侧详情面板（列表+详情联动），<1024px 保持现有弹窗
- 顶部保留：搜索、考试日历、通知铃铛、立即抓取

### 10.2 求职 Kanban（Web + Mobile）

- Web：三/四列看板（收藏/已投递/面试中/Offer），拖拽或按钮切换阶段
- Mobile：横向分组的简单看板（左右滑动阶段，点击卡片改状态）
- 数据：job_applications；从职位详情「加入求职」进入

### 10.3 市场分析页

- Web：图表卡片（城市需求柱状 / 薪资分布 / 技能热度 / 学历经验构成）
- 移动端：精简 Top 排行（复用现有卡片体系，不堆图）

### 10.4 职业模块

- 职业画像：目标岗位 + 准备度 + 技能雷达/进度条（复用 dashboard 数据）
- 技能树：skill_taxonomy 分类展示 + user_skills 等级
- 简历：复用 resume_assets（技能/项目/GitHub/证书）整理成简历预览
- 面试：复用 interview_questions + 答题记录

### 10.5 Mobile 细节

- 职位筛选：Bottom Sheet（半屏，城市/薪资/学历/技能）
- 职位详情：沉浸式整页（不是弹窗），底部操作条（收藏/加入求职/分享）
- 底部 Tab 重构见第三节

---

## 十一、分阶段实施路线（含依赖关系与验收）

### M2.0-P0 信息架构 + Design System + Dashboard（先 UI 后功能）
- [x] 招花 2.0 已建成（可作为 P1 前置）
- [ ] Web 顶导 5 入口 + Mobile Tab 重构（/career 新增）
- [ ] Design Token 落地 packages/ui + tailwind（色彩/圆角/阴影/间距）
- [ ] Dashboard 职业状态卡 + /api/dashboard + /api/profile/readiness
- [ ] wellbeing 收敛为系统级浮层
- 验收：首页一眼看到职业目标与准备度；导航 5 项清晰；旧功能不回归

### M2.0-P1 招花核心增强
- [ ] 多条件筛选（薪资/学历/经验/时间/技能）
- [ ] 职位新鲜度徽标
- [ ] 职位去重聚类（job_clusters）+ 来源聚合展示
- [ ] Web 双栏布局 + 右侧详情面板
- [ ] Mobile 筛选 Bottom Sheet + 沉浸详情
- 验收：筛选项齐全、无重复职位、卡片信息层级清晰

### M2.0-P2 学习 × 招聘打通（项目核心价值）
- [ ] skill_taxonomy + 归一化脚本（爬虫 tags → skill_id）
- [ ] 用户技能画像（resume_assets 回填 + 手动维护）
- [ ] 岗位匹配度（规则版）+ 详情展示
- [ ] 能力缺口分析 + skill_content_links 映射
- [ ] 缺口一键加入学习路线（生成任务）
- 验收：任意职位可看匹配度与缺口，缺口可转化为学习任务

### M2.0-P3 求职管理
- [ ] job_applications + Kanban UI（Web 看板 + Mobile 精简）
- [ ] 职位详情「加入求职」入口 + 阶段流转
- [ ] 求职统计（各阶段数量/转化）
- 验收：从收藏到 Offer 全流程可记录

### M2.0-P4 招聘市场分析
- [ ] 聚合任务（每日爬虫后写入 market_stats）
- [ ] 城市/薪资/技能/学历/经验分析 API + 图表页
- 验收：回答「市场需要什么」；数据随抓取自动更新

### M2.0-P5 AI 智能层（数据积累后）
- [ ] 基于用户行为/技能/匹配数据的 AI 岗位推荐
- [ ] AI 能力缺口分析与学习规划
- [ ] AI 简历优化 / 模拟面试
- 验收：有足够数据样本后再接入，避免为 AI 而 AI

---

## 十二、我的优化建议（相对原稿的补充）

1. **匹配度先规则后 AI**：P2 用同义词表 + 加权公式即可跑通闭环，P5 再上模型，避免一开始依赖 AI。
2. **去重用「归一化 + 相似度」双保险**：canonical 字符串聚类为主，编辑距离/别名表为辅助，控制误合并；保留人工「拆分组」入口。
3. **市场分析用定时聚合结果表**：不实时聚合，前端秒开，爬虫每日跑完后自动刷新。
4. **技能画像自动推导 + 手动兜底**：从 resume_assets / topic_progress 回填，用户可覆盖，避免空转。
5. **能力缺口映射复用现有 content 结构**：content_topics 已按 career_key 组织，补 skill_content_links 即可闭环，不用重建内容体系。
6. **健康提醒系统级化**：wellbeing 数据保留，UI 收敛为全局浮层，退出一级导航（符合原稿）。
7. **Web 先行、Mobile 对齐**：双栏/看板/图表先在 Web 验证，再落 Mobile（复用 shared 类型 + 接口）。
8. **数据新鲜度与 content_hash 联动**：职位新鲜度徽标用 published_at/fetched_at，抓取去重用 content_hash（已有），两者不冲突。
9. **分阶段小步上线**：P0-P1 是独立可交付增量，不要等全部完成再发布；每个阶段保持线上可用。
10. **控制范围**：遵守原稿「不做清单」——不新增更多一级导航、不为 AI 而 AI、不重写后端、不把每页做成玻璃。

---

## 十三、风险与边界

- 匹配度是「参考建议」而非「录用断言」，UI 需注明口径。
- 去重聚类可能误合并同名不同岗，需提供人工修正。
- 市场分析早期样本量有限（当前 258 条），结论仅供参考，随数据积累收敛。
- 技能归一化是长期维护项（新技能/别名），沿用 hosts 周更思路：技能表也纳入定期维护。
- 不承诺移动端与 Web 同时交付同一能力，按阶段先后对齐。

---

## 十四、结论

本路线图在原稿「先 UI 后功能、先数据关系后 AI、控制范围」的原则上，结合本项目已建成的招花 2.0、careers/content/resume_assets/interview_questions 等数据基础，给出了：

- 信息架构落地方式（5 入口 + 健康系统级化）
- Liquid Glass 2.0 设计规范与 Design Token
- 招花 P1 增强（筛选/新鲜度/去重/双栏）与 P2 打通（技能/匹配/缺口/学习联动）
- 求职管理、市场分析、AI 层的分期路径
- 新增 4 张核心表（012-015）与 12 个 API 的落地方案
- 10 条工程优化建议与风险边界

按此推进，Learn-Workbench 将从「功能丰富的个人学习工具」逐步演进为「个人职业成长操作系统（Personal Career OS）」。
