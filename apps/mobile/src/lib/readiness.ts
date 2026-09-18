import { todayISO } from "@learn-workbench/shared";

/**
 * 今日状态分（APP 侧入口）。
 *
 * v8 起**口径收敛到 `@learn-workbench/shared` 的 `computeDailyReadiness`** —— Web 健康页与 APP 健康页用同一套算法，
 * 这里只做命名兼容（历史调用点都叫 `computeReadiness` / `WEAKEST_LABEL`）。
 */
export type { DailyReadiness as Readiness, DailyReadinessInput as ReadinessInput } from "@learn-workbench/shared";
export {
  computeDailyReadiness as computeReadiness,
  DAILY_WEAKEST_LABEL as WEAKEST_LABEL,
} from "@learn-workbench/shared";

/** 供调试/测试用：今天的日期键 */
export function readinessDateKey(): string {
  return todayISO();
}
