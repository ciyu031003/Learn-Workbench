# APP 端国产 ROM（OPPO/ColorOS 等）触摸失效适配方案

> **触发**：2026-09-16 内测反馈 —— OPPO 手机装好 APK 后**能打开但全屏点不动**；清后台重开仍然点不动。
> **状态**：**方案待确认，未改代码**
> **基础**：v1.3.3（versionCode 12，targetSdk 36 / minSdk 24 / New Architecture / edge-to-edge）
> **配套**：`docs/APP端优化方案-v2-问题修复与UI精修.md`、`docs/APP端饮食健康模块-UI与交互优化方案-v3.md`、`docs/改动记录与任务看板.md`（踩坑点）

---

# 0. 先给结论

**这不一定是「OPPO 不适配」这一个原因**，但**我们的构建配置确实踩在了国产 ROM 最容易出触摸问题的组合上**：
`targetSdk 36 + edge-to-edge（透明状态栏/导航栏）+ New Architecture（Fabric）+ 一个全屏 box-none 手势层`。

按「证据 + 可验证性」排序，最可能是这三条之一（也可能是两条叠加）：

| 排序 | 原因 | 为什么怀疑它 | 30 秒自检方法 |
|---|---|---|---|
| **1** | **edge-to-edge + 高 targetSdk 在 ColorOS 上导致的窗口/触摸区域错位**（尤其被系统放进「兼容模式/小窗/非全屏」时） | 我们 `targetSdk=36`、`edgeToEdgeEnabled=true`、`statusBarColor/navigationBarColor=transparent`；Android 15+ 强制 edge-to-edge，而部分 ColorOS 版本对 SDK 35/36 的 inset 处理不完整 —— 典型症状正是「界面能看见、点哪儿都没反应」 | 打开**开发者选项 → 指针位置**，手指在屏幕上划：<br>① 有轨迹但 App 无反应 → 触摸到了系统，App 窗口区域不对（本原因）<br>② 连轨迹都没有 → 系统层拦截/屏幕/手套模式 |
| **2** | **根布局里的全屏手势层吞掉触摸**：`_layout.tsx` 的 `SwipeNavigator` 是 `position:absolute; top/left/right/bottom:0; zIndex:60; pointerEvents="box-none"`，浮在**整个 App** 之上 | 这是全项目**唯一**一个全屏覆盖层（已全量 grep 确认）；`box-none` 在部分 ROM + Fabric 组合下会退化成「整层可点」，于是一屏都点不动 | 若「设置」Tab 里的开关也点不动、但**底部 Tab 能点** → 是这个层只吞了内容区；若**连 Tab 都点不动** → 更可能是 1 或 3 |
| **3** | **JS 线程启动后被卡住**（设备特定：Keystore/网络/同步） | 界面已经渲染出来 = JS 至少跑过一次；若之后被阻塞，点击不会有任何反馈（按压态都不出现），与「点不动」完全一致 | 如果是这个，**状态栏时间在走、但任何按压都没有水波纹/缩放**；且「返回键」可能仍有效（原生处理） |

> 还有一条我**主动改了但收益很小、风险不明**的项：v1.3.1 起我把清单里
> `android:enableOnBackInvokedCallback` 打开了（预测返回）。它只影响返回手势，理论上不该影响点击，
> 但既然只是"锦上添花"，安全模式包里我会先关掉。

---

# 1. 我们代码/构建里与「触摸失效」相关的全部可疑点（已逐个定位）

| # | 位置 | 现状 | 风险 |
|---|---|---|---|
| A | `apps/mobile/src/app/_layout.tsx` L113-125 | 全屏 `SwipeNavigator`：`box-none` + `zIndex: 60` 覆盖所有页面，左右各 26pt 是 `Pan` 手势条 | **高**：唯一全屏覆盖层；`box-none` 退化即全屏失效 |
| B | `apps/mobile/android/gradle.properties` | `edgeToEdgeEnabled=true`（Expo 默认） | **高**：国产 ROM 上窗口 inset/触摸区域错位的主因 |
| C | `apps/mobile/android/app/src/main/res/values/styles.xml` | `android:statusBarColor`/`navigationBarColor` = transparent，无 `windowOptOutEdgeToEdgeEnforcement` | **高**：同上；没有为 Android 15 的强制 edge-to-edge 留逃生门 |
| D | APK 实测（aapt2） | `targetSdkVersion 36`、`minSdkVersion 24` | **中高**：targetSdk 越高，越容易被 ROM 用新行为（含兼容模式）接管 |
| E | 清单 `application` | `android:enableOnBackInvokedCallback="true"`（v1.3.1+），`usesCleartextTraffic="false"` | **低**（仅返回手势），但属"非必要风险" |
| F | 清单 `activity` | `launchMode="singleTask"`、`screenOrientation="unspecified"` + 运行时 `lockAsync(PORTRAIT_UP)` | **低**：`singleTask` 在部分 ROM 的分屏/小窗下行为怪异 |
| G | `components/celebration.tsx` / `daily-background.tsx` / `progress-arc.tsx` / `surface.tsx` | 覆盖层均带 `pointerEvents="none"` 或渲染在内容**之下** | 无风险（已核对） |
| H | 启动链路 `_layout.tsx`：`startSyncEngine()`、`migrateLegacySports()`、`silentCheckForUpdate()`、`secureToken.load()` | 都在首帧后异步跑；`secureToken` 走系统 Keystore | **中**：ColorOS 的 Keystore 实现有已知毛病，若同步抛错/卡住会表现为「界面在、点不动」 |

---

# 2. 适配方案（分三级，可按级实施）

## 级别 1 · 「安全模式」包（**建议立刻做**，风险极低、命中率最高）

目标：把所有「可能吞触摸 / 可能被 ROM 特殊对待」的项一次性关掉，让内测用户先能用起来；同时保留开关，后续再逐项打开验证。

| 改动 | 具体做法 | 为什么安全 |
|---|---|---|
| **1.1 去掉全屏手势层** | `SwipeNavigator` 不再用一个全屏 `View` 包两个边缘条，而是**直接渲染两个绝对定位的 26pt 竖条**（左侧 `left:0`、右侧 `right:0`，`height:'100%'`）。这样屏幕中央**根本不存在覆盖层** | 纯删除风险面；最坏情况只是失去"边缘横滑切 Tab"这个锦上添花的能力（底部 Tab 与返回键仍在） |
| **1.2 边缘横滑改为可选、默认关** | 新增设置项「边缘横滑切换标签」（默认 **关**，iOS 也建议关），开启后才挂手势条 | 把能力与风险解耦；用户想要随时开 |
| **1.3 退出强制 edge-to-edge** | 在主题里加 `‹item name="android:windowOptOutEdgeToEdgeEnforcement"›true‹/item›`（`values-v35`），保留透明状态栏但**不参与 Android 15 的强制 edge-to-edge**；同时显式设置 `windowLightStatusBar`/`windowLightNavigationBar` 以保证图标对比 | 这是国产 ROM 上最有效的一招：避免窗口被系统重排成"看得见点不着" |
| **1.4 targetSdk 36 → 34** | `app.json` 的 `expo-build-properties.android.targetSdkVersion=34`（compileSdk 仍 36） | 34 避开 Android 15 的强制 edge-to-edge 与部分 ROM 的新行为分支；且仍满足各商店 2025 年的 targetSdk ≥34 要求 |
| **1.5 关掉预测返回** | `android.predictiveBackGestureEnabled` 改回 `false`（构建脚本的清单断言同步调整） | 只损失一个动画糖 |
| **1.6 `resizeableActivity=false`** | 清单 `application` 加 `android:resizeableActivity="false"` | 阻止 ROM 用分屏/小窗/兼容容器承载本应用，避免坐标映射出错 |
| **1.7 启动链路加"不阻塞"保险** | `secureToken.load()` 包 try/catch + 3s 超时（超时就按未登录启动）；`startSyncEngine` 同样延后到首次交互之后 | 排除「Keystore 卡住 → JS 忙等」这一类 |

**验收**：内测 OPPO 机上「点哪儿哪儿有反应」；底部 Tab 五个都能切；列表能滚动；弹层能开合。

## 级别 2 · 「诊断」包（与级别 1 同时出，专门用来定位真凶）

在**首屏顶部**加一条可关闭的诊断条（仅诊断包启用，正式包不显示）：

```text
┌───────────────────────────────────────────────┐
│ JS ● 运行中 128s   触摸 0 次   安全模式 [开]   │
└───────────────────────────────────────────────┘
```

- `JS ● 运行中 Ns`：每秒 +1。**若数字不动 → 原因 3（JS 被卡住）**；能动能秒级响应 → JS 正常。
- `触摸 N 次`：在根视图加 `onStartShouldSetResponderCapture` 或 `onTouchStart` 计数。
  **数字为 0 但手指确实点了 → 原因 1/2（窗口区域或覆盖层）**；数字在涨但按钮无反应 → 事件到了但被某层吃掉（可用 1.1 排除）。
- `安全模式 [开]`：一键切「关边缘滑动 / 重载 UI（`RNRestart` 不支持则提示重启）」。
- 诊断包还应把关键事件写到**本地可读文件**（`FileSystem.documentDirectory/diag.log`：启动、每 10s 心跳、触摸计数、`Dimensions` 与 `SafeAreaInsets` 实测值、`Platform.Version`、`Device.modelName`），让内测用户在「设置 → 分享诊断日志」里一键发给我们（走已有的 `/api/*` 或分享文本）。

> 这张诊断条能把 4 个候选原因收敛到 1 个，避免我们再靠猜发下一版。

## 级别 3 · 系统性适配（拿到诊断结论后按需做）

| 主题 | 做法 |
|---|---|
| **insets 正确性** | 全量核对 `useSafeAreaInsets()` 在国产 ROM 上是否给到正确值（尤其手势导航 vs 虚拟键）。若给 0，改为读 `expo-navigation-bar` 的可见性 + 兜底常量，避免内容被导航栏压住/窗口高度算错 |
| **手势冲突** | 边缘手势一律避开系统手势区：左右各留 ≥44pt（Android 10+ 返回手势热区），或只在「无系统手势导航」时启用 |
| **前台保活/ANR 观测** | 在诊断包里加 ANR/卡顿埋点：`InteractionManager` 任务耗时 + 首帧后心跳；配合 `adb logcat`（若能拿到）确认 `ANR in com.yuanabd.learnworkbench` |
| **ROM 特性清单** | 写进交付说明：应用管理里关闭「应用兼容模式/全屏显示开关」、电池「允许后台」、关闭「应用速冻」；分屏/小窗下若异常请退出小窗 |
| **回归矩阵** | 至少覆盖：小米 HyperOS、OPPO ColorOS、vivo OriginOS、荣耀 MagicOS、华为 HarmonyOS(Android 兼容) 各 1 台；每台跑「五点触控自检」：Tab 切换 / 列表滚动 / 弹层 / 输入框 / 返回手势 |

---

# 3. 需要内测用户提供的 4 条信息（决定走哪条路）

1. **机型 + ColorOS/Android 版本**（设置 → 关于手机），以及是否 ColorOS 15/Android 15+
2. **装的哪个版本**：设置页「关于」显示 `苦旅 v1.3.3`？（我们每次发包版本号不同，能直接缩小范围）
3. **界面呈现**：是否**全屏**？有没有黑边/上下留白/被放进**小窗或分屏**？（对应原因 1）
4. **两个 30 秒自检**：
   - 开发者选项 → **指针位置**：手指划过屏幕，有没有轨迹线？
   - 手指点底部「今日 / 学习 / 职业 / 健康 / 我的」这五个 Tab，**有没有任何按压反馈**？

> 最理想是再拿到一份 `adb logcat -d | grep -i -E "learnworkbench|ANR|Fabric|touch"`；
> 拿不到也没关系，诊断包能替代。

---

# 4. 执行计划（确认后我按此做）

| 步骤 | 产出 | 用时 |
|---|---|---|
| S1 | 级别 1 全部改动（1.1–1.7）+ 级别 2 诊断条与日志 | 一轮 |
| S2 | 双包：`v1.3.4`（安全模式，正式发内测）+ `v1.3.4-diag`（诊断，单独给你转给 OPPO 用户） | 一轮 |
| S3 | 内测用户回 4 条信息 + 诊断条截图 → 定位真凶 | — |
| S4 | 按结论做级别 3 的对应项，再出 `v1.3.5`；随后逐项恢复被关掉的能力（先恢复预测返回，再恢复边缘横滑） | 按需 |
| S5 | 多 ROM 回归矩阵（小米/OPPO/vivo/荣耀/华为各一台）+ 交付说明里补「国产 ROM 使用小贴士」 | 按需 |

**回滚**：每次只动 manifest/主题/一个组件，且都保留旧实现于 git；`targetSdk` 若因商店要求必须回到 35/36，则保留 1.3 的 `windowOptOutEdgeToEdgeEnforcement` 与 1.1/1.2 的覆盖层移除 —— 这两条与 targetSdk 无关，本身就是净收益。

---

# 5. 一句话总结

```text
国产 ROM 上「能开、能看、点不动」八成不是我们的业务代码，而是
  ① 强制 edge-to-edge + 高 targetSdk 让窗口/触摸区域被系统重排，
  ② 我们自己在根布局放了一个全屏 box-none 手势层（唯一全屏覆盖层）；
  ③ 小概率是 JS 线程被设备特有的 Keystore/同步卡住。

安全模式包把这三条同时拆掉（覆盖层删除 + 退出 edge-to-edge + targetSdk 34 + 关预测返回 + 保活保险），
诊断包用「JS 心跳 / 触摸计数 / insets 实测」把真凶钉死，再逐项恢复能力。
```
