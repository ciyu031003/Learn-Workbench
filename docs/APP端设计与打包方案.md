# Learn-Workbench APP 端设计与打包方案（V1 草案）

> **定位**：APP 不是 Web 的容器，而是**同一套后端的第二产品形态**。
> **目标**：更简单（一步到达）· 更方便（拇指可达 + 少输入）· 更快（首屏/滚动/响应）· 更精美（一致的排版与手感）。
> **状态**：决策已确认（D1 5 Tab / D3 引入 FlashList / D7 仅 Android；D2/D4/D5/D6 按建议执行）。
> **进度（2026-09-14）**：**P0 已完成**（IA 重排 + 排版 Token + 骨架屏/空态 + 长列表虚拟化 + 启动延后/死资源清理），
> 提交 `d541766`→`177bdd6`；**P1 / P2 待办**（见 §8 与文末进度表）。
> **依据**：本仓库移动端实测审计（见 §1）+ 移动设计规范（见 §2）。

---

# 0. 一句话方向

```text
不套壳（现在本来就不是 WebView，是 React Native 原生工程）
     ↓
重排信息架构：4 Tab（功能埋在设置里）→ 5 Tab + 3 个领域 Hub（一步到达）
     ↓
补齐设计 Token（缺排版体系）+ 统一卡片/动效/触感/骨架屏
     ↓
列表虚拟化 + 图片缓存 + 启动瘦身（ScrollView→FlatList / 死资源清理 / TTI 预算）
     ↓
打包工程化：版本单一事实源 + 图标全变体 + 一键构建校验脚本
```

---

# 1. 现状审计（实测数据，非估算）

## 1.1 工程与打包

| 项 | 现状 | 问题 |
|---|---|---|
| 屏幕数 | **25 个**（`apps/mobile/src/app/*.tsx`） | — |
| 可见 Tab | **4**（首页 / 学习 / 招花 / 我的） | HIG 允许 3–5；V3 新增的 6 个功能**只能从「我的」里进**（设置当目录的反模式） |
| 版本号 | `build.gradle` **1.2.0/8**、`package.json` **1.2.0**、`app.json` **1.0.0** | **三处事实源**，`app.json` 已漂移（踩坑点 23 已记录 app.json 不注入） |
| 构建方式 | 本地 gradle（**无 `eas.json`**） | 无标准化构建脚本，靠人工记忆踩坑点 23 的 4 个前置检查 |
| cleartext | `app.json` build-properties **true** ↔ `AndroidManifest` **false** | 配置矛盾，易误判 |
| 预测返回 | `enableOnBackInvokedCallback="false"` | Android 13+ 预测返回未启用 |
| 权限 | INTERNET / VIBRATE / READ+WRITE_EXTERNAL_STORAGE(≤32) / **SYSTEM_ALERT_WINDOW** | `SYSTEM_ALERT_WINDOW` 是**敏感权限**（仅开发悬浮窗需要），release 包应剔除 |
| 图标 | Android 自适应三层（fg/bg/mono）+ `icon.png`；iOS 仅 `expo.icon` 单图 | **缺 iOS 深色/着色/透明变体**（iOS 26 桌面对多外观图标有要求） |
| 启动图 | `#208AEF`（Expo 蓝） | **与品牌画布 `#FDF8EF`（Sunny Clay）不符**，冷启动有刺眼跳变 |
| 模板遗留资源 | react-logo/expo-logo/expo-badge/explore/tutorial-web/logo-glow 等 | **≈434 KB 死资源**进包（logo-glow 单个 331 KB） |

## 1.2 性能（按 Callstack RN 优化清单口径）

| 指标 | 实测 | 判定 |
|---|---|---|
| `ScrollView` 用法 | **80 处** | 🔴 列表几乎全用 ScrollView + `.map()`，**无虚拟化** → 长列表（职位/市场/日志）掉帧与内存压力 |
| `FlatList` | 5 处 | 🟡 覆盖不足 |
| `FlashList` | 0 | — |
| `RefreshControl` | 6 处 | 🟡 下拉刷新覆盖不全 |
| `expo-image` | **0**（裸 `<Image>` 2 处） | 🔴 无磁盘缓存/过渡/blurhash，职位 logo 与背景图重复拉取 |
| Skeleton 骨架屏 | **0** | 🔴 加载即白屏 → 感知慢 |
| React Compiler | 已开启 `experiments.reactCompiler` | ✅ 自动 memo 已有 |
| 状态管理 | Zustand + 选择器订阅 | ✅ 基本盘良好 |
| 启动期副作用 | `_layout` 内 `startSyncEngine()` / `migrateLegacySports()` 与首帧同批 | 🟡 可能与首屏渲染抢 JS 线程（需实测 TTI） |

## 1.3 视觉与设计体系

| 项 | 现状 | 问题 |
|---|---|---|
| 色板 | 双色板完整（Sunny Clay 浅 / Night Voyage 深），语义色齐全 | ✅ 资产良好 |
| `radius` / `shadows` / `motion` / `spacing` | **均已存在** | ✅ 已 Token 化 |
| **排版（Typography）** | **不存在** | 🔴 25 屏各自硬编码 `fontSize`/`fontWeight` → **观感不一致的主要根因** |
| 图标 | `ThemedIcon`（iOS SF Symbols / Android Ionicons）+ `SPORT_SF` | ✅ 已原生化 |
| 玻璃质感 | `expo-glass-effect` + `daily-background` | 🟡 需按「玻璃不作为信息载体、对比度优先」复核 |
| 手感 | `expo-haptics` + `PressableScale`（85 处）+ reanimated（72 处） | ✅ 基础好，但缺统一"触感词汇表" |

---

# 2. 设计依据（本次检索到的可复用规范）

| 来源 | 采用的部分 |
|---|---|
| [Mobile Design Patterns（skillpacks/lyra-ux-designer）](https://github.com/tachyon-beep/skillpacks/blob/main/plugins/lyra-ux-designer/skills/using-ux-designer/mobile-design-patterns.md) | **移动交互评估模型四维**：可达性（拇指区）/ 手势约定 / 平台视觉一致性 / 性能感知；触控目标 44pt(iOS)–48dp(Android)；反模式清单（首页藏功能、无骨架屏、超 300ms 动画、>3 屏 onboarding） |
| [React Native Best Practices（Callstack 指南提炼）](https://github.com/ndesv21/openclaw-master-skills/blob/main/skills/react-native-best-practices/POWER.md) | 优化优先级：**FPS/重渲染 → 包体 → TTI → 原生 → 内存 → 动画**；列表用 FlatList/FlashList；避免 barrel 导入；Hermes mmap；R8 代码裁剪；TTI 只测冷启动 |
| [Apple HIG — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | 3–5 个 Tab、必须有文字标签、**不要隐藏/禁用 Tab**、用 SF Symbols、用角标提示 | 
| 项目既有约束（`CLAUDE.md` / 看板） | 保留 Liquid Glass + 每日壁纸 DNA；不新建第二套卡片/主题；移动端 `makeStyles(colors)` 模式；踩坑点 23 打包纪律 |

**取舍**：采用「**统一品牌语言 + 导航与手势按平台适配**」的混合策略（四维模型推荐的 Option 3），而非两套独立设计或完全统一。

---

# 3. 设计原则（APP 端五条铁律）

1. **一步到达**：任何 V3 能力从 Tab 起算 ≤ 2 次点击；禁止把功能入口继续堆在「设置」里。
2. **拇指优先**：主操作落在屏幕下 50%；顶部只放返回/标题/次级筛选。新增操作一律「底部 Sheet」而非整屏跳转。
3. **即时反馈**：所有 >1s 的操作必须有 **骨架屏或乐观更新**；不允许白屏等待。
4. **手感一致**：动效 150–300ms、尊重 reduce-motion；触感只用三种（轻选中 / 中成功 / 警告），不滥用。
5. **玻璃不承载信息**：玻璃仅作层级与氛围；文字对比度按真实壁纸最坏情况校验，**不把语义编码进玻璃强度**。

---

# 4. 信息架构重设计（更简单 / 更方便）

## 4.1 现状问题

```text
现在：4 Tab
首页 ─ 学习 ─ 招花 ─ 我的
                      └─ 我的一天 / 习惯 / 训练 / 饮食 / 运动档案 /
                         就业雷达 / 证书 / 简历 / 领域记录 / 领域管理 / 账号安全 …（11+ 项平铺）
```
→ 「我的」变成目录页；V3 的健康与职业能力**发现成本极高**（要滚到设置里找）。

## 4.2 目标 IA：5 Tab + 3 个领域 Hub

```text
┌── 今日 ──┬── 学习 ──┬── 职业 ──┬── 健康 ──┬── 我的 ──┐
│ Daily OS │ 路线图   │ 就业雷达 │ 今日训练 │ 账号安全 │
│ 完成度环 │ 今日任务 │ 我的求职 │ 今日饮食 │ 主题外观 │
│ 四域卡片 │ 专注     │ 简历     │ 习惯打卡 │ 领域管理 │
│ 快速打卡 │ 学习日志 │ 证书     │ 运动档案 │ OTA/关于 │
│ 一键专注 │ 领域记录 │ 技能树   │ 身体数据 │ 隐私政策 │
└──────────┴──────────┴──────────┴──────────┴──────────┘
   落地页      执行区     求职区     身体区     设置区
```

**关键改动**

| # | 改动 | 收益 |
|---|---|---|
| 1 | **「今日」成为默认落地页**，吸收现 `dashboard` 的统计与快捷开始 | 打开即见"今天要做什么"，消灭 dashboard 与 today 的双首页 |
| 2 | 新增 **职业 Hub**（卡片网格：雷达/求职/简历/证书/技能树/市场） | 求职五件事一个 Tab 内全见 |
| 3 | 新增 **健康 Hub**（训练/饮食/习惯/运动档案/体重） | 健康五件事一个 Tab 内全见 |
| 4 | **「我的」瘦身为纯设置**（账号/主题/领域管理/OTA/关于/隐私） | 去掉"设置当目录"反模式 |
| 5 | 招花（`jobs`）保留在**学习** Tab 内的市场入口 + 职业 Hub | 按 HIG「不隐藏 Tab」原则，5 个 Tab 全部有标签与图标 |

> 备选（若你希望更保守）：保持 4 Tab，把「健康」并入「今日」的下半屏。**见 §9 D1。**

## 4.3 每个 Hub 的排版约定

- Hub 用**分组卡片网格**（2 列），每张卡：图标 + 标题 + 一句副标题 + 可选角标（待办数/临期数）。
- Hub 卡片对角标取数：证书临期数、待打卡数、在途投递数 → 复用 `lib/daily-os.ts` 聚合，**不新增接口**。

---

# 5. 视觉与交互升级（更精美）

## 5.1 补齐排版 Token（最高性价比的一项）

在 `apps/mobile/src/theme/tokens.ts` 新增 `typography`（并按平台适配字体栈）：

```ts
export const typography = {
  display:  { fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.4 },
  title1:   { fontSize: 24, lineHeight: 30, fontWeight: "800" },
  title2:   { fontSize: 19, lineHeight: 25, fontWeight: "700" },
  headline: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  body:     { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  callout:  { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  caption:  { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  micro:    { fontSize: 11, lineHeight: 14, fontWeight: "600" },
} as const;
```
- 数字统一 `fontVariant: ["tabular-nums"]`（统计/时长/百分比对齐）。
- 25 屏内的硬编码字号**分批替换**为 token（按 Tab 分组，每批一次提交，可回滚）。

## 5.2 卡片与层级收敛为 3 种

| 变体 | 用途 | 规则 |
|---|---|---|
| `Card.surface` | 绝大多数信息卡 | 圆角 `radius.lg` + `shadows.card` + 单一浅边框 |
| `Card.glass` | 悬浮于壁纸之上（专注、庆祝、Hub 头图） | 玻璃 + 必须有实心回退（对比度兜底） |
| `Card.hero` | 每屏最多 1 张（今日完成度 / 雷达首页） | 更大留白 + 渐变描边，不与其它卡同屏重复 |

## 5.3 交互模式升级（Sheet-first）

| 场景 | 现在 | 改为 |
|---|---|---|
| 习惯打卡 / 训练记录 / 饮食添加 / 加证书 | 多为整屏或长表单 | **底部 Sheet 半屏**（已有 `BottomSheet` 组件，38 处使用） |
| 列表项操作 | 进入详情页 | **左滑操作**（删除/归档）+ 长按上下文菜单 |
| 列表刷新 | 部分缺失 | 全部列表**下拉刷新**（HIG 习惯） |
| 危险操作 | 直接执行 | 二次确认 + 触感警告 + 撤销 Snackbar |

## 5.4 动效与触感词汇表（统一，不新增动画方言）

```text
进入/切换 : 淡入 + 8pt 上移，180ms（motion.micro）
弹层      : 弹簧（damping 18 / stiffness 220）
按压      : scale 0.96（PressableScale 已有）
成功      : 中触感 + 环形勾选 240ms
警告/错误 : 重触感（仅此一处用重）
庆祝      : 现有 Celebration（保留，仅用于里程碑）
```
- 全部动效尊重 `prefers-reduced-motion`（RN：`AccessibilityInfo.isReduceMotionEnabled`）→ 关闭后降级为无动画状态切换。

## 5.5 加载态与空态

新增两个基础组件（`components/`）：
- `Skeleton`（卡/列表/图表三种形状，微光扫过，自带 reduce-motion 降级）
- `EmptyState`（插画式图标 + 一句说明 + 一个主 CTA，替换现有纯文字空态）

**规则**：首次加载 → 骨架屏；刷新 → 保留旧数据 + 顶部细进度条（乐观 UI）；离线 → 顶部「离线，显示缓存数据」条。

## 5.6 平台适配与可访问性

- **触控目标**：全部交互元素 ≥ **48dp**（同时满足 iOS 44pt 与 Material 48dp）。
- **动态字号**：正文使用 token，允许系统字体缩放（`allowFontScaling` 默认开，避免写死 `height` 造成截断）。
- **Tab 角标**：习惯待打卡 / 证书临期 / 在途投递 → HIG 明确建议用 badge 提示关键信息。
- **iOS 26 就绪**：桌面图标补齐 dark/tinted/clear 变体；玻璃交给系统材质，不自绘。

---

# 6. 性能方案（更快）

按 Callstack 优先级排序执行。

## 6.1 P0 — FPS 与重渲染（影响最大）

| 动作 | 具体 | 验收 |
|---|---|---|
| 列表虚拟化 | `jobs / market / logs / tasks / applications / certificates / habits / workout / nutrition / trackers` 的 ScrollView+map → **FlatList**（`keyExtractor`/`getItemLayout`/`removeClippedSubviews`/`windowSize`） | 1000 条数据滚动 ≥ 55 FPS |
| 长列表（>500） | 评估引入 **FlashList**（新增依赖，见 §9 D3） | 同上 + 内存峰值不随长度线性增长 |
| 图片 | 全部改 **`expo-image`**（`cachePolicy="memory-disk"`、`transition`、`placeholder`） | 二次进入列表无重复请求 |
| 启动副作用 | `startSyncEngine` / `migrateLegacySports` 延后到首帧之后（`InteractionManager.runAfterInteractions` 或 `requestIdleCallback` 等价方案） | 冷启动 TTI 下降 |

## 6.2 P0 — 包体与死资源

- 删除 Expo 模板遗留资源（≈**434 KB**）、无用 `expo-symbol 2.svg`、未引用图片。
- 检查 barrel 导入：`@learn-workbench/shared` 为单文件 barrel，热路径改为按需导入（打包分析后定）。
- Android release：开启 **R8 + resource shrinking**（`enableProguardInReleaseBuilds`/`shrinkResources`）。
- Hermes：确认 Android 关闭 JS bundle 压缩以启用 **mmap 加载**。

## 6.3 P1 — TTI（冷启动）

```text
目标预算（Release, 中端机）：
  冷启动 → 首屏可交互(TTI)  ≤ 1.8s
  首屏数据可见              ≤ 2.5s（骨架屏 ≤ 500ms 内出现）
  JS bundle (Hermes)        ≤ 3.2 MB
  APK (arm 双 ABI)          ≤ 70 MB（当前 ≈65 MB，留余量）
```
- 测量：`react-native-performance` 打点冷启动（只看冷启动，不看热启动）；`npx react-native bundle` + `source-map-explorer` 看包构成。
- 手段：预取首屏数据后再隐藏 Splash（Splash 与首帧同色，避免白闪）；常用重量级屏（专注计时/简历预览）预加载。

## 6.4 P2 — 内存与动画

- 长列表 + 图片内存峰值监控；卸载时清理定时器/订阅（`focus-timer`、`sync-engine`）。
- 动画全部走 `useNativeDriver`/Reanimated worklet，避免 JS 线程掉帧。

---

# 7. 打包工程化方案（打包本体）

## 7.1 版本号单一事实源

现状三处漂移 → 规定：**`android/app/build.gradle` 为唯一事实源**（与踩坑点 23 一致），其余自动同步。

新增 `scripts/sync-version.mjs`：
```text
读取 android/app/build.gradle 的 versionCode/versionName
   → 写回 apps/mobile/package.json (version)
   → 写回 apps/mobile/app.json (expo.version / android.versionCode)
   → 校验三者一致，不一致则退出码非 0
```

## 7.2 一键构建 + 自检脚本

新增 `scripts/build-android-release.ps1`（把踩坑点 23 的隐性知识固化成脚本）：
```text
1) 备份 android/keystore/ + keystore.properties 到 .local/keystore-backup/
2) npx expo prebuild --platform android（会重建 android/ 并重置签名为 debug）
3) 恢复 keystore 与 keystore.properties
4) 断言 build.gradle 三要素：versionCode/versionName、signingConfigs.release、release buildType 引用 release 签名
5) ./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
6) apksigner verify --print-certs → 断言 MD5 == 3057105285981cc18597a95c1370c147
7) 输出产物 + 体积 + 版本，并复制到 .local/accept/
失败即中止并打印修复提示。
```

## 7.3 图标 / 启动图 / 权限

| 项 | 方案 |
|---|---|
| 图标管线 | 沿用 `.local/icon-gen/`（sharp 生成全密度）；**新增 iOS 变体**（default / dark / tinted），Android 三层保持 |
| 启动图 | 背景改品牌画布 `#FDF8EF`（深色模式用 Night Voyage 底色），消除冷启动跳变 |
| 权限收敛 | release **移除 `SYSTEM_ALERT_WINDOW`**；确认 `READ/WRITE_EXTERNAL_STORAGE` 是否仍被使用（图片选择器若不需则删）；保留 INTERNET + VIBRATE |
| cleartext | 统一为 **false**（API 全 HTTPS），消除 app.json 与 Manifest 矛盾 |
| 预测返回 | 开启 `enableOnBackInvokedCallback="true"` 并回归（Android 13+ 手势返回预览） |
| 包名/签名 | **不变**（`com.yuanabd.learnworkbench` + 同一 keystore），避免备案与微信登记失效 |

## 7.4 更新（OTA）

- **保留自研 OTA**（`lib/ota.ts` + `/mobile-update.json`）：备案/商店场景下语义可控，不引入 `expo-updates` 的额外服务依赖。
- 增强：启动**静默检查**（不阻塞首屏）→ 有新版时在「我的」显示角标 + Sheet 提示（含更新说明与体积），沿用踩坑点 30 的二维码流程。

## 7.5 商店/上架就绪

- 已具备：备案号展示、隐私政策页、图标。
- 待补：**权限用途说明文案**（剥离 SYSTEM_ALERT_WINDOW 后可简化）、截图素材（各尺寸）、更新日志、各商店（华为/小米/OPPO/vivo/荣耀）包体与签名核验。

---

# 8. 分阶段实施

> 每阶段：独立提交 → 真机验收 → 可回滚（UI 改动保留旧组件直到新组件验收通过）。

## P0（体验地基，风险低、收益最大）
1. **IA 重排**：5 Tab + 职业 Hub + 健康 Hub + 今日作为落地页；「我的」瘦身。
2. **排版 Token** + 替换今日/职业/健康三个 Tab 的字号。
3. **Skeleton + EmptyState** 两个基础组件落地到所有列表。
4. **列表虚拟化**（先做 jobs/market/logs/tasks 四个最长的）+ `expo-image` 替换。
5. 启动副作用延后 + 死资源清理。
- **验收**：25 屏全部可达且 ≤2 次点击；长列表 ≥55 FPS；冷启动 TTI ≤1.8s（中端机）；包体不增。

## P1（精美与手感）
6. 卡片三变体收敛 + Sheet-first 快捷操作（打卡/记录/新增）。
7. 动效与触感词汇表统一 + reduce-motion 全量覆盖。
8. 空态/离线态/错误态统一；下拉刷新补齐。
9. 暗色（Night Voyage）逐屏打磨 + Dynamic Type 截断修复。
- **验收**：真机（iOS + Android 各 1 台）逐屏走查问题清单清零；对比度达标。

## P2（工程化与发布）
10. 版本单一事实源脚本 + 一键构建自检脚本。
11. 图标 iOS 变体 + 启动图配色 + 权限收敛 + 预测返回。
12. 包体瘦身（R8/资源裁剪/按需导入）+ TTI/包体埋点基线。
13. OTA 静默检查 + 上架素材。
- **验收**：一条命令从干净工作区产出可上架 APK，MD5 与备案一致；包体 ≤70MB；OTA 提示可用。

---

# 9. 待确认决策点（请逐条拍板）

| # | 决策 | 选项 | 我的建议 |
|---|---|---|---|
| **D1** | Tab 结构 | **A. 5 Tab**（今日/学习/职业/健康/我的）<br>B. 4 Tab（今日/学习/成长/我的，"成长"内含职业+健康双 Hub） | **A**：两个领域各自独立更符合「一步到达」，且 5 个仍在 HIG 上限内 |
| **D2** | 首页取舍 | A. 「今日」吸收 dashboard（合并，唯一落地页）<br>B. 今日与 dashboard 并存 | **A**：消灭双首页，减少维护面 |
| **D3** | 长列表方案 | A. 只用 FlatList（零新依赖）<br>B. FlatList + 对 >500 条列表引入 **@shopify/flash-list** | **B**：职位/市场是长列表重灾区，FlashList 收益明显；需登记到 THIRD_PARTY |
| **D4** | OTA | A. 保留自研清单 + 增强（静默检查/角标）<br>B. 迁移到 `expo-updates` | **A**：备案与商店场景更可控，且现有链路已跑通 |
| **D5** | 构建方式 | A. 继续本地 gradle + 自检脚本<br>B. 引入 EAS Build 云构建 | **A**：当前无 iOS 需求，本地可控、零额外成本 |
| **D6** | Android 目标版本 | A. 维持现状<br>B. 提升 targetSdk 并开启预测返回 | **B**：符合商店新规趋势，但需真机回归手势 |
| **D7** | iOS 是否纳入 | A. 本期只做 Android<br>B. 一并做 iOS（需 Apple 开发者账号 + iOS 打包链路） | **A**：先 Android 打磨到位；iOS 作为独立后续阶段（图标变体可先备好） |

> 另需你确认：**P0 是否允许一次性重排 Tab**（会改变你现在的使用习惯，但这是"更简单更快"的前提）。

---

# 10. 明确不做（防止范围蔓延）

- ❌ 不做 WebView 套壳、不做 Web 页面内嵌。
- ❌ 不新建第二套颜色/卡片/动效体系（沿用 `packages/ui` + 移动端 token）。
- ❌ 不改包名、不换签名（备案/微信/商店登记绑定）。
- ❌ 不引入重型 UI 框架（如原生导航重写、第三方组件库整体替换）。
- ❌ 不在本期做 iOS 打包（除非 D7 选 B）。
- ❌ 不为 UI 而牺牲可读性（玻璃不承载信息）。

---

# 11. 风险与回滚

| 风险 | 缓解 | 回滚 |
|---|---|---|
| Tab 重排后用户迷路 | 首启一次性导览（1 屏，非 3 屏）；保留各 Hub 的搜索式入口 | Tab 配置集中在一处，改回 4 Tab 仅需还原单个文件 |
| prebuild 重置签名（高危） | 构建脚本强制先备份 + 断言签名 + apksigner 校验 | keystore 备份在 `.local/keystore-backup/`，随时恢复 |
| 列表改造引入回归 | 逐屏替换 + 每屏单独提交 | 保留旧 ScrollView 分支直到该屏验收通过 |
| 包体上升 | 每阶段记录 APK 体积，超预算即停下查因 | R8/资源裁剪为独立提交，可单独回退 |

---

# 12. 执行进度（滚动更新）

| 阶段 | 状态 | 提交 | 关键产出 |
|---|---|---|---|
| P0-1 IA 重排 | ✅ 完成 | `d541766` | 5 Tab（今日/学习/职业/健康/我的）+ 职业/健康 Hub + 今日为唯一落地页 + 我的瘦身 + 学习快捷入口 |
| P0-2 排版 Token | ✅ 完成 | `12cb67c` | `typography`（8 档）+ `tabularNums`；落到新 Hub 与组件 |
| P0-3 骨架屏/空态 | ✅ 完成 | `177bdd6` | `Skeleton`/`SkeletonList`（微光，尊重 reduce-motion）+ `EmptyState`；接入 jobs/radar/certificates/habits/workout/nutrition |
| P0-4 长列表虚拟化 | ✅ 完成 | `177bdd6` | 引入 FlashList v2（MIT，已登记 THIRD_PARTY）；jobs → FlashList；logs → FlatList |
| P0-5 启动与包体 | ✅ 完成 | `12cb67c`/`abe29c5` | 同步引擎与旧数据迁移延后到首帧后；清理死资源 435.8 KB |
| P1 精美与手感 | ✅ 完成 | `bca2852` | Card 三变体（surface/glass/hero）；`lib/motion.ts` 动效词汇表（含 reduce-motion 收敛）；`useRefreshable` + 6 屏下拉刷新；暗色硬编码色→语义 token（learn 删除区/applications 徽标/career 就绪度/logs/tasks 主按钮）；Sheet-first 已核查无需改造；Dynamic Type 留真机走查 |
| P2 工程化与发布 | 🟡 部分完成 | `7b3a54f` | ✅ 版本单一事实源（gradle→app.json/package.json 由脚本同步，已升 1.3.0/9）✅ 一键构建自检脚本（签名三要素断言 + JDK17 选择 + apksigner MD5 校验 + 包体预算）✅ 内测 APK 已出包并上线（见下）；⏳ 待办：iOS 图标变体 / 启动图配色 / 权限收敛 / 预测返回 / R8 / OTA 静默检查 / 上架素材 |

## P1 / P2(部分) 发布记录（2026-09-15）

```text
版本      : v1.3.0（versionCode 9）
构建      : scripts/build-android-release.ps1 → BUILD SUCCESSFUL（2m18s，arm 双 ABI）
包体      : 65,913,259 B（62.9 MiB）
签名 MD5  : 3057105285981cc18597a95c1370c147（与备案一致 ✅）
SHA256    : 4222e9e14f5b57b6b0264b84d7cf3e94bcca9fd5fd2fd7a356817ea8d8fb2570
下载      : https://learn.yuanabd.cn/download/learn-workbench-v1.3.0.apk
下载页    : https://learn.yuanabd.cn/download.html（含新二维码）
OTA 清单  : https://learn.yuanabd.cn/mobile-update.json → 1.3.0 / code 9
回滚兜底  : v1.2.0 APK 仍在 releases 目录，可随时把 download.html 指回
```

**新增踩坑（已写入看板 43–45）**：① Gradle 工具链要 JDK **17**，系统 JAVA_HOME=21 会触发联网下载（被阻断）→ 必须用仓库内 `.tools/jdk17/Library`；② PowerShell 5.1 下 `.ps1` 脚本含中文必须存为 **UTF-8 with BOM**，否则按 ANSI 解析报「意外的标记」；③ PS 5.1 `$ErrorActionPreference='Stop'` 会把 native stderr（gradle 进度）当终止错误 → 改为重定向日志 + 只看退出码。

**P0 量化结论（待真机复测）**

- 列表：jobs 已由全量挂载改为回收式虚拟化；logs 由 ScrollView 全量 map 改为 FlatList 窗口渲染。
- 加载感知：6 个数据屏由「白屏 + 转圈」改为「骨架屏」，空态由纯文字改为带 CTA 的空态卡。
- 启动：同步引擎/旧数据迁移不再与首帧抢 JS 线程（`InteractionManager.runAfterInteractions`）。
- 包体：清理 435.8 KB 死资源；新增 FlashList（体积增量需在打包后实测）。

> **待真机验证项**（P0 尚未在真机跑过）：5 Tab 的拇指可达性与标签拥挤度、骨架屏与真实内容的高度贴合度、jobs 列表滚动 FPS、冷启动 TTI 前后对比。建议下一步先出一版内测 APK 走查。
