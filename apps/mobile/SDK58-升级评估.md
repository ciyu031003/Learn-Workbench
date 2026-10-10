# Expo SDK 58 升级评估（组一 · 阶段 5）

> 评估日期：2026-10-10 · 当前基线：`expo ~57.0.12` / RN `0.86.2` / react `19.2.3`
> **结论：本轮不升级，且不执行 `expo install --fix`。** 理由见 §2（决定性阻断项）与 §3。

## 1. 事实矩阵（数据来源）

- 官方 SDK 版本表：`GET https://api.expo.dev/v2/versions/latest`（`sdkVersions["58.0.0"]`）
- 官方原生模块映射：`GET https://api.expo.dev/v2/sdks/58.0.0/native-modules`（124 项）
- 本地现状：`apps/mobile/package.json` + `npx expo install --check`

| 包 | 当前 | SDK 58 目标 | 判断 |
|---|---|---|---|
| `expo` | `~57.0.12` | `~58.0.7` | 主线升级 |
| `react-native` | `0.86.2` | **`0.88.0-rc.4`** | ⛔ **RC（预发布）** |
| `react` | `19.2.3` | `19.3.0` | 次版本 |
| `typescript`（dev） | （当前 SDK 57 线） | **`~6.0.3`** | ⚠️ 主版本跃迁 |
| `metro` | （当前线） | `^0.84.6` | 需同步 |
| `react-native-reanimated` | `4.7.0` | `4.7.0` | ✅ 已一致 |
| `react-native-worklets` | `0.13.0` | `0.13.0` | ✅ 已一致 |
| `react-native-screens` | `~4.28.0` | `~4.28.0` | ✅ 已一致 |
| `@shopify/flash-list` | `^2.3.2` | `2.3.2` | ✅ 已一致 |
| `react-native-gesture-handler` | `~2.32.0` | **`~3.2.1`** | ⚠️ 主版本跃迁（2 → 3） |
| `react-native-safe-area-context` | `~5.7.0` | `~5.9.1` | 次版本 |
| `react-native-keyboard-controller` | `1.21.9` | `1.22.4` | 补丁 |
| `expo-router` | `~57.0.12` | `~58.0.17` | 主线升级 |
| 其余 `expo-*`（image / font / file-system / image-picker / network / splash-screen / build-properties / constants / secure-store …） | `57.x` | `58.x` | 主线升级 |

## 2. 决定性阻断项

**SDK 58 把 React Native 钉在 `0.88.0-rc.4`（release candidate）。**
本项目当前生产线（`v1.41.0 / 63`，已 OTA 推送）跑在 RN `0.86.2` 稳定版上；把发布线切到 RC
与项目自定规则冲突（“真机回归通过才随版本发布，不与修复线混版”），且 RC 期的原生行为变更
往往要到正式版才收敛。

## 3. 次要风险

1. **`react-native-gesture-handler` 2 → 3 主版本**：本项目的 `BottomSheet`（下滑关闭 + 拖拽扩展）、
   `swipe-row`、雷达/训练等手势都建立在它之上，主版本跃迁必须做**手势回归**而不是"装完就发"。
2. **`typescript ~6.0.3`**：TS 主版本会改变部分类型推断，本仓库 `pnpm typecheck` 是强门禁，
   升级需要单独一轮"只升 TS"的改动，不要和 SDK 升级混在一起。
3. **`react 19.3.0`**：与 RN RC 联动，需一起升。
4. **不要对 SDK 57 跑 `expo install --fix`**：`--check` 建议的版本里
   `react-native-reanimated` 4.7.0 → 4.5.1、`worklets` 0.13.0 → 0.10.1、`screens` 4.28.0 → 4.26.0
   都是**降级**；而这三个值恰好等于 **SDK 58 的目标值** —— 说明当前树是"SDK 58 的原生模块线 + SDK 57 运行时"，
   把 reanimated/worklets 降回去反而会破坏现有手势与动效（`SPRING`、worklets 依赖）。

## 4. 触发条件（满足任一即可启动升级）

- RN `0.88.0` 正式版（非 rc/preview）发布，且 Expo 把它写进 `api.expo.dev` 的 SDK 58 映射；
- 或者：SDK 59 起把 RN 收敛到稳定版（届时直接评估 59）。

## 5. 升级清单（届时按序执行，独立分支）

1. 建分支：`codex/sdk-58-upgrade`（基线快照：当前 `main`，便于随时丢弃）。
2. 只改 `apps/mobile`：`npx expo install expo@~58.0.7` → `npx expo install --check` 逐项确认
   （**不要**直接 `--fix`，先看它会降级什么）。
3. 原生项目重生成：`npx expo prebuild --clean`（`apps/mobile/android` 是 gitignore 的生成产物），
   核对 `app.json`/`build-properties` 里的 `targetSdk`、`edgeToEdgeEnabled`、ABI 是否保持 24/35/arm64+armv7。
4. 单独一轮只升 TypeScript 到 6.x，跑 `pnpm typecheck` 收敛类型问题。
5. `gesture-handler 3.x` 手势回归：BottomSheet 下滑关闭/拖拽扩展、swipe-row 左滑、长按拖拽。
6. 门禁全绿：`pnpm typecheck` / `pnpm lint` / `pnpm -F mobile test` / `lint:fontscale` / `lint:ui-matrix` / `lint:motion`。
7. 真机矩阵（沿用看板「真机回归清单」8 项）+ 低端机帧率基线复测。
8. 只有 7 通过，才并入发布批次（`versionCode` 顺延，走 `scripts/release.mjs` 一键发布）。

## 6. 本轮对后续阶段的影响

- 组二（内容平台）与组三（工程支柱）**不依赖** SDK 58，可以继续推进；
- 阶段 18（CI/CD 补强）里若加入 Expo 依赖校验，应使用**白名单**而不是 `expo install --check` 的原始输出，
  否则会把上面那几个"故意领先"的版本判成违规。
