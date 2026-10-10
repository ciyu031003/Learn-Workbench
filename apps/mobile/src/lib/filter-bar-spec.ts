import { isMotionActive } from "@/theme/motion";

/**
 * 筛选刷新细进度条的规格与降级判定（组一 · 阶段 3）。
 *
 * 零 react-native 依赖，可被 vitest 直接加载（与 `button-spec.ts` / `text-scale.ts` 同约定）。
 *
 * 背景：jobs 与 market 各抄了一份**完全相同**的无条件 `withRepeat(..., -1)` 脉冲，
 * 「减弱动态」的用户同样会看到持续闪烁。这里把节奏与降级口径收敛成唯一出口。
 */
export const FILTER_BAR_PULSE_MS = 380;
export const FILTER_BAR_MIN_OPACITY = 0.35;
export const FILTER_BAR_MAX_OPACITY = 1;
/** 减弱动态时的静态不透明度：不闪，但也不会淡到看不见（信息仍然成立） */
export const FILTER_BAR_STATIC_OPACITY = 0.7;

/** 减弱动态时应否脉冲（纯函数；与 skeleton 的 `resolveSkeletonAnimation` 同口径） */
export function resolveFilterBarPulse(reduceMotion: boolean): boolean {
  return isMotionActive(reduceMotion);
}

/** 初始/静止不透明度（脉冲关闭时用静态值，避免首帧闪一下） */
export function initialFilterBarOpacity(pulsing: boolean): number {
  return pulsing ? FILTER_BAR_MIN_OPACITY : FILTER_BAR_STATIC_OPACITY;
}
