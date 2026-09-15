# APP 端 饮食 / 健康模块 · UI 与交互优化方案 v3

> **来源**：2026-09-15 用户提出「参考『吃一点』iOS App 的审美与组件构造，也可以找类似的开源饮食记录 App，把它的动态效果与页面交互拿过来用」，并给出细分模块方案。
> **状态**：**方案待确认，未改代码**
> **基础**：v1.3.1（versionCode 10）已发布内测；本方案是 APP v2（阶段 A–D）之后的第三轮
> **配套**：`docs/APP端优化方案-v2-问题修复与UI精修.md`（v2）、`docs/APP端设计与打包方案.md`（总方案）、`docs/改动记录与任务看板.md`（踩坑点 1–53）
> **一句话纪律**：**借手艺，不借皮** —— 品牌色 / 明暗双色板 / Liquid Glass + Bing 背景的 DNA 不变；饮食模块只新增「能量橙 / 达标绿 / 饮水青」三个**语义色**。

---

# 0. 结论摘要

```text
「吃一点」值得学的不是它的贴纸和 Live 图（要相机 + 付费 AI，我们没有也不打算加），
而是它的三条做法：
  ① 首页用「今日剩余额度」当唯一主角（不是四个并列的营养条）
  ② 记录路径极短：常吃/最近的食物一点即记，份量用滑杆拖，数字实时跟着变
  ③ 页面分层用「日期 pill 条 + 餐次时间线 + 角落小卡（体重/喝水）」，而不是一堆同规格卡片

结合开源侧验证过的动效参数（Reanimated + SVG，零新增依赖）与我们的既有组件
（ProgressArc / Timeline / Surface / Stat / BottomSheet v2），
本轮可以做到：不引入任何新依赖、不加相机/AI、包体不变，把饮食模块从「能用」拉到「想每天打开」。
```

**已确认存量的三件事**（决定本方案成本很低）：

| 事实 | 含义 |
|---|---|
| 后端**已有** `hydration_logs` / `hydration_goals` 表与 `GET/POST /api/wellbeing/hydration` | 「喝水打卡」**不需要新迁移**，只缺 Mobile UI + 一个 DELETE |
| `meal_entries` 已有 `created_at`，但 `GET /api/nutrition` 没返回 | 「时间线显示 18:17」只需给 SELECT 加一列 |
| `GET /api/nutrition` 已支持 `?date=` | 「日期条切换历史」前端即可做，只差「多日汇总」一次请求 |

---

# 1. 研究结论

## 1.1 「吃一点」实测（我逐张看了它 App Store 的 10 张截图）

> 元数据来自 iTunes Lookup API（[App Store 详情](https://apps.apple.com/cn/app/id6761377025)、[lookup JSON](https://itunes.apple.com/lookup?id=6761377025&country=cn)）；评论证据来自[官方评论 RSS](https://itunes.apple.com/cn/rss/customerreviews/page=1/id6761377025/sortby=mostrecent/json)。
> 定位：反焦虑的饮食记录 + 美食 Plog；bundleId `kite.calLog`；2026-05 上架，评分 4.63（213 评）；主打 Live 图记录、AI 热量识别、食物贴纸、涂鸦、体重/喝水打卡。

### ① 首页（日记页）——**最重要的一张**

从上到下：

| 层 | 做法 | 对我们的启示 |
|---|---|---|
| 标题行 | 左「今天」+ 右一个人像圆角小方块 | 极简，不做大标题 |
| **日期条** | 7 个竖 pill（周一…周日 + 日期数字），已完成的日子上方一个小 ✓，**「今天」用橙色描边圈住**（不是填充） | 高亮用**描边**而非填充，克制、不抢戏 |
| **热量主角** | 左侧超大**斜体绿色** `371` + 小字 `kcal`；右侧灰色 `1550 kcal ›` 可点 | ① 数字是主角，不是进度条；② 目标值点在右侧、可点开编辑；③ **斜体数字**产生"势能感" |
| 活动水平 | 一张圆角卡里嵌**分段选择器**（久坐/轻活动/中等活动/高活动），选中项是绿色胶囊浮在灰轨上 | 分段控件兼作"我的活动量"可视化；给动态热量目标用 |
| 角落小卡 | 体重卡：`48.20 kg` 斜体大字 + `BMI: 18.1 ›` + **橙色迷你趋势线** + 右侧绿色圆形 `+` | 「一个指标 + 一条趋势 + 一个快捷加号」= 最小自洽单元 |
| **餐次时间线** | 左侧小圆点竖线；每条：绿色小字时间（今天 18:17）→ 黑色粗体菜名 → 灰色描述；**右侧一张圆形食物照 + 橙色 `62 kcal` 贴纸标签** | 时间线 + kcal 徽标；我们没有照片 → 用 **emoji 贴纸**替代（见 M4） |

### ② AI 热量识别流（我们没有 AI，但交互值得抄）

- 食物被抠成**带白色描边的贴纸**浮在点阵网格画布上，旁边一个**超大橙色斜体 `400 kcal`**（轻微旋转 + 贴纸投影）
- 下方 sheet：菜名 + 「纠正」胶囊 + 子项 chip
- 底部结果卡：**「食用比例 61%」+ 一个大白圆钮的滑杆** + 绿色圆形 ✓ + **`305 /186 kcal`**（已吃超大黑、目标是小的橙色）

**可迁移的两点（不需要 AI）**：
1. **份量滑杆 + 大圆钮 + 百分比 + 实时换算数字** → 我们的「份量/克重」输入就用这个（用户在评论里骂得最狠的就是"算不出克重"，这正好是解法）
2. **`已吃 / 目标` 的斜杠排版**（大 + 小 + 语义色）→ 我们的热量 hero

### ③ 贴纸 / 涂鸦 / Plog（**不采纳**，仅记录）

贴纸相册、虚线选中框、邮票相框、手写文字、底部背景缩略图条、深色沉浸画布、大圆钮笔刷滑杆。这些依赖相机、抠图、Live Photo 与付费 AI，且与「工具型工作台」定位不符 → **明确不做**（见决策点 D5）。

### ④ 用户评价里最有价值的三条（决定我们要避免什么）

| 评价 | 我们要做的事 |
|---|---|
| 「AI 算不出克重，热量偏差大」（差评主因） | 第一版就把「**先给一个合理默认值，再让用户拖滑杆/改克重**」做成主路径 |
| 多次「一直显示网络异常」（1 星） | 记录要**离线可用 + 失败重试**（本地先落库、失败进队列，与现有 sync 引擎同思路） |
| 「主页日期橘色标识总是自动跳回今天，有点误导」「主页食物记录没有按天分组」 | 日期选中态要**明确**（描边+文字变化），列表**严格按餐次分组**，不做跨天混排 |

### ⑤ 色彩与质感（我的读图结论，非官方）

暖白画布（约 `#F7F5F0`）+ **鼠尾草绿**（品牌主色）+ **橙色**（热量/能量专色）+ 纯黑粗体重字 + 白色大圆角卡（24–28）+ 大量留白。与我们现有 token 的关系：我们的暖白画布 `#FDF8EF` 与 `accent #F28C28` 已经同源，**只缺一个"达标绿"和一个"饮水青"的明确语义**（`success` / `teal` 已存在，只是没在饮食模块用起来）。

## 1.2 对标 App 的可抄清单（简表）

| App | 抄什么 |
|---|---|
| [Foodnoms](https://apps.apple.com/us/app/nutrition-tracker-foodnoms/id1479461686) | 记录后仍可改名/调数值再落库；按餐次的 **Smart Suggestions**（"这个餐次你常吃什么"）；一个搜索框内搜索/语音/拍照切换 |
| [小卡健康](https://apps.apple.com/cn/app/id6720721188) | 「≈ 等于几只苹果」的换算文案；一句话语音记录；杯量/份量快捷预设 |
| [MacroFactor](https://www.amyfoodjournal.com/blog/macrofactor-review) | **目标用区间**（170–195g）而非单值；体重曲线**加均线去噪**；反例警示：图表不能堆到看不懂 |
| [Yazio](https://feedback-en.yazio.com/suggestions/680246/) | 摘要卡用「剩余/缺口」布局；streak 必须有**可关闭开关** |
| [薄荷健康](https://cloud.tencent.cn/developer/article/1973492) | 不用轮播、**全卡片化**首页；灰底 + 白卡分区；右下角 FAB 形成肌肉记忆 |
| [Cal AI](https://feastgood.com/cal-ai-review/) | 「打开→记录→出结果」路径极短（**不抄**它的沉没成本式 onboarding） |

## 1.3 开源侧：可直接借用的动效参数（**已读源码验证**）

> 来源：[denizyesilirmak/nutrition-mobile](https://github.com/denizyesilirmak/nutrition-mobile)（RN/Expo，Reanimated + SVG + Lottie；**无 LICENSE → 只重实现模式，不复制代码**）。

| 手法 | 参数（源码实测） | 我们怎么用 |
|---|---|---|
| **会"跳动"的热量环** | `strokeDashoffset: withSpring(2πr(1-p), {damping:10, stiffness:100})` + 值变化时 `strokeWidth: withSequence(6→12→6 @ 100/300/500ms)` | 扩我们的 `ProgressArc`：加 `beatOnChange` 行为（M1） |
| **数字滚动** | `Animated.createAnimatedComponent(TextInput)` + `useAnimatedProps` 返回 `text`，`withTiming(v, {duration:500})` | 热量/饮水/体重大数字（M1/M7/M8/M10） |
| **拖拽填充 + 回弹** | PanResponder 比例 → `animatedProps.progress`；松手 `withSequence(withSpring(1.2,{damping:10,stiffness:100}), withSpring(1,{damping:3,stiffness:200}))` | 饮水杯液面、份量滑杆（M4/M7） |
| **吸附式日期条** | `Animated.FlatList` + `snapToInterval` + `useAnimatedScrollHandler` → `withDelay(50, withTiming(scale,{duration:180, easing: Easing.inOut(Easing.ease)}))` | 简化为 `ScrollView snapToInterval` + pill 缩放（M2） |
| 搜索/分量的骨架与选中态 | 500ms debounce + FlashList 骨架行 + `FadeInRight` 缩略图 | 直接对齐我们已有的 Skeleton + `FadeIn`（M4） |

**明确不引入的依赖**（会在方案验收时检查）：

| 候选 | 为什么不引入 |
|---|---|
| `@shopify/react-native-skia` + [`@mreyesh85/apple-rings`](https://www.npmjs.com/package/@mreyesh85/apple-rings) | 重原生依赖、增包体（我们才刚把权限/包体收干净）；我们的 `ProgressArc` 用 SVG 已经能做到 |
| [`@gorhom/bottom-sheet`](https://github.com/gorhom/react-native-bottom-sheet)（MIT，9k★） | 我们已自研 Sheet v2（键盘避让/滚动/安全区都对齐 HIG），再引一套会出现两套弹层体系 |
| [`react-native-ruler-picker`](https://github.com/rnheroes/react-native-ruler-picker)（MIT） | 2024 起停更；滑杆我们自写 40 行更可控 |
| `react-native-confetti-cannon`（MIT） | 我们已有 `Celebration` 组件 |

**许可证纪律**：`nutrition-mobile`、`SunshineList/health_record`、`tqbf/mfg` **均无 LICENSE → 仅借鉴模式，禁止贴代码**；[fud-ai](https://github.com/apoorvdarshan/fud-ai)（MIT）/ [NutriFoto](https://github.com/Portuno/NutriFoto)（MIT）可安全借鉴（前者是 Kotlin/SwiftUI，只作 UX 参照）；`MacroFlow` 是 GPL-3.0 → **禁用**。「吃一点」是闭源商业 App → 只借交互与手艺，不复制任何资源/图标/字体。

---

# 2. 现状盘点（我们有什么）

| 面 | 现状 |
|---|---|
| 页面 | `apps/mobile/src/app/nutrition.tsx`（ScreenHeader + 「添加饮食」按钮 + **4 条横向 macro bar** + 按餐次分组的文本行 + 两段式 Sheet）；`wellness.tsx`（readiness 弧 + 4 入口 + 快速记录）；`today.tsx` + `daily-os-summary.tsx`（完成度弧 + 4 个 StatLine，其中一行是饮食 kcal） |
| 组件 | `Surface/GlassSurface`、`ProgressArc`（270°、渐变、端点微光、420ms、reduce-motion）、`Stat/StatRow/StatLine/ProgressBar`、`Timeline`、`ListRow/ListGroup`、`Field`、`Button/IconButton`、`SectionHeader/BlockTitle`、`BottomSheet`（v2：键盘避让 + 内部滚动 + 安全区 + 下滑关闭）、`EmptyState`、`Skeleton`、`PressableScale`、`Celebration`、`charts(BarChart/LineChart/RingProgress)`、`haptics` |
| Token | 明暗双色板、`radius(10/16/20/24/pill)`、`shadows(card/floating)`、`motion(micro160/standard260/pressScale0.96/stagger40)`、`spacing`、`typography(display…micro)`、`tabularNums` |
| 接口 | `GET/POST/DELETE /api/nutrition`、`GET/POST /api/nutrition/foods`、`GET/POST /api/wellbeing/hydration`、`GET/PUT /api/wellbeing/profile`（体重单值）、`GET /api/daily` |
| 表 | `foods`（全局种子 + 用户私有）、`meal_entries`（meal/amount/unit/kcal/macros/`created_at`）、`hydration_logs`、`hydration_goals`、`user_settings`（只有 `weight_kg`） |
| 迁移 | 最新 **043**（habits 时间段）→ 本方案新迁移从 **044** 起 |

**差距一句话**：我们缺的是「**主角（剩余热量）+ 时间维度（日期/时间线）+ 极短记录路径（常吃一点即记 / 拖着调份量）+ 两个角落小卡（喝水/体重）**」，不缺口号也不缺组件。

---

# 3. 细分模块方案

> 每个模块统一给：**现状 → 目标 → 组件规格 → 动效规格（含参数）→ 数据/接口影响 → 验收**。
> 优先级：`P1`＝纯前端视觉（一轮包就能看到） `P2`＝交互 `P3`＝数据补齐 `P4`＝可选。

## M0 · 视觉基调与语义色（P1）

| 项 | 规格 |
|---|---|
| 语义色 | **能量橙** = `colors.accent`（热量、已吃、超出前的警示）；**达标绿** = `colors.success`；**饮水青** = `colors.teal`；超出 = `colors.danger`。**不改品牌主色**（`primary` 蓝仍是导航/链接色） |
| 数字字体 | 新增 `typography.metric`：`fontSize 34 / lineHeight 40 / fontWeight "800" / fontStyle "italic" / letterSpacing -1` + `tabularNums`。**只用于 hero 数字**（剩余 kcal、体重、饮水 ml） |
| 圆角 | 饮食模块默认：卡 24（`radius.xl`）、贴纸 20、chip `pill` |
| 层级 | 保持「暖白画布 + 白卡 + hairline」；hero 用 `GlassSurface`（iOS 真玻璃，Android 回落 elevated） |
| 排版层级 | 一屏最多 3 种字号（借 v2 §3 的纪律），饮食页即：hero 34 / 标题 17 / 正文 15 / 说明 12 |

## M1 · 热量 Hero：从「四个条」改成「剩余额度」（P1）

**现状**：`ScreenHeader subtitle = "1840 / 2000 kcal"` + 4 条细 bar 平铺。

**目标**：一张 hero 卡承担「今天还能吃多少」这一个问题。

```text
┌─────────────────────────────────────────────┐
│   ╭───────╮      还剩                        │   ← 环：ProgressArc 132/12
│   │ 620   │      620 kcal                    │   ← 数字：typography.metric（斜体橙）
│   │ kcal  │      约等于 2 碗米饭 / 1 杯奶茶    │   ← 换算文案（借小卡健康）
│   ╰───────╯      已吃 1380 · 目标 2000 ›      │   ← 目标可点，进 M6
└─────────────────────────────────────────────┘
```

| 组件 | 规格 |
|---|---|
| `ProgressArc` 扩展 | 新增 props：`mode: "remaining" \| "progress"`、`overBudget?: boolean`、`beatOnChange?: boolean`、`size 132 / strokeWidth 12`。剩余模式：弧长 = 剩余/目标，**顺时针递减**（吃掉一段，弧就少一段——比"填充"更有"消耗"的手感） |
| 中心数字 | `typography.metric` + `tabularNums`；标签 `caption·muted`「还剩」 |
| 换算文案 | 纯函数 `kcalEquivalents(remaining)`（shared，+单测）：每 100 kcal ≈ 半碗米饭 / 1 个苹果 / 1 瓶可乐的粗略对照，**只用 1 条**避免啰嗦 |
| 目标行 | `StatLine` 样式 + chevron，点击 → M6 |
| 超出态 | 轨道转 `dangerSoft`、数字转 `danger`、文案「已超出 120 kcal · 明天少一点就好」（**不说教**，延续 readiness 的"鼓励而非警示"） |

**动效**：进入 420ms ease-out（既有）；**数值变化**时：① 数字滚动 500ms；② 环 `beat`：`strokeWidth 6→12→6 @ 100/300/500ms`（借开源参数）；③ 超额瞬间 `haptics.warning()` + 数字一次 6pt 左右摆动（`withSequence(6,-4,0)`，120ms×3），**不做整卡抖动**。

**数据**：`GET /api/nutrition?date=` 已返回 `totals`；目标来自 `DEFAULT_NUTRITION_TARGETS`（M6 会替换）。

**验收**：进入饮食页 3 秒内能回答"今天还能吃多少"；改一条记录后数字滚动 + 环跳动，且 `reduce-motion` 下直接到位。

## M2 · 日期条：从「只有今天」到「可翻历史」（P1）

**现状**：只有今天，无法回看。

**目标**：横向 7 天 pill 条（周一起），已完成的日子显示小 ✓，**今天用能量橙描边**，选中日 = 实心 `primarySoft` + 描边加粗。

| 组件 | 规格 |
|---|---|
| `DayStrip`（新） | 高度 64；pill 48×56，圆角 18；上行 3 字星期（`micro·muted`）、下行日期数字（`headline`）；已完成 ✓ 用 `success` 10pt；今天描边 `accent` 1.5pt；选中日填充 `primarySoft` + 边框 `primary` |
| 交互 | 点按切日（`haptics.soft`）；左右滑动切上一/下一周（`ScrollView horizontal` + `snapToInterval={56+8}`） |
| 内容联动 | 切日时 hero + 时间线 + macro 一起 `FadeOut 90ms → FadeIn 120ms` 交叉淡化（延续 v2「只做淡化，不做位移」的纪律） |

**数据**：`GET /api/nutrition?date=` 已支持；为画 ✓ 需要**一次拿到近 7 天汇总** → 新增 `GET /api/nutrition/summary?days=7`（返回 `[{date, kcal, proteinG, carbsG, fatG, entryCount}]`，一次 SQL `GROUP BY log_date`）+ `route.test.ts`。

**验收**：连续点 7 天不卡顿（一次请求）；切到今天与历史的视觉状态一眼可辨。

## M3 · 餐次时间线：从「文本行」到「时间线 + 徽标 + 左滑删除」（P1/P2）

**现状**：`Card` 分餐次 + 纯文本行（无时间、无编辑、删除靠右侧小垃圾桶）。

**目标**：

```text
早餐  ·  420 kcal  ·  目标 30%  ▓▓▓▓▓░░░░░
 ●  08:12  燕麦牛奶                      320 kcal
 ●  08:20  水煮蛋 ×2                     100 kcal
午餐  ·  760 kcal  ·  目标 40%
 ●  12:35  香煎鳕鱼海鲜烩菜              520 kcal
 ...
```

| 组件 | 规格 |
|---|---|
| 复用 | `Timeline`（已建：三态节点 + 连线）作为骨架；分组头用 `SectionHeader`（标题 + 该餐 kcal + 目标占比细条 `ProgressBar`） |
| `KcalBadge`（新） | 胶囊：`accentSoft` 底 + `accentStrong` 文字 `12·700`，内容 `520 kcal`；超标时 `dangerSoft`/`danger` |
| 行内容 | 左：时间 `micro·muted`（`HH:mm`）；中：名称 `body·600` + 分量/宏量 `caption·muted`（`1 份 · P28 C12 F9`）；右：`KcalBadge` |
| 食物视觉锚 | 我们没有照片 → 用 **emoji 贴纸**（`FoodSticker`，40×40 圆角 12，`surfaceMuted` 底，emoji 22pt）替代 吃一点 的圆形食物照；emoji 由食物名映射（纯函数 `foodEmoji(name)`，约 60 条关键字表 + 兜底 🍽️） |
| 左滑删除 | `react-native-gesture-handler` 的 `ReanimatedSwipeable`（**已确认存在于我们装的 2.32.0，零新增依赖**）；滑出露出 `danger` 删除钮，删除后列表 `LinearTransition` 高度塌陷 |
| 点按编辑 | 点行 → 打开 M4 的份量面板（改 `amount`/`kcal`/`name`/`meal`） |

**动效**：新增行 `FadeInUp 180ms` + 列表 `LinearTransition`（重排 180ms）；删除 = 塌陷 + `haptics.warning`；某餐达标 → 分组头出现 ✓（`FadeIn` + scale 0.8→1 spring）。

**数据**：① `GET /api/nutrition` 的 SELECT 加 `created_at AS "createdAt"`（时间线需要）并在 `route.test.ts` 断言；② 新增 `PATCH /api/nutrition`（body `{ id, amount?, kcal?, proteinG?, carbsG?, fatG?, name?, meal? }`，服务端校验范围并重算/接受传入值）+ 测试；③ 离线：编辑/删除先写本地 store，失败进 sync 队列（与 M4 共用）。

**验收**：一屏看清「早/午/晚/加餐各吃了多少、目标占比多少」；每条能看到时间；左滑能删；点按能改分量。

## M4 · 记录流：从「两段式表单」到「一点即记 + 拖着调」（P2）

**现状**：BottomSheet 里上半是常用食物 chip（点了还要填数量），下半是手动表单（7 个输入框）。

**目标**：三层递进，**默认路径 0 次输入**：

```text
① 常吃/最近（Top 12 chip 网格，点一下 = 记 1 份，立刻入账）
   [🥚 水煮蛋 78] [🥛 牛奶 120] [🍚 米饭 230] [🍗 鸡胸 165] …
② 选中的食物展开：份量滑杆（0.5–3.0 份 / 或克重 50–500g）
   ├─ 大圆钮滑杆 + 居中百分比「1.5 份 · 61%」
   └─ 实时换算：热量 / 蛋白 / 碳水 / 脂肪 四个微环 + 数字滚动
③ 找不到？→「手动添加 / 新建常用」（保留现有表单，字段不变）
```

| 组件 | 规格 |
|---|---|
| `FoodChipSticker`（新） | 贴纸风：emoji 22pt + 名称 `13·700` + kcal `micro·muted`；白底 + 双层描边（`surfaceStrong` + hairline + 外圈 `border`）+ 轻投影 —— **借 吃一点 的贴纸 craft，但视觉主体是 emoji 不是照片** |
| `PortionSlider`（新，自研 ~80 行） | 轨道 8pt 圆角；**大圆钮 28pt**（白底 + `shadows.card`，拖动时 scale 1.12）；`PanGesture` + `runOnJS` 节流；吸附档位 0.5 份步进；两侧标签「0.5 份 / 3 份」；中间实时百分比（借 吃一点「食用比例 61%」） |
| `MacroMiniRings` | 4 个 `ProgressArc size 56 / strokeWidth 6`，中心小数字；实时联动 |
| 手动/新建 | 现有 `Field` 表单保留；「存入常用食物」开关保留 |
| 常在排序 | 「常吃」按使用频次、「最近」按最近一次使用时间排序 |

**动效**：chip 按下 scale 0.96（`PressableScale` 既有）+ `haptics.light`；滑杆拖动 knob 1.12、松手回 1.0（`withSpring(1,{damping:18,stiffness:240})`）；**记录成功**：sheet 关闭 + 时间线首行 `FadeInUp` + `haptics.success()` + hero 数字滚动/环跳动。

**数据**：① 新增 `GET /api/nutrition/foods?sort=recent`（用 `meal_entries` 最近 90 天按 `food_id` 聚合出频次与最近时间，**无需迁移**）+ 测试；② `POST /api/nutrition` 已支持 `amount/unit/kcal/...`，无需改；③ 离线先落本地 + 重试（和 sync 引擎复用）。

**验收**：从进入饮食页到记完一条常吃食物 ≤ 2 次点击、0 次键盘输入；改份量时四个营养数字实时跟着变。

## M5 · 营养素：从「4 条细 bar」到「1 主 + 3 微环 + 区间目标」（P1）

**现状**：4 条等权细 bar，看不出主次。

**目标**：
- 热量已在 M1 hero → 这里只留**蛋白 / 碳水 / 脂肪**三个 `ProgressArc size 72 / strokeWidth 8`，各自颜色：蛋白 `success`、碳水 `accent`、脂肪 `teal`（**数据可视化第二色**，符合 v2 §1.5.4 的约定）
- 每个环下：`已吃 / 目标` + 达标 ✓ 或「还差 12g」
- **目标用区间**（借 MacroFactor）：显示 `68 / 90–110g`，环以区间中值为满，落在区间内即为达标绿色
- 超区间上沿 → 环转 `danger` + 文案「超出 8%（不是问题，注意明天）」

**动效**：数值变化 500ms 滚动 + 环 300ms ease-out；达标瞬间端点 glow `scale 1→1.35→1 @600ms` 一次。

**数据**：区间目标需要扩展 shared 的 targets 类型（`{min, max}`）+ M6 设置项；若决策为单值则退化为 `target`。

## M6 · 目标与活动水平（P3）

**现状**：`DEFAULT_NUTRITION_TARGETS` 是客户端常量（固定 kcal/蛋白/碳水/脂肪），人人一样。

**目标**：
1. 目标行可点开 → 面板：**活动水平**（久坐 / 轻活动 / 中等活动 / 高活动，借 吃一点 的分段控件）+ **目标热量**（自动算值 + 手动覆盖）+ 三大营养素（按体重 g/kg 给默认：蛋白 1.6g/kg、脂肪 0.9g/kg、碳水补足）
2. 展示"怎么算出来的"：`BMR 1480 × 1.375 ≈ 2035 kcal`（一句话，可展开）
3. **未填身体数据不阻塞**：用默认目标 + 一行引导「填写身高体重后可自动算目标 ›」

**数据**（迁移 **044**）：
```sql
-- 044_nutrition_target.sql
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS height_cm int;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS birth_year int;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS sex text;              -- 'male' | 'female' | NULL
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS activity_level text;   -- sedentary|light|moderate|high
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS nutrition_target_kcal numeric;  -- 手动覆盖
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS protein_target_g numeric;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS carbs_target_g numeric;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS fat_target_g numeric;
```
+ 新接口 `GET/PUT /api/nutrition/target`（`route.test.ts`）+ shared 纯函数 `computeCalorieTarget()`（Mifflin-St Jeor + 活动系数，**含单测**：男女、缺失字段回落、上下限钳位）。

**验收**：改活动水平后目标与 hero 立即更新；不填身高体重也能正常使用。

## M7 · 喝水打卡（P3，**复用已有后端**）

**现状**：Mobile 完全没有；**后端已有** `hydration_logs` / `hydration_goals` 与 `GET/POST /api/wellbeing/hydration`（默认目标 2000ml，单次 1–2000ml，`source: MANUAL|REMINDER|FOCUS_BREAK`）。

**目标**：饮食页底部 / 健康 Hub 的「饮水」卡：

```text
┌───────────────┬──────────────────────────────┐
│   ▓▓▓▓▓▓░░░░  │ 800 / 2000 ml                │
│   （玻璃杯）   │ [ +200 ] [ +300 ] [ +500 ]   │  ← 一点即记，无输入框
│               │ 最近：14:20 300ml  ·  撤销     │
└───────────────┴──────────────────────────────┘
```

| 组件 | 规格 |
|---|---|
| `WaterGlass`（新） | `react-native-svg` 画杯身 + `ClipPath` 内的可动画矩形液面；杯身描边 `teal`，液面渐变 `teal → #57C7B2`；刻度 3 条 |
| 快捷按钮 | `Button variant="secondary"` 三个：`+200 / +300 / +500`；点了 `haptics.light` |
| 撤销 | 最近一条 `←` 撤销（DELETE） |
| 达标 | 液面到 100% → 杯身 glow + 文案「今天的水够了」 |

**动效**：加水 → 液面 `withSpring(h, {damping:14, stiffness:120})` 上升 + **3 个气泡**（`Circle` 在 ClipPath 内 `withRepeat(withTiming(-20,{duration:1600}), -1)` 上浮 + opacity 0→0.6→0，零依赖替代 Lottie）；数字滚动 400ms。

**数据**：① 复用 `GET/POST /api/wellbeing/hydration`；② **新增 `DELETE /api/wellbeing/hydration?id=`**（表已有 `deleted_at`，软删）+ 测试（这是本模块唯一的后端改动）；③ Mobile 新增 `lib/hydration.ts`。

**验收**：一次点击记一杯；液面动画不掉帧；撤销可用。

## M8 · 体重 / BMI 卡（P3）

**现状**：`user_settings.weight_kg` 单值（Web 端健康页可改），Mobile 无入口，无历史。

**目标**：角落小卡（借 吃一点 的体重卡）：

```text
┌───────────────────────────────────────┐
│ 62.40 kg              BMI 21.3 ›   ⊕ │
│      ╱‾‾╲__╱‾‾  ← 原始点（细线）+ 7 日均线（粗线）
└───────────────────────────────────────┘
```

| 组件 | 规格 |
|---|---|
| 数字 | `typography.metric` + `kg`（`micro·muted`） |
| 趋势 | 复用 `charts.tsx` 的 `LineChart`，扩展 `series?: ChartDatum[][]` 支持第二序列（7 日移动平均，去噪 —— MacroFactor 手法）；无历史时显示一句引导而非空图 |
| `⊕` 按钮 | 圆形 `successSoft` 底 36pt，点开 `BottomSheet`：`Field`（今日体重）+ ±0.1 步进 + 保存 |
| BMI | `BMI = kg / (m)²`，纯函数 + 单测；分档文案用中性词（偏轻/正常/偏高），**不做肥胖警示** |

**数据**（迁移 044 同批）：
```sql
CREATE TABLE IF NOT EXISTS weight_logs (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  anon_id    text,
  log_date   date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg  numeric NOT NULL CHECK (weight_kg BETWEEN 20 AND 300),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_weight_logs_user_date
  ON weight_logs(user_id, log_date) WHERE deleted_at IS NULL AND user_id IS NOT NULL;
```
+ `GET/POST/DELETE /api/wellbeing/weight`（同日 upsert；写入时同步 `user_settings.weight_kg = 最新值`，因为卡路里估算依赖它）+ `route.test.ts` + `db/schema.sql` 登记。

**验收**：记录体重后曲线出现新点且均线顺滑；BMI 与 Web 端一致（同一纯函数）。

## M9 · 「饮食日记」贴纸墙（P4，可选）

**现状**：无。

**目标**：把记录过的食物聚合成贴纸网格（emoji + 名称 + 次数），**点击 = 再次记录**（与 M4 的常吃 chip 同源数据）。标题「我的饮食日记」，副标题「已收集 23 种」。

**价值**：用最低成本复刻 吃一点 的"收集"动机（它靠照片贴纸，我们靠 emoji），并顺带成为 M4 的入口。

**数据**：复用 M4 的 `/api/nutrition/foods?sort=recent&limit=60`；无需新表。

## M10 · 微交互与动效规范（P1 建立，全模块复用）

| 场景 | 参数 | 备注 |
|---|---|---|
| 数字滚动 | `withTiming(500ms, Easing.out(cubic))`（`AnimatedText` 组件，`useAnimatedProps` + TextInput） | 热量 / 饮水 / 体重 / 比重 |
| 环变化 | `withTiming(300ms)` + 值变化时 `strokeWidth withSequence(6→12→6 @100/300/500)` | 只在"用户改数据"时 beat，滚动进入不 beat（避免聒噪） |
| 贴纸/chip 入场 | `scale 0.8→1` + `opacity 0→1`，`withSpring(damping 14, stiffness 240)` | **唯一允许的缩放动画**（贴纸语义） |
| 列表重排/删除 | `LinearTransition.duration(180)` + 删除 `FadeOut` | 不做位移动画（延续 v2 纪律） |
| 切日期/切 tab 内容 | 交叉淡化 90ms + 120ms | 沿用 v2 |
| 滑杆 knob | 拖 `scale 1.12`、松 `withSpring(1,{damping:18,stiffness:240})` | |
| 达标反馈 | glow `scale 1→1.35→1 @600ms` + `haptics.success` | 每达标一次只放一次（当日去重） |
| haptics 映射 | 选择 `light` / 记录成功 `success` / 删除与超额 `warning` / 切换 `soft` | 统一放 `lib/motion.ts` 常量 |
| reduce-motion | 全部直接到位（`useReducedMotion()`） | 既有约定 |

**新增共享件清单**（全部放 `apps/mobile/src/components/`）：`AnimatedNumber`、`DayStrip`、`KcalBadge`、`FoodSticker`、`PortionSlider`、`WaterGlass`、`MacroMiniRings`、`SwipeRow`。

## M11 · 与「今日 / 健康 Hub」的联动（P4）

- **今日页**：`DailyOsSummary` 的饮食 `StatLine` 改为「剩余 620 kcal」+ 新增一行「饮水 800/2000ml」（M7 上线后）；一张卡里同时看到"吃"和"喝"。
- **健康 Hub**：readiness hero 下新增一张**「今日饮食摘要」**（剩余 kcal + 饮水条 + 体重 mini），让"一处看全"落到饮食；四域入口卡不动。
- **纪律**：健康 Hub 首屏仍然 ≤2 个重点块（readiness hero + 摘要卡），四域入口降为紧凑一行。

---

# 4. 迁移 / 接口 / 依赖清单

## 4.1 迁移（从 044 起）

| 文件 | 内容 | 是否必需 |
|---|---|---|
| `044_nutrition_target.sql` | `user_settings` 加 `height_cm / birth_year / sex / activity_level / nutrition_target_kcal / protein_target_g / carbs_target_g / fat_target_g`（全 nullable，纯增量） | M6 需要 |
| `045_weight_logs.sql` | `weight_logs` 表 + 唯一索引 | M8 需要 |
| — | 饮水**不需要迁移**（表已存在） | — |

> 两份迁移都必须同步登记 `db/schema.sql`，并跑 `pnpm test:scripts` 校验。

## 4.2 接口

| 接口 | 动作 | 模块 |
|---|---|---|
| `GET /api/nutrition` | SELECT 补 `created_at AS "createdAt"`（+ 测试断言） | M3 |
| `GET /api/nutrition/summary?days=7` | **新增**（按日 GROUP BY 汇总） | M2 |
| `PATCH /api/nutrition` | **新增**（改分量/热量/名称/餐次） | M3/M4 |
| `GET /api/nutrition/foods?sort=recent&limit=N` | **新增**（按 meal_entries 聚合频次与最近使用） | M4/M9 |
| `GET/PUT /api/nutrition/target` | **新增** | M6 |
| `DELETE /api/wellbeing/hydration?id=` | **新增**（软删） | M7 |
| `GET/POST/DELETE /api/wellbeing/weight` | **新增** | M8 |
| 其余 | 复用现有 | — |

> 每个新路由都按项目铁律带 `route.test.ts`。

## 4.3 依赖与许可证

- **新增运行时依赖：0 个**（滑杆/杯子/动画都用 `react-native-reanimated` + `react-native-svg` + RNGH 2.32 已装的 `ReanimatedSwipeable`）。
- 复用需登记：无（未复制任何第三方代码）。若后续确实要抄 MIT 代码片段 → 必须登记 `docs/THIRD_PARTY.md`。
- **禁止**：Skia、gorhom/bottom-sheet、ruler-picker、confetti-cannon；**禁止**复制无 LICENSE 仓库（nutrition-mobile / health_record / mfg）与 GPL-3.0（MacroFlow）的代码；吃一点 为闭源商业 App，只借交互。

---

# 5. 执行计划

| 阶段 | 内容 | 产出 | 风险 |
|---|---|---|---|
| **P1 视觉重排（纯前端）** | M0 语义色 + `typography.metric`；**M1 热量 Hero**；**M2 日期条**（含 `summary` 接口）；**M3 时间线**（含 `createdAt` 加列）；**M5 三微环**；M10 动效常量与 `AnimatedNumber` | 一版可扫码回归的 APK：饮食页"焕新"但功能不变 | 低（不碰写接口） |
| **P2 交互** | M4 记录流（chip 贴纸 + 份量滑杆 + 实时微环）、M3 左滑删除 + 点按编辑（`PATCH`）、离线先落本地 | 「2 次点击记一条」 | 中（写接口 + 手势冲突） |
| **P3 数据补齐** | M6 目标（迁移 044 + 目标接口 + 纯函数）、M7 饮水（复用后端 + DELETE）、M8 体重（迁移 045 + 接口 + 趋势图） | 「会算目标、能记水、能看体重趋势」 | 中（迁移 + 新表） |
| **P4 可选** | M9 贴纸墙、M11 今日/健康联动、饮食周报分享卡 | 收藏动机与一处看全 | 低 |

**每阶段收尾**：`typecheck / lint / test`（mobile + web）→ 提交 → 推送 → 重新出包（版本号 +1）→ 上传服务器 → 出二维码给你回归。

---

# 6. 待你确认的决策点

| # | 决策 | 选项 | 我的建议 |
|---|---|---|---|
| **D1** | 饮食模块配色 | A. 只在饮食模块引入「能量橙 / 达标绿 / 饮水青」语义色，品牌主色不动 B. 把饮食模块主色也换成绿（更像 吃一点） | **A**（借手艺不借皮） |
| **D2** | 热量显示框架 | A. **「剩余可吃」为主**（吃一点 做法）B. 「已吃 / 目标」为主 | **A**，并把「已吃 / 目标」放在次要行 |
| **D3** | 三大营养素目标 | A. 单值（90g）B. **区间**（90–110g，MacroFactor 做法） | **B**（降低焦虑，与 readiness 的"鼓励式"一致） |
| **D4** | 记录主路径 | A. **常吃 chip 一点即记** + 份量滑杆（0 输入）B. 保持"搜索→选→填数量" C. A + 保留 B 作为"手动添加" | **C**（A 为主线，B 收纳进"手动/新建"） |
| **D5** | 是否做照片 / AI 识别 | A. **不做**（无相机权限、无 AI 成本，用 emoji 贴纸替代）B. 未来再说 | **A**（明确排除，避免范围蔓延） |
| **D6** | 喝水打卡 | A. **本期做**（复用已有 hydration 后端 + 新 UI）B. 延后 | **A**（成本最低、感知最强，且 吃一点 有、我们没有） |
| **D7** | 体重趋势 | A. **新增 `weight_logs` + 趋势图** B. 只用 `user_settings` 单值 | **A**（单值画不出趋势，而趋势才是价值） |
| **D8** | 贴纸墙（收集） | A. 本期做（emoji 版）B. 延后到 P4 | **B**（先把手感做好，再做游戏化） |
| **D9** | 动效强度 | A. **克制**（延续 v2「只做淡化」，仅贴纸/数字/滑杆例外）B. 更活泼（位移 + 弹跳 + confetti） | **A**（上轮刚把弹跳去掉，别再请回来） |

---

# 7. 一句话总结

```text
「吃一点」的真正长处是：把"今天还能吃多少"做成唯一主角、把记录压缩到"一点即记 + 拖着调份量"、
用日期条和时间线把一天串起来，再在角落里放两张会动的自洽小卡（喝水 / 体重）。

我们不需要它的相机、AI 和贴纸相册，需要的是它这三条手艺；
而这些恰好可以**零新增依赖**落在我们已有的 ProgressArc / Timeline / Surface / Sheet v2 上：
P1 只改视觉（一轮包就能看到焕新），P2 改交互（2 次点击记一条），P3 补数据（目标/喝水/体重），P4 再做收集与联动。
```
