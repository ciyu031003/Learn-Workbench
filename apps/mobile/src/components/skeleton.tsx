import { useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type AnimatedStyle,
} from "react-native-reanimated";
import { useTheme } from "@/theme";
import { motion, radius, shadows, spacing, type ThemeColors } from "@/theme/tokens";
import { useReducedMotion } from "@/lib/motion";

/**
 * 骨架屏：数据未就绪时的占位块（列表 / 卡片 / 图表 / 首屏大块）。
 *
 * 视觉：surfaceMuted 圆角块 + 透明度呼吸（只动 opacity，不动 transform，保持廉价）。
 * 无障碍：跟随系统「减弱动态效果」，开启时渲染为静态块。
 */

export type SkeletonVariant = "line" | "card" | "listItem" | "chart" | "hero";

/** 呼吸区间 0.45 ↔ 0.9，单程时长取自 motion.standard.duration */
const SHIMMER_MIN = 0.45;
const SHIMMER_MAX = 0.9;
const SHIMMER_DURATION = motion.standard.duration;

/** 固定高度比例序列（不随机，保证渲染稳定） */
const CHART_BARS: readonly number[] = [0.52, 0.78, 0.36, 0.94, 0.62, 0.84, 0.44];

/**
 * 共享的呼吸透明度：animated=false 或系统减弱动态效果时保持 1
 * （reduce-motion 读取已收敛到 lib/motion.ts，避免两处实现漂移）
 */
function useShimmerOpacity(animated: boolean): {
  active: boolean;
  animatedStyle: AnimatedStyle<ViewStyle>;
} {
  const reduced = useReducedMotion();
  const active = animated && !reduced;
  const opacity = useSharedValue(active ? SHIMMER_MIN : 1);

  useEffect(() => {
    if (!active) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(SHIMMER_MAX, { duration: SHIMMER_DURATION }),
        withTiming(SHIMMER_MIN, { duration: SHIMMER_DURATION })
      ),
      -1,
      true
    );
  }, [active, opacity]);

  const animatedStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: opacity.value }));

  return { active, animatedStyle };
}

interface SkeletonBaseProps {
  style?: StyleProp<ViewStyle>;
  /** 是否播放呼吸动画，默认 true */
  animated?: boolean;
  testID?: string;
}

/**
 * 骨架屏基础块：自带呼吸动画，variant 决定尺寸与形状。
 * 绝大多数场景直接用 Skeleton / SkeletonCard / SkeletonList。
 */
export function SkeletonBlock({
  variant,
  style,
  animated = true,
  testID,
}: SkeletonBaseProps & { variant: SkeletonVariant }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { active, animatedStyle } = useShimmerOpacity(animated);

  if (variant === "chart") {
    return (
      <Animated.View
        testID={testID}
        style={[styles.block, styles.chart, active ? animatedStyle : null, style]}
      >
        {CHART_BARS.map((ratio, index) => (
          <View
            key={index}
            style={[styles.chartBar, { height: `${Math.round(ratio * 100)}%` }]}
          />
        ))}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      testID={testID}
      style={[styles.block, styles[variant], active ? animatedStyle : null, style]}
    />
  );
}

/**
 * 通用骨架屏。
 * @param variant 形状，默认 "line"
 * @param lines   仅 variant="line" 生效，默认 1 行
 * @param animated 是否播放呼吸动画，默认 true
 */
export function Skeleton({
  variant = "line",
  lines = 1,
  style,
  animated = true,
  testID,
}: SkeletonBaseProps & {
  variant?: SkeletonVariant;
  lines?: number;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const count = Math.max(1, Math.floor(lines));

  if (variant !== "line" || count === 1) {
    return <SkeletonBlock variant={variant} animated={animated} style={style} testID={testID} />;
  }

  return (
    <View style={[styles.lines, style]} testID={testID}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBlock key={index} variant="line" animated={animated} />
      ))}
    </View>
  );
}

/** 卡片形状骨架，按 spacing.md 纵向堆叠 */
export function SkeletonCard({
  count = 1,
  animated,
}: {
  count?: number;
  animated?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const total = Math.max(1, Math.floor(count));

  return (
    <View style={styles.stack}>
      {Array.from({ length: total }).map((_, index) => (
        <SkeletonBlock key={index} variant="card" animated={animated} />
      ))}
    </View>
  );
}

/** 列表形状骨架：前置圆形 + 两行文字 */
export function SkeletonList({
  count = 6,
  animated,
}: {
  count?: number;
  animated?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const total = Math.max(1, Math.floor(count));

  return (
    <View style={styles.stack}>
      {Array.from({ length: total }).map((_, index) => (
        <View key={index} style={styles.listRow}>
          <SkeletonBlock variant="listItem" animated={animated} />
          <View style={styles.listRowBody}>
            <View style={styles.listRowLine} />
            <View style={[styles.listRowLine, styles.listRowLineShort]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    block: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      overflow: "hidden",
    },
    line: { height: 12, borderRadius: radius.sm, alignSelf: "stretch" },
    card: {
      minHeight: 96,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    listItem: { width: 40, height: 40, borderRadius: radius.pill },
    chart: {
      height: 148,
      borderRadius: radius.lg,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      padding: spacing.lg,
    },
    chartBar: { flex: 1, borderRadius: radius.sm, backgroundColor: colors.borderStrong },
    hero: {
      height: 172,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    lines: { gap: spacing.sm, alignSelf: "stretch" },
    stack: { gap: spacing.md, alignSelf: "stretch" },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    listRowBody: { flex: 1, gap: spacing.sm },
    listRowLine: { height: 11, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
    listRowLineShort: { width: "62%" },
  });
