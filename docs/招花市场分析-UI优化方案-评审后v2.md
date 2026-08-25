# 招花 · 招聘市场分析 2.0 — UI 优化方案（评审后 v2）

> 评审对象：`D:\Desktop\Learn-Workbench_UI_优化方案.md`（原稿，约 1105 行）
> 评审依据：Learn-Workbench 当前仓库 HEAD 实际代码 + docs/Learn-Workbench-2.0-实施路线图-优化版.md + 其他项目（Travel-Notes）设计方法
> 定位：本文件是**收敛续篇**——在保留原稿"洞察中心 / 探索空间"正确内核的前提下，修正其与项目实际进展的偏差，给出可落地的分阶段版本。
> 日期：2026-08-25

---

## 〇、先说结论（TL;DR）

原稿的**价值主张是正确的**：把市场分析从"招聘数据 Dashboard"升级为"职业市场洞察中心"，用"一个主视觉 + 多个辅助分析模块"替代"多个同等权重的图表卡片"，方向完全正确，应当采纳。

但原稿存在 **8 处与项目实际进展不符 / 落地会踩坑** 的偏差，若不修正，执行时会**重复建设或做出伪指标**。最关键的是：**原稿把「市场 × 学习闭环」排在 Phase 5（最后、长期），而项目数据层与大部分 UI 早已建成**——它才是文档自己说的"最值得做的产品升级"，成本几乎全在前端接驳，应提到 P0/P1。

以下是评审修正点（正文 §一～§八）与优化后的实施方案（§九～§十四）。

---

## 一、原稿的主要优点（保留）

1. **定位正确**：从"换图表"升维为"洞察中心 / 探索空间"，这个产品判断是对的。
2. **结构正确**："主视觉 + 辅助分析模块"、Section（Header + PrimaryVisualization + SecondaryInsight）优于"等权卡片堆叠"，能解决 Dashboard 疲劳。
3. **原则正确**：少颜色、强层级、弱网格、强交互；延续 Liquid Glass；城市地图放第二阶段、不硬造地图；不推倒重来、复用现有图表组件。
4. **组件化方向正确**：抽象 MarketSection / ChartTooltip / ChartEmpty / ChartLoading 等，符合现有 `market-charts.tsx` 的组件化现状。

---

## 二、偏差 1（最重要）：市场 × 学习闭环已被低估，优先级排错

原稿把「市场 × 学习」放在 Phase 5（"长期核心能力"）。这是**最大的偏差**。现状如下：

**数据层已完全建成**（`apps/web/lib/skills.ts` + `packages/shared`）：
- `skill_taxonomy` + `user_skills(level 0-5)` + `job_skill_links` + `skill_content_links` 四表已建（route 012）。
- `aggregateMarketGaps(userId)` → `MarketGapItem[]`（市场高频需求技能 × 我的缺失，返回 jobCount / demandWeight / myLevel / topicId / estimateHours / enrollable / phaseId）。
- `recommendSkillsForCareer()`、`computeJobMatch()`、`computeSkillGaps()`、`buildJobLearningPlan()`、`enrollGapsToTasks()` 全部可用。
- `MarketGapsResult` / `SkillRecommend` / `JobLearningPlan` 类型已入 `packages/shared`。

**部分 UI 已上线**：
- `components/skills/market-gaps-card.tsx`（技能树页 /career/skills）
- `components/skills/dashboard-gap-card.tsx`（首页 /dashboard）
- `components/jobs/job-match-section.tsx`（职位详情：匹配度 + 缺口 + 学习计划，可一键加入学习）
- API：`/api/skills/gaps`、`/api/skills/gaps/enroll`、`/api/jobs/:id/{gaps,match,plan}`、`/api/skills/recommend`、`/api/profile/skills`

**结论**：原稿 Phase 5 的任务清单（我的技能 / 市场技能 / 能力缺口 / 技能优先级 / 加入学习路线 / 自动创建学习任务 / 学习进度反馈）**绝大部分已实现**，唯一缺的是把它**接到市场分析页**（Skill Market Map 上叠加 myLevel + 加入学习路线）。

**修正**：Phase 5 应**前置并瘦身**为 P0/P1 的"市场页接驳"，而非"最后新建"。这是本方案最核心的调整。

---

## 三、偏差 2：若干"概览 / 详情"指标当前数据层算不出（伪指标风险）

原稿第一屏市场概览与详情卡的多个数字，**现有数据层无法直接给出**：

| 原稿指标 | 现状 | 修正 |
|---|---|---|
| "17.4K 平均薪资"（整体） | 无整体平均薪资（只有分城市 avgMin/avgMax、分技能 avgSalary） | 需新增整体 avg（`market_salary_stats` 或 analyzeMarket 内补 aggregate avg） |
| "36 城市 / 128 热门技能" | `byCity` 只 LIMIT 15、`bySkill` 只 LIMIT 20，**非全量** | 改用"Top 城市/技能数"，或放开 limit 后取全量并标注口径 |
| "学习中 62% / 已掌握 ✓"（技能详情） | `user_skills` 只有 level 0-5，**无百分比进度** | 改为 level 标签（未掌握/了解/入门/熟练/精通/专家），或明确用 topic_progress 完成度 |
| "市场热度 ★★★★★" | 无星级字段 | 由 jobCount / demandWeight 分档映射（规则化，标注口径），不伪造 |
| "职位样本 12,842" | `total` 项存在 ✓ | 直接用 `data.total` |

**原则**：所有 KPI 必须"真实可算"。建议在 `analyzeMarket()` 返回里**补一个 `overview` 字段**（total / uniqueCity / uniqueSkill / avgSalary（均值或中位）/ generatedAt），前端只读，不做前端伪算。

---

## 四、偏差 3：图表色板与全站 Design Token 脱节

原稿强调"少颜色、每个图表不要完全不同的颜色体系"，但**现状正好违背**：
- `market-charts.tsx` 用一套**硬编码 6 色渐变** G = emerald/cyan/indigo/violet/amber/pink，按 index 循环——每个图表色相不同，且**没用**全站 token（primary 靛蓝 `#4f46e5`、冷调强调 `#0ea5e9`、进步条靛蓝渐变）。
- 圆角不统一：`.glass`=12px、`Card` `rounded-2xl`=16px、图标 `rounded-lg`=8px、treemap 单元格 `rounded-[10px]`。

**修正**：
- 图表色板收敛到 token：冷调梯度从 `primary → accent`（indigo→sky），语义色（success/warning/danger/neutral）用于状态（我的掌握 / 学习入口 / 缺口），而非每个图表各一套彩虹。
- 圆角落地 `packages/ui` 预设（roadmap 4.2：sm8 / md12 / lg16 / xl20 / 2xl28），图表容器统一 `lg(16)`，单元格 `sm(8)`。
- 严格来说这属于**全站 Design Token 工作**（roadmap P0），市场页优化时应顺手对齐，而不是另起炉灶。

---

## 五、偏差 4：市场趋势需要历史留档，原稿未提

原稿 Phase 4"市场趋势计算"、Phase 5"市场变化重新评估"依赖**历史快照对比**。
- 现状 `market_stats`（route 015）只存**一条** `key='full'`，60s TTL 覆盖写，**无历史留档**，无法算趋势。

**修正**：新增 `market_stats_history`（`stat_key` + `snapshot_date` + `payload jsonb`），爬虫每日写库后追加一份当日快照；趋势先做**环比**（本周 vs 上周 top 变化），不做深度学习。此为真实的**数据前置工作**，原稿应单独立项而非混在 UI 阶段。

---

## 六、偏差 5：移动端几乎未设计

原稿"以 Web 端为主，兼顾移动端"但正文对移动端零方案。Skill Market Map（SVG 坐标图）在窄屏会很挤；roadmap 8.3 明确"移动端精简 Top 排行，不堆图"。

**修正**：明确移动端降级——Skill Market Map 在窄屏改为"技能矩阵摘要 + Top 榜"；概览 KPI 压缩为 2×2；不照搬 Web 复杂坐标图。可复用 `/api/market` 同一接口，前端按断点选择视图。

---

## 七、偏差 6：可访问性 / 性能 / 状态未覆盖

- 原稿组件清单有 ChartTooltip / ChartEmpty / ChartLoading（很好），但没提：hover tooltip 对**键盘/读屏不可达**、图表 `aria-label`、`prefers-reduced-motion`（部分全局已有，但 SVG 过渡/动画需各自处理）、treemap 大量元素的渲染性能、骨架屏。
- **修正**：ChartLoading / Empty / Tooltip（含键盘可达）+ 无障碍放到 **Phase 1**，并且 tooltip 用 `<title>`/SVG 原生或加 tabIndex，不依赖纯 hover。

---

## 八、偏差 7：Section 数量偏多，信息架构可再收敛

原稿最终结构 01-06 六个编号 Section + 概览，页面偏长、板块人人之平等。在当前样本量（有限）下，建议**收敛为 4 段**：

```text
市场概览（KPI 行 + 更新/来源/样本）
   ↓
01 · 市场需求   [岗位职能 Treemap] + [城市机会｜城市薪资] + （薪资分布）
   ↓
02 · 技能机会   [技能市场地图(主视觉,叠加我的掌握)] + [技能热度榜｜技能×薪资]
   ↓
03 · 人才画像   [学历 Donut] + [经验 CapsuleRank]  （平台/类型降权为说明）
   ↓
04 · 我的学习机会 [市场洞察(规则驱动)] + [能力缺口] + [一键加入学习路线]
```

这样把"薪资分布"并入市场需求、把"技能×薪资"并入技能机会、把"平台/类型"降到"关于数据"说明，真正落地"主图 > 次图 > 辅助信息"。

---

## 九、优化后的实施方案（严格对齐现状）

### 前置准备（数据层，1 项软 + 1 项硬）
- [ ] `analyzeMarket()` 补 `overview`：`{ total, uniqueCity, topSkillCount, avgSalary(avg/中位), generatedAt }`——供概览 KPI 真实取数（**接口不改字段名，前端只读**）。
- [ ] 新增 `market_stats_history`（每日快照），供趋势对比（**硬前置**，放 P5 趋势之前）。

### P0 —— 市场页接驳现有"市场 × 学习闭环"（最高价值，最小成本）
> 复用 `aggregateMarketGaps` + `/api/skills/gaps` + `/api/skills/gaps/enroll` + `user_skills`，把已有能力接到市场页。
- [ ] 登录态检测：`/career/market` 当前**不在登录守卫**（proxy.ts `PROTECTED` 不含 `/career`），匿名可看。市场数据保留公开；叠加"我的技能"依赖登录。
- [ ] Skill Market Map：由 `skillSalary`（x=平均薪资 / y=需求岗位数 / size=职位数）+ `user_skills`（myLevel 按 LEVEL_LABELS 标记：未掌握→专家）+ `job_skill_links`（需求强度）驱动；气泡颜色用冷调 token，我的状态用语义色（掌握=success、缺口=warning/primary、未入门=neutral）。
- [ ] 技能详情卡：岗位数 / 平均薪资 / 市场热度（jobCount 分档）/ **我的状态（level 标签）** / [加入学习路线]（POST `/api/skills/gaps/enroll`）。匿名态隐藏"我的状态"并提示登录。
- [ ] 顶部「关于数据」补数据源 / 更新时间 / 样本量。
- 验收：登录用户点击某个高需求技能可一键加入学习路线；匿名用户浏览不报错。

### P1 —— 市场概览 + Section 信息架构 + 状态组件
- [ ] 概览 KPI 行（真实可算，读 `overview`）。
- [ ] 页面分 4 段（见 §八），收敛卡片数量，辅助数据降权。
- [ ] ChartTooltip（键盘可达）/ ChartEmpty / ChartLoading（骨架屏）/ 无障碍（aria-label、prefers-reduced-motion）。
- [ ] 图表色板收敛到 token、圆角统一到 `packages/ui` 预设。
- 验收：首屏一眼"市场到底需要什么"；5 个图表数据全部真实；键盘可触达 tooltip。

### P2 —— 技能市场地图精修（核心差异化组件）
- [ ] 四象限背景、网格弱化、中位参考线（复用现有 `median` 逻辑）。
- [ ] 气泡 hover / 点击详情浮层（右侧或弹层）联动；节点标签防重叠。
- [ ] 响应式：>1024 完整地图，窄屏降级为"矩阵摘要 + Top 榜"。
- 验收：地图可作为"技能机会"模块的单一主视觉，且状态可读。

### P3 —— 市场洞察（规则驱动，先规则后 AI）
- [ ] 规则化洞察清单：需求 Top 岗位、增量城市、热门高薪技能、技能×薪资象限解读；全部由 `MarketAnalysis` 字段**计算**得出，禁止静态文案伪装。
- [ ] 数据更新时间醒目化。
- 验收：每条洞察可溯源到具体字段；无硬编码结论。

### P4 —— 移动端对齐
- [ ] 技能地图 / 概览 / 缺口在窄屏的降级视图（矩阵摘要 + Top 榜 + 2×2 KPI）。
- 验收：移动端可完成"看市场→看缺口→加入学习"主链路，不依赖复杂坐标图。

### P5 —— 市场趋势 + 城市市场地图（数据成熟后）
- [ ] `market_stats_history` 留档 + 环比趋势（本周 vs 上周）。
- [ ] 城市招聘地图（参考 Travel-Notes 交互理念，但**不复制旅行地图组件**）。
- 前置：数据规模足够、历史快照≥2 周。验收：趋势与城市图结论可溯源。

---

## 十、不做清单（控制范围）

- 不重写后端 / 不新增一级导航。
- 不引入真实地图库或复制 Travel-Notes 的地图组件。
- 不做生成式（LLM）自动洞察——P3 先规则。
- 不把"我的技能状态"做成百分比进度（`user_skills` 只有 level 0-5）；如要进度，用 topic_progress 明确口径。
- 不把每个页面都玻璃化。

---

## 十一、优先级速览

| 优先级 | 项目 | 建议 |
|---|---|---|
| P0 | **市场页接驳"市场×学习闭环"（Skill Market Map + myLevel + 一键学习）** | 最大价值 / 最小成本，必须做 |
| P0 | 市场概览（真实可算 overview） | 必须做 |
| P0 | Section 信息架构（4 段收敛）+ 状态组件（Tooltip/Empty/Loading/无障碍） | 必须做 |
| P1 | 图表色板收敛 token + 圆角统一 | 推荐，顺手做 |
| P1 | 技能市场地图精修（核心差异化） | 强烈推荐 |
| P2 | 市场洞察（规则驱动） | 推荐 |
| P3 | 移动端降级对齐 | 推荐 |
| P4 | 市场趋势（需历史留档硬前置）+ 城市市场地图 | 数据成熟后 |
