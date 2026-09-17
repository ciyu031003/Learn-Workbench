# APP 端优化方案 v5（一键开始绑定学习内容 + 学习统计按内容 + 4 项交互缺陷）

> **触发**：v1.4.0 真机复测反馈（6 项：1 项新功能需求 + 1 项统计需求 + 4 项交互缺陷）
> **状态**：**P1、P2 已完成并提交（2026-09-17）；P3 发布中**
>
> ### 执行进度
> | 阶段 | 内容 | 状态 | 提交 |
> |---|---|---|---|
> | P1-1 | Modal 内补 `GestureHandlerRootView`（LiveLog 拖拽 + 全部弹层内手势恢复） | ✅ | `65695dd` |
> | P1-2 | 弹窗改不透明（`GlassSurface.opaque`，只动 sheet） | ✅ | `65695dd` |
> | P1-3 | 键盘避让改自校正几何（收缩高度 + 按实测根容器高度补差额上抬） | ✅ | `65695dd` |
> | P1-4 | 训练记录弹窗关闭状态机（`pickerReturn` 意图门控） | ✅ | `65695dd` |
> | P1-5 | 分类 chip `alignItems:"center"` | ✅ | `65695dd` |
> | P2-1 | 一键开始绑定"这次学什么"（自由输入 / 阶段→主题 / 不指定） | ✅ | `2430a96` |
> | P2-2 | 学习统计按内容（今日 + 本周，写 `focus_sessions.tag`） | ✅ | `2430a96` |
> | P3 | 出包 v1.4.1 + 上传 + 门户/二维码/OTA | ⏳ | — |
>
> **验证**：P1 后 mobile 27 文件 260 用例；P2 后 **27 文件 266 用例**、web 157 文件 1037 用例；两侧 typecheck / lint 0 error。
> **审查**：两阶段各做一次子代理审查 —— P1 抓到 1 阻断（`lift` 夹取让高弹层的键盘避让失效、iOS 登录弹层反而回归）已改自校正几何；P2 无阻断，3 应修（D4 被违反会静默沿用上次内容、自建阶段选不到、0 分钟会话顶掉空态）已修。

>
> ### 已确认决策（用户 2026-09-16 拍板）
> | # | 决策 | 结果 |
> |---|---|---|
> | D1 | 学习内容落库 | **A · 只写 `focus_sessions.tag`**（零迁移、零后端改动；UI 与数据流按结构化设计，将来加列不用重做） |
> | D2 | 不透明范围 | **A · 只改弹窗/抽屉**（30 个 BottomSheet 实底；4 个 Hero 卡保留玻璃） |
> | D3 | 「这次学什么」入口 | **A · 自由输入（含最近用过）+ 阶段→主题 + 不指定** |
> | D4 | 是否记住上次内容 | **不记住**（每次从"不指定"开始） |
> | D5 | 统计时间范围 | **今日 + 本周两个 tab** |
> | D6 | 键盘修复兼容面 | **A · 只改 `BottomSheet`（统一生效）+ 清掉 `auth-sheet` 重复 KAV** |

> **基础**：v1.4.0（versionCode 15，targetSdk 35）
> **硬约束**：
> 1. 不得影响其它品牌 / 其它页面；2. 数据库只追加迁移、不改历史文件；3. 每个阶段独立审查 + 测试 + 提交；4. 出包后再统一部署推送。

---

## 0. 一页速览

| # | 你的反馈 | 已定位根因（一句话） | 阶段 | 后端 |
|---|---|---|---|---|
| 1 | 一键开始 → 学习时，要能**自建学习内容**（英语读写/力扣刷题）或**选阶段→主题**，并与这次专注绑定 | `QuickStartChoice` 只有 `kind/timerMode/minutes/sport*`，**没有"学什么"字段**；且「一键开始→学习」目前会把专注**隐式绑到"今天第一个未完成任务"**（`today.tsx:328`），用户完全不可控 | P2 | **零改动**（复用 `focus_sessions.tag`，同步白名单早已打通） |
| 2 | 学习页「学习统计」要能看到**今天学了哪些内容、各用了多久** | `lib/focus-stats.ts` 只按**日期**聚合，`todayList` 连 `taskId` 都没有；`learn.tsx` 的统计 Sheet 也没有内容维度 | P2 | 零改动（本地聚合） |
| 3 | **LiveLog 贴纸拖不动**，只能点、位置固定 | `BottomSheet` 的 RN `Modal` 内**缺第二层 `GestureHandlerRootView`**（RNGH 官方要求）→ Modal 内所有手势在 Android 上**静默失效**（贴纸 Pan/Pinch、`portion-slider` 也受影响） | P1 | 零改动 |
| 4 | 所有**抽屉/弹窗能看穿**到底部内容（玻璃） | `surface.tsx:112-115` 的 `glassTintOverlay` 在 Android 回落分支的**实底色之上又叠了 alpha**（`rgba(255,255,255,0.86)` / `rgba(20,24,28,0.72)`）→ sheet 半透明 | P1 | 零改动 |
| 5 | 键盘弹出时**搜索框往下缩**，更看不到内容（应整体上移） | `bottom-sheet.tsx:188-199` 用**改高度**做避让，而 Android `adjustResize` 已经把窗口变矮（`collapsed = winH * ratio`）→ **双重补偿**，视觉上向下缩 | P1 | 零改动 |
| 6 | 训练记录弹窗**关不掉**：点空白只关一层又自动弹回 | `workout.tsx:126-130` 的 `onPickerClosed` **无条件** `setSheetOpen(true)` → "点空白关 picker → 又开记录弹层"死循环 | P1 | 零改动 |
| 7 | 选择动作的分类 chip 是**长条椭圆 + 文字下方空白**，要"字多大组件多大" | `exercise-picker-sheet.tsx:375` 的 `tabRow` **缺 `alignItems:"center"`**：横向 ScrollView 内容容器默认 `stretch`，把 pill 纵向拉满 | P1 | 零改动 |

> **本轮全部为移动端改动**：**零后端接口改动、零数据库迁移**（推荐路径下），发布只需出包 + 门户/OTA。

---

## 1. 逐项根因与方案

### P1-1 LiveLog 贴纸拖不动（Modal 内手势静默失效）

**根因**
- 贴纸的 `Gesture.Pan`/`Pinch` 挂在 `BottomSheet` 的 RN `Modal` 内部（`live-log-sheet.tsx:392-412, 442-449`）。
- 全项目**唯一的 `GestureHandlerRootView` 在 `_layout.tsx:184-193`（app 壳层），在 Modal 之外**。Android 的 Modal 是**独立 Window**，主 root view 收不到它的触摸流 → 手势永不激活。
- `GestureDetector` 的校验只是渲染期 context 断言（`node_modules/.../GestureDetector/index.tsx:91-96`），context 会穿过 Modal 的 React 树 → **不报错、静默失效**，表现正是"只能点、不能拖，每次打开都停在固定槽位"（槽位来自 `lib/live-log.ts:59-68 SLOTS`）。

**方案**
1. **主修**：`bottom-sheet.tsx:205-206` 把 Modal 内容根节点换成 `GestureHandlerRootView`（保留 `flex:1` + `justifyContent:"flex-end"`）。**一处改动，修复全部 30 个 BottomSheet 内的手势**。
2. **加固**：`live-log-sheet.tsx:398-403` 的拖动坐标由 `e.absoluteX/Y` 改为相对画布坐标（Modal Window 与主 Window 的 absolute 空间可能不一致），并把 `onSelect/onCommit` 收进 ref，避免父渲染重建手势。

**影响面/回归**：修好后 `BottomSheet` 自带的**下滑关闭手势在 Android 上会真正生效**（`bottom-sheet.tsx:150-177`），需真机确认"列表内下滑不会误关"；`portion-slider`（`portion-slider.tsx:124`）也会恢复，属附带收益。

---

### P1-2 弹窗（抽屉）改为不透明

**根因**：`GlassSurface` 的 Android 回落分支 = `styles.elevated`（**不透明** `surfaceStrong`）+ `glassTintOverlay`（**带 alpha 的覆盖层**，`surface.tsx:112-115`）→ 最终半透明。（iOS 走真·`GlassView`，本来就透。）

**方案（推荐：只动 sheet，不动 Hero）**：给 `GlassSurface` 加 `opaque?: boolean`：
- iOS：`GlassView` 的 `tintColor` 用 `colors.surfaceStrong` 压住；
- Android：回落分支用 `{ backgroundColor: colors.surfaceStrong }` 取代 `glassTintOverlay`；
- `bottom-sheet.tsx:212` 传 `opaque` → **30 个弹窗一次性变实底**，4 个 Hero（wellness/career×2/nutrition/daily-os-summary）保持玻璃观感。

**备选**：直接把 `glassTintOverlay` 默认改成不透明（连 Hero 一起变实底，视觉更重但更省事）。
**注意**：sheet 的遮罩 `colors.scrim`（`bottom-sheet.tsx:252`）保持半透明，否则失去"点外部关闭"的视觉暗示。

---

### P1-3 键盘弹出时组件应"上移"而不是"下缩"

**根因**：`bottom-sheet.tsx:188-199` 的 `height: Math.min(sheetHeight, maxSheetHeight - kb)`；
- Android `adjustResize` 下 `winH` 已经变小 → `collapsed = winH * ratio`（`:83-90`）随之变小；
- `maxSheetHeight ≈ screenHeight` 几乎永远大于 `sheetHeight` → **`kb` 那项基本没生效，真正生效的是窗口 resize**；
- 根容器是 `justifyContent:"flex-end"`（`:250`）→ 高度变小 = **顶边向下移** = "往下缩"。

**方案**：把"改高度"换成"改位移"：
- `animatedSheet` 高度**恒定**（`sheetHeight` 不再随键盘变），键盘出现时 `transform: translateY(translateY.value - lift)`，`lift = min(kb, max(0, maxSheetHeight - sheetHeight))`（夹取，防止顶出屏幕）；
- `expandable` 的 `toggle()`（`:133-141`，直接写 `translateY 0 / maxOffset`）必须把 `lift` 融入同一表达式，否则展开/收起会把弹层甩回键盘下面；
- 高度基准改用 `screenHeight`（`Dimensions.get("screen")`）而非会缩小的 `winH`，彻底消除 Android 二次影响；
- 顺手清掉 `auth-sheet.tsx:138` 自己那层 `KeyboardAvoidingView`（与全局方案重复，会叠加）。

**影响面**：全部 30 个弹层；重点回归 `expandable` 的（`learn.tsx` 统计/选择类）与"搜索框在顶部"的（选择动作、市场搜索）。

---

### P1-4 训练记录弹窗"关不掉"

**根因（状态机）**
```
openCreate/openEdit → sheetOpen=1
点「＋添加动作」→ pending=1, pickerSession++, sheetOpen=0     ← 记录弹层退场
记录弹层 onClosed → onRecordSheetClosed(): if (pending) pickerOpen=1   ← 选择弹层进场
【用户点空白】picker onClose → pickerOpen=0
选择弹层 onClosed → onPickerClosed(): pending=0; sheetOpen=1   ← ★ 记录弹层又被拉起来
再点空白 → 这次才真关
```
即"点一次空白只关一层，另一层被无条件打开"（`workout.tsx:126-130`）。

**方案**
1. 引入"意图"标记：只有**用户确认选了动作**（`applyPicked`）才 `setPickerReturn(true)`；`onPickerClosed` 里**仅当 return=true** 才 `setSheetOpen(true)`。
2. 所有关闭出口（scrim 点击 / 返回键 / 组件 `onClose`）**无条件清零** `pending` 与 `return` → 保证"点空白必定关闭且不再自动重开"。
3. 顺手收窄 `bottom-sheet.tsx:103-120` 入场 effect 的依赖（目前含 `collapsed`，窗口/键盘变化会重播滑入动画 → "从下方重新弹出"的第二种来源）。

---

### P1-5 分类 chip 长条椭圆 + 文字下留白

**根因**：`exercise-picker-sheet.tsx:375` 的 `tabRow: { gap:8, paddingVertical:2 }` **没有 `alignItems`**；横向 `ScrollView` 的内容容器默认 `alignItems:"stretch"`（RN `ScrollView.js:1893-1895` 只设了 `flexDirection:"row"`）→ 每个 pill 被纵向拉满，单行文字贴顶、下方留白。

**方案**：`tabRow` 补 `alignItems:"center"`（一行）。**不要**给 chip 加 `flex:1`（那会让 6 个分类平分宽度，又变回长条）。全项目只有这一处是"横向 ScrollView + 无 alignItems"的写法，其余（`quick-start-sheet.tsx:204-217`、`today.tsx:188-199`）不受影响。

---

### P2-1 一键开始绑定"这次学什么"

**需求**：学习 tab 里可选 ① **自建学习内容**（如「英语读写」「力扣刷题」）② **阶段 → 主题** ③（隐含）不指定；选中的内容与本次专注**绑定**，并在统计里按内容汇总。

**现状（决定改动面）**
- `QuickStartChoice`（`quick-start-sheet.tsx:12-20`）：`{kind, timerMode, minutes?, sportKey?, sportName?}` —— 无内容字段。
- 记录链路：`FocusTimer.record()` → `onRecorded(task?.id ?? null, seconds)`（`focus-timer.tsx:409-428`）→ 页面 `addSession(taskId, seconds)`（`today.tsx:570-593`、`tasks.tsx:225-232`）。
- **`focus_sessions.tag` 是现成的"内容名"槽位**，且**同步全链路已通**：schema（`db/schema.sql:130`）、写白名单（`sync-service.ts:137-147`）、读映射（`:543-556`）、shared schema（`packages/shared/src/index.ts:105`）、本地 store（`app-store.ts:287`）、导出/导入（`export:25`、`import:58`）——**移动端只差"赋值"**。
- 学习阶段/主题数据源：`@learn-workbench/content` 的 `mainPhases/agentPhase`（phase.id 数字、topics[].id/title）；自定义主题在 `store.customTopics`（含 `phaseId`）；自定义阶段在服务端 `content_phases(is_custom, owner_id)`。
- ⚠️ **不建议把 `phaseId/topicId` 直接落库**：移动端本地新建的自定义主题 id 来自 `nextId()`，与服务端 `content_topics.id` 语义不一致 → push 时可能 FK 失败被**静默丢弃**，或误绑他人行（详见调查结论）。`taskId` 也有同类风险（本地自增 id）。

**方案（推荐"结构预留 + 本轮零迁移"）**
1. **UI 与数据流按结构化设计**：`QuickStartChoice` 扩展
   ```ts
   contentLabel?: string;          // 展示名（"英语读写" 或 "阶段X · 主题Y"）
   contentSource?: "free" | "phase" | "none";
   phaseId?: number;               // 本轮仅用于拼 label（不落库）
   topicId?: number;               // 同上，为将来结构化预留
   ```
2. **选择器 UI（一键开始的学习 tab）**：顶部「这次学什么」三选一
   - **自由内容**：输入框（占位「如：英语读写 / 力扣刷题」）+ 最近用过的 3~5 个 chip（点一下即选）
   - **从学习阶段选**：阶段列表 → 主题列表（两级，复用 `mainPhases` + `customTopics`），选中后 label = `阶段标题 · 主题标题`
   - **不指定**（默认）：label 为空 = 自由专注
3. **落库**：`addSession(taskId, seconds, contentLabel?)` → 写进 `focus_sessions.tag`（**零迁移、零协议改动**）；同时**不再隐式绑定"今天第一个未完成任务"**（一键开始路径改为 `task: {id:null,title:label}`，避免专注被算到无关任务上）。
4. **将来结构化**：若后续要做"按阶段/主题的跨设备报表"，只需追加迁移 `047`（`phase_id/topic_id/label` 三列）+ 同步白名单 + 把已收集的 `phaseId/topicId` 一并写入 —— **UI 与数据流无需重做**。
5. 顺手：`tasks.tsx` 的「自由专注」入口也支持填内容名（同一套选择器组件复用）。

---

### P2-2 学习统计按"学习内容"汇总

**现状**：`lib/focus-stats.ts:3-11,61-70` 的 `FocusDaily` 只有日期维度（`todayList` 仅 `{startTime,endTime,minutes}`）；`learn.tsx:654-756` 的统计 Sheet 展示目标环/四宫格/84 天热力图/时段柱状/14 天折线 —— **没有内容维度**。

**方案**
1. `focus-stats.ts` 增加：
   - `todayList` 每项补 `label`（来自 `session.tag`）与 `taskId`；
   - 新增 `byContent: { label: string; minutes: number; sessions: number }[]`（按 `tag ?? "未分类"` 聚合，按分钟降序）；
   - 可选 `range: "today" | "week"` 参数（本周用同一套聚合，复用现有 `byDay` 结构）。
2. `learn.tsx` 统计 Sheet 顶部新增「今日学习内容」区块：每行 `内容名 · 分钟 · 次数` + 占比细条；无内容时显示"今天还没有绑定学习内容的专注"。
3. 回归：`focus-stats.test.ts` 现有用例（`tag: null`）必须仍通过；调用方 5 处（`learn/tasks/today/focus-timer×2/today-stack`）返回类型兼容（只加字段）。
4. 历史数据：老会话 `tag=null` → 归「未分类」，不影响现有聚合。

---

## 2. 需要你确认的决策点

| # | 决策 | 选项 | 我的建议 |
|---|---|---|---|
| **D1** | 学习内容如何落库 | **A** 只写 `tag` 文本（零迁移，本轮即可见效）／ **B** A + 追加迁移 `047` 结构化 `phase_id/topic_id/label`（服务端可按阶段聚合，但要动同步协议 + 处理本地自定义 id） ／ **C** 直接上结构化 | **A**（UI/数据流按结构化设计，落库先走 `tag`；等你要"按阶段跨设备报表"再加迁移） |
| **D2** | 不透明的范围 | **A** 只把**弹窗/抽屉**改成不透明（4 个 Hero 保持玻璃）／ **B** 全部（含 Hero 卡）一起改实底 | **A**（你反馈的就是弹窗看穿） |
| **D3** | 「这次学什么」的入口形态 | **A** 弹层内分三段：自由输入 / 阶段→主题 / 不指定（推荐）／ **B** 只有自由输入（最简）／ **C** 只做阶段→主题 | **A** |
| **D4** | 是否记住上次选的学习内容 | **A** 记住并在下次默认选中（存本地）／ **B** 每次都从"不指定"开始 | **A**（连续学同一内容更顺） |
| **D5** | 统计的时间范围 | **A** 今日 + 本周两个 tab ／ **B** 只做今日 | **A**（今天/本周各内容耗时都能看） |
| **D6** | 键盘修复的兼容面 | **A** 只改 `BottomSheet`（30 处统一生效）+ 清掉 `auth-sheet` 重复的 KAV ／ **B** 顺便把内联表单也改成统一组件 | **A**（改动面可控，先真机验证再考虑 B） |

---

## 3. 本轮不做 / 推迟

| 项 | 原因 |
|---|---|
| `focus_sessions.phase_id/topic_id` 结构化列 | 需处理"本地自定义 topic id ↔ 服务端 id"映射（先同步再允许记录），风险高于收益；UI 已按结构化设计，将来加列不用重做（见 D1） |
| Web 端 `/api/focus` 写 `tag` | 移动端不走这条路；等 Web 也要"按内容统计"时一并改 |
| 修正 `taskId` 的本地/服务端 id 语义 | 既有问题（离线新建任务后 push 可能被静默丢弃），属于同步协议加固，单独一轮 |
| `learn.tsx` 里 `customTopics` 与 `/api/roadmap` 自带自定义主题的**重复展示隐患** | 与本次需求同域但独立，先记进看板，选择器实现时做一次去重即可 |

---

## 4. 验收标准

| 阶段 | 验收 |
|---|---|
| P1 | ① LiveLog 贴纸能自由拖动、松手位置被记住、重开仍在原位；`portion-slider` 拖动恢复；② 所有弹窗（水杯/选择动作/添加饮食/训练记录…）**实底不透明**，Hero 卡仍是玻璃；③ 键盘弹出时弹层**整体上移**，搜索框与输入框始终可见（含 `expandable` 的展开态与收起态）；④ 训练记录：点空白**一次即关**且不再自动重开；选完动作仍能回到表单；⑤ 分类 chip 尺寸随文字自适应，无空白椭圆 |
| P2 | ⑥ 一键开始 → 学习 → 可选「自由内容（输入/最近用过）」或「阶段→主题」或「不指定」，选完立即开始计时；⑦ 学习统计里能看到今日各内容耗时（如"英语读写 40 分钟 / 阶段X·主题Y 50 分钟"）并按 D5 支持本周；⑧ 老数据（tag=null）显示为「未分类」且不影响既有数字 |
| 回归 | 每阶段：mobile 单测 / typecheck / lint 全绿；真机验证 30 个弹层的关键几个（登录、饮食、体重、习惯、训练、选择动作）；出包后 `aapt2` 核验；OTA 可升级 |

---

## 5. 风险与回滚

| 风险 | 缓解 | 回滚 |
|---|---|---|
| Modal 内加 `GestureHandlerRootView` 让 BottomSheet 下滑关闭在 Android 生效 → 可能误关 | 真机重点验"列表内下滑不误关"；必要时把下滑关闭限定为仅 grabber 区域触发 | 移除该 root view（一行） |
| 键盘改为 `translateY(-kb)` 后，`expandable` 展开态与键盘位移冲突 | `lift` 参与同一个 transform 表达式；真机验展开/收起来回切换 | 恢复高度方案（一行） |
| 弹窗改实底后视觉变重 | 只改 sheet 不动 Hero（D2-A）；必要时下调阴影强度 | 去掉 `opaque` 传参 |
| `addSession` 签名变更影响既有调用点 | 新参数可选（`contentLabel?`），5 处调用点零改动也能编译 | — |
| 统计按 tag 聚合，历史会话无 tag | 归「未分类」并显式提示 | — |
| 训练记录关闭逻辑改动影响"编辑已有动作" | 保留 `pickerSession` 换 key 机制；回归"编辑 → 确认 → 回表单且替换该行" | 单文件 revert |

---

## 6. 执行顺序与提交节奏

```
P1（交互致命项，一个包就能止血）
  ├─ Modal 内补 GestureHandlerRootView（LiveLog 拖拽 + 全局手势恢复）
  ├─ 弹窗不透明（GlassSurface.opaque + BottomSheet 传参）
  ├─ 键盘避让改为整体上移（+ 清理 auth-sheet 重复 KAV）
  ├─ 训练记录关闭状态机（意图门控 + 无条件清零）
  └─ 分类 chip alignItems:center
P2（绑定学习内容 + 统计按内容）
  ├─ QuickStartChoice 扩展 + 「这次学什么」选择器 UI（自由输入 / 阶段→主题 / 不指定 + 记住上次）
  ├─ FocusTimer 透传 label → addSession(label) → focus_sessions.tag
  ├─ focus-stats 增加 todayList.label 与 byContent（今日/本周）
  └─ learn.tsx 统计 Sheet 新增「学习内容」区块
P3（发布）
  └─ 出包 v1.4.1（versionCode 16）→ 上传 + 门户/二维码/OTA → 真机复测
```
每阶段：`pnpm -F mobile test` + `typecheck` + `lint` 全绿 → 代码审查（子代理）→ 修掉审查发现 → git 提交（阶段内可多次）→ 全部完成后统一推送 + 部署 + OTA。
