@AGENTS.md

# CLAUDE.md — apps/mobile (Expo / React Native)

## Purpose
Expo Router app mirroring Web: dashboard, roadmap, tasks, logs, jobs, career, settings. Local AsyncStorage + cloud sync via Web `/api/sync`.

## Surface
- `apps/mobile/app/**` Expo Router screens (Tabs: 首页/学习/招花/职业/我的).
- `apps/mobile/src/**` — `lib`(api/sync/jobs), `components`(`job-detail-modal.tsx`…), `store/app-store.ts`(zustand+persist+sync).

## Key files
- `app.json` — Expo config (`extra.apiUrl`), package `com.yuanabd.learnworkbench`.
- `src/store/app-store.ts` — local state + pending-change sync (changeId 幂等).
- `src/lib/sync.ts` — push/pull to Web API.

## Entry
- `expo-router/entry`; `package.json` `main`. Expo SDK ~57, RN 0.86.

## Dependencies
`expo ~57`, `react-native 0.86`, `expo-router`, `@learn-workbench/{shared,content,ui}`, AsyncStorage, zustand, reanimated, screens, safe-area, gesture-handler.

## Scripts
- `pnpm mobile`. Typecheck `tsc --noEmit`; lint via eslint-config-expo.

## Testing
- Vitest for `src/lib`/store; `pnpm -F mobile test`.

## Notes
- Read exact Expo SDK 57 docs before writing RN code (breaking changes). Sync uses `changeId: uid()`; data user-isolated.

## 手势与 worklet（硬约束，2026-09-18 两次真机闪退的教训）
- worklet（`Gesture.*` 回调 / `useAnimatedStyle` / `useDerivedValue`）**只允许**：读写共享值、调 Reanimated API（`withTiming`/`withSpring`/`withDelay`）、`runOnJS` 转发。**禁止**在里面调用外部普通函数 —— 要复用就抽成带 `"worklet"` 指令的模块函数并单测。
- worklet 引用的**所有局部量必须声明在它之前**：babel/worklets 插件在 worklet **定义处**快照自由变量，声明在后面的量拿到的是 `undefined`（产物把 `const` 降级成 `var`，不报 TDZ），读 `.value` 会在 UI 线程抛错并**直接闪退**。`components/bottom-sheet.tsx` 顶部有「⚠️ 顺序约束」注释，改它之前先读。
- 手势改动必须在 **release 包**真机验证「按下 / 拖动 / 松手 / 取消」四条路径（dev 模式不报错不代表真机不崩）。见看板踩坑 71 / 78 / 79。
- 「乐观 UI + 离线发件箱」的通用规则：只有服务端确认成功才 `load()`；`load()` 一律用 `mergePendingEntries(server, outbox)` 合并待同步条目；界面上必须有「N 条待同步」状态条。见看板踩坑 80。
