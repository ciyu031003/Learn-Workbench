/**
 * 双端一致性口径（S5-1）：完成度 / 日期 / streak 的**唯一实现**。
 *
 * 约定：Web 与 Mobile 都只从这里取口径；任何一端"自己算一遍"都视为回归。
 * 纯函数、无 I/O、无时区库依赖（时区用 Intl.DateTimeFormat）。
 *
 * 消费者：`import { ... } from "@learn-workbench/shared/domains"`
 */
export * from "./completion";
export * from "./date";
export * from "./streak";
