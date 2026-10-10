import { useEffect } from "react";
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/theme";
import { useReducedMotion } from "@/lib/motion";
import {
  FILTER_BAR_MAX_OPACITY,
  FILTER_BAR_MIN_OPACITY,
  FILTER_BAR_PULSE_MS,
  FILTER_BAR_STATIC_OPACITY,
  initialFilterBarOpacity,
  resolveFilterBarPulse,
} from "@/lib/filter-bar-spec";

export {
  FILTER_BAR_MAX_OPACITY,
  FILTER_BAR_MIN_OPACITY,
  FILTER_BAR_PULSE_MS,
  FILTER_BAR_STATIC_OPACITY,
  resolveFilterBarPulse,
} from "@/lib/filter-bar-spec";

/**
 * 筛选刷新细进度条（组一 · 阶段 3 从 jobs / market 收敛成一处）。
 *
 * 语义：筛选 / 排序 / 换区间期间**保留旧内容**，只在列表顶部脉冲一根 2pt 主色条，
 * 让用户知道"正在刷新"而不是"内容变了"。
 *
 * 为什么抽出来：
 * - jobs.tsx 与 market.tsx 各抄了一份**完全相同**的实现，动效预算因此被记了两遍；
 * - 原实现是无条件 `withRepeat(..., -1)`：**减弱动态**的用户同样会看到持续闪烁，
 *   与仓库其它动效（skeleton / celebration 等）的口径不一致。
 *
 * 现在的口径：减弱动态 → 不闪，改为一根固定的 70% 实色条，信息仍然成立（进度条还在）。
 */
export function FilterRefreshBar() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pulsing = resolveFilterBarPulse(reduceMotion);
  const opacity = useSharedValue(initialFilterBarOpacity(pulsing));

  useEffect(() => {
    if (!pulsing) {
      opacity.value = FILTER_BAR_STATIC_OPACITY;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(FILTER_BAR_MAX_OPACITY, { duration: FILTER_BAR_PULSE_MS }),
        withTiming(FILTER_BAR_MIN_OPACITY, { duration: FILTER_BAR_PULSE_MS })
      ),
      -1,
      true
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity, pulsing]);

  const bar = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(150)}
      style={[{ height: 2, borderRadius: 1, backgroundColor: colors.primary, marginBottom: 8 }, bar]}
    />
  );
}
