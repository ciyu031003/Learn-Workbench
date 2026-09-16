# OPPO / ColorOS 适配方案（触摸失效专项 · 以官方文档为准）

> **触发**：内测用户 OPPO 手机安装后**能打开但全屏点不动**，清后台重开仍无效。
> **状态**：**Phase 1 + Phase 2 路径 A 已实施**（代码 + 构建脚本补丁，v1.3.4 出包）；真机验证中
> **基础**：v1.3.3（versionCode 12，`minSdk 24` / `targetSdk 36` / New Architecture / Expo SDK 57 + RN 0.86）
> **本文取代**：`docs/APP端国产ROM触摸失效适配方案.md`（该文基于推断；本文补齐了 OPPO 官方文档依据与本地实测证据）
> **硬约束（用户明确要求）**：**不得影响其它品牌手机**——全部改动只用标准 Android 属性，**不写任何按厂商分支的代码**，
> 且不采用"只在某一品牌上才有意义"的开关。逐项影响评估见第 4.5 节。

---

# 0. 结论先行（三条，都可复现验证）

```text
① 我们并没有"主动开启 edge-to-edge"：MainActivity 没有 enableEdgeToEdge()，依赖里没有 react-native-edge-to-edge，
   而 gradle.properties 里的 edgeToEdgeEnabled=true 在当前版本**没有任何代码读取**（全量 grep 无命中）→ 它是遗留空开关。
   但我们的 targetSdk=36 + 主题把状态栏/导航栏设成透明 → 形成"伪 edge-to-edge"：
   窗口仍按系统栏内缩，而各屏又额外加了 insets.top 内边距（双重留白），inset 计算在国产 ROM 上最容易错位。

② 我们代码里**唯一**的全屏覆盖层在根布局：SwipeNavigator（position:absolute 四边贴边 + zIndex:60 + pointerEvents="box-none"）。
   它浮在**整个 App** 之上。box-none 在部分 ROM + Fabric 组合下会退化成"整层可点" → 表现正是"界面正常、点哪儿都没反应"。

③ OPPO 官方适配文档明确把「Window inset 变化」列为 Android 15 起的头号兼容性影响项
   （原文：targetSdk 35 起 edge to edge 默认启动，会影响与系统栏相关的布局；Configuration 不再排除系统栏）。
   这与 ① 叠加，就是国产 ROM 上"看得见、点不着"的经典成因。
```

**因此适配方向是**：先把 ② 这类**我们自己的确定性风险**彻底删掉，再把 ① 的 inset 策略**显式化并回到经典布局**（兼容优先：`targetSdk 35` + 官方 opt-out），最后用**真机云测**验证，而不是让内测用户一轮轮试。

---

# 0.5 实施结果（v1.3.4 已落地）

| 项 | 改前（v1.3.3） | 改后（v1.3.4） | 位置 |
|---|---|---|---|
| 全屏覆盖层 | `SwipeNavigator` = 四边贴边 + `zIndex:60` 全屏 View，靠 `pointerEvents="box-none"` 透传 | **两条各自绝对定位的 26pt 窄条**，屏幕中央零覆盖层 | `apps/mobile/src/app/_layout.tsx` |
| 边缘横滑 | 双端常开 | iOS 默认开、**Android 默认关**（可手动打开，见「我的 → 手势」） | `src/lib/edge-swipe.ts`（纯函数 + 单测）、`src/store/app-store.ts`、`src/app/settings.tsx` |
| 系统栏 | `statusBarColor`/`navigationBarColor` = 透明（伪 edge-to-edge） | 跟随画布色 `@color/app_bar_color`（浅 `#FDF8EF` / 深 `#171209`），图标明暗走 `@bool/system_bars_light` | 构建脚本修补 `res/values/styles.xml` + `values-night/` |
| Android 15 强制 edge-to-edge | 无声明（targetSdk 36 无法 opt-out） | `android:windowOptOutEdgeToEdgeEnforcement=true` + **targetSdk 35**（compileSdk 仍 36） | 同上 + `gradle.properties`（`android.targetSdkVersion=35`） |
| 挖孔屏 | 未声明 | `android:windowLayoutInDisplayCutoutMode=shortEdges` | 同上 |
| 预测返回 | `enableOnBackInvokedCallback="true"`（v1.3.1 我加的） | **回到 `false`**（经典返回，Android 15 起默认值本就如此） | 构建脚本修补 `AndroidManifest.xml` |
| 启动期安全存储 | `secureToken.load()` 无超时 | `loadWithTimeout(3000)`，异常/卡住按未登录启动 | `src/lib/secure-token.ts`（+4 单测） |

> 全部原生改动都固化在 `scripts/build-android-release.ps1` 的幂等修补 + 构建后断言里
> （`android/` 不进 git，prebuild 会重建它）；任何一次 prebuild 后重跑脚本都能得到同一个包。

---

# 1. 官方依据（可直接点开核对）

| 来源 | 关键内容 | 对我们的含义 |
|---|---|---|
| **OPPO 开放平台 · 三方应用开发适配指导书**<br>[open.oppomobile.com/documentation/page/info?id=11308](https://open.oppomobile.com/documentation/page/info?id=11308) | OPPO 官方适配总纲（需登录查看正文） | 交付前应作为 checklist 人工过一遍 |
| **OPPO 官方社区 ·「OTalk｜Android 15 新特性解读」**<br>[open.oppomobile.com/bbs/forum.php?mod=viewthread&tid=6274](https://open.oppomobile.com/bbs/forum.php?mod=viewthread&tid=6274) | 原文列出影响兼容性的变更：**Window inset 变化**（targetSdk 35 起 edge-to-edge 默认启动，影响系统栏相关布局）、**Configuration 变化**（不再排除系统栏，影响依赖系统栏尺寸的布局计算）、AndroidManifest TAG 限制、前台服务类型、`BOOT_COMPLETED` 限制、ART 符号可见性、JobScheduler 15 分钟检查、**16KB page size**、Vulkan 替换 OpenGL ES、包名校验 | ① 我们的风险集中在 **inset/Configuration**；② 其余项本文第 2 节已逐条核对 |
| **OPPO 官方资源**（社区页脚） | [云真机调试](https://open.oppomobile.com/new/introduction?page_name=cloudmachine) · [适配支持/自检](https://open.oppomobile.com/new/introduction?page_name=autotest) · [OPPO 软件商店上架要求](https://open.oppomobile.com/new/messageDetails?id=33&type=1) | **出包前先在真实 ColorOS 机型上验证**，不再依赖内测用户反复试 |
| **Android 平台行为变更**<br>[Android 15](https://developer.android.com/about/versions/15/behavior-changes-15) · [Android 16](https://developer.android.com/about/versions/16/behavior-changes-16) | Android 15 起 targetSdk 35 强制 edge-to-edge，并提供 `windowOptOutEdgeToEdgeEnforcement` 逃生开关；Android 16 起 targetSdk 36 **忽略**该开关 | 给了我们两条明确路径：**降 targetSdk 35 + opt-out（兼容优先）** 或 **36 + 真 edge-to-edge（insets 必须做对）** |
| **Expo 变更**<br>[PR #42518「remove deprecated edgeToEdgeEnabled field」](https://github.com/expo/expo/pull/42518) | `edgeToEdgeEnabled` 已废弃 | 印证第 0 节 ①：这个开关在新版本里不再起作用 |

---

# 2. 已核对 / 已排除的项（OPPO 官方清单逐条过）

| OPPO 官方清单项 | 我们的状态 | 结论 |
|---|---|---|
| **16KB page size**（Android 15+ 新机型内核） | 本地实测 `zipalign -c -P 16 -v 4`：**1287 个条目全部 OK**，`lib/*/**.so` 均满足 16KB 对齐 | ✅ 通过（若不通过会安装失败/启动崩） |
| AndroidManifest TAG 数量 / 属性长度限制 | 由 aapt2 正常构建并安装成功 | ✅ 通过 |
| 前台服务类型与权限 | 未使用前台服务（同步走 AppState/NetInfo，无 `expo-notifications`） | ✅ 不涉及 |
| `BOOT_COMPLETED` 限制 | 无开机广播接收器 | ✅ 不涉及 |
| JobScheduler 15 分钟检查 | 未使用 JobScheduler/WorkManager | ✅ 不涉及 |
| ART 符号可见性 / Vulkan 替换 | 纯 RN/Hermes，无自定义 native 符号依赖；RN 0.86 自带适配 | ✅ 不涉及 |
| ABI | `armeabi-v7a` + `arm64-v8a`（未打 x86 进正式包） | ✅ 正常 |
| 包名校验 | `com.yuanabd.learnworkbench`，与备案一致 | ✅ 通过 |
| **Window inset 变化 / Configuration 变化** | 见下节（**未适配**） | ❌ **要做** |
| 挖孔屏 / 刘海屏声明 | 清单**未声明** `windowLayoutInDisplayCutoutMode` | ❌ **建议补**（OPPO 指导书要求项） |
| 小窗 / 分屏 / 兼容容器 | 清单未声明 `resizeableActivity` | ❌ **建议补 `false`** |

---

# 3. 仍存在的风险点（含代码位置与判定方法）

| # | 位置 | 现状 | 判定/证据 |
|---|---|---|---|
| A | `apps/mobile/src/app/_layout.tsx` L113-125 | 全屏 `SwipeNavigator`：`position:absolute; top/left/right/bottom:0; zIndex:60; pointerEvents="box-none"`，左右 26pt 为 `Pan` 手势条 | 全项目 grep 只有它有全屏覆盖 + `zIndex`；`celebration`/`daily-background`/`progress-arc`/`surface` 都已带 `pointerEvents="none"` 或渲染在内容之下（已逐个核对） |
| B | `android/app/src/main/res/values/styles.xml` | `android:statusBarColor`/`navigationBarColor` = **transparent**，但窗口并未真正 edge-to-edge | "伪 edge-to-edge"：窗口按系统栏内缩 + 各屏又加 `insets.top + N` → 双重留白；inset 语义在 ROM 上易错 |
| C | APK 实测（aapt2） | `targetSdkVersion 36` | OPPO 官方指出 35 起 edge-to-edge 默认启动；36 更严且无法 opt-out |
| D | 清单 `application` | `android:enableOnBackInvokedCallback="true"`（**v1.3.1 起，我加的**） | 仅影响返回手势，但属"非必要风险"；ColorOS 对预测返回实现不完整时可能干扰系统手势 |
| E | 清单 `activity` | `launchMode="singleTask"`、未声明 `resizeableActivity` | 小窗/分屏/兼容模式下坐标映射可能异常 |
| F | 启动链路 `_layout.tsx` | `secureToken.load()`（系统 Keystore）、`startSyncEngine()`、`migrateLegacySports()`、`silentCheckForUpdate()` | ColorOS Keystore 有已知毛病；若卡住，表现同样是"界面在、点不动"（可用诊断包区分） |

---

# 4. 适配方案（四阶段，Phase 1–2 是出包内容）

> **执行状态**：Phase 1 的 1.1 / 1.2 / 1.3 / 1.5 与 Phase 2 路径 A **已实施**；
> 1.4 除 `resizeableActivity` 外已实施——**刻意不设 `android:resizeableActivity="false"`**，理由见 4.5。

## Phase 1 · 删掉我们自己的确定性风险（零风险、纯收益）

| # | 改动 | 文件 | 说明 |
|---|---|---|---|
| 1.1 | **删除全屏手势层**：`SwipeNavigator` 不再用全屏 View 包裹，而是**直接渲染左右两条 26pt 绝对定位竖条**（`left:0` / `right:0`，`height:'100%'`）。屏幕中央**不存在任何覆盖层** | `app/_layout.tsx` | 最坏情况只失去"边缘横滑切 Tab"这一锦上添花能力 |
| 1.2 | **边缘横滑改为设置项，默认关** | `app/_layout.tsx` + `app/settings.tsx` + store | 能力与风险解耦；用户想要可自行打开 |
| 1.3 | **系统栏回到经典策略**：去掉 `statusBarColor/navigationBarColor` 透明，改为跟随画布色（或不设，交系统默认），并显式依赖 `SafeAreaInsets`；同时把各屏 `insets.top + N` 的叠加改为"仅在真 edge-to-edge 时加"，消除双重留白 | `styles.xml` + 各屏 | 让"窗口是否内缩"变成唯一确定的事实，不再有 ROM 解释空间 |
| 1.4 | **清单对齐 OPPO 指导书**：`android:windowLayoutInDisplayCutoutMode="shortEdges"`（挖孔屏）、`android:resizeableActivity="false"`（禁小窗/分屏/兼容容器）、`android:enableOnBackInvokedCallback="false"`（撤掉 v1.3.1 的预测返回） | `app.json`（`expo-build-properties`/`android`）+ 构建脚本的原生修补步骤与断言 | 与 v1.3.2 起「原生清单修补固化进构建脚本」的做法一致，prebuild 后也不会丢 |
| 1.5 | **启动不阻塞保险**：`secureToken.load()` 加 try/catch + 3s 超时（超时按未登录启动）；同步引擎延后到首个交互后 | `app/_layout.tsx`、`lib/secure-token.ts` | 排除"JS 被 Keystore 卡住"这一类 |

## Phase 2 · targetSdk 策略（按官方行为变更二选一）

**路径 A · 兼容优先（建议作为本轮内测包）**
- `expo-build-properties` → `android.targetSdkVersion: 35`（`compileSdkVersion` 保持 36）
- 主题加 `android:windowOptOutEdgeToEdgeEnforcement=true`（Android 15 官方逃生开关；对 targetSdk 35 生效）
- 效果：**彻底回到"系统栏占位、内容内缩"的经典布局**，把 OPPO 官方点名的 Window inset / Configuration 变更影响降到零。
- 合规：OPPO/小米/vivo/华为商店的公开门槛是 `targetSdkVersion ≥ 30`（OPPO 官方公告），35 远超；Google Play 新应用门槛为 35，同样满足。

**路径 B · 现代路径（后续可选，需要真机验收）**
- `targetSdkVersion 36` + 真 edge-to-edge：调用 `enableEdgeToEdge()`（或引入 `react-native-edge-to-edge`），并把**所有**屏幕的内边距改成真实 insets 逻辑（去掉现在的 `insets.top + N` 叠加）
- 代价：Android 16 起 36 无法 opt-out，必须 insets 全对；且需在多种 ROM 上回归

> 建议：**本轮先走 A**（内测用户马上能用），A 稳定后再评估 B。**A 已实施**（`android.targetSdkVersion=35`）。

## 4.5 跨品牌无损影响评估（硬约束：其它品牌手机必须照常可用）

前提：**没有一行按厂商分支的代码**（无 `Build.MANUFACTURER` 判断、无 OEM 专属开关）。所有改动都是标准 Android 属性或纯 JS 层：

| 改动 | 影响面 | 是否有品牌差异 | 判定 |
|---|---|---|---|
| 删全屏手势覆盖层 + 窄条绝对定位 | 所有平台 | 无 | ✅ 纯收益：任何 ROM 都不再可能被整层吃掉触摸 |
| 边缘横滑 Android 默认关（可开） | 所有 Android 品牌**完全一致** | 无（只按 `Platform.OS`） | ✅ 反而消除了与 Android 系统返回手势的冲突 |
| 系统栏改跟随画布色（不再透明） | 所有品牌视觉一致；`values-night` 自动跟随深色 | 无 | ✅ 视觉微调，无功能损失 |
| `windowOptOutEdgeToEdgeEnforcement` + targetSdk 35 | Android 15/16 上回到经典"内容内缩"布局；Android 14 及以下无此概念，行为不变 | 无 | ✅ 官方提供的行为开关，Google/各家文档一致 |
| `windowLayoutInDisplayCutoutMode=shortEdges` | 挖孔屏设备允许内容延伸进挖孔区，安全区由 `SafeAreaInsets` 兜底 | 无 | ✅ 所有挖孔屏机型一致（本就该有） |
| `enableOnBackInvokedCallback=false` | Android 13+ 回到经典返回路径 | 无 | ✅ 经典路径在 RN 生态是兼容性最好的选择 |
| `secureToken.loadWithTimeout` | 所有平台 | 无 | ✅ 纯保险 |
| **`resizeableActivity="false"`（原方案 1.4 的一项，最终不做）** | 会让**所有**手机/平板失去分屏与小窗能力；且 Android 16 起对大屏本就忽略该属性，收益为 0 | 无（但代价由所有品牌承担） | ❌ **放弃**：与"不影响其它品牌"冲突，收益不可验证 |
| ABI 不变（armeabi-v7a + arm64-v8a） | 所有品牌一致 | 无 | ✅ 保持现状 |

**回归矩阵（每次出包必过）**：

| 层 | 用例 |
|---|---|
| 单元/集成 | `pnpm -F mobile test`（20 文件 160 用例，含 `edge-swipe`/`secure-token` 新用例）、`pnpm -F web test` |
| 静态 | `pnpm -F mobile typecheck`、`pnpm -F mobile lint`（0 error） |
| 产物核验 | `aapt2 dump badging`：`targetSdkVersion 35`、`minSdk 24`、`enableOnBackInvokedCallback=false`；`zipalign -c -P 16 -v 4` 全 OK；`apksigner` MD5 = 备案值 |
| 模拟器 | API 35 / API 36 各起一台：五 Tab 切换、列表滚动、弹层开合、输入聚焦、返回手势（**跨品牌代表：非 OPPO 平台的 Android**） |
| 云真机 | 腾讯 WeTest 云手机（OPPO/ColorOS 机型）+ 后续 OPPO 官方云真机（实名认证审核通过后）|
| 现场 | 内测用户复测：能点、能切 Tab、能滚动、能开弹层、能记一条饮食 |

## Phase 3 · 真机验证（不再让内测用户当小白鼠）

### 3.1 路线说明（实测约束）

| 平台 | 状态 | 说明 |
|---|---|---|
| **OPPO 官方云真机** | ⛔ 暂不可用 | `open.oppomobile.com` → 管理中心只放行「选择认证」：**账号未实名认证时云测服务菜单不出现**（实测截图留档）。已提交个人开发者实名认证，**审核 1–3 天**，通过后回到本路线（最贴近现场） |
| **腾讯 WeTest 云手机（云真机）** | ✅ 采用 | [wetest.qq.com/products/cloud-phone](https://wetest.qq.com/products/cloud-phone)：真实 OPPO/ColorOS 机型、支持上传 APK、截图 + 实时日志 + ADB 模式；按分钟计费（新账号可能有体验额度） |
| 本地 Android 模拟器 | ✅ 兜底 | API 35/36，用于跨品牌行为回归（不代表 ColorOS） |

### 3.2 云真机五点触控自检（每次出包在 ColorOS 机型上跑一遍）

1. 五个底部 Tab 逐个点击 → 页面都切换
2. 长列表上下滚动（今日 / 学习 / 招花）
3. 打开任意弹层（饮食录入 Sheet / 任务详情）再关闭
4. 输入框聚焦并输入（登录用户名）
5. 系统返回手势 / 返回键退回上一屏
6. 附加：`adb shell` 抓 `logcat` 看有无 `ANR` / 触摸事件是否到达 RN（`InputDispatcher` 相关）

### 3.3 官方自检工具（OPPO 实名通过后补跑）

- **适配自检/适配支持**（[autotest](https://open.oppomobile.com/new/introduction?page_name=autotest)）：跑官方兼容性自检，收集报告
- **适配指导书**（[doc id=11308](https://open.oppomobile.com/documentation/page/info?id=11308)，需登录）：交付前人工过一遍 checklist


## Phase 4 · 兜底与远程观测（按需）

- **诊断构建**（单独 APK，仅发给需要的测试者）：首屏顶部「JS 心跳 / 触摸计数 / insets 实测值 / 机型 / Android 版本」，并可导出文本日志
- **客户端日志上报**：新增轻量端点（如 `POST /api/internal/client-log`，写入 `task_runs` 或独立表），记录启动、首个触摸、异常堆栈 → 下次同类问题可远程定位，不用来回问
- **给内测用户的一页「ColorOS 小贴士」**：应用管理里关闭「应用兼容模式/全屏显示开关」、电池里设为「允许后台」、关闭「应用速冻」、不要放进小窗/分屏

---

# 5. 验收标准

- 云真机（ColorOS 机型）：五点触控自检全绿，无一次"点了没反应"
- 本机 Android 模拟器（API 35/36）冒烟通过
- 内测用户复测：能点、能切 Tab、能滚动、能开弹层、能记一条饮食
- 回归确认：非 OPPO 品牌 Android 行为与 v1.3.3 一致（除视觉/边缘横滑默认值）；iOS 保留边缘横滑

---

# 6. 风险与回滚

| 风险 | 缓解 | 回滚 |
|---|---|---|
| 降 targetSdk 到 35 影响新特性 | 只影响 Android 15 的强制 edge-to-edge，功能无损失；compileSdk 仍 36 | `scripts/build-android-release.ps1` 里 `android.targetSdkVersion` 改回 36（一行） |
| 去掉边缘横滑后体验变差 | 默认关但保留开关；底部 Tab 与返回键不受影响 | 「我的 → 手势」打开，或在 `lib/edge-swipe.ts` 改平台默认 |
| 删覆盖层引入手势回归 | 改动只在根布局一个函数，且 iOS 保留原能力 | 单文件 revert |
| 原生改动被 prebuild 覆盖 | 已把清单/主题/资源/targetSdk 修补**固化进构建脚本**并加构建后断言 | 脚本内开关 |

---

# 7. 待办（与责任方）

| # | 事项 | 责任方 | 状态 |
|---|---|---|---|
| 1 | OPPO 开放平台个人开发者**实名认证**（云真机前置条件） | 用户 | 🕓 已提交，审核中（1–3 天） |
| 2 | 腾讯 WeTest 云手机**登录**（手机号 + 短信验证码，腾讯滑块验证码） | 用户 | 🕓 待登录 |
| 3 | v1.3.4 出包 + 产物核验（targetSdk/清单/16KB/签名） | 我 | 🔄 进行中 |
| 4 | 云真机触控自检 + 模拟器跨品牌回归 | 我 | ⏳ 待 2/3 完成 |
| 5 | 内测用户复测（同一台 OPPO 手机） | 用户/内测 | ⏳ 待发布 |
| 6 | 内测机型信息（型号 / ColorOS / Android 版本、是否简易模式/大字/悬浮球类 App） | 用户 | ⏳ 拿不到则按最坏情况兼容 |

