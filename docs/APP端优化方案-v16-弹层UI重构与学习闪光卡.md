# APP 端优化方案 v16 · 二级弹层 UI 重构 + 学习闪光分享卡

> 状态：**方案（待拍板）**，建议一次性落到 **v1.24.0 / versionCode 37**。
> 触发：v1.23.0 真机截图（「一键开始」弹层）——用户要求把**所有同类二级弹层**重构，重点是**学习模块**与**招花模块**；并指定参考 https://uiverse.io/ 与 `E:\Codex_output_files\badminton-archive-card`（学习分享闪光卡）。
> 承接：v13 的 U1–U12 已经覆盖了骨架/按钮/输入/上传/Toast/主题/图鉴/成就/底纹；本轮是**弹层层面的组合与结构**，不重复皮肤级改造。

---

## 0. 结论先说（3 条）

1. **先立系统，再搬页面**：新增 `Sheet v3` 外壳 + 7 个原子组件，然后把学习 8 个、招花 6 个、通用 6 个弹层迁上去。只补"副标题 / 分组 / 分段槽位 / 吸底 CTA"，**不改弹层几何**（键盘自校正与退场串行是踩坑 74/78 换来的，动它必回归）。
2. **uiverse 只借技法（新增第 6 批 P6，10 个技法）**：全部走现有 token，**零新增依赖**。
3. **学习闪光卡对接参考项目的通用数据口**：`card-config.data.rows_left` / `rows_right` / `flags` 是一份纯 JSON 契约，运动卡与学习卡共用同一个 `card.glb` 与三层贴图。移动端**不引入 three/gl**，沿用 v10 的拟态分层卡 + v14 已接的 `react-native-view-shot` 出图。

---

## 1. 现状盘点（截图问题 + 结构问题）

### 1.1 截图直读（一键开始）

- 层级扁平：顶部两个等权 Tab → 三个等权胶囊 → 两个大按钮，**没有主次**；
- 选中态只有"换色 + 描边"，缺参考 uiverse 那种**滑块位移 / 内高光 / 按压下沉**的物理感；
- 「一键开始」四个字与下方内容之间没有副标题或说明，新用户不知道"选择 ≠ 开始"这条关键规则（v1.4.2 定下的不变量，界面上却看不出来）；
- 底部 CTA 与内容同处一个滚动容器，内容一长按钮就被推走（吸底能力缺失）。

### 1.2 结构问题（代码层）

| # | 现象 | 根因 |
| --- | --- | --- |
| S1 | 14 个弹层观感不一致 | `components/bottom-sheet.tsx` 只有 grabber + 标题 + 关闭三件套；没有副标题/分组/分段/吸底槽位，每个调用方各自拼 View |
| S2 | 分段控件有 4 套实现 | quick-start 的 `tabs`、tasks 的 `typeRow`、radar 的 chips、settings 的 `theme-segmented` 各写一遍，选中态三种画法 |
| S3 | 招花"筛选"与"结果"同页 | `jobs.tsx` 的 `FilterBottomSheet` 与长列表分离，但列表页没有"当前筛选摘要条"，收起弹层后看不出来在筛什么 |
| S4 | 选择器类各自为政 | upload-card / equipment-picker / exercise-picker / content-picker 四套卡样式与空态 |
| S5 | 吸底 CTA 缺失 | 学习统计 94% 全屏 sheet 的长内容里，操作按钮会被滚走 |

### 1.3 弹层清单（本轮范围）

**学习模块（8）**

| 文件 | 弹层 | 高度 | 目标 |
| --- | --- | --- | --- |
| `components/quick-start-sheet.tsx` | 一键开始（截图） | 62% | Sheet v3 + Segmented + StickyCta |
| `components/content-picker.tsx` | 这次学什么（嵌在上者内） | - | Section + ChipGroup + SearchField |
| `app/learn.tsx` statsOpen | 学习统计 | 94% | Sheet v3 + Section + StickyCta（分享） |
| `app/learn.tsx` calendarOpen | 选择日期 | 60% | Sheet v3 + 日历网格卡 |
| `app/learn.tsx` customTopicSheet | 添加学习内容 | - | Sheet v3 + FloatField |
| `app/learn.tsx` stageSheet | 阶段 / 主题 | - | Sheet v3 + ListRow |
| `app/learn.tsx` customPhaseSheet | 阶段表单（新建/编辑） | - | Sheet v3 + FloatField + StickyCta |
| `app/learn.tsx` mdSheet | 导入 Markdown 学习计划 | - | Sheet v3 + 分区预览 + StickyCta |

> `app/tasks.tsx` 的 newTaskOpen（新建任务）与 contentOpen（自由专注）同批跟进。

**招花模块（6）**

| 文件 | 弹层 | 目标 |
| --- | --- | --- |
| `app/jobs.tsx` FilterBottomSheet | 筛选 | Sheet v3 + ChipGroup + StickyCta（应用/重置）+ 列表页筛选摘要条 |
| `components/job-detail-modal.tsx` | 岗位详情 | Sheet v3 全屏档 + Section + StickyCta（收藏/加入求职） |
| `app/market.tsx` 弹层组 | 市场分析筛选与详情 | Sheet v3 + Segmented + ChipGroup |
| `app/radar.tsx` 筛选区 | 雷达筛选（v1.23 刚做） | 收敛到 ChipGroup（行为不变） |
| `app/interview.tsx` 弹层 | 题库筛选 / 答案对照 | Sheet v3 + Segmented + Section |
| `app/applications.tsx` | 阶段选择 / 删除确认 | Sheet v3 + ListRow + 危险态 CTA |

**通用（6）**：upload-card（上传图片 / 简历 / 档案）、equipment-picker-sheet、exercise-picker-sheet、target-sheet、meal-edit-sheet、auth-sheet。

---

## 2. 参考吸收

### 2.1 uiverse P6（新增 10 个技法）

本地归档 `.local/uiverse/elements` 已有 **3802 个元素 / 11 类**（v13 拉取）。P6 的候选按"技法特征"用正则筛过，**不是按名字瞎挑**；短名单仍需 P0 目检（流程见 §7.3）。

| # | 技法 | 已验证候选（真实文件名） | 落点 |
| --- | --- | --- | --- |
| P6-1 | 滑动指示分段（`translateX` 滑块） | `Pradeepsaranbishnoi_big-swan-35`、`shadowfax29_nasty-octopus-47`、`Subaashbala_silly-sheep-7` | 新 `SheetSegmented`，替换 S2 的 4 套实现 |
| P6-2 | 描边绘制勾选（`stroke-dashoffset` / `clip-path`） | `mobinkakei_strange-frog-14`、`guilhermeyohan_white-cheetah-13`、`PriyanshuGupta28_massive-ape-73` | 新 `SheetListRow` 多选（招花筛选、阶段选择） |
| P6-3 | 胶囊搜索 + 内嵌清空 | `Inputs`（226 个）目检短名单 | 新 `SheetSearchField`（内容选择、题库、装备图库） |
| P6-4 | 吸底 CTA 按压下沉 + 内高光 | `Buttons`（1231 个）目检短名单 | 新 `SheetStickyCta` |
| P6-5 | 卡内分组 + 细分隔线 | `Cards`（726 个）目检短名单 | 新 `SheetSection` |
| P6-6 | 开关形变（过冲缓动） | `adamgiebl_grumpy-moth-36` 等 `Toggle-switches`（260 个） | 通用弹层里的开关项 |
| P6-7 | 提示气泡（图标解释） | `Tooltips`（62 个） | 步进器 / 图标按钮的可达性标签 |
| P6-8 | 细进度条 / 载入态 | `loaders`（v13 已挑 4 个） | 弹层内提交与导入进度 |
| P6-9 | 通知条 | `Notifications` | 弹层内轻提示（替代 Alert） |
| P6-10 | 低透明度几何底纹 | `Patterns` | 弹层空态（复用 `pattern-backdrop`） |

**负向清单（明确不采纳）**：不搬霓虹/玻璃拟态皮肤；不引入 `linear-gradient` 依赖；不做 hover 专属效果（移动端无 hover）；不为了动效牺牲 `MOTION_ENABLED=false` 的降级路径。

### 2.2 参考卡的数据口（勘察结论）

`E:\Codex_output_files\badminton-archive-card` 是一个 three.js 幻光卡项目，关键三件事：

1. **配置即数据口**：`web/card-config.json` 里除文案外，有通用数据段
   `data.rows_left` / `data.rows_right` = `[[标签, 值], ...]`、`data.flags` = 徽章数组；
   没有配 `rows_*` 时才回落到羽毛球形状的默认字段（`badminton_level` / `racket` / `shoes` / `total` / `record` / `winrate`）。
2. **数据落到卡面**：`scripts/data_overlay.py` 把这两列 + 徽章画进 1728×2368 文本层的**中段面板**（设计空间 1024×1536；面板 x 90–934、y 320–960；标题 40px 金、标签 30px 灰、值 34px 米白、徽章 28px 描边胶囊）。
3. **出图即分享**：`web/app.js` 用 three.js 着色器（镭射 `spectrum` + 视差 `parallax` + 星点 + bloom）渲染，`save` 按钮执行 `renderer.domElement.toDataURL("image/png")` 下载；`preserveDrawingBuffer: true` 就是为导出留的。

**结论**：数据口 = 一份纯 JSON 契约，**与运动卡共用同一个 `card.glb` 与三层贴图**（项目里 `apps/web/public/holo/` 已有 `card.glb` + 7 个项目的 subject/background/lineart）。做"学习分享"只需换数据与文案，**不需要新模型、不需要新依赖**。

---

## 3. 决策点（每条给了建议值）

| # | 决策 | 建议 | 理由 |
| --- | --- | --- | --- |
| D1 | 本轮范围 | **只覆盖"学习 + 招花 + 通用 6 个"**，其它模块随批次跟脚 | 用户点名的两个模块优先，避免一次性动 20+ 文件 |
| D2 | 是否引入新依赖 | **不引入** | reanimated / gesture-handler / view-shot 都已具备 |
| D3 | 弹层形态 | 默认半屏 Sheet；**学习统计 / 计时器 / 岗位详情**保留全屏档 | 长内容必须全屏，其余半屏更轻 |
| D4 | 分段控件 | **胶囊滑块**（P6-1），淘汰文字 Tab | 一处实现收敛 S2 的 4 套 |
| D5 | 卡片数据口 | 沿用参考的 `rows_left/rows_right/flags` **原样契约** | 可直接喂参考项目的 `card-config.json` 形状，便于双端同源 |
| D6 | 移动端出图 | 拟态分层卡 + `react-native-view-shot` | 不引入 three/gl（包体 +5MB、低端机风险） |
| D7 | 分享数据是否落库 | **不落库** | 与 v14 一致；纯前端组装，零迁移 |
| D8 | 动效降级 | 沿用 `theme/motion.ts` 的 `MOTION_ENABLED` + 系统减弱动态 | 低端机一键停装饰 |
| D9 | 弹层几何 | **不动**（高度/键盘自校正/退场串行） | 踩坑 74/78 的回归代价极高 |
| D10 | 迁移顺序 | 先壳与原子组件 → 学习高频 3 个 → 其余 | 高频弹层先受益，风险面小 |

---

## 4. 改造方案

### 4.1 `Sheet v3`：外壳升级（向后兼容）

`apps/mobile/src/components/bottom-sheet.tsx` 新增**可选** props，现有 30 个调用方零改动：

```ts
subtitle?: string;            // 标题下一行小字（把"选择 ≠ 开始"这类规则写在界面上）
icon?: IconName;              // 标题左侧图标徽章
headerAction?: ReactNode;     // 右上角动作（如"重置"）
segmented?: ReactNode;        // 头部下方的分段槽位（固定不滚动）
footer?: ReactNode;           // 吸底 CTA：内容滚动、按钮不动（安全区 + 键盘上沿）
footerHint?: string;          // 按钮下方一句规则说明
```

结构：`grabber → header(图标+标题+副标题+动作) → segmented → ScrollView(children) → footer`。

**保持不动的部分**：滑入滑出时间轴、`eatenByResize` 键盘自校正、`onClosed` 串行契约、worklet 声明顺序约束（文件顶部「⚠️ 顺序约束」注释必须继续成立）。

### 4.2 新增 7 个原子组件（`apps/mobile/src/components/sheet/`）

| 组件 | 职责 | 技法来源 |
| --- | --- | --- |
| `segmented.tsx` | 2–4 段切换，滑块位移 + 内高光 | P6-1 |
| `section.tsx` | 分组标题 + 说明 + 卡内细分隔 | P6-5 |
| `chip-group.tsx` | 单选 / 多选胶囊（招花领域、城市、方向） | P6-1 的胶囊语言 |
| `list-row.tsx` | 可多选行 + 勾选描边动画 | P6-2 |
| `sticky-cta.tsx` | 主/次按钮 + 危险态 + 加载态 | P6-4 |
| `search-field.tsx` | 胶囊搜索 + 内嵌清空 + 300ms 防抖口径 | P6-3 |
| `stepper-row.tsx` | ± 步进（时长 / 组次 / 重量） | P6-7 提示标签 |

### 4.3 学习模块重构要点

- **一键开始（截图那个）**：`Segmented（学习 / 运动）` → `SheetSection 这次学什么`（ContentPicker 换成 ChipGroup + SearchField）→ `SheetSection 时长`（ChipGroup 15/25/45 + StepperRow 自定义）→ `Segmented（倒计时 / 正向计时）` → **吸底 CTA**「开始计时 · 学习 25 分钟」+ `footerHint`「选好后点这里开始；返回或点空白只会退出，不会开始计时」。
- **学习统计（94%）**：头部挂 `headerAction = 分享`；内容按 `SheetSection` 分为 热力 / 内容维度 / 周期柱状 / 14 天趋势；**分享按钮吸底**并接 §4.5 的闪光卡。
- **阶段 / 主题 与 阶段表单**：`ListRow` 承载主题勾选，表单改 `FloatField`（已有组件）+ 吸底「保存」；删除仍走长按确认（P6-4 危险态）。
- **Markdown 导入**：分区 = 粘贴区 / 解析预览树 / 导入统计，吸底「确认导入」+ 进度条（P6-8）。
- **tasks.tsx**：新建任务与自由专注同批迁移，复用同一套原子组件。

### 4.4 招花模块重构要点

- **筛选**：`FilterBottomSheet` 改 `SheetSection`（领域 / 城市 / 岗位方向 / 薪资带）+ `ChipGroup` 多选 + 吸底「查看 N 个结果」「重置」；列表页顶部加**当前筛选摘要条**（解决 S3）。
- **岗位详情**：全屏档 Sheet，`Section` 分「岗位信息 / 匹配分析 / 来源」，吸底双按钮「收藏」「加入求职」（收藏现在会同步进我的求职）。
- **市场分析**：筛选区与图表分区，`Segmented` 切 7/30/90 天。
- **雷达**：把 v1.23 的 chips 收敛到 `ChipGroup`（行为与排序不变）。
- **面试题库**：`Segmented`（全部 / 只看错题）+ `Section`（我的答案 ↔ 参考答案并排）。
- **我的求职**：阶段选择改 `ListRow` 单选 + 危险态「移出求职」。

### 4.5 学习闪光分享卡（对接参考卡数据口）

**新文件**

| 端 | 文件 | 职责 |
| --- | --- | --- |
| Shared | `apps/mobile/src/lib/study-card-model.ts` | 纯函数 `buildStudyCardModel(...)`，零 RN import（可单测） |
| Mobile | `apps/mobile/src/components/study-holo-card.tsx` | 拟态分层卡：背景/主体两层视差 + 扫光条 + 中段数据面板 + 徽章行 |
| Mobile | `apps/mobile/src/components/study-share-sheet.tsx` | 复用 `focus-share-card.tsx` 的弹层壳与 view-shot 出图 / 文字兜底 |
| Web | `apps/web/lib/study-card-text.ts` | canvas 文本层（版式对齐参考的 1024×1536 设计空间） |
| Web | `apps/web/components/holo/holo-study-card.tsx` | 复用 `holo-sport-card.tsx` 的着色器，仅换数据源与文案层；导出走 `toDataURL` |

**接入点**：`app/learn.tsx` 学习统计的「分享」（v1.23 已统一为卡片图片，本轮把卡片升级为闪光卡）、`app/tasks.tsx` 打卡分享、`app/wellness.tsx` 运动分享（可选）。

**降级链（三层，沿用 v14）**：截图/分享不可用 → 文字分享；`MOTION_ENABLED=false` → 静态卡面；Web 无 WebGL → 2D 卡（`holo-sport-card` 已有回落）。

---

## 5. 数据契约（可直接喂参考卡）

```ts
export interface StudyCardData {
  title: string; subtitle: string; technique: string; tagline: string;
  edition: string; collection: string; description: string;
  /** 左列：今日 / 本周 / 累计 这类"投入"指标 */
  rowsLeft: [string, string][];
  /** 右列：连续 / 完成率 / 阶段 这类"结果"指标 */
  rowsRight: [string, string][];
  /** 徽章（最多 4 枚，超出截断） */
  flags: string[];
  parameters: { foil: number; subjectScale: number; subjectDepth: number; backgroundDepth: number; glow: number };
  safeArea: { scale: number; offset: [number, number] };
}
```

与参考项目 `card-config.json` 的对应：`data.rows_left` / `data.rows_right` / `data.flags` 一一对应，其余字段同名；因此 Web 侧可直接把模型序列化成参考卡能吃的 JSON 做本地预览核对。

**数据来源（全部是现有字段，零新接口 / 零迁移）**

| 槽位 | 来源 |
| --- | --- |
| 今日专注 / 次数 | `lib/focus-stats.ts` 的 `todayMinutes` / `todaySessions` |
| 本周 / 累计 | `computeFocusStats().last14`、`totalFocusDays` |
| 连续打卡 | `computeFocusStats().streak`（今日页 streak 同源） |
| 任务完成率 | `DailyOsSummary` 的 `learning.tasksDone / tasksTotal`（`/api/daily`） |
| 习惯 | `/api/daily` 的 `habits.done / scheduled` |
| 运动 | `app-store` 的 `sports` 合计分钟 / METs |
| 领域分布 | `focus-stats` 的 `byContent` / `weekByContent` |
| 阶段进度 | `learn.tsx` 的 `phaseDone()` |

**徽章规则（确定性，便于单测）**：连续 ≥ 7 天 → 「七日不断」；本周专注 ≥ 目标 → 「本周达标」；单次 ≥ 45 分钟 → 「深度专注」；当日任务全清 → 「今日全清」；阶段完成 → 「阶段达成」。最多取 4 枚，按上述优先级。

---

## 6. 批次与验收

| 批次 | 内容 | 验收 |
| --- | --- | --- |
| **P0** | Sheet v3 + 7 个原子组件 + 学习高频 3 个（一键开始 / 学习统计 / 新建任务） | 双端 tsc/vitest/lint 全绿；`MOTION_ENABLED=false` 降级可用；真机四条手势路径 |
| **P1** | 学习剩余 5 个 + 招花 4 个（筛选 / 岗位详情 / 雷达 / 我的求职） | 同上 + 招花筛选摘要条与结果数量一致 |
| **P2** | 招花剩余 2 个 + 通用 6 个 + 学习闪光分享卡 | 同上 + 分享出图（微信预览可读、2560px 内不失真） |

每批完成即按项目惯例**统一部署 Web + 出新包**（v1.24.0 一次出，或按批次出小版本）。

---

## 7. 工程约束与视觉验收

### 7.1 硬约束

- worklet 只读写共享值 + Reanimated API；被 worklet 读取的局部量必须声明在它之前（踩坑 71/78）；
- 弹层几何（高度、键盘自校正、`onClosed` 串行）不动（踩坑 74/78/70）；
- 页面底部留白一律走 `useTabBarSpace()`（踩坑 47）；
- 新增/改动页面必须在 `_layout.tsx` 补 `href: null`（踩坑 86）；
- 弹层内的选择 ≠ 启动：只有唯一的显式 CTA 才启动（踩坑 77）；
- 零新依赖；正式包只允许 https（`config.ts` 既有约束）。

### 7.2 单测落点

- `study-card-model.test.ts`：指标映射、徽章优先级与截断、空数据不崩；
- `sheet` 原子组件若含纯逻辑（分页/多选/防抖）抽 `lib/*.ts` 单测；组件本身不引入 RN 依赖到测试（踩坑 48/89）；
- `back-target.test.ts` 保持通过（返回层级不被弹层重构破坏）。

### 7.3 视觉验收（沿用踩坑 16 的流程）

1. `.local/accept/` 存弹层截图（Web 用 `app/ui-preview` 的既有机制，移动端用真机/模拟器截图）；
2. uiverse 短名单用 `scripts/uiverse/build-sheets.mjs` → `screenshot-sheets.mjs` 生成对照图后目检，**确认技法可用再落地**；
3. judge 子代理评审时给足场景权重（层级 / 主次 / 触控目标 ≥44 / 深色对比度 / 减弱动态）。

---

## 8. 风险

| 风险 | 缓解 |
| --- | --- |
| 弹层改结构导致键盘/高度回归 | D9：几何代码一行不碰，只加槽位；真机复测键盘四路径 |
| 94% 全屏 sheet 重排后滚动失效 | 保留 `scroll` 语义；`footer` 不进入 ScrollView |
| 出图在低端机失败 | 三层兜底 + 失败提示，绝不"点了没反应" |
| uiverse 全量目检耗时 | 只跑 P6 短名单（已有 3802 元素与筛选脚本），不重复 v13 的全量筛选 |
| 学习卡与运动卡视觉割裂 | 共用 `card.glb` 与同一套着色器/文本层版式，只在数据与配色语义上区分 |

---

## 9. 需要你拍板的 3 件事

1. **范围**：先做学习 + 招花（建议），还是一次性把通用 6 个（上传 / 选择器 / 登录 / 更新）也一起做？
2. **移动端卡片**：接受"不引入 three、用拟态分层卡 + view-shot 出图"（建议），还是要求移动端也跑真 three.js（包体 +5MB 左右）？
3. **发版节奏**：一次出 v1.24.0（建议），还是 P0/P1/P2 各出一个小版本？

确认后我按 P0 开工：先落 `Sheet v3` + 7 个原子组件 + 一键开始 / 学习统计 / 新建任务，并同步更新看板。

---

## 10. 实施进度（2026-09-24 执行记录）

> 三项决策已拍板：**只做学习 + 招花** / **移动端用真 three.js** / **一次出 v1.24.0**；分阶段 git 提交，全部完成后统一打包与推送。

| 阶段 | 提交 | 内容 |
| --- | --- | --- |
| P0 | `fd4d508` | `bottom-sheet.tsx` 加 6 个槽位（几何未动）；`components/sheet/` 7 个原子组件（segmented / section / chip-group / list-row / sticky-cta / search-field / stepper-row）；一键开始、学习统计、新建任务、自由专注四个弹层重构 |
| P1a | `2d0704e` | ContentPicker 改胶囊分段 + ChipGroup；选择日期 / 添加学习内容 / 阶段表单 / Markdown 导入 补副标题+图标+吸底 CTA（MD 的预览与确认导入合成主次按钮） |
| P1b | `55d0b06` | 招花：高级筛选改 Sheet v3（分组 + ChipGroup + 吸底应用/清空，重置移入 headerAction）；雷达三组 chips 收敛到 ChipGroup；我的求职 9 个阶段胶囊改「一行摘要 + 阶段单选弹层 + 吸底危险 CTA」 |
| P2b | `f6b41d0` |
| P3（进行中） | 待提交 | 通用 6 个弹层迁移：上传卡 / 装备图库选择 / 动作选择 / 每日目标 / 饮食编辑 / 登录注册（并行两个子代理，写作用域互不重叠） | 移动端**真 three.js** 闪光卡：`expo-gl@~57.0.2` + `three@^0.186`；`lib/holo-scene.ts`（参考卡着色器骨架的程序化复现：镭射/星点/扫光/描金框，无后处理以保低端机稳定）；`lib/study-card-model.ts`（数据口契约 = `rowsLeft`/`rowsRight`/`flags`/`parameters`/`safeArea` + 徽章优先级，11 条单测）；`components/study-share-card.tsx`（GL 背景 + RN 中文数据面板 → 先冻 GL 出图再 view-shot 合成整卡分享）；学习统计的分享已切到该卡 |

**关键工程决策（P2 落地时补充）**

1. **不引入 `expo-three`**：它对新版 three 的适配不确定；改为用最小 canvas shim 直接喂 `three` 的 `WebGLRenderer`，`expo-gl` 负责上下文与 `endFrameEXP`。
2. **中文不进 GL**：GL 里排版中文代价极高，数据面板用 RN 视图叠加；GL 只负责镭射/星点/扫光这层"会动的皮肤"。
3. **出图分两步**：先 `GLView.takeSnapshotAsync` 冻结 GL（view-shot 对 GL 原生绘制面的捕获不稳定），再用 `react-native-view-shot` 合成"冻结图 + 数据面板"，最后 `expo-sharing` 分享；失败回落文字分享。
4. **移动端不做 UnrealBloom**：后处理在低端机不稳，改为着色器内发光 + 描金内框。
### 发布记录（v1.24.0 / 37，2026-09-25）

| 项 | 值 |
| --- | --- |
| 提交 | `fd4d508` P0 · `2d0704e` P1a · `55d0b06` P1b · `13a2a71` P2a · `f6b41d0` P2b（分阶段提交，最后统一推送） |
| APK | **72,865,827 B** · MD5 `ad1009777e7b4daf0bb453327f07d2da` · SHA256 `db23819356703cdd5e29abdf9d75d3af09584d0e31a6c8bceb43742519fa6452` · 签名 MD5 `3057105285981cc18597a95c1370c147`（与备案一致） |
| 包体增量 | 70,527,139 → 72,865,827（**+2.34MB**，即 three.js + expo-gl 的原生/JS 成本） |
| 发布物 | APK → `/data/learn-workbench/releases/learn-workbench-v1.24.0.apk`；OTA 清单 `1.24.0/37`（7 条说明）→ `landing/mobile-update.json`；`download.html` 与二维码更新（`?v=20260925a`，二维码按 v1.24.0 地址重新生成） |
| 线上核验 | `download.html` / `mobile-update.json` / `img/learn-download-qr.png` 与本地 **MD5 全等**；APK `HEAD` 200 且 `Content-Length=72,865,827`，服务器 `md5sum` 与本地一致 |
| 待真机复测 | ① 学习档案闪光卡的出图与分享（微信预览可读性）；② 各弹层观感 / 键盘 / 下滑关闭；③ 招花筛选与我的求职阶段；④ 低端机 running three.js 是否掉帧（掉帧可把动效降到静态卡面） |