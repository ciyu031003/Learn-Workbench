# shared/domains —— 双端一致性口径（S5-1）

> 纯函数、无 I/O、无时区库依赖。Web 与 Mobile **只从这里取口径**：
> `import { computeDailyCompletion, computeStreak, dateKeyInZone, todayISOInZone } from "@learn-workbench/shared/domains"`。

| 文件 | 导出 | 口径 |
|---|---|---|
| `completion.ts` | `computeDailyCompletion`, `DAILY_COMPLETION_WEIGHTS` | 今日完成度 = 学习 40% + 习惯 30% + 运动 15% + 饮食 15%（抽自 Web daily-os 231-256 行） |
| `date.ts` | `todayISOInZone`, `dateKeyInZone`, `addDaysToDateKey`, `isDateKey`, `DEFAULT_TIME_ZONE` | 业务日期统一 **Asia/Shanghai**（决策 D3），Intl.DateTimeFormat 实现，跨零点正确 |
| `streak.ts` | `computeStreak`, `streakEventDateKey` | 连续天数：事件按业务时区归日+去重；今天没打不打断；断一天即中断（与 Web 原实现一致） |

## 单测（Node 内置 runner；shared 无 vitest）

```bash
node --import ./packages/shared/src/domains/node-loader.mjs --test packages/shared/src/domains/domains.test.mjs
```

- 为什么需要 loader：源码按 bundler 习惯写无扩展名相对导入；Node ESM 不做补全 → `resolve-ts-hook.mjs` 在解析失败时补 `.ts`（仅测试用，不参与 Web/Mobile 打包）。
- 双端快照：`apps/web/lib/domains-parity.test.ts` 与 `apps/mobile/src/lib/domains-parity.test.ts` 使用逐字相同的 fixture/期望（各自既有 vitest 框架），两份都绿才算口径一致。
