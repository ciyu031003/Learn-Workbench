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
