/**
 * 列表入场 stagger 的纯逻辑（v17-D / R8）—— 零 react-native 依赖，可直接单测。
 *
 * 纪律（方案 §7）：只在**首帧**入场时错峰，滚动复现不做；**每屏 ≤12 项**，
 * 避免长列表每张卡都动（廉价且掉帧）。
 */
import { motion } from "@/theme/tokens";

export const STAGGER_MAX = 12;

/**
 * 步长来自 token（theme/tokens 的 motion.stagger = 40），本文件不另立一套数值 ——
 * 这样"列表入场间隔"与其它动效同源；tokens.ts 对 react-native 只有 type import，
 * 运行期被抹掉，所以本模块仍可被 vitest 直接加载。
 */
export const STAGGER_STEP = motion.stagger;

/** 第 index 项的入场延迟（ms）；超出上限的项统一用最后一档，不再线性增大 */
export function staggerDelay(index: number, step: number = STAGGER_STEP): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  const capped = Math.min(Math.floor(index), STAGGER_MAX - 1);
  return capped * step;
}

/** 该项是否应该参与入场错峰（第 0 项也参与，只是延迟 0） */
export function shouldStagger(index: number, total: number): boolean {
  return Number.isFinite(index) && index >= 0 && total > 1 && index < STAGGER_MAX;
}
