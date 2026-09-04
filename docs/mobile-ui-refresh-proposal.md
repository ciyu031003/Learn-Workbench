# 移动端「苦旅」重构方案 — 阳光青春 · 移动优先（Proposal）

> 版本：draft v0.1
> 范围：`apps/mobile`（Expo 57 / React Native 0.86 / Expo Router / Reanimated 4）
> 目标：让移动端成为一个**独立于 Web 的、更简单、更清晰、更明快**的「今日工作台」，而不是 Web 端缩小版。
> 状态：**方案阶段，尚未实施代码**。下轮确认后再进入 P0 落地。

---

## 0. 设计主张（一句话）

Web 是「完整学习工作台」，移动端是「**今天 + 一个焦点 + 可折叠任务 + 沉浸专注**」。

移动端用户打开 App 的三秒内只应该做三件事：
1. 看到**今天该做什么**；
2. 一键进入**此刻唯一的焦点动作**（开始专注 / 完成今日任务 / 打卡）；
3. 感觉自己处在一个**明亮、轻快、有呼吸感**的青春世界里。

所有把 GitHub 表单、爬虫配置、堆叠统计塞进首屏的冲动，都是「Web 缩小版」的惯性，必须被移动端的「单一焦点原则」替换掉。

---

## 1. 现状诊断（为什么现在像 Web 缩小版）

基于对 `apps/mobile/src` 的通读，当前存在以下系统性偏差：

| # | 问题 | 现状证据 | 影响 |
|---|---|---|---|
| D1 | **底部 5 个 tab 过载** | `_layout.tsx`：首页 / 学习 / 招花 / 职业 / 我的，5 个高频 tab 已占满容量，且「职业」「我的」都偏配置/重功能 | 信息架构没有主次，用户不知道该点哪里 |
| D2 | **全局暗色壁纸 + 深色遮罩 + 白字 hero** 与「阳光浅色」冲突 | `daily-background.tsx` overlay `rgba(8,8,14,0.38)`；`dashboard.tsx` hero 白字 `#fff`，卡片却是浅色半透明 | 忽亮忽暗、对比割裂、不像一个体系 |
| D3 | **色彩碎片化 + 大量硬编码** | `#4f46e5 / #10b981 / #0ea5e9 / #f97316 / #f43f5e / #8b5cf6` 散落各处，与 `packages/ui` 的 `sunny` 图文案（`#2f74c0 / #e1781c`）不同步 | 品牌色不统一，图表、标签、按钮各自为政 |
| D4 | **Emoji 充当功能图标** | `focus-timer.tsx` 与多个页面用 `🎨 🎉 ⏱ ⏸ ▶ ⏹ ↩ 🔁 📋 📚 🔥 💪 📤` 等 | 跨平台渲染不一致、无法 token 化管理、专业感低 |
| D5 | **单页承载所有功能的长卷滚动** | `dashboard.tsx` 首页塞入统计、进度条、任务、GitHub 表单；`settings.tsx` 633 行滚不完；`jobs.tsx` 961 行 | 认知负荷高、层级混乱 |
| D6 | **环形进度是「假环」** | `focus-timer.tsx` 用 `Animated.Image` + `scale` 造环，`ringScale = 0.6 + 0.4*ratio` | 进度不精确、无法表达「时间在流逝」的真实感 |
| D7 | **卡片材质误用** | `card.tsx` 用 `GlassView`，浅色场景回退成白色半透明，且 border/shadow 混用 | 没有稳定的海拔体系，浅色画布上发灰 |
| D8 | **完成/庆祝体验弱** | 「专注完成」只有文字，无庆祝动效；打卡/建任务无正向反馈 | 缺少「青春的成就感时刻」 |

结论：移动端需要的不是「把 Web 的 token 搬过来换个颜色」，而是一次**信息架构 + 视觉世界 + 动效节奏**的三层重构。

---

## 2. 目标与设计原则

### 2.1 Visitor Mode：Operate（完成任务的工具）
移动端属于 `impeccable` 的 **Operate** 模式：可扫读性、一致性、原生习惯、真实使用场景 > 表达性。品牌藏在精确的细节里（圆角、阴影、动效、spacing），而不是靠大面积装饰。

### 2.2 风格方向：Sunny Clay / Soft 3D（轻量）
延续 Web v1.3 的「青春阳光」世界（`packages/ui` 的 `sunny`/`oilPainting`），移动端把它推进成**软 3D 黏土感 + Material You MD3 动效哲学**：
- 暖象牙白画布，不压黑遮罩；
- 晴空蓝主导 + 阳光橘强调 + 语义色点缀（不是高饱和色堆叠）；
- 柔圆卡片、薄暖边框、暖色软阴影、胶囊控件、MD3 state layer；
- 所有可点元素有 `press scale 0.95–1.05` + 触觉反馈。

### 2.3 三条铁律（来自三个 skill 的收敛）
1. **禁止 Emoji 做结构化图标**（ui-ux-pro-max / gpt-taste）——统一矢量化图标。
2. **每屏只保留一个主 CTA**（ui-ux-pro-max `primary-action`）——「今日焦点」只能有一个。
3. **动效必须有因果意义，且可被打断/降级**（ui-ux-pro-max `motion-meaning` / Apple HIG）——庆祝只在一次性完成事件触发，不做持续粒子雨。

---

## 3. 信息架构 / 导航重构（最重要的改动）

### 3.1 底部导航：5 → 4（推荐）

| tab | 定位 | 内容 |
|---|---|---|
| **今天** | 唯一首屏 / index | 问候 + 每日一句（顶部）+ 今日焦点 + 今日任务 + 今日专注 + 连续打卡 + 本周进度 |
| **学习** | 学习主线 | roadmap / 主题 / 任务 / 日志 |
| **招花** | 求职绽放 | 市场列表、投递、统计（保留品牌隐喻，但语义色并入 sunny 体系） |
| **我的** | 个人 + 设置 | **职业规划并入此页**，设置拆成「外观 / 同步 / 数据 / 招聘」分区 |

**理由**：移动端导航 ≤ 4（ui-ux-pro-max bottom-nav-limit），「职业」从独立 tab 降级为「我的」里的分区，「设置」不再是独立 tab，腾出的空间和注意力全部给「今天」。

**备选（若想更激进）**：3 tab + 首页中心 FAB——`今天 / 学习 / 我的`，将「招花」作为「今天」里一个可置顶模块或「学习」内的分支入口，中心 FAB 触发「开始专注」。此方案更像 iOS 习惯，但改动面更大，建议作为 P1 可选。

### 3.2 首屏「今天」= 唯一重点
`dashboard.tsx` 重构为「今天」：
1. **顶部问候**：`早上好，继续今天的 ICT 学习规划`（浅色大标题，非白字压壁纸）。
2. **每日一句**放在问候下方/并排（`今天` 顶层，不再是页面底部）。
3. **今日焦点卡片**：一个醒目的主 CTA——当前应做的那件事（开始专注 / 月历某任务 / 打卡），其余动作全部降级。
4. **今日任务**：可勾选 pill / checkbox，完成即触发轻庆祝。
5. **今日专注 + 连续打卡 + 本周进度**：紧凑、语义化、可点击进入详情。
6. GitHub 表单、路线图进度条等**非「今天」内容移出首屏**（放入「我的 / 数据」或「学习」）。

### 3.3 二级功能分层
- `roadmap / tasks / logs` 保持 `href: null` 次级页面，从「学习」进入，不占底部 tab（现状已正确，保留）。
- 新增独立全屏页：**Focus（专注）**、**Task detail（今日任务详情）**，避免在首页长卷里内嵌 568 行 timer 逻辑。
- 「设置」从 633 行滚动屏改为**分组 List**：外观 / 同步登录 / 数据服务地址 / 招聘采集。

---

## 4. 视觉系统 Token（单一事实源）

建议新增 `apps/mobile/src/theme/tokens.ts`，直接引用/对齐 `packages/ui/src/index.ts` 的 `sunny`，但补充移动端专属的 elevation / state / motion token。

### 4.1 色彩（浅色默认，晴空蓝 + 阳光橘）

```ts
export const colors = {
  canvas: "#FDF8EF",        // 暖象牙白画布（替换全局暗色壁纸）
  surface: "#FFFBEA",       // 卡片暖白
  surfaceStrong: "#FFFFFF",
  text: "#3A3630",
  textMuted: "#6F6A63",
  border: "rgba(120,90,45,0.16)",
  borderStrong: "rgba(120,90,45,0.28)",

  primary: "#2F74C0",       // 晴空蓝
  primaryStrong: "#2563B0",
  primarySoft: "#EAF4FD",

  accent: "#E1781C",        // 阳光橘
  accentStrong: "#B85C12",
  accentSoft: "#FDEFdf",

  success: "#3DA35D",
  successSoft: "#E8F6EC",
  warning: "#D99000",
  warningSoft: "#FCF3DF",
  danger: "#C04545",
  dangerSoft: "#FBEBEB",

  // 专注沉浸仍保留暗色世界（唯一保留暗色的场景）
  focusCanvas: "#0F2027",
  focusAccent: "#FFB25E",

  chart: ["#2F74C0", "#5B93D6", "#8BB7E8", "#E1781C", "#8FBF5F"],
};
```

> 关键决定：**普通页面回到浅色明亮画布**；只有「专注全屏」保留沉浸式暗色 + 流线光（见 6.4）。这解决 D2 的「忽亮忽暗」。

### 4.2 字体
- **中文正文/标题**：系统 CJK（iOS PingFang SC / Android MiSans + Noto Sans CJK），保证可读性与 Dynamic Type。
- **数字/拉丁/计时**：`Nunito`（青春圆润）或 `Plus Jakarta Sans`（中性现代）。计时器使用 **tabular-nums / monospaced figures**，避免数字跳动。
- 推荐组合：**标题/展示数字 `Fredoka`，正文 `Nunito`**；若想更稳重走 iOS 中性风，则统一 **Plus Jakarta Sans**。二者选一，不混用两种展示体。
- 字号走平台 type scale：`display 34 / title 28 / headline 22 / body 16 / subhead 14 / caption 12`。

### 4.3 图标
- **主图标库切换为 Phosphor（`phosphor-react-native`）**，线性、统一 stroke 1.5px，skill 默认体系。
- 现有 `@expo/vector-icons`（Ionicons）**降级为兼容/占位**，逐步迁移。
- 建立语义映射：`今天=house / 学习=book-open-text / 招花=flower-lotus / 我的=user-circle / 专注=timer / 完成=check-circle / 待办=circle / 设置=gear-six` 等。
- 所有 Emoji 图标全部替换为矢量化图标；装饰性 Emoji 仅在非结构化的「文案段落」中保留（如分享文案）。

### 4.4 圆角 / 阴影 / 海拔
```ts
export const radius = { sm: 10, md: 16, lg: 20, xl: 24, pill: 999 };
export const shadows = {
  card: { shadowColor: "#B8823F", shadowOpacity: 0.10, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  floating: { shadowColor: "#E1781C", shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
};
```
- 软 3D 的关键是**暖色阴影 + 同一海拔只用同一种 shadow**，避免随机 shadow 值。

### 4.5 间距 / 触控
- 间距节奏：`4 / 8 / 12 / 16 / 24 / 32 / 48`。
- 触控目标 ≥ 44pt（iOS）/ 48dp（Android）；图标再小，热区也要扩大。
- 内容距安全区顶部/底部留足 `safe-area` 内边距。

### 4.6 动效 Token
```ts
export const motion = {
  micro: { duration: 160, easing: "spring", damping: 16, stiffness: 320 },
  standard: { duration: 260, easing: "spring", damping: 14, stiffness: 240 },
  enter: 260, exit: 180,      // exit 约等于 enter 的 60-70%
  stagger: 40,                // 列表逐项 30-50ms
  pressScale: 0.96,
};
```
- 所有动效尊重 `AccessibilityInfo.isReduceMotionEnabled()`，开启后禁用装饰性动效、仅保留状态切换。

---

## 5. 组件改造清单

| 组件 | 现状 | 改造 |
|---|---|---|
| `DailyBackground` | 全局暗色 Bing 壁纸 + 黑遮罩 | 拆为两个：`LightSurface`（默认暖白画布 + 轻微顶部渐晕）+ `FocusAmbient`（专注全屏沉浸背景），全局不再压黑 |
| `Card` | `GlassView` 半透明/玻璃 | 改为暖白纸面卡：`surface` 底 + 暖边框 + 暖软阴影 + 统一圆角间距；标题/subtitle 层级固定 |
| `PressableScale` | 仅 `jobs.tsx` 内联一份 | 抽为通用 `PressableScale`（0.96 press + 可选 haptic），所有按钮/卡片复用 |
| `Button`（Primary/Secondary/Text） | 各处散落 | 统一 Primary 晴空蓝、Secondary 浅底、Text 无边框；disabled 用 opacity 0.4 + 非交互语义 |
| `Pill / Chip` | 任务类型、筛选混用 | 统一胶囊控件，选中态 `primarySoft`/`accentSoft`，边界清晰 |
| `ListItem / SectionHeader` | 设置/我的长卷 | 分组 List，section header + 行 + 右侧 chevron |
| `EmptyState` | 文案散落 | 统一插画感空态（暖色 + 图标 + 一句话 + 一个动作） |
| `RingProgress` | `Animated.Image` + scale 假环 | 新增 `react-native-svg` 真环形：按真实进度绘制，支持呼吸/光晕动画 |
| `Celebration` | 无 | 新增一次性 confetti/sparkle（可自研 Reanimated+SVG，或评估 confetti 库） |
| `BottomSheet` | 求职详情用 `Modal` | 统一 sheet 从底部上滑，带 scrim + 可拖拽收起，符合 iOS 习惯 |
| `TabBar` | Expo Router `Tabs` 默认 | 自定义 4-tab，材质半透明 + 图标 spring 弹跳 + 选中态 subtle pill 高亮 |

---

## 6. 页面级改造要点

### 6.1 「今天」`dashboard.tsx`（P0 首要）
- 浅色大标题 + 顶部安全区；问候语 + **每日一句在顶部**，与问候并置。
- 首屏模块优先级：今日焦点（唯一主 CTA）> 今日任务 > 今日专注 / 连续打卡 > 本周进度。
- 移除 GitHub 表单与完整路线图进度条，归档到「我的 / 数据」或「学习」。
- 今日句、打卡、专注、任务完成全部走统一 token，不再出现 `#4f46e5`。

### 6.2 「学习」`learn.tsx / roadmap.tsx / tasks.tsx / logs.tsx`
- 保持次级导航，`roadmap` 用横向阶段卡 + 可折叠主题，`tasks` 用可勾选列表，`logs` 做「时间线 + 复盘」。
- 任务完成改用 `check-circle`（未完成 `circle`），不靠裸色块表义。
- 日志页做「这是我今天的学习证据」的叙事感：每行 = 时间轴点 + 任务 + 专注时长 + 一句话复盘。

### 6.3 「招花」`jobs.tsx`
- 保留「绽放」隐喻（`flower-lotus` icon），但把 `SOURCE_COLORS` 与 `AVATAR_COLORS` 里 `#10b981/#0ea5e9/...` 迁到 sunny 语义色 + chart 系列。
- 列表间距、卡片圆角、状态 chip、空态统一；去掉与浅色画布冲突的硬编码绿色/品红大面积。
- 详情 `job-detail-modal.tsx` 改为 BottomSheet，字段分组、显式「申请/收藏/详情」动作。

### 6.4 「专注」`focus-timer.tsx`（保留暗色世界，但更电影化）
- **信息架构**：从首页/任务的「开始专注」进入，全屏独立页，顶部浅色返回。
- **背景**：保留暗色 + 可切换图库/纯色/自定义，但引入 `expo-linear-gradient` + `expo-blur` 做「流线光 / 呼吸光晕」，让这成为移动端唯一允许沉浸式装饰的场景。
- **环形进度**：用 `react-native-svg` 画真实弧线，随剩余时间平滑前进/回退；环形外圈可做「呼吸光晕」。
- **中途退出记录**：确认并保留现有 `record(elapsed)` 语义（关闭 / 系统返回都会把 `elapsed = total - remaining` 作为本次实际专注时长记录，≥10s 才入账）；在此基础上加**明确的「结束并记录」按钮**，让「学两分钟退出」被正确、可感知地记录，而不是藏在一个关闭按钮里。
- **庆祝**：完成时触发 `Celebration`（confetti/sparkle 一次性）+ 轻触觉，`🎉` 文案降级为文字 + 图标。
- **计时字体**：tabular-nums，避免秒位抖动。
- **今日一句**：可保留在专注页作为沉浸语境，但首页顶部已有「每日一句」，二者共享来源即可，不重复职责。
- **尊重 Reduced Motion**：开启后关闭流线光与连续粒子，只保留必要的状态切换。

### 6.5 「我的」`settings.tsx`（并入职业，分组化）
- 顶部为个人卡（头像/昵称/连续打卡/累计专注）。
- 分组：**外观**（背景开关、主题） / **账户**（登录/注册/改密） / **服务**（API 地址） / **数据**（同步、GitHub 资产、导出） / **招聘**（采集配置、运行记录） / **职业**（原 `career.tsx` 内容并入）。
- 删除长卷与「一把梭」表单，用 List + 展开 sheet 的方式渐进披露。

---

## 7. 动效与「类视频流特效」落地（不过度）

> 原则：每屏 1-2 个关键动效，每个动效有原因，`prefers-reduced-motion` 一关全降级。

| 场景 | 特效 | 实现建议 |
|---|---|---|
| 首屏 hero | 顶部**暖色渐晕** + 每日一句处**轻微漂浮动效** | `expo-linear-gradient` 静态渐晕 + `Reanimated` 慢速 `translate/opacity` |
| 今日焦点 / 主 CTA | 按压回弹 + 水波/缩放 | `PressableScale` + `expo-haptics` |
| 完成/打卡/建任务 | 一次性 confetti / sparkle | `Celebration`（自研 SVG+Reanimated，或评估 confetti 库），触发后自动收起 |
| tab 切换 | 图标 spring 弹一下、页面淡入 | 4 tab 的 `TabIcon` spring，内容 crossfade |
| 列表卡片 | 逐项 stagger 30-50ms | `withDelay(index*motion.stagger)` |
| 专注全屏 | **呼吸光环 + 流线光** | `react-native-svg` 弧线 + Reanimated scale/opacity；`expo-linear-gradient` + `expo-blur` 做流动背景；随专注进度增强亮度 |
| 完成任务 | 卡片从「进行中」到「完成」的连续过渡 | 图标描边 fill 过渡 + 文字划线 + 卡片阴影轻微下沉 |

**视频流般的效果不是无限粒子**，而是一条连贯的光/呼吸节奏：专注页的背景光会像呼吸一样缓慢起伏，完成瞬间光流汇聚、彩带弹出一次，然后立即归于平静。这样既有「电影感」，又不会喧宾夺主。

---

## 8. 依赖变更建议

**新增**
- `phosphor-react-native` + `react-native-svg`（图标库 + 真弧线/自研庆祝）。
- `expo-linear-gradient`（流线光、暖色渐晕）。
- `expo-blur`（专注沉浸背景、底部 sheet scrim）。
- `expo-haptics`（按压/完成触觉）。
- 评估：`react-native-confetti-cannon`（若自研成本高、Expo 兼容性稳则选它）。

**保留/复用**
- `react-native-reanimated`、`react-native-gesture-handler`、`react-native-safe-area-context`、`react-native-worklets`、`expo-image`、`expo-glass-effect`（仅必要时作为「我的」顶部材质，不再用在普通 Card）。

**降级**
- `@expo/vector-icons`（Ionicons）：迁移期保留，最终作为位图/兼容 fallback。

所有新依赖需先确认 `npx expo install` 版本与 Expo 57 兼容，避免裸装破坏 native 构建。

---

## 9. 分期落地（P0 → P1 → P2）

### P0：打地基 + 信息架构（必须先做）
1. 建立 `apps/mobile/src/theme/tokens.ts`。
2. 重构 `DailyBackground` → `LightSurface`（默认浅色）+ 保留专注沉浸背景能力。
3. 重构 `Card`、新增 `PressableScale`、`Button`、`Pill`。
4. 底部导航 5→4：`今天 / 学习 / 招花 / 我的`；「职业」并入「我的」。
5. 重构 `dashboard.tsx` 为「今天」（顶部问候 + 每日一句 + 今日焦点 + 今日任务 + 专注/打卡/进度），移除首页 GitHub 表单与全量进度条。
6. 迁移 Emoji 图标第一批（首页 + 导航 + 任务状态）。
**验收**：`pnpm --filter mobile typecheck && pnpm --filter mobile lint && pnpm --filter mobile test` 全绿；首屏不再黑遮罩；一个主 CTA；无 `#4f46e5` 等残留硬编码（新 theme 文件除外）。

### P1：专注重构 + 动效
1. 将 `focus-timer.tsx` 抽为独立全屏 Focus 页，`react-native-svg` 真弧线 + 呼吸光晕 + 流线光。
2. 明确「结束并记录」（中途退出记录实际时长），并补齐 Web 端同语义的对齐（若 Web 仍是「只在完成时记录」）。
3. 新增 `Celebration`（完成/打卡/建任务一次性 confetti）。
4. 统一 tabs 动效 / 卡片 stagger / sheet 过渡。
**验收**：进入专注 → 中断退出 → 专注时长正确入账；完成触发一次性庆祝；Reduced Motion 下降级正常。

### P2：招花与「我的」打磨
1. `jobs.tsx` 迁移语义色、列表/空态/pill、详情改 BottomSheet。
2. `settings.tsx` 分组化并并入职业，长卷拆解。
3. 补齐 `EmptyState`、`SectionHeader`、深/浅模式对比与 AA 对比抽检。
**验收**：所有二级页 token 化；无 Emoji 结构化图标；设置按分组清晰可扫；触控目标全部 ≥44pt。

每完成一个阶段：`typecheck / lint / test` + 真机/模拟器截图自查（375pt 与 landscape、Dynamic Type 最大档、Reduced Motion 开启），确认无误再进入下一阶段。

---

## 10. 需用户拍板的开放决策

1. **底部 tab 数量**：推荐 4（今天/学习/招花/我的）；是否接受把「职业」从独立 tab 并入「我的」？（备选：保留 5 但改为主次，或激进改 3+中心 FAB。）
2. **默认浅色画布**：是否接受**普通页面不再使用每日 Bing 暗色壁纸**，只保留「专注全屏」的沉浸暗色？（强烈建议接受，否则阳光青春与暗色叠加无法自洽。）
3. **新依赖**：是否接受引入 `react-native-svg` + `phosphor-react-native`（支撑真弧线与统一图标）？（自研庆祝不额外引入 confetti 库，降低风险。）
4. **字体**：展示数字用 `Fredoka`（更卡通青春）还是 `Plus Jakarta Sans`（更 iOS 中性）？
5. **实施顺序**：是否按 P0→P2 逐阶段推进，每阶段自审通过再继续（推荐）？

> 下一轮确认以上 5 点后，即可从 P0 开始实施；实施时先跑 mobile `typecheck/lint/test` 基线，再逐阶段提交，切勿一次性重写 `jobs.tsx`（961 行）这类大文件。
