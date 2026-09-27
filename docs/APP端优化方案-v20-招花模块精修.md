# APP 端优化方案 v20 · 招花模块精修（交互流畅 / 组件精修 / 简历·雷达·市场专项）

> **触发**：用户要求对招花模块做进一步优化——交互流畅有美感、UI 组件设计进一步精修、简历/就业雷达/市场分析等子模块一并优化。
> **评审方式**：招花域 10 页 + 8 个支撑组件逐文件精读（双通道：探索代理普查 + 核心文件人工复核），全部结论带文件行号证据。
> **前置状态**：v17（导航栈/真吸顶/去土/字阶）与 v19（动效基建/打卡反馈链/触觉/增删转场）已发布 v1.29.0/46。本方案不重复其内容，专注招花域的**剩余缺口**。
> **硬约束回顾**：FlashList 虚拟化列表项禁挂 entering/layout/index-effect 动画（踩坑 64422a9）；worklet 规则（CLAUDE.md）；禁新增全屏覆盖层；手势改动 release 真机四路径验证。

---

## 0. 诊断结论

招花域的骨架是好的（jobs 动线最完整、certificates 是空/载态正面样板、radar 筛选手感好），但三类问题拖住了"流畅有美感"：

1. **动线断头**：雷达结果卡完全不可点（看中岗位无法进详情/收藏，只能记名字去招花页重搜）——本轮最高价值的单点改造；jobs 高级筛选应用后无条件回显（弹层副标题承诺了但没做）。
2. **反馈"死"按压**：主入口大量裸 Pressable（jobs 分类/城市/排序/筛选钮、market 的 Chip 与 picker、applications 更新阶段行、interview 题型 chips）——按下无视觉变化、多数无触觉，与已精修的卡片/ChipGroup 手感割裂。
3. **组件碎片化**：分页条 4 处复制、筛选胶囊 8+ 套实现、统计卡 3 套、搜索框 3 套（SheetSearchField 做了没人用）、加载态骨架/转圈 7 页混用、空态 4 处手写、jobs 与详情弹层 5 组常量/徽章整段复制。**不先收组件，逐页精修会越修越散。**

外加市场分析页是"全模块最静的数据页"（KPI 无滚动、柱状图无动画、全页 spinner、决策失败伪装成加载中），简历预览没有出口（不能分享/导出，空态死胡同）。

---

## 1. 方案总览

| 编号 | 改造项 | 解决什么 | 阶段 |
| --- | --- | --- | --- |
| J1 | **岗位视觉件收单源**（`components/job-bits.tsx`：SourceBadge/FreshnessBadge/NewBadge/salaryText/AVATAR_COLORS） | jobs 与 detail-modal 5 组复制清零，徽章规格统一 | A |
| J2 | **分页条组件化**（`components/pager-bar.tsx`） | 4 处复制收敛，样式统一 | A |
| J3 | **统计卡归一**（KpiCard → stat.tsx 的 Stat 体系，内置 AnimatedNumber） | 3 套 KPI 合一，数字全部滚动 | A |
| J4 | **搜索框归一**（激活 sheet/search-field.tsx，含清除钮/防抖） | 3 套搜索框合一 | A |
| J5 | **加载/空态规范落地** | market/applications/interview/resume/resume-preview 接 Skeleton + EmptyState | A |
| A1–A7 | **jobs 主入口精修** | 筛选回显、防闪屏、首屏压缩、死交互点复活、header 性能 | B |
| A8 | **岗位详情弹层精修** | 中性 meta 色、骨架、重试、收藏心跳、JD 折叠 | B |
| B1–B5 | **就业雷达动线打通** | 结果卡可点进详情、匹配度圆环、错误态、筛选卡折叠 | C |
| C1–C6 | **市场分析数据页质感** | 骨架、全量数据动效、决策卡纠错、反馈统一 | C |
| D1–D5 | **简历专项** | 编辑能力、分享卡出口、信息架构分组、表单统一 | D |
| E1–E4 | **面试/求职/hub/证书** | 答题反馈链、乐观更新、hub 直达、tone 语义修正 | D |

---

## 2. 阶段 A · 组件基建（后续精修的地基）

- **J1 岗位视觉件**：新建 `src/components/job-bits.tsx` —— `SourceBadge`（色点+平台名）、`FreshnessBadge`（鲜度徽章，色映射走 successSoft/warningSoft/dangerSoft token）、`NewBadge`（统一 hairline 边）、`jobSalaryText()`、`AVATAR_COLORS`（token 等价色）。jobs.tsx 与 job-detail-modal.tsx 的 5 组重复改为单源引用。
- **J2 分页条**：`components/pager-bar.tsx`，props `{ page, pageCount, from, to, total, onPageChange, loading?, label? }`——内置 PressableScale + haptics + paging 转圈；jobs/radar/applications/interview 四页替换。
- **J3 统计卡**：market 的 KpiCard 改为 `stat.tsx` 体系（`Stat animated` + 统一容器），jobs 的 statCard 同步；数字全部 AnimatedNumber，`tabularNums` 对齐。
- **J4 搜索框**：`sheet/search-field.tsx` 升级为通用 `SearchField`（props: value/onChange/onSubmit/onClear/placeholder），jobs（一体式）与 market（带按钮式）两处接入，内置清除钮与 300ms 防抖。
- **J5 等待/空态**：market（KPI 骨架 + 卡片骨架）、applications、interview、resume、resume-preview 五页 ActivityIndicator → `Skeleton`；4 处手写空态 → `EmptyState`（带 CTA）。certificates 页作为对照标准。
- **顺手**：批量清理死样式/死状态（jobs L929-1001 旧 sheet 块 + skillDraft + cardSep；career L251；radar L380-391/L442-452；interview L448-452；certificates L221-251 残留）。

---

## 3. 阶段 B · jobs 主入口 + 岗位详情

- **A1 筛选回显行（P1）**：renderHeader 在分类 chips 下新增"当前条件"行——薪资/城市/经验/学历/技能/来源各渲染为一枚可删 chip（`label ×`，点 × 单项移除 + haptics.warning），末尾"清空全部"。兑现 FilterBottomSheet 副标题的承诺（参照 market 的回显实现）。
- **A2 防闪屏（P1）**：筛选/排序变化不再 `setInitialLoading(true)` 整列表换骨架——保留旧列表，顶部显示 2pt 主色细进度条（加载中流动），数据到达后替换；`setJobs([])` 仅保留在分类切换。数据到达后列表项用轻 crossfade（FlashList 红线内：不加 entering，用容器 opacity 过渡）。
- **A3 首屏压缩**：统计三卡改一行 StatRow（高度约 -40pt）；排序 seg 收进筛选行右侧（SheetSegmented 或"排序"小按钮开 sheet）；城市 chips 维持默认收起。目标：**小屏第一张职位卡进入首屏**。
- **A4 死交互点复活**：分类/城市 chips、筛选按钮、搜索清空、排序 → `PressableScale` + 语义触觉（选中 soft、清除 warning）；分类 chip 选中态加 `LinearTransition` 胶囊滑动（非虚拟化区域，合规）。
- **A5 header 性能**：`searchInput` 状态下沉到独立子组件（onSubmit 回调上抛），`renderHeader` 拆出并 memo——输入不再整列表头重渲染。
- **A6 字号/对比度收口**：jobTitle 15.5 → `typography.headline`；三档 chip 字号统一 `caption`；jobMeta 12pt textMuted → `textSecondary`（对齐 v18 WCAG 修复标准）；三处裸 `shadowColor` → `shadows.card`。
- **A7 岗位详情弹层**：metaGrid 绿底改中性 `surfaceMuted` + label `textSecondary`（语义错位修复）；加载转圈 → `Skeleton`（正文三段占位）；失败加"重新加载"按钮；enrollPlan 补 `haptics.success/error`；收藏成功时 footer 图标心跳（复用 v19 心跳弹簧）；JD 三段超 6 行折叠 + "展开全文"（重点：长 JD 不再把匹配分析推走）。

---

## 4. 阶段 C · 就业雷达 + 市场分析

### 雷达（动线打通是本轮最高价值）
- **B1 结果卡可点（P1）**：卡片本体接 `PressableScale` → 打开 `JobDetailModal`（radar item 构造最小 JobPostingListItem，详情/学习计划由 modal 内 fetchJobDetail 拉全量）；底部动作行加"收藏"（复用 onToggleFavorite 链路，收藏后同步我的求职）。用户动线：雷达 → 详情 → 收藏 → 我的求职，全线打通。
- **B2 匹配度可视化**：scoreWrap 文本 → 小号 `ProgressArc`（size≈48, strokeWidth 5）+ AnimatedNumber；分档色：≥75 success / 60–74 primary / <60 textSecondary，筛选行下加一行图例说明。
- **B3 错误态**：`catch` 记录 error → 网络失败时 EmptyState（cloud-offline 图标 + "重新扫描" CTA），不再伪装"还没有岗位画像"。
- **B4 技能 chips**：✓/○ 文本前缀 → ThemedIcon（checkmark-circle / ellipse-outline）+ textSecondary；命中技能加 `colors.success` 弱底。
- **B5 筛选卡折叠**：filterHead 可点击收起（默认展开，收起态显示"领域 · 城市 · 方向"摘要 + 计数）；死样式清理。

### 市场分析（"分析"页最该有的质感）
- **C1 骨架与防闪屏**：首载 → KPI 骨架 + 四卡骨架；range/搜索切换保留旧内容 + 细进度条（与 jobs A2 同一机制），不再整页闪 spinner。
- **C2 数据动效全覆盖**：KPI 数字 AnimatedNumber + kpiGrid 入场；BarRow 全部换 stat.tsx 的动画 ProgressBar；TrendChart 柱子 `entering={FadeInDown}` + range 切换时高度过渡（LinearTransition），90 天档按周采样渲染（≤31 根）防拥挤，末节点柱用 accent 高亮。
- **C3 决策卡纠错**：decision 请求失败落 error state（"场景计算失败 · 重试"），不再伪装"正在计算"；重算期间在 picker 行显示局部 12pt 进度提示（旧数据保留置灰）。
- **C4 反馈统一**：enroll 成功/失败 → 页内 `InlineToast`（顶部浮出，复用 toast.tsx），去掉 Alert；登录引导统一走 AuthSheet（jobs 的 Alert 引导同步改）。
- **C5 可读性修复**：trendDate 8pt → micro（按采样点显示）；rowValue 定宽 34 → min-width 自适应；chipText 11 → caption；KpiCard 去描边。
- **C6 交互补齐**：Chip/pickerButton 全部 PressableScale + haptics；横滑筛选行 chips 迁移到 ChipGroup（滑动版）。

---

## 5. 阶段 D · 简历专项 + 其余页面

### 简历（resume / resume-preview / resume-files-card）
- **D1 编辑能力**：资产卡加"编辑"入口（打开现有 Sheet 预填 → 保存）。需后端 `PUT /api/resume-assets/[id]`（见决策点 D1）。
- **D2 预览页出口（P2）**：右上角"分享"→ 新建 `components/resume-share-card.tsx`（view-shot + expo-sharing，版式参照 focus-share-card：姓名/headline 主视觉 + 分节摘要 + 品牌页脚）；空态改 EmptyState + 双 CTA（"去完善资料" → push /resume；"去 Web 端编辑" → 链接）。
- **D3 信息架构**：资产按 kind 分四组（小节标题 + 组内计数）；顶部加一行 StatRow（项目 n · 技能 n · 资产 n）概览；两个等权 pill 改主次——"预览简历" primary（PressButton）、"添加资产" secondary。
- **D4 表单统一**：添加/编辑 Sheet 改 `FloatField` + `PressButton`（对齐 certificates 的表单语言）；skill chips 与 certificates 的 kindChip 收敛为共享小件。
- **D5 文件卡**：文件行 PressableScale；上传成功 haptics.success + toast；长按删除保留但加首次提示气泡（P3）。

### 其余页面
- **E1 面试**：提交判定反馈链——答对 `haptics.success` + verdict 区 `SuccessBurst`，答错 `haptics.error`（组件已在库零消费，直接接入）；DIFF_STYLE 硬编码 hex → successSoft/warningSoft/dangerSoft token（修暗色离群）；加载失败给 InlineToast 提示（不再静默停留旧列表）；筛选快速连点加请求序号守卫；题型 chips PressableScale 化。
- **E2 我的求职**：`setStage` 乐观更新（本地先改 + 失败回滚 + InlineToast），Sheet 关闭时序改为"请求发起即关、toast 确认结果"；加载接 Skeleton、空态接 EmptyState；阶段 strip 折叠为"当前阶段 ±1"窗口（横向滚动其余）；"更新阶段"行 PressableScale + haptic。
- **E3 职业 hub**：hero + 三主入口 + moreRow 补入场错峰（useScreenEntrance）；「更多职业工具」改四个独立可点项（显示 desc 副标题，1 步直达）；断网时 hero 下方加错误条 + 重试（参照 wellness 的 errorBar），不再显示误导的"登录并记录…"。
- **E4 证书**：tone 语义修正——planned → 中性（slate/primarySoft）、preparing → primary、achieved → gold 保留（绿只留给"达成"语义）；状态改统一徽章样式（J1 的 Badge 体系）；删除加 FadeOut 退场。

---

## 6. 执行阶段

| 阶段 | 内容 | 工作量 |
| --- | --- | --- |
| **A · 组件基建** | J1–J5 + 死样式清理 | 1.5 天 |
| **B · jobs + 详情** | A1–A7 | 2 天 |
| **C · 雷达 + 市场** | B1–B5、C1–C6 | 2–2.5 天 |
| **D · 简历 + 其余** | D1–D5、E1–E4 | 2 天 |

每阶段：`pnpm -F mobile typecheck` / `test` / `lint` 全绿 + 字阶棘轮通过 → 提交一批。阶段 C 的 B1（雷达卡片进详情）单独可先发——它是单点最高价值。真机重点：jobs FlashList 快速滚动（A2 不得引入动画违规）、BottomSheet 四路径、雷达→详情→收藏→我的求职全动线。

发布：**v1.30.0 / versionCode 47** 起。

---

## 7. 决策点（开工前拍板）

| # | 问题 | 建议 |
| --- | --- | --- |
| D1 | resume 编辑需要后端 `PUT /api/resume-assets/[id]`（当前只有 POST/DELETE）。若本轮不做后端，可先做"编辑=预填+保存时删旧建新"的过渡 | **建议本轮补后端 PUT**（小改动， route + test 一对） |
| D2 | jobs 首屏压缩幅度：统计卡一行化即可，还是移到"更多"里 | **一行化保留**（数字是信任感来源，StatRow 足够矮） |
| D3 | 雷达结果卡点开详情用 BottomSheet（JobDetailModal）还是 push 详情页 | **BottomSheet**（与招花页行为一致，且雷达卡数据不全正好由 modal 内拉全量兜底） |

---

## 8. 验收标准

1. 雷达卡可点进详情、可收藏、同步我的求职——三段动线无断点。
2. jobs 筛选/排序后：当前条件一行可见、可单项移除；操作期间旧列表保留（无骨架闪屏）。
3. 招花域所有可点元素按压有缩放反馈、关键操作有触觉；裸 Pressable 计数为 0。
4. 分页条/统计卡/搜索框/岗位徽章各只有一套实现；market 数据页 KPI 滚动、柱状图生长、卡片错峰。
5. market/applications/interview/resume/resume-preview 加载=骨架、空态=EmptyState、错误有重试或提示（静默吞错清零）。
6. 简历可编辑、预览可分享出图；空态有出路。
7. 面试答对/答错有触觉与视觉反馈；DIFF_STYLE 随主题。
8. 全程不违反 FlashList 红线与 worklet 约束；`pnpm -F mobile test` 全绿；字阶棘轮不回退。
