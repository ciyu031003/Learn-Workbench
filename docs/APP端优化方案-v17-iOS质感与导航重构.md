# APP 端优化方案 v17 · iOS 质感与导航重构（"去土"专项）

> **触发**：用户反馈「移动端 UI 太土，没有 iOS App 那种流畅感与美观感」。
> **本文结构**：先诊断（全部带代码证据）→ 再开方（R1–R10 改造项）→ 分阶段执行清单 → 决策点 → 验收标准。
> **硬约束回顾**：CLAUDE.md 的 worklet 规则；踩坑 71/78/79（手势改动必须 release 包真机四路径验证）；踩坑「OPPO/ColorOS 全屏覆盖层导致触摸失效」（**任何改造不得引入全屏覆盖层**）。

---

## 0. 诊断结论：为什么"土"

先说公道话：工程底子明显高于平均水平——token 体系、语义化触觉（25+ 文件接入）、骨架/空态、reduced-motion 降级、SF Symbols 双轨图标（`themed-icon.tsx` 内置 90 条 Ionicons→SF 映射）、worklet 纪律都在。

"土"和"不流畅"不是细节没打磨，而是 **7 个系统性成因**，其中前 3 个是结构性的：

| # | 成因 | 一句话 | 证据 |
| --- | --- | --- | --- |
| 1 | **没有原生导航栈** | 全 App 页面切换 = 瞬时替换，没有 push/pop 转场、没有系统侧滑返回、没有大标题折叠 | `src/app/_layout.tsx:360-384` 所有子页都是 `<Tabs>` 的 `href:null` 兄弟路由；`screen-header.tsx:26-31` 返回靠 `router.replace` 模拟 |
| 2 | **假玻璃 + 实色状态栏** | Tab 栏是"半透明实底+描边+投影"伪造玻璃（无 blur）；状态栏是实色带，内容不能延伸到顶 | `_layout.tsx:89-105`（tabBarGlass，`canvas+"E0"`）、`:249-255`（StatusBar translucent=false + 兜底色带）；expo-blur 不在依赖里 |
| 3 | **暖陶土配色 + 全卡片描边** | 奶油黄画布 + 每张卡 1px 棕色描边 + 橙色投影 + 呼吸色斑背景，信息密度低但画面"热闹" | `theme/tokens.ts:11-51`（Sunny Clay 色板）、`card.tsx:47-49`（borderWidth:1 + borderStrong）、`daily-background.tsx`（4 团呼吸色斑常驻全局） |
| 4 | **屏幕级动效为零** | 组件层动效丰富，但页面间零转场、列表零入场、token 里定义的 stagger 从未使用 | 全 App 仅 `nutrition.tsx:1297` 一处 `entering=`；`lib/motion.ts:24` 的 `ANIM.stagger` 0 使用 |
| 5 | **排版失控** | 415 处硬编码 `fontSize`；首屏 hero 标题 4 种尺寸打架；Tab 标签 10pt 过小 | `today.tsx:846`(26) `learn.tsx:1215`(28) `interview.tsx:382`(28) `settings.tsx:532`(26)；typography 只有 4 个页面在用 |
| 6 | **观感语言不统一** | 三种头部并存、顶部留白 8 种取值、jobs 页整页绿色离群色与全局蓝主色打架 | ScreenHeader(17页)/自绘hero(7页)/自绘header(5页)；`insets.top +6~+24`；`jobs.tsx:53-59,740-741` |
| 7 | **"身体接触"覆盖不全** | 下拉刷新仅 8/23 页；Tab 切换无触觉；4 页无返回按钮是 v15 才补的 | `certificates/radar/jobs/nutrition/market/wellness/workout/habits` 有刷新，其余 15 页无 |

**流畅感**来自：原生转场 + 侧滑返回 + 真实模糊材质 + 边到边 + 触觉 + 统一节奏的动效。
**美观感**来自：克制的底色 + 无描边卡片 + 大标题 + 干净的字阶。
现在四样都缺。下面逐项开方。

---

## 1. 方案总览

| 编号 | 改造项 | 解决什么 | 风险 | 阶段 |
| --- | --- | --- | --- | --- |
| R1 | **导航栈重构**（Stack + Tabs 嵌套） | 转场动画、原生侧滑返回、预测性返回、大标题的前提 | 中（动 _layout 与文件归位，路由不变） | B |
| R2 | **ScreenHeader v2 · 大标题折叠栏** | iOS 最具辨识度的"大标题滚动折叠吸顶" | 低 | C |
| R3 | **真玻璃 TabBar + 切换触觉 + 图标动效** | 底栏从"伪造玻璃"升级为真实模糊材质 | 中（Android blur 性能，决策 D3） | C |
| R4 | **边到边状态栏** | 内容延伸到状态栏下，去掉实色带与 8 种顶距 | 中（v12 P0-5 历史坑，见 R4 风险） | C |
| R5 | **配色系统 v2（去土）** | 画布转中性、描边退场、阴影中性化，双路线可选（决策 D1） | 低（纯 token 改） | A |
| R6 | **卡片与表面重制** | 去描边、中性阴影、层级靠底色差与投影表达 | 低 | A |
| R7 | **字阶收敛 + lint 护栏** | 415 处硬编码字号 → typography；杜绝回归 | 低（机械替换） | A |
| R8 | **屏幕级动效** | 列表入场 stagger、增删 Layout 转场，与 Web 节奏对齐 | 低 | D |
| R9 | **刷新/触觉/离群色补全** | 15 页补下拉刷新、Tab 切换触觉、jobs 离群色归队 | 低 | A |
| R10 | **细节包** | Splash 渐隐、Tab 图标换 SF Symbols、双按钮系统合并、色斑背景降档 | 低 | D |

阶段划分：**A（速效，1–2 天）→ B（导航栈，3–5 天）→ C（质感，3–4 天）→ D（动效细节，2–3 天）**。A 阶段不动架构，先让"土"减一半；B 阶段是"流畅感"的本体；C/D 锦上添花。

---

## 2. R1 导航栈重构（最重要的一项）

### 2.1 现状

- `_layout.tsx:256` 根布局就是 `<Tabs>`，`today/learn/career/wellness/settings` 5 个真实 Tab + 25 个 `href:null` 子页平铺在同一层。
- 后果：`router.push("/tasks")` 实际是**切 Tab**——`react-native-screens` 的 TabNavigator 不做 push 动画，页面瞬时替换；没有返回手势（v15 还得给 `roadmap/logs/tasks` 补返回按钮）；`screen-header.tsx:30` 只能 `router.replace` 模拟"返回上一级"（因为 `router.back()` 会回到"上一个看过的 Tab"）。
- 为了弥补，自研了 26pt 边缘横滑切 Tab（`SwipeNavigator`，`_layout.tsx:120-169`）——这是把"返回手势"用在了"切 Tab"上，方向反了。

### 2.2 目标结构（路由全部不变）

expo-router 官方嵌套模式：根 `Stack` 包住 `(tabs)` 组 + 全部子页。

```
src/app/
  _layout.tsx            ← 改为 <Stack screenOptions={{ headerShown: false, animation: "default" }}>
  (tabs)/
    _layout.tsx          ← 现在的 <Tabs> 整体搬进来（5 个真实 Tab + index/dashboard 重定向）
    today.tsx  learn.tsx  career.tsx  wellness.tsx  settings.tsx
    index.tsx  dashboard.tsx
  tasks.tsx  roadmap.tsx  logs.tsx  jobs.tsx  market.tsx  radar.tsx
  applications.tsx  resume.tsx  resume-preview.tsx  certificates.tsx
  interview.tsx  phase/[id].tsx  account-security.tsx  domain-manager.tsx
  trackers.tsx  habits.tsx  workout.tsx  nutrition.tsx  sports-card.tsx
  diagnostics.tsx  +not-found.tsx
```

- 子页文件**原地不动**（仍在 `app/` 根），只是从 `<Tabs>` 的 `href:null` 注册改为根 `<Stack>` 的 `<Stack.Screen>` 注册——URL 完全不变，`back-target.ts` 的 PARENT_RULES、深链、`+not-found` 全部不受影响。
- 收益：
  - hub → 子页获得**原生 push/pop 转场**（iOS 滑入 + Android `default` 缩放淡入；可按页配 `animation: "slide_from_right"`）。
  - iOS 获得**全宽原生侧滑返回**；Android 已开 `predictiveBackGestureEnabled`（app.json:20），此刻才真正生效。
  - push 时子页自然盖住 TabBar——悬浮玻璃底栏在详情页自动消失，这正是 iOS 的层级气质（决策 D2，推荐就这样做，`useTabBarSpace` 在子页返回 0）。
  - `ScreenHeader` 的返回键从 `router.replace` 改回 `router.back()`（栈是真实存在的）， replace 仅保留为"无栈历史时的兜底"。

### 2.3 配套修改

1. **SwipeNavigator 退役或降级**：原生侧滑返回与 26pt 边缘切 Tab 抢同一条边。推荐：子页面（栈内）不挂 SwipeNavigator；若还想保留"根层级边缘横滑切 Tab"，用 `usePathname()` 判定当前在 5 个 hub 之一时才挂载两条窄条（`_layout.tsx:151` 已有 `if (!edgeSwipeEnabled) return null` 的挂载点）。彻底退役更干净。
2. **返回键统一**：`screen-header.tsx` 改为 `router.back()` 优先 + `canGoBack` 判断，失败兜底 `resolveBackTarget`。
3. **转场参数**：`Stack screenOptions={{ animation: "default" }}`；弹层型页面（`diagnostics` 等）可用 `fade_from_bottom`。
4. **回归红线**：这次改动全在导航层，`CLAUDE.md` 的 OPPO 触摸失效教训必须遵守——**不新增任何全屏覆盖层**；手势改动按踩坑 71/78/79 在 release 包真机验证「按下/拖动/松手/取消」四条路径 + Android 系统返回键 + 预测性返回动画。

---

## 3. R2 ScreenHeader v2 · 大标题折叠栏

iOS 观感的"第一眼"是大标题（Large Title）：页首 34pt 粗标题，往下滚折叠成 17pt 小标题吸顶在毛玻璃栏上。现在 `screen-header.tsx` 是一行静态标题，`today.tsx:458-475` 的 hero 视差是唯一近似，但"滚上去什么也不剩"。

### 3.1 设计

`ScreenHeader` 升级为受滚动驱动的**双态折叠栏**（跨平台自绘，保持 `headerShown:false` 的既有语言）：

```
┌─────────────────────────────┐   静止态：大标题（typography.display 30~34 / 800）+ 副标题
│  任务                    ⋯  │   ← 状态栏下随内容滚动
│  12 个待办 · 3 个逾期        │
├─────────────────────────────┤   滚过阈值（≈24pt）后折叠为：
│ ‹ 返回   任务            ⋯  │   ← 吸顶毛玻璃栏（blur/半透明 + hairline 底边）
└─────────────────────────────┘      小标题 17/600 交叉淡入，返回键同时出现
```

- 实现要点：`Animated.ScrollView` 的 `onScroll`（`useAnimatedScrollHandler`）驱动折叠进度 `p ∈ [0,1]`；大标题 `translateY/opacity` 与吸顶小标题 `opacity` 交叉插值；吸顶栏背景 `opacity` 随 p 渐显（毛玻璃见 R3 的 blur 复用）。全部走共享值 + worklet，遵守 CLAUDE.md 硬约束。
- hub 页（today/learn/wellness/career/settings） hero 保留自身性格，但 hero 标题字号统一到 `typography.display`（见 R7）。
- 顺带消灭"三种头部语言"：17 页 ScreenHeader + 7 页自绘 hero + 5 页自绘 header 全部归一到 v2（hero 型页面传 `large` 变体）。
- 顶部留白 8 种取值（`+6 ~ +24`）收归组件内部（组件自己吃 `insets.top`），23 页逐页删掉手写 padding。
- 可选加分（iOS 端）：若某天想要"真·原生大标题"，react-native-screens 支持 `headerLargeTitle`，但 Android 无对应物、且与自定义头部并存会双头——**不建议**，保持自绘一致性。

---

## 4. R3 真玻璃 TabBar + R4 边到边

### 4.1 TabBar（`_layout.tsx:89-105, 287-294`）

现状是 `canvas+"E0"` 半透明实底 + 描边 + 投影，注释自认"Android 没有系统级液态玻璃，用半透明底做出玻璃质感"。升级为三档：

| 平台 | 材质 | 实现 |
| --- | --- | --- |
| iOS 26+ | 真液态玻璃 | `expo-glass-effect` GlassView（`surface.tsx:93` 已有现成封装，直接复用到 tabBarBackground） |
| iOS <26 / Android 中高端 | 系统模糊 | 新增 `expo-blur`：`<BlurView intensity={40} tint={dark?"dark":"light"} experimentalBlurMethod="dimezisBlurView">`（Android 上 dimezis 法是真实时模糊） |
| 低端机降级 | 现有半透明实底 | 保留 `canvas+"E0"` 分支作为兜底（`isMotionActive` 同款降级开关） |

配套：
- **Tab 切换触觉**：`screenListeners={{ tabPress: () => haptics.soft() }}`（现在 `_layout.tsx` 里 haptics 为 0 命中）。
- **Tab 图标动效**：`TabIcon`（`_layout.tsx:36-54`）加选中弹跳 `withSpring(1.12 → 1)` + 选中色过渡；顺带把 `ios={undefined}` 改为传 SF Symbol 名（`themed-icon.tsx` 映射表已备好 `house.fill / book.fill / briefcase.fill / heart.fill / person.fill`）。
- **标签字号** 10 → 11（10pt 在真机上发虚，也是"土"的微观来源）；v1.27 的几何标定魔数注释（`_layout.tsx:62-66`）随字号一并重算，或改为 `flex` 布局自测量。

### 4.2 边到边状态栏（风险项，单独决策）

现状：`RNStatusBar translucent={false} backgroundColor={colors.canvas}`（`_layout.tsx:249-253`）+ 一条 `insets.top` 兜底色带（`:255`）——内容被状态栏"顶开"，是典型的 Android 4.4 时代气质。v12 P0-5 当年 opt-out 的原因是"系统深色 + App 浅色时顶部一条黑带"（根因是 Android 主题 DayNight 资源跟随系统而非 App 主题）。

改造：
1. 删除 `backgroundColor`/`translucent` 与兜底色带，开启边到边（SDK 57 默认方向），内容自然延伸到状态栏下。
2. 状态栏图标颜色仍由 `barStyle={dark ? "light-content" : "dark-content"}` 运行时控制——这已能覆盖 v12 P0-5 的场景（App 主题与系统解耦），Android 主题里残留的 `@color/app_bar_color` 不再参与。
3. 顶栏背景交给 R2 的折叠毛玻璃栏 + `ScreenHeader`（滚动时内容从状态栏下穿过、吸顶栏模糊——边到边 + 毛玻璃是互为前提的一对）。
4. **风险与真机验证**：ColorOS/OPPO 对边到边的实现在 ROM 间差异大（键盘、弹层、专注页横屏时钟）。按阶段放开：先全局开 → `bottom-sheet`/`celebration-modal`/`focus-timer` 逐个真机过；不行就保留专注页例外（沉浸暗色全屏自管状态栏）。23 页的 `paddingTop: insets.top + N` 在 R2 里统一消掉，本项不单独逐页改。

---

## 5. R5 配色系统 v2（"去土"的主战场）+ R6 表面重制

### 5.1 "土"的配色成分分析

`theme/tokens.ts` 现状四个问题：
1. **画布太黄**：`canvas #FDF8EF`、`surface #FFFBEA`——奶油黄大面积铺开，屏幕像泛黄的照片。
2. **描边存在感过强**：`border rgba(120,90,45,0.16)` 是棕色，且 `card.tsx:47-49` 每张卡 1px 全描边——描边是"表单感/廉价感"的最大来源（iOS 的卡片几乎不描边，层级靠底色差 + 投影）。
3. **投影带颜色**：`shadows.card` 用 `#B8823F`（棕橙）、`floating` 用 `#E1781C`（橙）——iOS 投影是中性色（近黑、低透明度、大模糊半径）。
4. **强调色过多**：sun/coral/teal/lavender/peach 五彩 + jobs 页又自成一套绿/青/靛/橙/玫（`jobs.tsx:53-59`），全局像调色盘。

### 5.2 两条路线（决策 D1，二选一）

**路线 A · 中性底 + 品牌点缀（推荐）**：底色体系整体转 iOS 语义中性，"苦旅"的暖橙/品牌蓝收缩到少数焦点（进度环、庆祝、主按钮、选中态）。改动集中在 `tokens.ts` 一个文件：

```
浅色：canvas      #FDF8EF → #F6F6F7（近中性，留一丝暖）
      surface     #FFFBEA → #FFFFFF
      surfaceStrong #FFFFFF 不变
      border      棕色 rgba(120,90,45,·) → rgba(60,60,67,0.10)（iOS separator）
      text        #3A342C → #1C1C1E / textMuted → #8E8E93（iOS 系统灰阶）
      primary     #2F74C0 保留（品牌蓝），primaryStrong 用于 tab 选中
      accent      #F28C28 保留，只用于庆祝/成就/进度高光
      shadows     #B8823F/#E1781C → 中性 #1C2430，opacity 0.12/0.24 → 0.06/0.10，
                  radius 18/24 → 22/28（更柔更大）
深色：canvas       #171209 → #000000 或 #111113（iOS 纯黑分组底）
      surface      #221B10 → #1C1C1E；surfaceStrong → #2C2C2E（iOS 三层语义）
      其余同浅色逻辑，暖橙 accent 保留提亮
```

**路线 B · 保留暖色身份，只去"土"的成分**：canvas 降饱和 `#FDF8EF → #FAF8F5`（暖灰白）、描边改为中性 hairline、阴影中性化、五彩色收进图表色板。品牌感 100% 保留，"土"感减掉约 6 成。

无论哪条路线，都要做：
- **呼吸色斑降档**（`daily-background.tsx`）：浅色下色斑透明度再压（0.85-0.95 → ≤0.5）或只在 5 个 hub 保留、子页面纯色——背景安静了，内容才高级。
- **jobs 离群色归队**（`jobs.tsx:53-59,624,740-741`）：平台色降为"图表语义色"仅用于小色点；RefreshControl `tintColor="#10b981"` 改 `colors.primary`。
- `learn.tsx:42-54` 阶段渐变色对挪进 tokens 的 `chart` 系列，数据驱动色统一出口。

### 5.3 R6 卡片与表面重制（`card.tsx` / `surface.tsx` / `list-row.tsx`）

```
现状：1px 棕描边 + 橙影 + 奶油底        目标：无描边 + 中性柔影 + 底色差分层
┌──────────────────────┐          ┌──────────────────────┐
│ ▢ 边框包着内容        │    →     │  内容直接坐在白卡上    │
└──────────────────────┘          └──────────────────────┘
                                   阴影: 0 8 22 rgba(24,39,58,0.06)
                                   hover/按压: PressableScale 已有
```

- `card.tsx:46-49` 默认 `borderWidth:1` 删除，需要边界的极少数场景（头像框、二维码框）显式传。
- `surface.tsx` 的 `elevated` 阴影换 R5 中性影；`highlight` 顶部 1px 高光（`:148-155`）保留——这是模拟玻璃受光的好细节。
- `list-row.tsx` 的 inset grouped 列表已经是 iOS 形态，补两个细节：分隔线左端从文字起点开始（现在可能通栏）；行按压时整组卡片轻微变色（现在是单行缩放 0.98）。
- 深浅两套 + ColorOS 真机过一遍对比度（尤其路线 A 的 textMuted 换色后）。

---

## 6. R7 字阶收敛

`typography`（`tokens.ts:155-164`）本身是好的，问题是**没人用**（415 处硬编码）。三步：

1. **token 对齐 iOS 语义**（微调）：
   ```
   display 30/800 → 32/800（大标题）
   title1  24/800 → 28/700（iOS Title1）
   title2  19/700 → 22/700（iOS Title2）
   headline 16/700 → 17/600（iOS Headline，中文 600 比 700 秀气）
   body    15/400 → 16/400（中文正文 16pt 是可读性拐点）
   callout 14/500 → 15/500；caption 12；micro 11 → 12（现状 10pt Tab 标签 → 11）
   ```
2. **机械收敛**：23 页硬编码 `fontSize` 按"就近档"替换为 `...typography.x`；hero 标题 4 种尺寸（26/26/28/28）统一 `display`；`12.5` 这类分数字号取整进 caption。
3. **防回归护栏**：eslint `no-restricted-syntax` 禁止 `app/**` 里裸写 `fontSize:`（豁免 tokens.ts 与 typography 展开），CI 即红。

---

## 7. R8 屏幕级动效 + R9 补全 + R10 细节包

### R8 动效（节奏对齐 Web v1.28 的经验）
- **列表入场**：`lib/motion.ts` 里已定义 `ANIM.stagger`（从未使用）。hub 页卡片组入场：`Animated.View entering={FadeInDown.duration(motion.base).delay(i * 40)}`——只在首帧入场做，滚动复现不做（防烦）。
- **列表增删**：把 `nutrition.tsx:1297` 的 `layout={LinearTransition}` 推广到 tasks/habits 的勾选与删除（打卡完成的行收缩 + 勾选回弹，配 `haptics.success`）。
- **数量级纪律**：每屏常驻动画 ≤1（色斑/太阳呼吸只留一个），入场 stagger ≤12 项——保持现有 `MOTION_ENABLED`/reduced-motion 降级语义不变。

### R9 补全
- 下拉刷新补到 15 个缺页（数据页全配，`tintColor`/`progressBackgroundColor` 走主题色）；封装 `usePullRefresh(onRefresh)` 统一 RefreshControl props。
- 触觉补点：Tab 切换（R3）、下拉刷新触发阈值、大标题折叠完成、Stack push/pop 不加（系统已有）。
- 双按钮系统合并：`button.tsx` 与 `press-button.tsx` 并存（`button.tsx:52-77` vs `press-button.tsx:95-120`）——以 PressButton 的按压/加载语义为准做一个 `variant` 清单，逐步替换调用点后删旧件。

### R10 细节包
- Splash 渐隐：`expo-splash-screen` `preventAutoHideAsync` + 首帧 fade out 250ms（现状是硬切）。
- 色斑背景（R5 已含降档）。
- `career.tsx:228` 等 token 外圆角（14）归队到 `radius`。
- 空态/骨架已达标，不动。

---

## 8. 分阶段执行清单

> 节奏沿用项目惯例：每阶段一个提交批次 + 真机复测 + 看板回填。

### 阶段 A · 速效去土（1–2 天，不动架构）
- [ ] A1 R5 配色 v2（决策 D1 拍板后改 `tokens.ts` + splash/adaptiveIcon 底色同步）
- [ ] A2 R6 卡片去描边 + 中性阴影（card/surface/list-row）
- [ ] A3 R7 字阶：token 微调 + 23 页机械替换 + eslint 护栏
- [ ] A4 R9：jobs 离群色归队 + 全局 RefreshControl 主题色
- [ ] A5 色斑背景降档
- **验证**：`pnpm -F mobile typecheck` / `test` 全绿；真机浅/深两套过 5 个 hub + 3 个代表子页。

### 阶段 B · 导航栈（3–5 天，"流畅感"本体）
- [ ] B1 R1：`(tabs)` 组归位 + 根 Stack + 子页注册迁移（路由不变）
- [ ] B2 返回键 `router.back()` 化 + `resolveBackTarget` 降级保留
- [ ] B3 SwipeNavigator 降级为"仅 hub 层"或退役
- [ ] B4 各页 `animation` 微调（弹层型 fade_from_bottom）
- **验证（release 包真机，踩坑 71/78/79 流程）**：按下/拖动/松手/取消四路径；iOS 侧滑返回；Android 系统返回键 + 预测性返回动画；deep link 与 `+not-found`；OPPO 真机全屏触摸抽查（无新覆盖层）。

### 阶段 C · 材质与头部（3–4 天）
- [ ] C1 R2：ScreenHeader v2 折叠栏 + 三种头部归一 + 8 种顶距消灭
- [ ] C2 R3：TabBar 三档材质（GlassView / expo-blur / 实底）+ tabPress 触觉 + 图标弹跳 + SF Symbols
- [ ] C3 R4：边到边（先全局，ColorOS 真机逐场景：键盘/弹层/专注横屏）
- **验证**：滚动折叠流畅（DevTools FPS）；blur 在 ColorOS 中端机的滚动帧率（决策 D3 兜底预案：实底透明度提高）；状态栏黑带回归测试（v12 P0-5 场景：系统深色 + App 浅色）。

### 阶段 D · 动效与细节（2–3 天）
- [ ] D1 R8：入场 stagger + Layout 转场推广
- [ ] D2 R9：15 页下拉刷新 + `usePullRefresh` + 触觉补点
- [ ] D3 R10：splash 渐隐 + 按钮合并 + 圆角归队
- **验证**：`pnpm -r test` 全绿 → 按 v15 的发布流程出包（APK + OTA 清单 + landing 更新）。

---

## 9. 决策点（开工前拍板）

| # | 问题 | 选项 | 建议 |
| --- | --- | --- | --- |
| D1 | 配色路线 | **A** 中性底+品牌点缀（推荐，iOS 味最正）/ **B** 保留暖色只去土（品牌延续最强） | A，暖橙 accent 保留在庆祝/成就场景，身份不丢 |
| D2 | 详情页 TabBar | **push 后自动隐藏（推荐）** / 保持常驻 | 隐藏。iOS 层级气质 + 省掉子页 `useTabBarSpace` |
| D3 | Android 真模糊 | **expo-blur dimezis（推荐，先测）** / 直接实底+高透明 | 先测 ColorOS 中端机帧率，不达标自动降档 |
| D4 | SwipeNavigator | **退役（推荐）** / 降级为仅 hub 层 | 退役，让位原生返回手势；横滑切 Tab 本就与 iOS 心智冲突 |

---

## 10. 验收标准（对照"土/不流畅"的 7 个成因）

1. hub→子页有原生转场动画；iOS 全宽侧滑返回、Android 预测性返回可用。
2. 详情页返回键回的是真实栈顶（`router.back()`），不再出现"返回却回到今日首页"。
3. TabBar 在真机上呈现真实模糊（或明确降档），切换有触觉与图标动效。
4. 状态栏区域内容可穿透，无实色带；23 页顶部留白由组件统一管理。
5. `app/**` 裸写 `fontSize` 计数为 0（lint 强制）；hero 标题全 App 一档。
6. 浅色模式无大面积奶油黄、无棕色描边、投影全部中性。
7. 数据页 100% 有下拉刷新；刷新/Tab 切换/打卡完成有触觉反馈。
8. 全程遵守：worklet 约束、无全屏覆盖层、release 真机四路径手势验证、`pnpm -F mobile test` 全绿。

---

## 附：本方案引用的关键证据文件

- `apps/mobile/src/app/_layout.tsx`（Tabs 平铺 / 假玻璃 / 实色状态栏 / SwipeNavigator）
- `apps/mobile/src/components/screen-header.tsx:25-31`（router.replace 模拟返回）
- `apps/mobile/src/theme/tokens.ts`（Sunny Clay 色板 / 棕描边 / 橙投影 / typography）
- `apps/mobile/src/components/card.tsx:43-73`、`surface.tsx`、`list-row.tsx:89-128`
- `apps/mobile/src/components/daily-background.tsx`（呼吸色斑）
- `apps/mobile/src/components/themed-icon.tsx`（SF Symbols 映射，现状最佳实践）
- `apps/mobile/src/app/jobs.tsx:53-59,624,740-741`（离群色）
- `apps/mobile/src/app/nutrition.tsx:1297`（全 App 唯一 entering）
- 历史：`docs/APP端优化方案-v12-下一阶段.md`（P0-5 状态栏）、`docs/APP端国产ROM触摸失效适配方案.md`、看板踩坑 71/78/79/80
