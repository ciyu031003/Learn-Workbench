# APP 端优化方案 v2 —— 问题修复 · UI 精修 · 信息精简（并入 P2）

> **来源**：2026-09-15 真机走查反馈（8 个问题 + 2 条设计要求）
> **状态**：**方案待确认，今天不改代码**
> **基础**：v1.3.0（versionCode 9）已发布内测；本方案是 P0/P1 之后的第二轮
> **本轮设计参照**：Orbix Studio（学习/健康类 App 作品，见 §1.5）+ 用户提供的底栏参考图 + Apple HIG + Expo GlassEffect
> **配套**：`docs/APP端设计与打包方案.md`（总方案，§12 进度表）、`docs/改动记录与任务看板.md`（踩坑点）

---

# 0. 结论摘要

```text
8 个问题里有 3 个是「真 bug」（计时不开始 / 底栏遮挡 / 返回跳错），4 个是「设计不到位」，
1 个是「功能缺失」。此外发现一个关键事实：
  ⚠️ expo-glass-effect 已安装但全项目 0 处使用 —— 所谓「液态玻璃」目前并不存在。

因此本轮 = 3 个紧急修复 + UI 设计体系 v2（材质三级 + 组件统一）+ 3 处功能补齐 + 全站信息精简。

另经检索 Orbix Studio 作品集（详见 §1.5），其两条设计主线与我们的两个核心域直接对应：
  · Studia（学习伴侣）：暖桃渐变 + 柔玻璃卡 + 橙色「鼓励而非警示」+ 首页进度弧
  · Pulse（健身营养）：深青 + 黑 + 点阵数字 + readiness 分数 + 「一处看全，别让人翻三个 tab」
→ 结论：**不需要换调色板**（Orbix 的暖橙/深青两极正好对应我们已有的 Sunny Clay / Night Voyage），
  需要的是把它的「手艺」落到我们的 token 上：进度弧化、记分牌式数字、一处看全、软玻璃配方。
```

---

# 1. 问题清单与根因（逐条，已定位到代码）

## 🔴 Bug 1 · 点「开始计时」不开始计时（最高优先，是我 Phase 2 引入的回归）

**根因（确定）**：`apps/mobile/src/components/focus-timer.tsx`

```ts
// 第 136-140 行：currentElapsed 依赖 running「state」
const currentElapsed = () => {
  const acc = accumulatedMsRef.current;
  const runningMs = running && startRef.current !== null ? Date.now() - startRef.current : 0;
  return Math.round((acc + runningMs) / 1000);   // ← running=false 时恒为 0
};

// 第 277-282 行：resume() 先 setRunning(true)（异步），再用「本次渲染的闭包」注册 interval
const resume = () => {
  if (timer.current) clearInterval(timer.current);
  if (startRef.current === null) startRef.current = Date.now();
  setRunning(true);                              // ← state 更新不会替换已注册的 interval
  timer.current = setInterval(tick, 1000);       // ← tick 闭包里 running 仍是 false
};
```

`setInterval` 注册的是**注册那一刻的闭包**，之后每秒调用的都是这个旧闭包 → `running` 永远是 `false` →
`runningMs` 恒为 0 → `remaining` 恒等于 `total` → **数字完全不动**（看起来"没计时"）。

**影响**：Mobile 复现；**Web 端 `apps/web/components/focus-timer.tsx` 同一模式，需一并修**（`currentElapsed` 用 `useCallback([running])`，`tick` 同样是旧闭包）。

**修复**：运行状态判断一律走 **ref**，不用 state：
```ts
const runningMs = startRef.current !== null ? Date.now() - startRef.current : 0;
```
（`pause()` 已把当前段折进 `accumulatedMsRef` 并置 `startRef.current = null`，语义自洽。）

**验收**：点开始后 1 秒内数字开始变化；暂停 5 秒再继续，时间不跳变；切后台 30 秒回来数字对得上。
**补测**：给 `lib/` 抽一个纯函数 `elapsedSeconds(acc, startRef, now)` 并加单测（start/pause/resume/后台）。

---

## 🔴 Bug 2 · 底栏遮挡内容（并且 Tab 设计要按参考图重做）

**根因（已量化）**：
- 当前 Tab 栏是**浮动胶囊**：`position:absolute; left/right:14; bottom:16; height:62` → 占底部 **78pt**（还不含安全区与阴影）。
- 各屏内容底部留白**没有统一常量**，实测 `paddingBottom`：

| 值 | 屏幕 | 是否被遮挡 |
|---|---|---|
| **40** | applications / career / certificates / habits / interview / market / nutrition / radar / resume / resume-preview / workout（**11 屏**）| ❌ **必然被压住** |
| 32 | roadmap / tasks | ❌ 不够 |
| 96 / 110 / 118 | wellness / logs / learn / settings / today / jobs | ✅ 够 |

**修复**：
1. 新增 `useTabBarSpace()`（= 栏高 + 安全区 + 12pt 呼吸）并在**所有可滚动页**统一作为 `paddingBottom` 下限，替换上面 13 屏零散数值。
2. **Tab 栏按上传参考图重做**（小宇宙那种通栏扁平）：

```text
现状（浮动胶囊）                改为（通栏扁平，参考图风格）
┌ ─ ─ ─ ─ ─ ─ ─ ─ ┐            ┌─────────────────────────────┐
│  ( 今日 学习 职业 ) │  ← 悬浮      │  今日   学习   职业   健康   我的  │
└ ─ ─ ─ ─ ─ ─ ─ ─ ┘   圆角+阴影    ├──────────────────────────────┤
                                   │  ▁▁                          │ ← 激活项下方短横线
                                   └──────────────────────────────┘
```

| 属性 | 新值 |
|---|---|
| 定位 | `left:0; right:0; bottom:0`（通栏，不再浮动） |
| 高度 | `56 + insets.bottom` |
| 背景 | `colors.surfaceStrong`（实底，非透明） |
| 分隔 | 顶部 1px `colors.border` hairline |
| 阴影/圆角 | **去掉**（`elevation:0`、无 borderRadius） |
| 激活项 | 图标+文字 = 品牌色；**图标下方 18×3 圆角短横线**（参考图的红色下划线 → 用品牌色 `colors.primary`） |
| 未激活 | `colors.textMuted`；字号 10 / weight 600 |
| 图标 | 沿用 `ThemedIcon`（iOS SF Symbols 原生观感） |

**验收**：任意 Tab 滚到底，最后一行完整可见；底栏与参考图观感一致（通栏、实底、激活短横线）；每项触控宽度 ≥64pt。

---

## 🔴 Bug 4 · 今日焦点卡片切换要「纯淡入淡出」

**根因**：`apps/mobile/src/components/today-stack.tsx`
- 第 169 行 `topY.value = withTiming(back ? 260 : -260, {duration:150})` → 卡片**滑出 260pt**
- 第 172/176 行 `withSpring(0, {damping:18, stiffness:240})` → 下一张**弹回**
- 第 179 行 `topScale` 弹簧 + 第 206 行背后卡片 `translateY: index*9 / scale: 1-index*0.055`（叠层错位）

→ 就是你描述的「上滑、弹跳、再消失」。

**修复**：改为**交叉淡化（cross-fade）**：
- 删除：滑出位移、弹回弹簧、缩放、背后卡片错位与半透明
- 切换时：旧卡 `opacity 1→0`、新卡 `opacity 0→1`，`withTiming(200, Easing.inOut)`，**两者时间重叠**
- 手势（左右滑）**保留作为触发方式**，但不改变动画形式（无位移）
- 去掉切换期间的外层阴影/模糊抖动

**验收**：切卡过程无任何位移与弹跳，只有 200ms 淡化；连续快速切换不闪烁。

---

## 🟠 Bug 5 · 招花页头部（删右上角设置 + 加左上角返回）

**根因**：`apps/mobile/src/app/jobs.tsx` 第 611 行 `<GearButton onPress={() => setMoreVisible(true)} />`（第 259 行 `GEAR_MENU` 里还有"设置→/settings"），右上角占用视觉焦点。

**修复**：
- 删除 `GearButton` 及其 `GEAR_MENU` 弹层（这些入口已收敛在「我的」Tab）
- 左上角加返回按钮（复用 `ScreenHeader`），返回目标 **`/career`**（职业 Hub）

---

## 🟠 Bug 7b · 训练记录返回键跳回「今日」首页

**根因**：`apps/mobile/src/components/screen-header.tsx`
```ts
const goBack = () => {
  if (router.canGoBack()) router.back();
  else router.replace("/today");     // ← 兜底是全局单一目标
};
```
在 Tab 结构下切 Tab 会重置各自的栈，`canGoBack()` 常为 false → 落入兜底 `/today`，于是「健康→训练记录→返回」直接回了今日首页。

**修复**：兜底改为**按页面所属 Hub 映射**（新增 `backTo` 或路由→父级表）：

| 页面 | 返回兜底 |
|---|---|
| workout / nutrition / habits / trackers | `/wellness` |
| jobs / market / radar / applications / resume / resume-preview / certificates / interview | `/career` |
| tasks / logs / roadmap / phase | `/learn` |
| account-security / domain-manager | `/settings` |

**验收**：从任一 Hub 进入子页后点返回，回到**该 Hub**（而不是今日首页）；有历史时仍走 `router.back()`。

---

## 🟠 Bug 3 · 抽屉式弹窗（BottomSheet）UI 精修

**根因**：`apps/mobile/src/components/bottom-sheet.tsx` 有 5 个硬伤：

| # | 问题 | 后果 |
|---|---|---|
| 1 | 无键盘避让 | 输入框被键盘挡住（习惯/饮食/训练表单都会中招） |
| 2 | `body: { flex: 1 }` 无 ScrollView | 长表单被裁掉，无法滚动 |
| 3 | 无底部安全区 padding | 按钮贴在home indicator 上 |
| 4 | grabber `64×7`、标题 18/800 + 独立 32px 圆形关闭钮 | 头重脚轻、显"厚" |
| 5 | `Modal animationType="fade"` 与内部 `withSpring` 叠加 | 「先淡入、再弹一下」的割裂感 |

**修复（对标 Apple HIG Sheets）**：
- **滑入**：Modal 用 `animationType="none"`，自己实现 `translateY` 滑入（`motion.standard`），**去掉内部 spring 位移**（仅保留可拖拽展开时的跟手）
- **键盘**：`KeyboardAvoidingView`（iOS `padding`）+ `keyboardShouldPersistTaps="handled"`
- **滚动**：body 内建 `ScrollView`，`contentContainerStyle` 含 `paddingBottom: insets.bottom + 16`
- **头部**：grabber `36×5`；标题左对齐 `17/700`；关闭按钮 `28×28` 淡底（`colors.surfaceMuted`）；标题与内容间距 12
- **圆角**：顶部 `28`（`radius.xl` 提一档）
- **材质**：iOS 用 `GlassView`（`expo-glass-effect`，见 Bug 8），其它平台回落 `surfaceStrong`
- **HIG 依据**：可调整高度的 sheet 要带 grabber、支持下滑关闭、同一时刻只present 一个 sheet —— 这三条当前都满足，需保持

**验收**：习惯/饮食/训练/证书 四个弹窗：键盘弹出时输入框可见；长表单能滚动到底部按钮；观感与 iOS 原生 Sheet 接近。

---

## 🟠 Bug 6 · 学习页内容过多 → 统计收纳成按钮

**根因**：`apps/mobile/src/app/learn.tsx`（1149 行）把学习阶段、统计卡、热力图、日历、周期柱状图全部内联在首屏。

**修复**：
- 首屏只留 **主线**：学习阶段列表（含进度）+ 3 个快捷入口（任务 / 日志 / 领域记录）
- 新增「**学习统计**」入口按钮 → 打开**全屏 Sheet 或独立页** `/learn-stats`，容纳：热力图、周期柱状图、日历、连续天数、今日/本周时长
- 移除首屏可直接看到的统计明细（保留「今日已专注 N 分钟」一行摘要）

**验收**：学习 Tab 首屏一屏内看到主线；统计明细需 1 次点击进入。

---

## 🟠 Bug 7a · 今日饮食不支持自定义添加

**根因**：`apps/mobile/src/app/nutrition.tsx` 添加流程走 `if (!picked) return`（必须从常用食物里选），没有手输路径（**Web 端已有手输**，Mobile 缺失）。

**修复**：添加弹窗改两段式
- 顶部：**搜索/选择常用食物**（保留）
- 下半：**手动添加**——名称 / 数量 / 单位 / 热量 / 蛋白 / 碳水 / 脂肪，附「存入常用食物」开关（调用已有 `POST /api/nutrition/foods`）
- 选择食物时自动带出营养并支持改数量实时换算

**验收**：不选常用食物也能记一条（手输名称+热量）；「存入常用食物」后再打开能在列表里搜到。

---

## 🟠 Bug 7c · 习惯新建：内置图标选择 + 可选时间段

**根因**：`apps/mobile/src/app/habits.tsx` 的图标是一个 **TextInput**（默认 `✅`），且没有时间段字段；`habits` 表也无时间列。

**修复**：
- **图标选择器**：内置 ~24 个图标网格（💧🌙🧘📖👟✍️🥗🏃💪🧠☀️🎯…），点选高亮；保留"自定义 emoji"入口
- **时间段（可选）**：`开始 / 结束` 两个时间选择（可留空 = 不限定）；**不是必填**
- **迁移 043**：`habits` 增加 `remind_start text null`、`remind_end text null`（`HH:MM` 文本，先存+展示；本地通知见决策点 D5）
- 卡片上展示时间段标签（如 `07:00–08:00`）

**验收**：新建习惯能选图标、能选时间段且可留空；卡片显示时间段。

---

## 🔴 Bug 8 · 全局 UI「粗糙」→ 设计体系 v2（本轮最大工作量）

### 8.1 关键发现

```text
package.json 里有 expo-glass-effect@~57.0.1，但全项目使用次数 = 0
```

也就是说：**当前 APP 里没有任何"液态玻璃"，全是实色卡片 + 阴影**。这和"高级毛玻璃"的预期差距是根因之一。

### 8.2 三个层次的问题

| 层次 | 现状 | 目标 |
|---|---|---|
| **材质** | 只有 surfaceStrong 一种实底；无层级深度 | **三级材质**：`surface`（实底）/ `elevated`（轻阴影）/ `glass`（真玻璃，iOS 26） |
| **组件** | 卡片已 3 变体，但**列表行/表单/按钮/弹窗各行其是** | 抽出 `ListRow` / `Field` / `Button`(三级) / `Sheet` 统一件 |
| **密度** | 每屏信息量过大、无主次（你反馈"内容太多"） | 每屏首屏 ≤2 个重点块；次级进"更多"（见 §3） |

### 8.3 设计体系 v2 规格

**① 材质三级（`components/surface.tsx`）**

```text
surface   : 实底 colors.surfaceStrong + hairline 边   → 常规信息卡
elevated  : 实底 + shadows.card + 稍大圆角            → 需要浮起（列表容器/工具条）
glass     : iOS 26 GlassView(expo-glass-effect)      → Tab 栏 / Sheet / Hero 卡
            非 iOS 回落 elevated（保证一致观感）
```

**约束（来自四维评估模型 + iOS 26 经验）**：玻璃**只做层级，不承载语义**；文字对比度按最坏背景校验；`Reduce Transparency` 打开时必须可读。

**② 组件统一件**

| 组件 | 规格 |
|---|---|
| `ListRow` | 图标槽 36×36（`primarySoft` 底）/ 主文字 15·600 / 副文字 12·muted / 右侧值或 chevron；行高 ≥56；按压缩放 0.98 |
| `Field` | label 12·muted（上方 6pt）/ 输入框高 44 / 圆角 12 / 聚焦态品牌色描边 / 错误文案 12·danger |
| `Button` | `primary`（实心品牌，高 48，pill）/ `secondary`（`primarySoft` 底）/ `ghost`（纯文字）；禁用态 40% 透明 |
| `Sheet` | 见 Bug 3 规格 |
| `SectionHeader` | 标题 17·800 + 右侧"更多 ›"；分组间距 24 |
| `Stat` | 记分牌数字 28·800 + `tabular-nums` + 字距 -0.5；标签 11·600 muted（见 §1.5.3-C）|
| **`ProgressArc`** | 进度弧：直径 120/72，线宽 10 圆头，品牌色渐变，端点 glow（见 §1.5.3-B）|
| **`Timeline`** | 统一时间线：完成/进行中/未开始三态节点（求职 + 学习阶段 + 证书共用，见 §1.5.3-E）|
| **`GlassSurface`** | 软玻璃容器：iOS 走 `GlassView`，其它平台回落 `elevated`（见 §1.5.3-A）|

**③ TabBar（见 Bug 2）**：通栏扁平 + 激活短横线 + glass 背景（iOS）。

**④ 视觉节奏（统一后不再逐屏随手写）**

```text
屏内边距        16（紧凑）/ 20（Hero 页）
卡片间距        12
分组间距        24
卡片圆角        16（surface）/ 20（elevated）/ 24（hero、sheet 顶）
触控目标        ≥48
动效            150–300ms；切卡/换页只做淡化（见 Bug 4）
```

### 8.4 参考与依据（本次检索）

| 参考 | 采用点 |
|---|---|
| [Expo **GlassEffect** 官方文档](https://docs.expo.dev/versions/v56.0.0/sdk/glass-effect/) | `GlassView`/`isLiquidGlassAvailable()` 的正确用法与回落策略（本项目依赖已装未用） |
| [Apple **HIG — Sheets**（索引）](https://github.com/raintree-technology/hig-doctor/blob/main/skills/hig-components-dialogs/references/sheets.md) | 可调整高度需 grabber、支持下滑关闭、一次只present 一个 sheet、Done/Cancel 位置 |
| [expo-glass-ui-login-form（开源示例）](https://github.com/zkerkeb/expo-glass-ui-login-form) | 玻璃卡片的组件写法与层级处理 |
| [移动交互评估模型（skillpacks）](https://github.com/tachyon-beep/skillpacks/blob/main/plugins/lyra-ux-designer/skills/using-ux-designer/mobile-design-patterns.md) | 四维：拇指可达 / 手势约定 / 平台一致 / 性能感知；触控 44–48；反模式清单 |
| [React Native 性能最佳实践（Callstack）](https://github.com/ndesv21/openclaw-master-skills/blob/main/skills/react-native-best-practices/POWER.md) | 玻璃/模糊属"高开销"，**限制使用范围**并避免在长列表内使用 |
| **Orbix Studio**：[Studia（学习）](https://me.muz.li/orbix-studio/studia-ai-study-companion-app-ui-design-2) / [Pulse（健身营养）](https://me.muz.li/orbix-studio/pulse-ai-fitness-health-tracking-app-ui-design-2) / [CareNest（健康看板）](https://me.muz.li/orbix-studio/carenest-healthcare-dashboard-design) | **软玻璃配方、进度弧、记分牌数字、readiness 状态分、一处看全、时间线、AI 卡片**（详见 §1.5，含"不借鉴"清单） |
| 用户提供的参考图（小宇宙风格） | **底栏通栏扁平 + 激活项短下划线 + 实底深色**；这条优先于其它视觉偏好（含 Orbix 的玻璃底栏） |

> 说明：本轮**不引入新的 UI 组件库**（保持零新增依赖，`expo-glass-effect` 已在依赖内）。若后续需要更复杂的动画/图表，再单独评估。

---

# 1.5 Orbix Studio 风格借鉴（本轮新增）

> 检索来源：[Orbix Studio 作品集（Muzli）](https://me.muz.li/orbix-studio) · [Studia — AI 学习伴侣](https://me.muz.li/orbix-studio/studia-ai-study-companion-app-ui-design-2) · [Pulse — AI 健身营养](https://me.muz.li/orbix-studio/pulse-ai-fitness-health-tracking-app-ui-design-2) · [CareNest — 健康看板](https://me.muz.li/orbix-studio/carenest-healthcare-dashboard-design) · 官网 [orbix.studio](https://www.orbix.studio/)
> 工作室自述：*"Designing what people feel — not just see."*（设计人感受到的，而不只是看到的）

## 1.5.1 他们的设计主张（原文摘录 → 对我们的直接启示）

**Studia（学习伴侣）** —— 与我们「学习」域同构：

| 他们的原文 | 对我们的启示 |
|---|---|
| *"How do we make progress feel real?"*（怎么让进步**被感受到**） | 这正是我们「今日完成度」要解决的问题 |
| *"A progress arc on the home screen that curves toward the goal. **72% doesn't feel like a stat. It feels like momentum.**"* | **把进度条升级为「进度弧」**——弧线朝目标卷曲，数字产生"势能感"而不是"报表感" |
| *"Warm peach gradients. **Soft glassmorphism** cards. Orange accents that feel **encouraging, not urgent**."* | 暖桃渐变 + 柔玻璃卡 + 橙色**鼓励而非警示** —— 与我们 `canvas #FDF8EF` / `accent #F28C28` 几乎同源 |
| *"does this make the student feel like they're winning?"* | 每个组件评审问一句：这让学生感觉在"赢"吗 |

**Pulse（健身营养）** —— 与我们「健康」域同构：

| 他们的原文 | 对我们的启示 |
|---|---|
| *"Most health apps make you dig through three tabs… **This puts it all in one place**"* | 与我们的「健康 Hub / 一处看全」方向完全一致（且有 readiness / 训练 / 热量 / 饮水 / 营养成就同屏） |
| *"**Dark teal and black**, cinematic photography, **dot-matrix numbers** that feel more like a sports scoreboard"* | 深色用**深青**而非纯黑；统计数字用**点阵/记分牌**质感（我们已有 `teal #2FB3A6` 未被使用） |
| *"93% workout quality. 89% daily energy target achieved. Before you lift a single weight, the app already knows where you stand."* | 引入「**今日状态分 / readiness**」作为健康页 hero，而不是罗列数字 |

**CareNest（健康看板）**：*"…in a **soft teal glassmorphism** interface"*，含 wellness 进度图、平衡面板、生物标记、甜甜圈可视化、**care plan timeline**、AI 助手面板。

## 1.5.2 可借鉴 vs 不借鉴（重要：避免把我们做成另一个 App）

| # | Orbix 的手法 | 采纳？ | 在我们的落地方式 |
|---|---|---|---|
| 1 | **柔玻璃（soft glassmorphism）** | ✅ 采纳 | 用 `expo-glass-effect` 的 `GlassView`，但**只用于 Tab / Sheet / Hero 卡**；参数走"低饱和、宽模糊、极细边、顶部 1px 高光"，不做霓虹 |
| 2 | **进度弧（Progress Arc）** | ✅ 采纳 | 「今日完成度」由**横条 → 弧线**（弧长 = 完成度，端点带小圆点），数字加大字号 |
| 3 | **记分牌式数字** | ✅ 采纳 | `Stat` 组件：大数字 28–32·800 + `tabular-nums` + 字距收紧；深色下加极淡内阴影做出"点阵屏"感 |
| 4 | **状态分 / readiness** | ✅ 采纳 | 健康页 hero = **今日状态分**（训练/饮食/习惯/专注加权，复用已有 `/api/daily` 口径） |
| 5 | **一处看全（kill tab-digging）** | ✅ 采纳 | 强化「今日」与「健康」Hub 的同屏聚合；与 Bug 6 的"精简"配合（**聚合 ≠ 堆砌**，见 §3） |
| 6 | **时间线组件** | ✅ 采纳 | 求职时间线 + 学习阶段时间线统一为同一个 `Timeline` 组件 |
| 7 | **AI 卡片一等公民** | ✅ 采纳 | 已有 AI 每日建议 → 提升为首页/学习页的独立卡片样式（不再是附属文案） |
| 8 | **插画化空态 / 引导** | 🟡 渐进 | 本期先用"柔和渐变底 + 大图标"（零成本）；插画集（Milo 那类）留待有插画资源时再做 |
| 9 | **深青 + 黑 的深色主题** | 🟡 调整 | 采纳"深青感"但要**落在我们已有的 Night Voyage**（不整体换色）；仅把 `teal` 用作数据可视化第二色 |
| 10 | **电影感摄影/大图** | ❌ 不采纳 | 我们是工具型工作台，不需要情绪化大图；保留每日 Bing 风景作为背景层即可 |
| 11 | **社区/社交 feed 模块** | ❌ 不采纳（本期） | 超出范围；不在本轮引入 |

> **一句话纪律**：借它的**手艺与主张**，不借它的**皮**。主品牌色、明暗双色板、Liquid Glass + Bing 背景的 DNA 不变（与总方案 §7 一致）。

## 1.5.3 落地规格（可直接写进 token / 组件）

**A. 软玻璃配方（`glass` 材质）**

```ts
// components/surface.tsx —— iOS 用真玻璃，其它平台回落 elevated
glass: {
  blur: 24,            // 与 Web 端 glass token 对齐
  saturation: 1.8,     // 同上
  tint: "rgba(255,255,255,0.10)"（浅色）/ "rgba(20,24,28,0.28)"（深色）,
  border: "1px rgba(255,255,255,0.22)",
  topHighlight: "1px 顶部线性高光（linear-gradient 由 0.28 → 0）",
  radius: 20,
}
```
> 约束：玻璃内文字对比度按**最坏背景**（Bing 深色风景）校验；`Reduce Transparency` 开启时回落实底。

**B. 进度弧 `ProgressArc`（替代今日完成度的横条）**

| 属性 | 值 |
|---|---|
| 尺寸 | 直径 120（今日 hero）/ 72（子卡） |
| 轨道 | `colors.surfaceMuted`，线宽 10，圆头 |
| 进度 | 品牌色渐变（`primary → accentStrong`），线宽 10，圆头，从 -90° 起 |
| 中心 | 大数字 `28/800`（`tabular-nums`）+ 下方 11·muted 标签 |
| 动效 | 进入时 `strokeDashoffset` 420ms ease-out；**尊重 reduce-motion**（直接到位） |
| 微光 | 弧端点加 6pt 圆点 + 同色 glow（`shadowRadius 6`） |

**C. `Stat`（记分牌数字）**

```text
数字：28/800，letterSpacing -0.5，tabular-nums
浅色：colors.text；深色：colors.text + 极淡 inset 阴影（模拟点阵屏）
单位/标签：11/600 muted，紧跟数字右下 2pt
分组：一行最多 3 个 Stat，用 hairline 竖线分隔（参考 Pulse）
```

**D. 今日状态分（readiness）**

```text
口径（复用 /api/daily，不新增接口）：
  状态分 = 学习任务完成率×40 + 习惯完成率×30 + 今日有训练×15 + 饮食达标率×15
展示：健康页 hero = ProgressArc(状态分) + 一句话结论（如「今天状态不错，适合练力量」）
```

**E. `Timeline`（统一时间线）**

```text
节点：10pt 圆点（完成=品牌色实心 / 进行中=品牌色描边+脉冲 / 未开始=muted 空心）
连线：2pt `colors.border`；日期在左 11·muted，内容在右 15/600 + 12·muted
用于：求职投递时间线、学习阶段推进、证书有效期
```

## 1.5.4 关键冲突与解决（必须先对齐，否则会做成四不像）

| 冲突 | 说明 | 建议解决 |
|---|---|---|
| **Tab 栏：玻璃 vs 扁平** | Orbix 的底栏偏玻璃质感；而你给的参考图（小宇宙）是**通栏扁平 + 激活短横线** | **以你的参考图为准**（扁平实底 + 短横线）；玻璃只用在 **Sheet / Hero / 卡片**。理由：底栏上有文字，玻璃会削弱可读性，也与你给的参考图直接矛盾 |
| **深青 vs 暖橙** | Orbix 学习类偏暖橙、健康类偏深青；我们只有一个品牌主色 | 主色仍唯一（`primary` 蓝 + `accent` 橙用于鼓励态）；**`teal` 仅作数据可视化第二色**（图表/分类色），不作为主题色 |
| **"一处看全" vs "精简"** | 你要求"内容别太多"，Pulse 主张"全都放一处" | 二者不矛盾：**一屏一处看全，但每处只留核心指标**（≤3 个 Stat + ≤2 个重点块）；明细进"更多"（§3） |

---

# 2. 与 P2 的合并：统一执行计划

> 明天开始按 P0 → P1 → P2 → P3 推进；**每阶段结束都出一版 APK 上传服务器，你扫码回归**。

## 阶段 A｜紧急修复（先做，改动小、收益直接）
1. **Bug 1** 计时不开始（Mobile + Web 双端）
2. **Bug 7b** 返回兜底改 Hub 映射（`ScreenHeader.backTo`）
3. **Bug 5** 招花页删设置、加返回
4. **Bug 2** 底栏遮挡：`useTabBarSpace()` 统一 13 屏
5. **Bug 4** 焦点卡片改纯淡入淡出

**验收**：计时能走；滚到底不被挡；返回回到正确 Hub；招花页头部正确；切卡只有淡化。

## 阶段 B｜UI 体系 v2（视觉提升主体）
6. **Bug 3** Sheet 重写（键盘/滚动/安全区/头图/滑入）
7. **Bug 8** 材质三级 + 统一件：`ListRow`/`Field`/`Button`/`SectionHeader`/`Stat`/`GlassSurface`
8. **Bug 2** 底栏按参考图落地（通栏 + 激活短横线；**底栏不走玻璃**）
9. **Orbix 借鉴落地（§1.5）**：`ProgressArc` 替换今日完成度横条；`Stat` 记分牌数字；健康页 **今日状态分** hero；`Timeline` 统一时间线；AI 建议卡片化
10. 逐屏套用统一件（今日 / 学习 / 职业 / 健康 / 我的 + 子页）

**验收**：全站无"手写一次性样式"的卡片/行/表单；Tab 与参考图观感一致；软玻璃只出现在 Tab 之外的指定位置；深色模式对比度达标；进度弧与记分牌数字在浅/深两色板下都可读。

## 阶段 C｜功能补齐 + 信息精简
10. **Bug 6** 学习统计收成按钮 + `/learn-stats`
11. **Bug 7a** 饮食自定义添加 + 存常用
12. **Bug 7c** 习惯图标选择 + 可选时间段（**迁移 043**）
13. **Bug 7b/§3** 各屏"重点/更多"精简（今日、学习、职业、健康、我的）

**验收**：每屏首屏 ≤2 个重点块；三项功能按 §1 的验收口径通过。

## 阶段 D｜原 P2 工程化收尾
14. 启动图配色统一（`#208AEF` → 品牌画布）、**图标 iOS 变体**
15. **权限收敛**（移除 `SYSTEM_ALERT_WINDOW`、核对存储权限）、开启预测返回
16. **R8 + 资源裁剪**（包体目标 ≤70MB，当前 65.9MB）
17. OTA 启动静默检查 + 更新说明展示
18. 上架素材（截图/文案/权限说明）

**验收**：一条命令出包（`scripts/build-android-release.ps1`）→ 签名 MD5 校验通过 → 包体达标 → 上架材料齐备。

---

# 3. 信息精简规范（你的两条设计要求落地）

> **要求 1 重点突出**：每屏首屏 ≤2 个重点块，其余下沉。
> **要求 2 非重点收纳**：次级功能进「更多」Sheet 或折叠区。

| 页面 | 首屏重点（保留） | 收纳到「更多」/折叠 |
|---|---|---|
| **今日** | ① 今日完成度 ② 四域入口卡 ③ 今日任务（前 3 条） | 运动记录明细、AI 建议、打卡、引用语 → 「更多」Sheet |
| **学习** | ① 当前阶段 + 进度 ② 任务/日志/计量 快捷入口 | **统计/热力图/日历 → 「学习统计」按钮**（Bug 6） |
| **职业** | ① 招花市场 ② 就业雷达 ③ 我的求职 | 市场分析 / 简历 / 证书 / 面试 → 「更多职业工具」 |
| **健康** | ① 今日状态 ② 快速记录训练/饮食/习惯 | 领域计量、运动档案 → 「更多」 |
| **我的** | 账号与安全、主题外观、关于 | 领域管理、OTA、诊断 → 「进阶设置」折叠 |

**通用规则**：卡片内条目 >3 条即折叠（"展开全部"）；一个屏最多 3 种字号层级。

---

# 4. 风险与回滚

| 风险 | 缓解 | 回滚 |
|---|---|---|
| 计时修复引入新问题 | 先抽纯函数 + 单测，再改 UI 调用 | 单文件改动，可单独 revert |
| Tab 栏改造影响 13 屏留白 | 先落 `useTabBarSpace()`（纯常量），再改视觉 | 视觉改动独立提交 |
| 玻璃材质在低端机掉帧 | 玻璃仅用于 Tab/Sheet/Hero（不在长列表内）；真机测 FPS | 全局开关回落 `elevated` |
| Sheet 重写影响 7 个创建流程 | 保持 props 不变（`visible/onClose/title/height`），内部重写 | 保留旧实现于 git，可 revert |
| 迁移 043 加列 | 全部 nullable、纯增量 | 无需降级 |

---

# 5. 待你确认的决策点

| # | 决策 | 选项 | 我的建议 |
|---|---|---|---|
| **D1** | Tab 栏视觉 | A. 完全照参考图（通栏扁平+实底+激活短横线）B. 保留浮动胶囊只修留白 | **A**（你已明确要看齐参考图） |
| **D2** | 玻璃使用范围 | A. 全站三级材质都用玻璃 B. 仅 Tab/Sheet/Hero 用玻璃，其余实底 | **B**（性能 + 可读性，符合"玻璃不承载语义"） |
| **D3** | 焦点卡片交互 | A. 保留左右滑**触发**+纯淡化 B. 只保留点按切换 | **A**（手势保留、动画简化） |
| **D4** | 学习统计形态 | A. 全屏 Sheet B. 独立页 `/learn-stats` | **A**（不增导航层级） |
| **D5** | 习惯时间段 | A. 先只存字段+展示 B. 同时接本地通知（需 `expo-notifications` + 通知权限） | **A**（B 会引入权限弹窗与后台提醒，建议下一阶段） |
| **D6** | 训练动作库 | A. 内置约 20 条常用力量动作（扁平列表）B. 内置并按部位分组（胸/背/腿/肩/臂/核心） | **B**（选起来更快，符合"重点突出"） |
| **D7** | 是否同步修 Web 端计时 | A. 同步修（同一 bug）B. 只修 APP | **A**（Web 也存在同一闭包问题） |
| **D8** | Orbix 借鉴范围 | A. 采纳 §1.5.2 中的 7 项（软玻璃/进度弧/记分牌/状态分/一处看全/时间线/AI 卡）B. 只采纳软玻璃 + 进度弧 C. 全部含插画与深青主题 | **A**（7 项都是纯手艺提升，不换皮） |
| **D9** | 今日完成度形态 | A. 横条 → **进度弧**（Studia 手法）B. 保留横条只调样式 | **A**（"让进步被感受到"是本轮核心诉求） |
| **D10** | 底栏是否用玻璃 | A. 不用（按参考图扁平实底）B. 用软玻璃 | **A**（与你给的参考图一致；底栏有文字，玻璃削弱可读性） |

---

# 6. 一句话总结

```text
先修 4 个真 bug（计时 / 遮挡 / 返回 / 切卡动画），
再用「材质三级 + 9 个统一组件 + 参考图底栏」把 UI 从"能用"拉到"精致"，
同时借 Orbix 的手艺：进度弧让进步被"感受到"、记分牌数字、状态分 hero、一处看全、统一时间线，
最后按「重点突出、非重点收纳」逐屏精简，并把原 P2 工程化一并收口。
每阶段出包 → 扫码回归 → 再进下一阶段。

纪律：借手艺，不借皮 —— 主品牌色 / 明暗双色板 / Liquid Glass + Bing 背景 的 DNA 不变。
```
