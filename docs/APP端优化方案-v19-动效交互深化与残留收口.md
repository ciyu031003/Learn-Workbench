# APP端优化方案-v19 · 动效交互深化与残留收口（2026-09-27）

> **触发**：v17/v18 全部落地（v1.28.0/43 → v1.28.2/45，含两次真机热修）后的第二轮复审。
> **复审方式**：导航栈 / TabBar / 吸顶栏 / tokens / motion 库逐文件精读 + 全部 23 页与 68 组件的动效·触觉·配色普查。
> **结论**：骨架（导航栈、真吸顶、字阶/配色 token 化、错峰纪律、刷新统一）落地质量高；剩余缺口高度集中——**动效 token 齐全但覆盖面不足**（数字/勾选/圆环三件套、Tab 内容过渡、Layout 转场、触觉空白页）、**jobs 单页系统性欠账**、**旧土色残留**、少量稳定性隐患。
> **新增红线**（来自热修 64422a9 的真机教训）：**FlashList v2 的虚拟化列表项上禁止挂 `entering` / `layout` / 任何依赖 `index` 的 useEffect 动画**——item 回收复用发生在动画进行中会在原生层崩溃，且复用拿到新 index 会重放动画。列表动效只允许出现在非虚拟化容器（ScrollView 内 map / 小 FlatList）。

---

## v19.0 复审快照（哪些已经好，哪些还差）

**已达标（不再动）**：根 Stack + 原生转场 + 侧滑/预测性返回（`app/_layout.tsx:148-182`）；真吸顶三件套且 worklet 干净（`screen-header.tsx`）；TabBar 材质两档（iOS26 GlassView / 其余实底，D3 决策不引 expo-blur）+ tabPress 触觉 + 图标弹跳；暖中性配色 v2 + textSecondary 灰阶 + 中性投影；字阶基线棘轮；pull-refresh 纯函数化；错峰基建 `lib/stagger.ts`（shouldStagger 守卫 + STAGGER_MAX）；SPRING 四档弹簧 token；splash 渐隐；AnimatedCheckMark / ProgressArc / CelebrationModal 单点质量都好。

**还差的三类**（详见下文清单）：
1. **覆盖面**——动效组件都造好了，但只接了 1-2 个点：`AnimatedNumber` 全 App 仅 3 处消费（nutrition/water/weight），today 统计格、tasks 统计格、jobs 统计行全是死数字；`AnimatedCheckMark` 只有 today 在用，tasks 还是文本 `✓`（tasks.tsx:181）、habits 还是静态图标（habits.tsx:331）；`SPRING.sheet` 定义了但 bottom-sheet 还在用纯 timing（`bottom-sheet.tsx:26-27,177-184`）；`beatOnChange`/`pulseKey` 只有 nutrition 传了（wellness.tsx:251、career.tsx:121、daily-os-summary.tsx:202 没传）。
2. **Tab 切换内容零过渡**——5 个 hub 里 learn/wellness/settings 无任何入场（FadeIn 消费者只有 today/career），Tab 间切换是瞬时硬切，是当前与 iOS 质感差距最大的一条。
3. **反馈链断裂**——7 个页面零触觉（jobs/roadmap/logs/applications/certificates/resume/interview）；全仓库 `exit=` 为 0（删除没有任何退场表达）；`layout=`（增删补位转场）仅 4 处。

---

## v19.1 动效设计总纲（一页纸）

> 原则：**响应优先，装饰其次**。每个可点元素必须有 <100ms 的按压/触觉反馈；每个数据变化必须有 150-400ms 的过渡；常驻动画每屏 ≤1；能用局部反馈（行内 ripple/勾选 pop）就不用全屏弹窗——iOS 的满足感来自"点哪哪应"，不是"到处在动"。

| 交互事件 | 动效 | token / 组件 | 触觉 |
| --- | --- | --- | --- |
| 按压任意可点元素 | 缩放 0.96~0.98 | `PressableScale`（补齐缺的 8 处） | light |
| 勾选 / 完成 | 对勾描边 + 1.18 pop | `AnimatedCheckMark` | success |
| 数字变化 | 滚动计数 | `AnimatedNumber` / `Stat` 内置 | — |
| 进度条变化 | 宽度/填充 240ms 缓动 | 新 `BarProgress` | — |
| 圆环入场/变化 | 生长 + 数值跳变 beat | `ProgressArc`（beatOnChange 补传）/ `RingProgress`（补入场） | — |
| 列表增删 | 补位滑动 | `layout={LinearTransition}` | 删 warning |
| 首屏入场 | FadeInDown 错峰 ≤12 项 | `lib/stagger` + 新 `useScreenEntrance` | — |
| 弹层出入 | 弹簧上滑 + 遮罩淡入 | `SPRING.sheet`（接入 bottom-sheet） | 开 soft |
| Tab 切换 | 即时切换 + 首次挂载入场错峰 | （Tab 本体不加动画） | soft（已有） |
| 收藏/星标 | 弹簧放大 1.3→1 + 变色 | `SPRING.snappy` | success |

---

## v19.2 改造清单

### M1 · Tab 切换内容过渡（P1，差距最大的一条）
- learn / wellness / settings 三个 hub 补齐 today/career 同款首屏错峰；**Tab 本体不加转场动画**（原生 Tab 切换本该即时，iOS 也如此），过渡感来自每个 hub 首次挂载的入场——Tab scene 常驻不销毁，切回不重放，行为正确。
- 顺手把"reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))"这个三页重复的三元式收敛为 `useScreenEntrance(index)` hook（内部封装 `useReducedMotion` + STAGGER_MAX），全 App 入场写法归一。

### M2 · 数据变化三件套全覆盖（P1）
- **数字滚动**：`stat.tsx` 的 `Stat` 组件加 `animated?: boolean`（默认 true，内部接 AnimatedNumber），learn/career/wellness 记分牌一次性受益；today statsGrid（today.tsx:690-705）、tasks statGrid（tasks.tsx:212-222）、jobs statsRow（jobs.tsx:598-611）、nutrition summaryPill（nutrition.tsx:1030-1059）逐点替换。
- **进度条**：新增 `BarProgress`（Reanimated 驱动，`withTiming(DURATION.base)`），替换裸 `width:${pct}%` 四处：tasks.tsx:163、nutrition.tsx:1280-1289、update-sheet.tsx 进度条、tasks 14 天柱状图（柱子加 entering + 高度过渡）。
- **圆环**：`ring-progress.tsx:59` 补入场生长（initial=arcLen → withTiming(target)，对齐 progress-arc 的既有模式）；wellness/career/daily-os-summary 的 ProgressArc 补传 `beatOnChange`/`pulseKey`。

### M3 · 打卡完成反馈链（P1）
- tasks.tsx:181 文本 `✓` 与 habits.tsx:331 静态 `checkmark` 统一换 `AnimatedCheckMark`（组件现成，今天就能换）。
- 新增 `SuccessBurst` 微组件：勾选瞬间在被点的那一行做"圆环扩散 ripple + 勾 pop"（500ms，worklet 驱动，减弱动态降级）——habits 打卡的过程反馈用它，**不弹全屏**；celebration-modal 只保留给"当日全部完成"的里程碑时刻。
- 配套触觉：勾选 `haptics.success()`、取消 `haptics.soft()`。

### M4 · 列表增删转场补全（P2）
- `layout={LinearTransition}` 补到：today 运动明细、logs、market、applications、interview、certificates、radar 分页列表（全部确认非 FlashList 容器；jobs 的 FlashList **永不加**，见红线）。
- 删除反馈：today 运动明细（today.tsx:738-740）与 tasks 采用"先缩后删"两段式（150ms `scale→0.95 + opacity→0` 再 setState），删除后由 LinearTransition 补位塌陷；配 `haptics.warning()`。

### M5 · 触觉补全（P1，工作量最小收益最大）
七个零触觉页面的关键点位：
- jobs：收藏切换 success、筛选 chip soft、进入详情 light；
- tasks「开始专注」soft；roadmap 阶段展开 soft；logs 提交 success；
- applications 状态推进 success；certificates 保存 success；resume 保存 success；interview 切题 soft。
- 全局：下拉刷新触发时刻 light、数据返回 success（`use-pull-refresh.ts` 内两行）；today 运动明细删除 warning。

### M6 · 弹层动效统一（P2）
- `bottom-sheet.tsx` 出入场从纯 timing 换 `SPRING.sheet`（token 已就绪：damping≈25.5/stiffness 220）：入 `withSpring(0, SPRING.sheet)`、出保持 timing 180ms（退场快是 iOS 惯例，弹簧只给入场）；Pan 释放回弹同款弹簧。
- focus-timer 全屏 Modal、celebration 卡片入场统一为"容器 fade + 内容弹簧缩放"一套语言；update-sheet 进度条接 M2 的 BarProgress。

### M7 · 按压反馈补全 + jobs 归一（P1/P2）
- `PressableScale` 补到：tasks 全部行与主按钮、meal-card-grid 四张餐次主卡（66-130）、interview 题卡（241）、month-calendar 日期、day-strip 导航钮、logs 行。
- jobs.tsx 删除自造的 `ScalePressable`（78-111）改用 PressableScale；收藏心形换 token 色 + `SPRING.snappy` 弹跳（1→1.3→1）+ success 触觉。

### M8 · 微交互包（P3，锦上添花，按余力做）
- TabBar 当前 Tab **再点一次回顶**：`screenListeners` 里对已聚焦 tab 做 `scrollTo` 顶（需 hub 暴露 scroll ref 或走事件总线）——iOS 系统级心智，成本低。
- expo-image 补 `thumbhash` placeholder：优先 sports-card 图鉴（图片最密集），弱网从"空白→淡入"变"模糊→清晰"。
- 下拉刷新可做自定义头部（Hub 页顶部下拉露出品牌小太阳）——**可选项**，系统转圈已是及格线，投入产出比低，放最后。

---

## v19.3 视觉残留收口

- **V1 旧土色清理（P1）**：roadmap.tsx:243-282（旧橙 `#e8930c`×4 + 绿红三色）、wellness.tsx:46/50（`#E1781C`——tokens 注释里点名批评过的"土三大来源"仍在健康 hub）、tasks.tsx:386-417 五处、trackers.tsx:47-48 十色数组、jobs.tsx 13 处 + job-detail-modal.tsx 9 处旧 tailwind 色。做法：阶段 A 已建 `chart` 数组，扩为 `chart/chartSoft` 两档并在 tokens.ts 增加语义别名（如 `stageColors`），逐页替换后 lint 禁裸 hex（复用基线棘轮思路，新建 `docs/color-baseline.json`）。
- **V2 暗色漏面（P2）**：today.tsx:840 quickStart 背景硬编码 `#2F74C0`（暗色下主色是 `#6FA8E0`，按钮不变色）→ `colors.primary`；`(tabs)/_layout.tsx:161` TabBar 高光描边固定 `rgba(255,255,255,0.34)` → 浅色下改 `rgba(255,255,255,0.5)`、深色 `0.22`（跟随 dark 传入）。
- **V3 硬编码阴影（P2）**：jobs.tsx:817/872/885 `#000` → `shadows.card`；learn.tsx:1266/1306、phase/[id].tsx:274 的 `#14548D` 品牌藏青影收进 shadows token（新增 `brand` 档）。
- **V4 棘轮收紧（P3）**：现豁免 208 处裸 fontSize（sports-card 37 / jobs 28 / radar 18 / market 17 / interview 15 为大头），V1 清理时顺手 `--update` 收紧基线；`check-font-scale.mjs:19` 把 `components/**` 纳入扫描（组件库目前不设防）。

## v19.4 稳定性修复

- **S1 jobs 列表动画回收重放（P1，红线同源）**：JobCard 内 `useEffect([index])` 驱动的入场动画在 cell 回收复用拿到新 index 时会重放（jobs.tsx:162-165），滚动全程反复触发。修法：删掉该 effect 与内部动画，jobs 列表遵守"FlashList item 无入场"红线（可接受的替代：给 JobCard 一个 `appearing` 态由**父层首帧**统一控制，item 复用不感知）。
- **S2 FlashList 底部留白丢失（P2）**：jobs.tsx:753 传了 v2 不消费的 `contentContainerStyle`；改用 `ListFooterComponent` 撑底或外层 View padding。
- **S3 吸顶高度双源（P2）**：`pull-refresh-core.ts:10` 与 `screen-header.tsx:52` 各写一份 44——让前者 `import` 后者常量（纯函数单测仍可跑，因为 screen-header 顶部常量区不依赖 RN 组件），并加一条断言两值相等的单测。
- **S4 CelebrationModal 自关计时器（P3）**：effect 依赖内联 `onClose`（today.tsx:818-822 每渲染新箭头）导致父渲染重置 3.4s 计时——`onClose` 存 ref 再消费。
- **S5 死代码清理（P3）**：旧版 `ScreenHeader` 组件 ~120 行全仓库零消费（screen-header.tsx:98-219）、`compactOnly` 残渣（:369-370）、根 `_layout.tsx:46-50` makeStyles 残渣，一并删除。

## v19.5 执行阶段

| 阶段 | 内容 | 工作量 |
| --- | --- | --- |
| **E · 动效基建 + P1** | M1 useScreenEntrance + 三 hub 接入；M2 三件套；M3 勾选链 + SuccessBurst；M5 触觉；S1 | 1.5–2 天 |
| **F · 覆盖面铺开** | M4 转场补全；M6 弹层统一；M7 按压/jobs 归一；V1–V3 视觉收口 | 2 天 |
| **G · 收尾** | M8 微交互；V4 棘轮收紧；S3–S5 | 1 天 |

每阶段照惯例：`pnpm -F mobile typecheck` + `pnpm -F mobile test` 全绿 → 真机（release 包）过「减弱动态开/关 × 浅色/深色」四象限；M4/S1 涉及列表动效与 jobs 页，按踩坑 71/78/79 流程在 OPPO 真机重点回归 FlashList 快速滚动与回收（这正是 64422a9 闪退的现场）。

**发布门槛**：E 阶段完成后先发一版（动效收益最直观）；F/G 合并发布。版本建议 v1.29.0 / versionCode 46 起。

## v19.6 验收标准

1. 五个 hub 首次进入均有错峰入场；Tab 切换即时无闪白。
2. 全 App 无"死数字"：统计格、进度条、圆环的值变化均有 150-400ms 过渡。
3. tasks/habits/today 三处打卡反馈统一（描边勾 + 局部 SuccessBurst + success 触觉），里程碑才弹全屏庆祝。
4. 七个零触觉页面补齐触觉；全 App 无裸 Pressable 可点区域（按压均有缩放反馈）。
5. bottom-sheet 出入场为弹簧；celebration/focus-timer 同一套语言。
6. 仓库内旧 tailwind 色 / 裸 hex / `#000` 阴影清零（color 基线棘轮守护）。
7. jobs FlashList 上不存在任何 entering/layout/index-effect 动画；快速滚动 10 分钟无崩溃、无动画重放。
8. 上述全部在「减弱动态」开启时静态降级、低端机 `MOTION_ENABLED=false` 时时长归零。

---

## v19.7 执行记录（2026-09-27，E/F/G 三批已提交）

| 批次 | 提交 | 内容 |
| --- | --- | --- |
| E | `913c5e3` | M1 useScreenEntrance + 三 hub 入场；M2 数据三件套全覆盖；M3 打卡反馈链 + SuccessBurst；M5 触觉补全；S1 jobs 动画重放修复 |
| F | `f3eadda` | M4 五页增删转场（LinearTransition + FadeOut）；M6 BottomSheet 弹簧；M7 按压补全 + jobs 归一 + 心跳收藏；V1 旧色清零（roadmap/tasks/wellness/jobs/job-detail-modal/trackers/meal-card-grid）；V2 暗色漏面；V3 阴影收 token（新增 `shadows.brand` 档） |
| G | `fb25f38` | M8 Tab 双击回顶；V4 字阶棘轮扩面 components/**（基线 55 文件/354 处）；S3 双源 44 收单源；S4 celebration 计时器；S5 死代码清理 |

**校验（每批实跑）**：`tsc --noEmit` 0 错；`vitest` 48 文件 / 419 用例全绿；`eslint` 0 error / 70 warning（与改造前基线完全一致）；`check-font-scale.mjs` 通过。

**与方案的偏差 / 遗留（按最小惊讶原则记录）**：

1. **M6 只做了 BottomSheet**：celebration（弹簧卡 + confetti）与 focus-timer（RN Modal fade）保持现状——两者容器动画语义不同（庆祝 vs 工具），强行统一收益低；update-sheet 进度条已随 M2 动画化。
2. **M4 的 market 未加**：`MoveList` 是静态排行（无增删交互），转场无意义；certificates 的 AchievementCard 自带入场动画，未再叠 LinearTransition。
3. **M8b thumbhash 未做**：需要构建期给图鉴图片生成 thumbhash 串（数据管线改造），留待图鉴专项；expo-image 的 `transition` 淡入已兜底。
4. **M8 双击回顶的实现路径**：expo-router 的 `Tabs.Screen` options 不接受 per-screen `listeners`，改为全局 `screenListeners.tabPress` + 导航状态判定（pressed==焦点路由即"再点一次"），比 pathname 方案更可靠（事件先于导航触发）。
5. **下拉刷新触觉从简**：`haptics.success()` 仅在刷新**成功返回**时触发（失败不震）——"错也震一下"语义不对。

**发布门槛**：按 v19.5 建议出 **v1.29.0 / versionCode 46**；真机重点回归：jobs FlashList 快速滚动（S1 现场）、BottomSheet 弹簧拖拽「按下/拖动/松手/取消」四路径（踩坑 71/78/79 流程）、双击回顶 × 5 hub、减弱动态全量降级、深浅两套过 V1 改色页面（roadmap/wellness/tasks/trackers）。

