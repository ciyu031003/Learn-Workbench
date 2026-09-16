# APP 端优化方案 v4（真机内测 8 项反馈 · 交互修复 + 一键开始 + 饮食 UI）

> **触发**：v1.3.5 真机内测反馈（8 项：3 个交互缺陷 + 一键开始大按钮 + 训练记录 + 输入法 + 离线提示 + 饮食 UI）
> **状态**：**P1 已完成并提交（2026-09-16）**；P2 → P4 待做（见第 6 节执行顺序）
>
> ### 执行进度
> | 阶段 | 内容 | 状态 | 提交 |
> |---|---|---|---|
> | P1-1 | 招花页卡片间距（FlashList v2 不消费 contentContainerStyle） | ✅ | `5d8b46e` |
> | P1-2 | 学习页拖拽排序（抬层级 + 实测高度 + 实时让位 + 拖动锁滚动） | ✅ | `5d8b46e` |
> | P1-3 | 每日任务页视觉层级（焦点 hero / 进度条 / 工具区收拢） | ✅ | `d824691` |
> | P1-4 | 饮食写操作四分类 + 后台自动补发 + 毒丸跳过 | ✅ | `e2fd58b` |
> | P2 | 一键开始大按钮 + Bing 默认壁纸 + keyboard-controller 键盘适配 | ⏳ | — |
> | P3 | 训练记录（删除/弹层重做/动作字典迁移） | ⏳ | — |
> | P4 | 饮食 日/周/月 + 月历 + 「吃一点」UI（含进阶套件） | ⏳ | — |
>
> P1 验证：`pnpm -F mobile test` 22 文件 **180 用例**全绿；typecheck / lint **0 error**。

>
> ### 已确认决策（用户 2026-09-16 拍板）
> | # | 决策 | 结果 | 对方案的影响 |
> |---|---|---|---|
> | D1 | 键盘适配路线 | **B · 引入 `react-native-keyboard-controller`** | P2 增加"新增原生依赖 + 重跑 gradle"；`android/` 不进 git，靠 autolinking + 构建脚本幂等修补，**不需要 prebuild** |
> | D2 | 训练记录范围 | **B · 含新建健身房动作字典** | P3 追加迁移（`046_exercise_catalog`）+ 种子 + `GET /api/exercises` + 移动端选择面板 |
> | D3 | 饮食 UI 深度 | **B · 含进阶套件** | P4 扩为 P4-a/b/c：追加 7 天曲线、6 个月点阵热力图、Food Calendar 缩略图、水杯液位动画、LiveLog 拖拽贴纸 |
> | D4 | 是否引入开源库 | **B · 允许引入** | 图表/日历等可按需引库；**每个新依赖必须登记 `docs/THIRD_PARTY.md`**，并确认 Expo 57 / RN 0.86 / New Arch 兼容 |
> | D5 | 一键开始行为 | **A · 点大按钮 → 弹层选学习/运动/秒表 → 选完立即开始** | 同原方案 |
> | D7 | 明文地址 | **A · 统一禁 http，只允许 https** | 设置页自定义地址仅允许 https；顺手排查"流量开着也传不上" |
> | D6 | 运动计时落库 | A（新增 `addSportSeconds`，秒数不丢）——按建议默认执行 | 同原方案 |
> | D8 | 首页首屏高度 | A（压缩 TodayStack 到 ~150）——按建议默认执行 | 同原方案 |
>
> **基础**：v1.3.5（versionCode 14）
> **硬约束**：
> 1. **不得影响其它品牌 / 其它页面**：不改动既有交互的语义，只做加法与定点修复；
> 2. **数据库只追加迁移**，不改历史迁移文件；
> 3. **不新增原生依赖**为默认选择（除非你在决策点明确要求）；
> 4. 每个阶段独立 git 提交；出包按阶段给内测（最后统一部署）。

---

## 0. 一页速览

| # | 你的反馈 | 已定位根因（一句话） | 阶段 | 规模 |
|---|---|---|---|---|
| 1 | 招花职位卡片零间距 | `gap:12` 写在 **FlashList v2 根本不消费的 `contentContainerStyle`** 上，卡片自身也无 margin → 间距与左右内边距一起丢失 | **P1** | 小 |
| 2 | 学习页长按拖拽：被拖卡片沉底、其它卡片不让位 | `stageCardDragging` **只有 `opacity`，没有 `zIndex`/更高 `elevation`**（而每张卡 base `elevation:4`）；且**完全没有实时让位**逻辑；步长常量 108 ≠ 实际 116 | **P1** | 中 |
| 3 | 每日任务页"没有焦点，每张卡都很均匀" | 4 张卡全走 `variant="surface"` 等权平铺，**`Card` 的 hero 变体一次没用**，字号跨度只有 13–24px | **P1** | 小 |
| 4 | 新增「一键开始」大按钮（大/直接开始/默认 Bing 壁纸/首页合并学习+运动） | 专注计时器是 **Modal 组件而非路由**，只有 `useState` 入口、**无 autoStart / 无初始模式**；默认背景是纯色 `sunset`；`pickGallery("bing")` 存在"切了不拉图"的既有 bug | **P2** | 中 |
| 5 | 训练记录：动作不能删、弹层丑、动作要能下拉选 | **纯 UI 缺失**（后端 `PATCH /api/workouts/[id]` 传 `items` 即整组替换，已支持删除）；移动端动作行只有 4 个 TextInput | **P3** | 中 |
| 6 | 键盘遮挡输入框 | `BottomSheet` 的 `KeyboardAvoidingView` **仅 iOS 生效**，且弹层高度是**挂载时按窗口算死的像素值**；另有 6 处自绘弹层 + 6 处内联表单**完全无适配** | **P2** | 中 |
| 7 | 加午餐每次都弹"当前网络不可用"，流量开着也传不上 | `sendOp` 把**任何非 2xx 与任何异常都归为"离线"**并弹 Alert（与真实网络状态无关）；outbox 只在进页面时补发；另有 `usesCleartextTraffic` 配置矛盾这一潜在真凶 | **P1** | 小 |
| 8 | 饮食页只能按周；要 日/周/月 + 月历汇总 + 「吃一点」UI | 现在是 `DayStrip`（固定 7 天、最多回看 4 周、`scrollEnabled={false}`）；**后端 `summary?days=&end=` 已返回逐日 kcal（上限 31 天）→ 零后端改动**，只是客户端把 kcal 丢掉了 | **P4** | 大 |

---

## 1. 逐项根因与方案

### P1-1 招花页职位卡片零间距

**现象**：招花页每张职位卡紧紧挨着，无间隙、无左右留白。

**根因（三段）**
1. 列表用 **FlashList v2.3.2**：`apps/mobile/src/app/jobs.tsx:712-732` 的 `<FlashList>` 只传了 `contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}`，而 `styles.content` 是 `{ padding: 16, gap: 12 }`（`jobs.tsx:770`）。
2. **FlashList v2 不消费 `contentContainerStyle`**：`node_modules/@shopify/flash-list/dist/recyclerview/RecyclerView.js:357` 把 `...rest` 直接摊给 `CompatScrollView`，全 `dist/` 目录 grep `contentContainerStyle` **0 命中**；v2 的 item 是**绝对定位**（`ViewHolder.js:42-52` `position: "absolute", top: layout.y`），根本没有"内容容器"可让 `gap`/`padding` 生效。
3. `JobCard` 根节点 `styles.jobCard`（`jobs.tsx:843-854`）**没有 margin**，也没有 `ItemSeparatorComponent` → 间距为 0，且 `padding:16` 也一起丢了（卡片顶到屏幕边）。

**方案（最小改动，只动 jobs.tsx）**
- 给 FlashList 加 `ItemSeparatorComponent`（v2 明确支持，`ViewHolderCollection.js:82`，自动跳过最后一项）→ 高度 12，与设计一致；分隔组件提到组件外或用 `useCallback` 保持引用恒定（避免每次 render 重建）。
- 左右 16 / 上下留白通过 `ListHeaderComponent` 与 `ListFooterComponent` 的容器样式补齐（FlashList 的 header/footer 是普通子节点，样式有效）。
- 保留 `styles.content` 常量语义，注释里写清"FlashList v2 不读这个 prop，改间距请改 separator"。

**影响面**：仅招花页一个列表（全仓库**唯一**一处 FlashList）。`scrollToOffset` 逻辑不受影响。
**验收**：卡片间距 12、左右留白 16、最后一张不出现多余尾巴；翻页/回到顶部正常。

---

### P1-2 学习页阶段卡片拖拽排序

**现象**：长按拖动时被拖卡片**沉到其它卡片下面**；拖到目标位置时**其它卡片不让位**，只能盲拖。

**根因**
1. 自研实现（非库）：`apps/mobile/src/app/learn.tsx:272-297` 用 `Gesture.Pan().activateAfterLongPress(260)` + reanimated。
2. **沉底**：`styles.stageCardDragging`（`learn.tsx:1023`）**只有 `opacity: 0.88`**；而每张卡 base 都有 `elevation: 4`（`learn.tsx:1020`）。Android 上同 elevation 的兄弟按**子视图顺序**绘制（后画的盖住先画的），且被拖卡片半透明 → 观感就是"沉下去"。iOS 未设 `zIndex` 时同样按兄弟顺序。
   - 对照证据：同文件里**从未被渲染的死代码** `ReorderRow` 的 `reorderCardDragging`（`learn.tsx:1192-1200`）反而是正确写法（`zIndex:10 + elevation:6`）。
3. **无实时让位**：全文件没有任何 layout 让位逻辑，目标索引只在松手时算一次（`learn.tsx:284`），且 `STAGE_CARD_STEP = 108`（`:214`）≠ 实际行距 `minHeight 104 + gap 12 = 116` → 跨一格常常算不出变化，手感"黏"。
4. 父层：所有 `StageCard` 是 ScrollView 内容容器的**直接兄弟**（`learn.tsx:683-700`），滚动容器不会裁剪，问题纯粹是"没抬层级"。

**方案**
1. **抬层级**：`stageCardDragging` 补 `zIndex: 20` + `elevation: 16` + 加强阴影；并把 `zIndex/elevation` 同时挂在 `StageCard` 外层 `Animated.View`（`learn.tsx:301`，它才是滚动容器的直接子节点）——**Android 上只加 zIndex 可能看不出变化，必须同时抬 elevation**。`overflow:"hidden"`（`:1011`）保持不动（卡片内光斑需要裁剪，浮起感用外层阴影表达）。
2. **实时让位（UI 线程）**：把 `dragIndex`/`dragY` 提升到页面级共享值；每张卡一个 `useAnimatedStyle`，根据 `dragIndex` 与自身下标计算 `translateY = ±(自身高+gap)`，用 `withTiming(160ms, Easing.out(quad))` 让位；松手时先 `runOnJS(swapPhase)` 再归零。**禁止在 `onUpdate` 里 `runOnJS(setState)`**（每帧 JS 往返必掉帧）。
3. **实测行高**：用 `onLayout` 记录每张卡高度到 `heights[i]`，把固定步长换成"累计位移跨过相邻卡片中点"的判定。
4. **手势与滚动互斥**：拖动中给 ScrollView 设 `scrollEnabled={false}`（参考 `today.tsx:381` 的既有写法），避免"卡片跟着动 + 页面同时滚"。
5. 落库仍只在 `onEnd` 调一次 `reorderPhases`（现在 `swapPhase` 每次重排都会打接口，`learn.tsx:529-540`），保持乐观更新 + 静默失败。

**影响面**：仅学习页。iOS 行为不变（只是顺序正确了）。
**验收**：长按后卡片**浮在所有卡片之上**（含拖到最上方）；拖过相邻卡中线时对方平滑让位；松手落位准确；拖动中页面不滚；顺序刷新后保持。

---

### P1-3 每日任务页的视觉焦点

**现象**：首页点「学习」→ `/tasks`，进去后"每张卡都很均匀，没有焦点"。

**根因**
- 页面是 **4 张等权 `Card`**（`apps/mobile/src/app/tasks.tsx:75 / 83 / 107 / 135`），全部 `variant="surface"`（同背景、同 `padding:16`、同圆角/边框/阴影），字号跨度只有 13–24px，没有 hero、没有分区层级、没有进度可视化。
- 设计意图被代码违背：`components/card.tsx:11` 明确写着**「hero：每屏最多 1 张」**，而 tasks 页一张都没用。
- 「专注计时」「新建任务」这两张**工具卡**常驻首屏前两位，把信息量最大的「今日任务」压在下面 —— 这是"没有焦点"的直接原因。

**方案（纯视觉改版，不动数据模型）**
1. **新增"今天最重要的一件事" hero**：复用现成 `variant="hero"`（`card.tsx:62-69`，更大的 `radius.xl/padding:20/shadows.floating`），内容取今日第一个未完成任务（`today.tsx:321` 已有该逻辑），hero 内嵌唯一一颗主按钮「开始专注」→ 直接调 `openTimer`（`tasks.tsx:39-43`，注意必须沿用 `openTimer` 以触发 `timerSession` 重建）。
2. **「今日任务」卡上移**到「新建任务」之前，并在副标题旁加**细进度条**（复用 `learn.tsx:1040` 的 bar 写法或 `components/ring-progress.tsx`）。
3. **工具区收拢**：「专注计时」+「新建任务」合并为一张紧凑卡（`variant="glass"`）或一行两个小按钮，"新建任务"的输入框改为点开弹层输入（`BottomSheet` 已内置键盘避让）。
4. （可选）「专注打卡」整卡降权为一行摘要 + chevron（`learn.tsx:704` 的 `statsEntry` 套路），明细收进 sheet。

**不做**：不引入任务优先级字段（那要动 store + `/api/sync`，风险大于收益）；"最重要的一件事"先用"第一个未完成"，命名上标注为"下一步"避免误导。

**验收**：进页面 1 秒内能回答"我今天第一件该做什么"；首屏只有 1 个强视觉元素；四张等权卡消失。

---

### P2-4 一键开始大按钮（含 Bing 壁纸与首页合并）

**现象/需求**：①要大、一目了然；②点击后**直接开始**倒计时学习，或正向计时学习/锻炼；③倒计时默认用 **Bing 每日壁纸**（风景，不用纯色）；④今日首页把「学习」「运动」合并为一个大的「一键开始」。

**现状（关键事实）**
- 专注计时器是 **`components/focus-timer.tsx`（731 行全屏 Modal，不是路由页）**，入口只有 `useState`：
  - `tasks.tsx:39-43` `openTimer()` → `setTimerOpen(true)`；入口 3 处（`tasks.tsx:79` 按钮、`tasks.tsx:126` 任务行 ▶、`today.tsx:396` 轮播卡 CTA）
  - `today.tsx:532-538` 直接渲染 `<FocusTimer>`，**没有 `key`** → `timerMode`/`started` 等 state 会跨次打开残留（`tasks.tsx:181` 用 `key={timerSession}` 规避了这个问题）
- 计时模式 `timerMode: "countdown" | "stopwatch"`（`focus-timer.tsx:85-86`）**只在 ready 屏用两个 chip 手动切换**（`:586-601`），无 props、不持久化；开始必须手点 `begin()`（`:603-608`）
- 背景模式 `BgMode = "gallery" | "color" | "upload"`（`:45`），**默认 `galleryId = "sunset"`（纯色 `#7c2d12`）**；Web 端对应默认值已经是 `"bing"`（`apps/web/store/focus-bg-store.ts:41-44`）——**这就是"网页版已默认、App 没默认"的差异根因**
- Bing 图链路已存在：`focus-timer.tsx:193-202` → `GET {api}/api/background`（读 manifest，**今日缺图会回退到最近历史图，不会空窗**）→ `GET {api}/api/background/img?date=`（ETag + `max-age=86400`）；服务端爬虫 `scripts/fetch_bing_wallpaper.py`，COS 桶 `/data/learn-workbench/bing`
  - **既有 bug**：`pickGallery("bing")`（`:249-252`）**不会触发拉图**，只有 `open` 那次 effect 会拉 → 用户在默认背景下切到"每日 Bing"会看到纯色 `#1f2937`，必须关掉重开
- 客户端**无图片缓存/预取**：`expo-image` 已在依赖里（`apps/mobile/package.json:20`）但**全项目未使用**，仍是 RN `Image`
- 首页两套重复入口：`daily-os-summary.tsx:85-122` 的 2×2 网格（学习→`/tasks`、运动→`/wellness`）＋ `today-stack.tsx:118-139` 的轮播卡（学习/运动卡 `action:"none"`，**点了没反应**）
- 运动侧**没有任何计时入口**，只有"直接记时长"（`SportSheet` → `addSport(sportKey, minutes)`，`app-store.ts:412-445`，**只接受分钟整数**）
- 现成底部弹层可复用：`components/bottom-sheet.tsx`（14 处在用，**内置键盘避让 + 安全区**）；HIG 约束"一次只 present 一个 sheet"（`bottom-sheet.tsx:51`）

**方案**
1. **大按钮（视觉）**：放在首页 **Hero 之后、`DailyOsSummary` 之前**（`today.tsx:391` 与 `:394` 之间）。
   - 用**实色强调色**（沿用 `#2F74C0`）+ `radius.xl` + `padding:18` + `minHeight:88`，左侧圆形 play 图标 + 主标题「一键开始」+ 副标题「倒计时 / 正向计时 · 学习或运动」+ 右侧 chevron。
   - **刻意不用玻璃**：首屏已有问候 Hero 与完成度玻璃 Hero，「每屏唯一 hero」是成文约束（`daily-os-summary.tsx:141`），第三个玻璃块会互相抢戏。
   - 必须放在 `today.tsx` 自己的 JSX 里，**不能放进 `DailyOsSummary`**（它 `if (!data) return null`，`daily-os-summary.tsx:125`，离线时会把大按钮一起隐藏）。
2. **点击后直接开始（功能）**：给 `FocusTimer` 新增 props：
   - `autoStart?: boolean`（打开即 `resume()`，跳过 ready 屏）
   - `initialTimerMode?: "countdown" | "stopwatch"`、`initialMinutes?: number`
   - `mode?: "focus" | "exercise"`、`exerciseLabel?`、`exerciseType?`
   - 同时给 `today.tsx` 的 `<FocusTimer>` 补 `key={timerSession}`（否则第二次点"正向计时"会失效）
3. **Bing 每日壁纸（默认）**：
   - 默认值 `"sunset"` → `"bing"`（`focus-timer.tsx:75`）+ **老用户迁移**（AsyncStorage 里存过 `"sunset"` 会覆盖新默认值，需要一个 `K_GALLERY_VERSION` 一次性迁移，否则老用户看不到变化）
   - **修既有 bug**：把拉图逻辑抽成 `useEffect([open, galleryId])`，让 `pickGallery("bing")` 也能触发
   - **预取**：App 启动 / 首页挂载时预取一次 manifest + 图片并落 AsyncStorage（日期 + URL），下次冷启零等待；首帧用 `bgColor` 占位
   - **换 `expo-image`**：`cachePolicy="memory-disk"` + `placeholder` + `transition`，解决首帧黑屏/闪烁（依赖已在，属"启用已有依赖"而非新增）
   - **可读性**：scrim 从 `rgba(0,0,0,0.32)`（`focus-timer.tsx:620`）提到 **0.45~0.55**（亮色风景/雪景上白字与白色进度环必须可读），必要时改底部加深的渐变
   - 服务端图源依赖宿主机 cron + COS 挂载，**接口失败自动回退历史图**，客户端 `catch → bgColor` 兜底不崩
4. **首页入口合并（去重）**：
   - 从 `DailyOsSummary` 的 2×2 网格里**摘掉「学习」「运动」两块**（保留 职业 / 习惯）→ 网格变 1×2，需实测 `width:"47.5%"`（`:240`）在两块时的排布
   - 大按钮弹层（新 `components/quick-start-sheet.tsx`，复用 `BottomSheet`）三项：**学习（25 分钟倒计时）** / **运动** / **正向计时（秒表）**
     - 「运动」分支复用 `today.tsx:158-259` 的 `SportSheet` 项目网格拿到 `{sportKey, minutes}`；若选正向计时，结束用**新增的 `addSportSeconds(sportKey, seconds)`**（现有 `addSport` 只吃分钟整数，45 秒会被 `Math.round` 抹成 0 → 兜成 1 分钟）
   - 顺带把 `today-stack.tsx` 的 study/sport 卡也指向同一个弹层（否则轮播里还留着第二个"看着能点其实不能点"的入口）
   - 交替打开两个 sheet 时注意 `bottom-sheet.tsx:51` 的单 sheet 约束：先 `setQuickOpen(false)`，下一帧再 `setSportSheetOpen(true)`
5. **首屏高度预算**（重要）：Hero(~100) + 大按钮(~88+14) + 完成度 hero(~160) + 网格(~200) + TodayStack(168+16) ≈ **950pt+**，6.1" 机型（可视 ~800pt）会把「今日任务」挤到折叠线下。**建议同时**把 `TodayStack` 高度从 168 压到 ~150，或网格只留 2 项（后者的收益已包含在"摘掉学习/运动"里）。

**影响面**：`focus-timer.tsx`（新增 props，**所有既有调用点保持默认行为不变**）、`today.tsx`、`daily-os-summary.tsx`、`today-stack.tsx`、新增 `quick-start-sheet.tsx`、`app-store.ts`（`addSportSeconds`）。
**验收**：首页一个按钮 → 选学习/运动/秒表 → **无需再点一次"开始"**即进入计时；倒计时页**默认是当天 Bing 风景照**且文字清晰；离线时回落到深色底不崩；学习结束写 `sessions`、运动结束写 `exerciseLogs`（秒表秒数不丢）。

---

### P2-5 输入法遮挡输入框

**现象**：需要输入时键盘总是盖住输入框，看不到输入内容。

**根因（三层，全部已核实）**
1. 全项目**只有 2 个文件**做键盘适配：`components/bottom-sheet.tsx:192` 与 `components/auth-sheet.tsx:138`，且都是 `behavior={Platform.OS === "ios" ? "padding" : undefined}` → **Android 上等于空壳**。
2. `BottomSheet` 的高度是**挂载时按窗口高度算死的像素值**（`bottom-sheet.tsx:76-79, 177`：`collapsed = winH * ratio`），键盘弹出不会重算；RN 的 Modal 在 Android 只给 Dialog 设了 `ADJUST_RESIZE`（`ReactModalHostView.kt:332`），**不会把尺寸变化回灌给 `useWindowDimensions()`** → 弹层下半部分（含保存按钮）被键盘盖住。
3. 另有 **6 处自绘弹层完全无适配**：`trackers.tsx:276-343`（自绘绝对定位遮罩）、`jobs.tsx:286/365`（裸 Modal + 技能输入）、`interview.tsx:111/118`、`focus-timer.tsx:356/400/534/563`；以及 **6 处内联表单**：`logs.tsx:81`（多行日志）、`tasks.tsx:84`、`roadmap.tsx:167`、`market.tsx:353`、`domain-manager.tsx:312`、`account-security.tsx:195`。
4. Android 侧 `windowSoftInputMode="adjustResize"`（`apps/mobile/android/app/src/main/AndroidManifest.xml:18`）在 Activity 层**当前是有效的**（因为我们 targetSdk 35 + `windowOptOutEdgeToEdgeEnforcement=true`，已退出 Android 15 强制 edge-to-edge）；`app.json` 未声明 `softwareKeyboardLayoutMode`（缺省 resize）。**但一旦将来 targetSdk 提到 36，该开关被忽略，键盘问题会全面复发。**

**方案（默认走 A，零新依赖）**
- **A（推荐）**：
  1. `BottomSheet` 改成**键盘感知**：监听键盘高度（`Keyboard` 事件）→ `sheetHeight = min(collapsed, availableHeight - keyboardHeight)`，并给 Android 也启用 `behavior="padding"`；内容区 `keyboardShouldPersistTaps="handled"`。
  2. 6 处自绘弹层**统一改用 `BottomSheet`**（顺带统一视觉，也解决第 5 项"弹层太丑"的一部分）。
  3. 内联表单给宿主 ScrollView 加键盘内边距（iOS `automaticallyAdjustKeyboardInsets`、Android 依赖 `adjustResize`），必要时把表单也改成弹层。
  4. **构建脚本加断言**：`AndroidManifest.xml` 必须为 `android:windowSoftInputMode="adjustResize"`（防某次 prebuild 回退）。
- **B（可选的长期方案）**：引入 `react-native-keyboard-controller`（新的**原生**依赖，需要重跑 gradle；`android/` 不进 git，靠构建脚本幂等修补）→ 真实键盘 insets，为将来 targetSdk 36 铺路。

**影响面**：所有含输入的页面/弹层；改 `BottomSheet` 属核心组件，需全量回归 14 个使用点。
**验收**：登录、饮食录入、体重/目标、训练记录、任务新建、习惯、证书、简历 —— 输入框与保存按钮**始终可见**（Android + iOS）。

---

### P1-6 饮食页离线提示与"流量开着传不上"

**现象**：加午餐时每次都弹「已记载，本机当前网络不可用，联网后会自动补发」；而且移动数据是开的。

**根因（关键：这句提示与网络状态无关）**
- 触发点：`apps/mobile/src/app/nutrition.tsx:321`（一点即记）、`:371`（按份量）、`:451/:498`（删除/编辑）。
- `sendOp`（`nutrition.tsx:164-190`）对 create/update/delete **一律 `return r.ok`**，`catch { return false }`：**任何非 2xx（400/401/404/500）或任何 fetch 异常，都被当成"网络不可用"**，且**不读响应体、不记日志** → 真实原因在端上完全不可见。
- `lib/nutrition-outbox.ts` 全文**没有 NetInfo/联网判定**；`sync-engine.ts:46-48` 的联网判断（`type !== NONE && isInternetReachable !== false`）**只服务 app-store 的 pendingChanges 队列，与饮食发件箱无关**。
- 补发时机**只有进入/刷新饮食页**（`nutrition.tsx:193-207` 的 `flushPending` ← `load()`）；"联网后自动补发"目前只对了一半。
- **可能的真凶之一（值得单测）**：包内实测 `usesCleartextTraffic="false"`（合并清单 `:64`），而 `app.json:48` 的 build-properties 写的是 `true`；`src/config.ts:17-21` 允许设置页运行时改 `apiUrl`。**如果这台手机把服务器地址改成了 `http://…`，所有写请求会被系统直接拒绝，表现就是"网络不可用"** —— 需要向测试者确认是否改过地址。

**方案**
1. **不再无脑弹窗**：把 `sendOp` 返回值从 `boolean` 改为 `{ ok: true } | { ok: false; kind: "offline" | "http" | "auth"; status?; error? }`：
   - `offline`（fetch 抛异常 / `Network.getNetworkStateAsync()` 明确无网）→ **静默入队**，只靠列表里已有的「待同步」灰点（`nutrition.tsx:757/785` 的 `isPending`）反馈；
   - `http`（非 2xx）→ **读 `r.json().error` 并把服务端原因显示给用户**（不再说"网络不可用"）；4xx 明确不可重试的**不入队**（否则"待同步"永远不消失）；
   - `auth`（401）→ 提示登录。
2. **后台自动补发**：把 outbox flush 抽成独立模块，挂到 `sync-engine` 的网络恢复 / 回前台回调（现在只有进页面才补发）；给 `flushOutbox` 加**指数退避 + 最大次数 + 跳过毒丸**（现状 `nutrition-outbox.ts:207` 一条永久失败会堵住整条队列）。
3. **排查 cleartext 矛盾**：统一为"生产 https + `usesCleartextTraffic=false`"，并禁止设置页填 `http://`（或明确提示"仅调试用"）。
4. 保留"离线优先"语义：**弱网/断网时仍然先落本机、不丢数据**。

**影响面**：`nutrition.tsx`、`lib/nutrition-outbox.ts`（`flushOutbox` 契约变更 → 需同步改 `nutrition-outbox.test.ts`）、`lib/sync-engine.ts`。
**验收**：断网加一条 → **不弹窗**、列表显示待同步、恢复网络 30 秒内自动补发；服务端 4xx → 明确提示服务端原因；流量在线时**直接成功、不出现任何离线文案**。

---

### P4-7 饮食页 日 / 周 / 月 + 月历汇总 + 「吃一点」UI 复刻

**现象/需求**：①现在只能按周；②顶部要有 日/周/月 切换；③点"日"→ 今天/昨天卡片（喝了多少水、吃了什么）；④点"周"→ 一排；⑤点"月"→ 整月日历，每格下面汇总当天摄入 kcal；⑥「吃一点」添加饮食 UI 太简单/不好看，按你上传的截图（吃一点 App）复刻：圆润、美观、焦点集中。

**现状（好消息：后端零改动）**
- 日期切换 = `components/day-strip.tsx`：固定 **7 天窗口**、`‹ ›` 按周翻页、**最多回看 4 周**（`DAY_STRIP_MAX_WEEKS = 4`），`scrollEnabled={false}`（`:104`）。
- 后端已具备：`GET /api/nutrition/summary?days=1..31&end=YYYY-MM-DD` **返回逐日 `{date,kcal,proteinG,carbsG,fatG,entryCount}`**（`summary/route.ts:6,16-17,29-43`）——**31 天正好够整月，还支持 `end` 锚点查任意历史月**。
- **而且客户端已经在拉这份数据却把 kcal 丢掉了**：`nutrition.tsx:212` 请求 `?days=28`，`:222-224` 只留 `entryCount` 画 ✓。月视图只需改成按视图算天数 + 保留完整字段。
- `meal_entries` 有 `log_date date` + `idx_meal_entries_user_date ... WHERE deleted_at IS NULL`（`db/schema.sql:1114-1134`）→ 按月 range 查询走索引。
- 可复用日历：`learn.tsx:122-131 monthGrid()` + `:133-207 MonthCalendar`（整月网格 + 上下月翻页）以及 `:95-120 buildHeatmap/heatColor` —— **目前定义在页面文件里，需要抽到 `components/`**。

**方案（分两步走，先 P1 再做进阶）**

**P4-a · 视图与信息结构（本轮必做）**
1. 抽出 `components/month-calendar.tsx`（从 `learn.tsx` 迁移 `monthGrid` + `MonthCalendar`，支持 `renderDayBadge` 回调挂"当天 kcal"）。
2. 饮食页顶部加 **日 / 周 / 月 分段控件**（圆角胶囊，参考你上传图中"日周月年"那条）：
   - **日**：新增"今天 / 昨天"两张摘要卡（喝水 ml + 摄入 kcal + 最近几条饮食），即你说的"桌面会旋转弹出一个卡片"——落成页面顶部的**摘要卡**而不是真旋转弹窗（更稳、也符合"焦点集中"）。
   - **周**：现有 `DayStrip` 一排（保留 ✓ 标记，可加密 kcal）。
   - **月**：`MonthCalendar` + 每格 `kcal` 汇总，点某天 → 切回日视图并加载那天。
3. 数据侧：按视图算 `days`（月视图 = 该月天数，≤31，用 `new Date(y, m+1, 0).getDate()` 精确算，避免 31 天窗口带出上月数据）；`summary` 结果保留完整字段。

**P4-b · 「吃一点」UI 复刻（从你 8 张参考图提炼的设计语言）**

| 设计要素 | 参考图 | 我们现在的对应物 | 复刻方式 |
|---|---|---|---|
| **时间线**：左侧细竖线 + 节点圆点；每行「日期 时间（品牌绿）→ 食物名 → 副标题」 | 图2/3 | `nutrition.tsx` 餐次时间线（已有雏形） | 重排为**单列时间线**，日期时间用主题绿/品牌色 |
| **食物贴纸**：白边描边 + 微旋转 + 阴影，居中偏右 | 图2/3 | `components/food-sticker.tsx`（已有） | 给贴纸加**白边描边 + 轻微旋转**（贴纸感），尺寸统一 |
| **kcal 橙色数字**：贴纸右下角 | 图2/3 | `components/kcal-badge.tsx`（已有） | 定位到贴纸右下 + 加粗橙色 |
| **顶部摘要胶囊**：`1,549 kcal ⓢ ｜ — kg ｜ ＋` | 图2 | `MacroMiniRings` + 剩余热量 hero | 收敛成**一行胶囊**（kcal · 体重 · ＋），把三微环降级到展开态 |
| **日/周/月 分段控件** | 图1/统计图 | 无 | 新增（P4-a） |
| **月历 + 每日缩略** | 图6（Food Calendar） | 无 | `MonthCalendar` + 每格 kcal 或小图 |
| **统计页**：7 天曲线 + 6 个月点阵热力图 | 图6 | 无 | **P4-c（进阶）** |
| **喝水**：水杯液位动画 + 250ml 快捷值 | 图8 | `components/water-card.tsx`（已有，是进度条） | **P4-c** 复刻液位动画 |
| **LiveLog**：贴纸自由拖拽 + 背景图 + 工具条 | 图4/5/7 | `sticker-book.tsx`（收集册） | **P4-c**（工作量最大） |

**P4-c · 进阶项（本轮先不做，等你看到 P4-a/b 效果再决定）**：7 天曲线、6 个月热力图、Food Calendar 缩略图、水杯液位动画、LiveLog 自由拖拽贴纸。

**关于"直接抄开源项目代码"**：建议**抄设计、不抄代码**——① 竞品 UI 代码多有许可/版权风险；② 我们已有 `food-sticker`/`kcal-badge`/`MonthCalendar`/`BottomSheet` 等可复用件，自己实现能保持主题一致与包体不变；③ 若确实要移植开源组件（如 `react-native-calendars`、图表库），必须新增依赖并登记 `docs/THIRD_PARTY.md`。**这一条我按"不新增依赖、自研复刻设计"来估工，如需引库请在第 2 节决策点告诉我。**

**影响面**：`nutrition.tsx`、`day-strip.tsx`、新增 `month-calendar.tsx`；`learn.tsx` 抽出日历组件（需回归学习页的日期选择）。**后端 0 改动、0 迁移**。
**验收**：日/周/月 三视图切换流畅；月视图每格显示当天 kcal 且能点进去；日视图一眼看到"今天喝了多少水/吃了什么/还能吃多少"；添加饮食的弹层与时间线为"圆润 + 焦点集中"的同一套语言。

---

### P3-8 训练记录（动作删除 · 弹层重做 · 动作下拉）

**现象/需求**：①添加动作后无法删除；②弹出来的记录训练页面太丑；③动作应能下拉选择；④或在添加动作时弹小弹窗选"动作 / 组数 / 每组次数"。

**根因**
- **不能删 = 纯 UI 缺失**：`apps/mobile/src/app/workout.tsx:145-179` 的动作行只有 4 个 `TextInput`（动作/组/次/kg），**没有删除按钮**；全文件只有 GET 与 POST（`:52`、`:85-89`），无 PATCH/DELETE 调用。
- **后端已够用**（无需新接口）：
  - `PATCH /api/workouts/[id]`（`apps/web/app/api/workouts/[id]/route.ts:15-91`）：**传 `items` 即"先删后插"整组替换** → 删一条动作 = 用剩余行整体 PATCH；
  - `DELETE /api/workouts/[id]`（`:94-104`）：软删整次训练（`workouts.deleted_at`）；
  - Web 端已有现成实现可照搬（`apps/web/app/wellbeing/workout/page.tsx:250-256` 单行动作删除、`:165-167` 整次删除）。
  - 缺的只有 item 级路由（`/items/[itemId]`）——**不必新增**。
- **弹层丑**：`workout.tsx:140-190` 是 `BottomSheet` 里直接堆 4 个裸 `TextInput` + 一个 ghost 按钮，无分组、无步进器、无图标；且它也是"Android 键盘遮挡"的重灾户（见 P2-5）。
- **动作字典不足**：现有 `SPORT_CATALOG`（`packages/shared/src/index.ts:628-665`，33 项）是**运动/活动**目录（篮球、跑步、深蹲…），力量类只有几项，**不是健身房动作字典**（没有卧推/硬拉/划船）。`GET /api/sports` 可直接读它且**无需鉴权**。
- **无离线队列**：`SyncEntityType`（`app-store.ts:11-19`）不含 `workouts`，断网 `save()` 直接 `Alert("保存失败")`（`workout.tsx:94-95`），与饮食页的离线优先策略不一致。

**方案**
1. **动作行加删除**（最小改动，立刻可用）：每行右侧 `trash-outline` 图标按钮，最少保留 1 行；`Alert` 二次确认。
2. **弹层重做**（视觉与交互）：
   - 顶部：训练名称（默认"今日训练"）+ 日期选择（现在是写死今天，`workout.tsx:28-31`）；
   - 中间：动作行 = **动作名（可点击 → 动作选择面板）+ 组数/次数/重量步进器（±）+ 删除**；
   - 底部：主按钮「保存训练」（固定在键盘之上，依赖 P2-5 的键盘适配）。
3. **动作下拉/弹窗选择**：新增 `components/exercise-picker-sheet.tsx`：
   - 分类 Tab（复用 `exerciseTypeOptions`：球类/有氧/力量/拉伸/移动/其他）+ 搜索框；
   - 数据源 `GET /api/sports`（服务端空表时回退 `SPORT_CATALOG`），**允许自由输入自定义动作名**（`exercise_key` 可空）；
   - 参考 Web 端 `apps/web/components/sport/exercise-sheet.tsx:24-70` 的模块级缓存写法。
   - **「添加动作」小弹窗**（你提的第二种交互）与此面板合并：选中动作后在同一弹窗里填"组数 / 次数 / 重量"→ 确认即追加一行。
4. **整次训练删除/编辑**：详情弹层加删除（`DELETE /api/workouts/{id}`），并支持编辑（`PATCH`，含 items 整体替换）。
5. **可选（决策点）**：给 workouts 也做本地队列（进 `SyncEntityType` + `/api/sync`，`client_id` 幂等索引已就绪 `db/schema.sql:1078-1079`）——**代价是同步协议扩展**，建议单独一轮做。

**影响面**：`workout.tsx`、新增 `exercise-picker-sheet.tsx`；后端 0 改动；若做健身房动作字典则需**追加迁移 + 种子**（`db/migrations/046_*`）。
**验收**：能加动作、能删单行动作、能删整次训练、能编辑已存记录；动作可下拉/搜索选择也可自由输入；弹层在键盘弹出时不被遮挡。

---

## 2. 需要你确认的决策点

| # | 决策 | 选项 | 我的建议 |
|---|---|---|---|
| **D1** | 键盘适配路线 | **A** 零依赖（改 `BottomSheet` + 自绘弹层统一改用 `BottomSheet` + 内联表单补偿）／ **B** 引入 `react-native-keyboard-controller`（新原生依赖，长期更稳，为 targetSdk 36 铺路） | **A**，B 留到 targetSdk 36 时再做 |
| **D2** | 训练记录范围 | **A** 删除 + 弹层重做 + 动作下拉（用现有 `SPORT_CATALOG` + 自由输入）／ **B** A + 新建"健身房动作字典"（追加迁移 + 种子，动作带肌群/器械） | **A**，B 等你还想要"肌群统计"时再做 |
| **D3** | 饮食 UI 复刻深度 | **A** P4-a（日/周/月 + 月历 kcal）+ P4-b（时间线 + 贴纸/kcal 呈现 + 摘要胶囊 + 分段控件）／ **B** A + P4-c（7 天曲线、6 月热力图、Food Calendar 缩略图、水杯液位动画、LiveLog 拖拽贴纸） | **先 A**，看到效果再定 C |
| **D4** | 是否引入开源库 | **A** 不新增依赖，自研复刻设计 ／ **B** 允许引入（如 `react-native-calendars`、图表库），并登记 `THIRD_PARTY.md` | **A** |
| **D5** | 一键开始的默认行为 | **A** 点大按钮 → 弹层选「学习 25 分钟倒计时 / 运动 / 正向计时」，选完**立即开始**（不再二次点击）／ **B** 点大按钮直接开始 25 分钟学习倒计时，"运动/秒表"放进长按或次级入口 | **A**（与你描述一致，且最可控） |
| **D6** | 运动计时落库 | **A** 新增 `addSportSeconds`（秒表秒数不丢）／ **B** 沿用 `addSport(minutes)` 取整（45 秒会变 1 分钟） | **A** |
| **D7** | cleartext/自定地址 | **A** 统一"生产 https + 禁 http"，并把设置页的自定义地址标注为"仅调试"／ **B** 保持现状 | **A**（这可能正是"流量开着也传不上"的真凶之一） |
| **D8** | 首页首屏高度 | **A** 同时把 `TodayStack` 轮播卡从 168 压到 ~150，保证「今日任务」在首屏可见 ／ **B** 不动轮播 | **A** |

> 另外想请你帮我确认一件事（影响第 P1-6 的排查）：**内测那台 OPPO 手机，在「我的」页里有没有把服务器地址改成过 `http://…`？** 若有，那"流量开着也传不上"就有了直接解释，我们会顺手在设置里禁掉明文地址。

---

## 3. 本轮不做 / 推迟

| 项 | 原因 |
|---|---|
| 任务优先级字段（让"最重要的一件事"名副其实） | 需要动 store + `/api/sync`，风险大于收益，先用"第一个未完成" |
| workouts 离线队列 / 进同步协议 | 同步协议扩展应单独一轮，避免本轮改动面过大 |
| 健身房动作字典（肌群/器械/PR 统计） | 需要追加迁移 + 种子，等 D2 结论 |
| LiveLog 自由拖拽贴纸、水杯液位动画、6 个月热力图 | P4-c，等你确认 UI 方向后再排 |
| 引入 `react-native-keyboard-controller` | 等 D1；也等 targetSdk 36 的评估 |

---

## 4. 验收标准（逐项可自测）

| 阶段 | 验收 |
|---|---|
| P1 | ①招花卡片间距 12/留白 16；②学习页拖动时卡片浮在最上层、其它卡让位、落位准确、拖动中不滚页；③任务页首屏 1 个 hero + 「今日任务」进度条；④断网加饮食**不弹窗**、恢复网络自动补发、在线时不再出现"网络不可用" |
| P2 | ⑤首页大按钮 → 选学习/运动/秒表 → **直接开始计时**；⑥倒计时页**默认当天 Bing 风景照**且文字清晰、离线回落深色不崩、老用户也能看到新默认；⑦学习写 sessions、运动写 exerciseLogs（秒数不丢）；⑧所有输入框/保存按钮在键盘弹出时可见（Android + iOS） |
| P3 | ⑨训练记录：加/删单行动作、删整次、编辑、动作下拉与自由输入、键盘不遮挡 |
| P4 | ⑩日/周/月 三视图；⑪月历每格显示当天 kcal 且可点入；⑫日视图一眼看到"喝水/吃了什么/还能吃多少"；⑬添加饮食弹层与时间线视觉统一（圆润、焦点集中） |
| 回归 | 每阶段：mobile 单测 + typecheck + lint 全绿；出包用 `aapt2` 核验版本/权限/16KB/签名；**不影响其它品牌**（无厂商分支、无新原生依赖）；老版本 APK 保留可回滚 |

---

## 5. 风险与回滚

| 风险 | 缓解 | 回滚 |
|---|---|---|
| `BottomSheet` 是 14 处在用的核心组件，改键盘逻辑可能引入回归 | 先加"键盘感知高度"并逐点回归（重点：登录/饮食/体重/训练/习惯） | 单文件 revert |
| 拖拽实时让位在低端机上掉帧 | 全部位移在 UI 线程；`onUpdate` 不跨线程 setState；卡片数量有限（非虚拟列表） | 让位动画可用常量开关关闭，退化为"仅抬层级 + 松手落位" |
| Bing 壁纸首帧慢/失败 | 预取 + 占位色 + `expo-image` 磁盘缓存；接口侧今日缺图回退历史图 | 设置里可切回纯色 |
| 老用户 AsyncStorage 里存了 `sunset`，新默认不生效 | 加一次性迁移标记（`K_GALLERY_VERSION`） | 迁移逻辑可移除 |
| 首页新增按钮把「今日任务」挤出首屏 | 同阶段压缩 `TodayStack`、网格减为 2 项 | 调整间距即可 |
| 饮食发件箱改契约可能影响既有单测 | 同步改 `nutrition-outbox.test.ts`，并补"4xx 不入队/毒丸跳过"用例 | 保留旧的 `boolean` 适配层 |
| 抽 `MonthCalendar` 影响学习页 | 抽组件时保持 props 兼容，学习页改用 `<MonthCalendar>` 后回归日期选择 | 保留学习页内旧实现一个版本 |
| 出包/发布 | 每阶段 `git commit`；APK 阶段出包并保留上一版可回滚；文档与看板同步 | 回滚到上一版 APK |

---

## 6. 执行顺序与提交节奏

```
P1（快速止血，1 个内测包 v1.4.0）
  ├─ 招花卡片间距（jobs.tsx）
  ├─ 学习页拖拽层级 + 实时让位（learn.tsx）
  ├─ 任务页焦点层级（tasks.tsx）
  └─ 饮食离线提示与自动补发（nutrition.tsx + nutrition-outbox + sync-engine）
P2（一键开始 + 键盘，v1.4.1）
  ├─ FocusTimer 新增 props + 默认 Bing + 预取/缓存 + 遮罩可读性
  ├─ 首页大按钮 + QuickStartSheet + 网格去重 + TodayStack 压缩
  └─ BottomSheet 键盘感知 + 自绘弹层统一 + 构建脚本断言
P3（训练记录，v1.4.2 或并入 P2）
  └─ 动作删除 + 弹层重做 + 动作选择面板
P4（饮食 UI，v1.5.0）
  ├─ P4-a 日/周/月 + 月历 kcal
  └─ P4-b 时间线/贴纸/摘要胶囊复刻
```

每个阶段：`pnpm -F mobile test` + `typecheck` + `lint` 全绿 → 出包 → `aapt2` 核验 → 内测包上传 + 门户版本号更新 → 文档与看板记录 → git 提交推送。
