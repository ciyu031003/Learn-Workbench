# Learn Workbench 青春阳光风 · UI 组件精修与体验优化方案

> 版本：v1.3 提案（仅方案，未改代码）
> 日期：2026-09-05
> 前置文档：docs/ui-redesign-proposal.md（v1.2 浅色油画方案）
> 结论：**色彩方向保留并提亮，组件层做一次系统性精修 + 三个明确诉求落地 + 借鉴开源工作台补几个高价值轻模块。**
> 原则：不是推翻 v1.2，而是在「浅色油画」的纸上，把「青春 / 阳光 / 灿烂」落在语义亲进度、图标准确度、组件精致度、微交互与成功反馈上，而不是堆背景动画。

---

## 一、一句话总结

- 现有配色“克制得体”，但**组件在浅色纸面上继续用“深色壁纸时代”的透明玻璃控件**，导致发灰、发糊、层级乱；加上 token 三处不同步、图标和圆角硬编码，所以“看起来粗糙”。
- 本轮要做的是：**把阳光调子点亮 + 把组件做干净 + 把三个具体诉求做到位**，并顺手借鉴开源工作台的“今日焦点 / 快捷输入 / 连续打卡 / 成功庆祝 / 空状态引导”能力。

---

## 二、现状审计：粗糙点在哪（read-only 结论）

| # | 问题 | 具体位置 | 可感知影响 | 修法方向 |
|---|---|---|---|---|
| 1 | 三套色值不同步 | `packages/ui/src/index.ts` 的 `colors`(#4f46e5 indigo)、`oilPainting`(#46617a)、`globals.css @theme`(#46617a) 并存 | 新色板与旧组件各自为政 | 统一到单一事实源，旧 `colors` 仅留 RN/兼容用途；全站引用 oil tokens |
| 2 | 浅色纸面上仍用深色时代的透明玻璃控件 | `wellbeing`、健康卡片、`tasks` 大量 `border-white/20 bg-white/10 backdrop-blur` | 显灰、糊边、对比不足 | 浅色态改用「纸面控件」：`bg-muted/60` + `border-border` + 实底文字；玻璃仅保留给专注全屏弹层 |
| 3 | 硬编码旧色残留 | `OverallRing`(#6366f1→#0ea5e9)、`button` 渐变 #4338ca、`progress-fill` indigo、健康运动进度条 emerald→teal、`planKindMeta` 六色 | 页面花哨、脱离 token | 全部改为「晴空蓝 primary + 阳光橘 accent + 语义绿/黄/红」 |
| 4 | 圆角/阴影不统一 | button `rounded-md`(6)、Input `rounded-xl`(12)、Card(16)、modal(24)、toaster(10) | 混搭感强、不专业 | 统一：控件 12、卡片/容器 16、弹窗 20、胶囊 full；阴影引入暖色低饱和 |
| 5 | 图标尺寸/描边混 | 同一行 `size-4.5`/`size-4`/`size-3.5` 混用 | 对齐不稳 | 规范：导航/区块 20、卡片语义 18、行内 16、角标 14，统一 strokeWidth=2 |
| 6 | Badge 可读性弱 | `badge default = bg-primary/25 + text-foreground` | 文字糊、像标签不像状态 | 语义色浅底 + 语义深字（success/danger/warning），default 用 `bg-primary/12 + text-primary` |
| 7 | 空状态无焦 | `EmptyState` 只有图标+文案 | 无下一步引导，冷清 | 加「主行动按钮 + 一句钩子」，卡片内留白收紧 |
| 8 | 运动模块无球类图标 | `wellbeing` 运动类型是纯文字下拉 | 用户点名要球类图标 | 为每类运动配 Lucide 语义图标（见 §4.1） |
| 9 | 每日一言孤立在底部 | `dashboard` 末尾单独 `QuoteWidget` max-w-md | 像贴片、无归属 | 上移至 hero 问候卡，与问候语并排（见 §4.3） |
| 10 | 成功反馈缺席 | 创建任务 / 完成任务只有 Toast 文案 | 用户点名要彩带/烟花 | 新增可复用的 `Celebration` 分层庆祝组件（见 §4.2） |

---

## 三、青春阳光视觉方向（在 v1.2 上提亮，不推翻）

### 3.1 语义色彩校准版（暖底 + 晴空蓝 + 阳光橘）

| Token | 现值 | 建议值 | 一句话说明 |
|---|---|---|---|
| canvas | #f6f2ea | **#fdf8ef** | 暖象牙白，更像“晒着太阳的纸面” |
| surface | #fffdf7 | **#fffefa** | 留一点点暖，卡片更白净 |
| primary | #46617a | **#2f74c0**（晴空蓝） | 年轻、提神；白字对比 ≥4.5:1 |
| primary-600 | 无 | **#2563b0** | hover/active 深一档，避免只用 opacity 变糊 |
| accent | #a5662e | **#e1781c**（阳光橘） | 大图标/高亮用；起色相，不抢阅读 |
| accent-strong | 无 | **#b85c12** | 小字用，保证 AA（避免“文字上的橘”太浅） |
| success | #5f7d59 | **#3da35d**（新芽绿） | 更明快；配套 success-strong #2c7d47 |
| warning | #8f6a2a | **#d99000**（暖阳黄） | 配套 warning-strong #a86900 |
| danger | #a0524a | **#c04545**（砖红） | 保留克制，配套 danger-strong #9c2f2f |
| border | rgba(90,80,60,.14) | **rgba(120,90,45,.16)** | 稍微带暖，仍够轻 |

> 规则：**主色偏冷（晴空）、强调色偏暖（阳光）**，恰好构成“阳光下清爽”的张力，不会变成甜腻的儿童风。深色档继续沿用 v1.2 深色列，但把 primary/accent 换成同一色相的系统深色适配值。

### 3.2 图表色板（单一事实源）

- 多系列：`#2f74c0 → #5b93d6 → #8bb7e8 → #e1781c → #8fbf5f`
- 状态数据：success / warning / danger / neutral
- “我的”数据：一律 accent 系；对比/市场数据：一律 primary 系
- 禁止再出现 `#4f46e5 / #6366f1 / #0ea5e9` 等旧 indigo/cyan 硬编码。

### 3.3 卡片 / 圆角 / 阴影

- 卡片：柔和暖影，去掉沉闷黑影：
  `box-shadow: 0 1px 2px rgba(160,110,40,.06), 0 12px 32px rgba(160,110,40,.12)`
- hover：只加深阴影 + 边框变暖 1px，**不上浮**（工作台要稳，不炫技）。
- 圆角统一：控件 12、卡片 16、弹窗 20、底部抽屉 28、胶囊 full；废弃 `rounded-md / rounded-[10px]`。

### 3.4 动效原则

- 所有动效尊重 `prefers-reduced-motion`；常规动画 180–360ms，缓动统一 `cubic-bezier(.22,1,.36,1)`。
- 微交互三件套：`press-scale`（按压）、hover 暖影、成功时一次性 `sparkle/sunburst`。
- **绝对不加**：全屏粒子背景、滚动视差、持续循环的 confetti 雨。庆祝只发生在“事件完成的 2–3 秒一次”。

---

## 四、三个明确诉求的落地设计

### 4.1 健康/球类运动增加图标

当前 lucide-react 1.31 可用运动类图标：`Volleyball`、`Bike`、`Dumbbell`、`SportShoe`、`BicepsFlexed`、`Footprints`、`HeartPulse`、`Activity`、`Medal`、`Trophy`、`Target`。

建议建立 `EXERCISE_ICONS` 映射，落到 `wellbeing/page.tsx`：

| 运动类型 | 图标 | 说明 |
|---|---|---|
| 球类 / BALL | `Volleyball` | 球类主图标（篮球/羽毛球无内置，见下） |
| 跑步 / 走 | `Footprints` 或 `SportShoe` | 有氧 |
| 骑行 | `Bike` | 通勤/骑行 |
| 力量 | `Dumbbell` 或 `BicepsFlexed` | 无氧 |
| 拉伸/瑜伽 | `HeartPulse` 或 `Activity` | 恢复类 |
| 自定义 | `Activity` | 兜底 |

- 交互：运动类型下拉改成「图标 + 标签」的胶囊组（单选），让“球类”一眼可辨。
- 若坚持要“篮球 / 羽毛球 / 乒乓球”等精确图标：本项目 lucide 版本没有，建议**内置 3–4 个 24×24 线性小 SVG**（stroke 与 lucide 对齐，strokeWidth=2），成本低且可控；不建议为此引入整套图标库。

### 4.2 创建任务 / 完成任务成功庆祝（彩带/烟花）

新增一个可复用组件 `apps/web/components/celebration.tsx`（`use client`），提供两级：

| 等级 | 触发 | 效果 | 实现 |
|---|---|---|---|
| `sparkle`（轻） | 创建任务成功、单条任务完成 | 弹窗/Toast 上 1.2s 小烟花 + 成功勾 | 纯 CSS/SVG 粒子，零依赖 |
| `confetti`（重） | 当日全部任务完成、专注计时完成 | 全屏 2.5s 彩带/烟花 + 遮罩淡入淡出 | 推荐 `react-confetti`（轻量，约几 KB，成熟稳定）；降级方案为内置 Canvas confetti |

- 接入点：
  - `tasks/page.tsx`：`创建任务成功` → `sparkle`；`toggleDone` 成功 → `sparkle`；`今日任务已全部完成` → `confetti`。
  - `focus-timer.tsx` 的 done 页 → `confetti`。
- 交互克制：同一时间只触发一次；`prefers-reduced-motion` 时直接显示静态“成功徽章 + 一句话”，不放粒子。
- 依赖新增：`react-confetti`（仅 confetti 级使用）。

### 4.3 每日一言上移，与问候语并排

- 目标：把 `QuoteWidget` 从底部拿掉，放进 hero 问候卡（`dashboard/page.tsx` 的“问候条 + 整体进度”section）。
- 布局：
  - 桌面：左侧问候（日期 + `早上好，{领域名}` + 副文案 + 领域胶囊），右侧“每日一言”轻卡，中间用 `w-px` 或留白分隔，宽度 `max-w-sm`。
  - 移动：单列，问候在上、每日一言在下（可缩成“只显一句 + 换一句按钮”，弱化卡片边框）。
- 组件调整：保留 `QuoteWidget` 的轮播与交叉淡入，但新增 `variant="inline"`，去掉外层 `paper-card`（嵌进 hero 卡内部，避免“卡中卡”）。
- 说明：这样“每天一句话”成为首屏情绪开场，而不是底部收尾贴片。

---

## 五、借鉴开源工作台：值得我们“拿过来用”的模块

| 借鉴来源 | 值得抄的点 | 本项目落点 | 优先级 |
|---|---|---|---|
| Pomofocus | 番茄预设 + 历史统计 + 连续专注成就 | 已有专注页，补「今日专注心率条 + 最近 7 天小热力条」 | P1 |
| Vikunja | 任务“输入即添加”的快捷新建框 | 首页「接下来」区顶部加 `⌘/Ctrl+K` 或一个内联输入框，回车即建任务 | P1 |
| Focalboard / Notion | Dashboard 可组合 widget + 今日焦点 | 强化“当前唯一最重要的一件事（MIT）”，其余任务折叠为“接下来” | P0/P1 |
| Dashy / Homarr | 问候 + 实时时钟/日期 + 小部件 | hero 加“实时时钟”，日期层级丰满（天气需外部 API，列为可选 P2） | P2 |
| Logseq / Notion daily note | 每日复盘/一句话日志 | “当前状态”区加“今日一句话复盘”轻输入框 | P2 |
| Habitica / Duolingo | 连续打卡火焰 + 成就反馈 | 已有 streak，加“连续打卡火焰团 + 当日完成庆祝”视觉 | P1 |
| Forest | 专注完成“种一棵树/攒一点成就”的轻奖励 | 专注完成弹层加一枚“专注果实/积分 +N”的视觉奖励 | P2 |

推荐本轮 P0 只做：**MIT 今日焦点 + 快捷输入 + 连续打卡火焰**，都是低风险、高感知。天气/AI 推荐等外部依赖事项一律 P2/可选项，先不做。

---

## 六、实施优先级（Roadmap）

### P0 —— 本轮必做（用户三点 + 色彩与组件精修）
1. 统一 tokens：`packages/ui/src/index.ts` 增加 `sunny`（或改进 `oilPainting`）为单一事实源；`globals.css @theme` 同步；移除组件里的旧 indigo/cyan/emerald 硬编码。
2. 浅色纸面控件化：把 `wellbeing/tasks` 等页面内联 `bg-white/10 backdrop-blur` 换成纸面控件，解决发灰模糊。
3. 球类图标映射 + 运动类型胶囊组（§4.1）。
4. `Celebration` 分层组件 + 接入创建/完成/全完成/专注完成（§4.2）。
5. 每日一言上移 hero（§4.3）。
6. Badge 可读性 + 按钮/输入/圆角/阴影统一。

### P1 —— 高感知补充
- 首页「今日焦点（MIT）」强化 + 快捷新建任务内联框。
- 连续打卡火焰团视觉强化。
- 专注心率条 / 最近 7 天小热力条。
- Toast/空状态视觉升级（带主行动按钮）。

### P2 —— 可选增强
- 实时时钟、天气（要 API）、每日复盘快捷输入、专注“种树/攒分”轻奖励。
- 精确球类自定义 SVG（篮球/羽毛球/乒乓球）补齐。

---

## 七、落地与验收

**改动范围**：纯前端。涉及
- `packages/ui/src/index.ts`
- `apps/web/app/globals.css`
- `apps/web/components/ui/*`（button/badge/card/input/switch/toaster/empty-state/progress）
- `apps/web/app/dashboard/page.tsx`、`apps/web/components/quote-widget.tsx`
- `apps/web/app/wellbeing/page.tsx`、`apps/web/app/tasks/page.tsx`、`apps/web/components/focus-timer.tsx`
- 新增 `apps/web/components/celebration.tsx`

**新增依赖**：`react-confetti`（可选，若走零依赖 CSS/SVG 则无需新增）。

**验收清单**：
- [ ] 浅色首页不再出现发灰的透明玻璃控件；卡片/按钮/输入/Badge 视觉统一
- [ ] 页面里 `grep` 不到 `#4f46e5 / #6366f1 / #0ea5e9 / emerald / teal / violet` 等旧色硬编码
- [ ] 球类运动有图标；创建任务、完成任务、全完成、专注完成有对应等级庆祝
- [ ] 每日一言在首屏 hero，与问候并排；移动端单列不拥挤
- [ ] `pnpm --filter web lint && pnpm --filter web typecheck && pnpm --filter web test` 通过
- [ ] 手动验证 `prefers-reduced-motion: reduce` 下无粒子动画、内容可读

**上线**：提交时 **排除 `.workbuddy/memory/2026-09-03.md`**；部署只重建 web 容器（`docker compose build web && docker compose up -d web`）。

---

## 八、需要你拍板的点

1. **主色**：接受“晴空蓝 #2f74c0 + 阳光橘 #e1781c”吗？若你更想要“奶油黄底、更暖更粉”，可把 canvas 再提暖，但建议保留蓝色做正文/主按钮的对比，否则整页会腻。
2. **庆祝强度**：创建/完成单条任务只放“轻烟花”，只有“全部完成/专注完成”才放全屏彩带——这样不会天天被 confetti 刷屏。是否 OK？
3. **球类不够精确**：当前图标库只有排球/骑行/哑铃/跑鞋，若你坚持要篮球/羽毛球/乒乓球的精确图标，我下一轮顺手内置 3 个线性 SVG。
4. **是否本轮直接开始改代码**：你确认后我会按 P0 顺序实现、跑测试、提交、部署。
