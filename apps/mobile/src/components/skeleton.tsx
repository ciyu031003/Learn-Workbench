import { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
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
import { MOTION_ENABLED, MOTION_SLOW, easingStandard, isMotionActive } from "@/theme/motion";

/**
 * v13 U1 · 统一骨架屏（两段式：呼吸 + 扫光）
 *
 * 技法参考:
 *  - uiverse.io/Praashoo7/stale-bat-2 (MIT)：斜切高光扫过的高光条（RN 无 CSS 渐变，
 *    这里用一条 **8% 宽的低透明度白色圆角条** 横向平移替代 linear-gradient(105deg…)）
 *  - uiverse.io/zanina-yassine/dangerous-pug-69 (MIT)：卡片骨架行 + 内容行结构
 *
 * 视觉：surfaceMuted 圆角块 + 不透明度 0.45↔0.9 呼吸 + 高光条 1.6s 横扫。
 * 降级：`MOTION_ENABLED=false` 或系统「减弱动态效果」→ 完全不播动画，渲染为静态块。
 * 性能：只动 opacity/transform；圆点（listItem）不做扫光（圆里扫光观感差且更贵）。
 */

export type SkeletonVariant = "line" | "card" | "listItem" | "chart" | "hero";

/** 呼吸区间 0.45 ↔ 0.9；单程时长沿用既有 motion.standard（260ms），与旧版一致不引回归 */
export const SKELETON_OPACITY_MIN = 0.45;
export const SKELETON_OPACITY_MAX = 0.9;
/** 高光条宽度占容器宽度的比例（Web 端是渐变过渡带，这里取等价的 8%） */
export const SKELETON_HIGHLIGHT_RATIO = 0.08;
/** 扫光一轮时长：4 × slow(400) = 1600ms，与 Web .shimmer 的 1.6s 对齐 */
export const SKELETON_SWEEP_MS = MOTION_SLOW * 4;
/** 多行文字骨架最后一行短一截（Web SkeletonText 同款），读起来更像"正在加载的文字" */
export const SKELETON_LAST_LINE_RATIO = 0.62;

const SHIMMER_DURATION = motion.standard.duration;

/** 固定高度比例序列（不随机，保证渲染稳定） */
const CHART_BARS: readonly number[] = [0.52, 0.78, 0.36, 0.94, 0.62, 0.84, 0.44];

/* ---------------------------------------------------------------- 纯函数（可单测） */

/** 行数归一到 ≥1 的整数 */
export function clampSkeletonLines(lines: number): number {
  if (!Number.isFinite(lines)) return 1;
  return Math.max(1, Math.floor(lines));
}

/** 高光条宽度（px）：容器宽 × 8%，至少 1px（避免 0 宽看不到） */
export function skeletonHighlightWidth(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 0;
  return Math.max(1, Math.round(containerWidth * SKELETON_HIGHLIGHT_RATIO));
}

/** 扫光位移距离（px）：从 -条宽 走到 容器宽，正好完全离开右侧 */
export function skeletonSweepDistance(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 0;
  return Math.round(containerWidth + skeletonHighlightWidth(containerWidth));
}

/** 高光条颜色（中性 rgba，唯一允许"不跟 token"的地方）：深色档显著更弱 */
export function skeletonHighlightColor(dark: boolean): string {
  return dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.66)";
}

/** 呼吸透明度区间：不播动画时恒为 1（静态块） */
export function skeletonOpacityRange(active: boolean): { min: number; max: number } {
  return active ? { min: SKELETON_OPACITY_MIN, max: SKELETON_OPACITY_MAX } : { min: 1, max: 1 };
}

/** 是否允许播放动画：`animated=false` / 系统减弱动态 / 总开关关闭 → false */
export function resolveSkeletonAnimation(
  animated: boolean,
  reduceMotion: boolean,
  enabled: boolean = MOTION_ENABLED
): boolean {
  return animated === true && isMotionActive(reduceMotion, enabled);
}

/** 圆点不做扫光（圆形容器里横扫观感差、且省一次测量 + 一个 UI 线程动画） */
export function skeletonSupportsSweep(variant: SkeletonVariant): boolean {
  return variant !== "listItem";
}

/* ---------------------------------------------------------------- hooks */

interface SkeletonAnimation {
  /** 是否正在播动画（决定是否叠加 animatedStyle / 渲染色光条） */
  active: boolean;
  animatedStyle: AnimatedStyle<ViewStyle>;
  /** 高光条是否可见 */
  sweepVisible: boolean;
  sweepWidth: number;
  sweepStyle: AnimatedStyle<ViewStyle>;
  highlightColor: string;
  onLayout: (e: LayoutChangeEvent) => void;
}

/**
 * 呼吸 + 扫光。`animated=false` 或减弱动态时保持静态（opacity=1、不渲染高光条）。
 * 注意：所有 shared value 都声明在 `useAnimatedStyle` 之前（worklet 顺序约束）。
 */
function useSkeletonAnimation(variant: SkeletonVariant, animated: boolean): SkeletonAnimation {
  const { dark } = useTheme();
  const reduceMotion = useReducedMotion();
  const active = resolveSkeletonAnimation(animated, reduceMotion);
  const sweepEnabled = active && skeletonSupportsSweep(variant);

  const { min, max } = skeletonOpacityRange(active);
  const opacity = useSharedValue(active ? min : 1);
  const sweep = useSharedValue(0);
  const [width, setWidth] = useState(0);

  const sweepWidth = skeletonHighlightWidth(width);
  const sweepDistance = skeletonSweepDistance(width);
  const sweepVisible = sweepEnabled && width > 0;

  useEffect(() => {
    if (!active) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(max, { duration: SHIMMER_DURATION }),
        withTiming(min, { duration: SHIMMER_DURATION })
      ),
      -1,
      true
    );
  }, [active, max, min, opacity]);

  useEffect(() => {
    if (!sweepVisible) {
      sweep.value = -sweepWidth;
      return;
    }
    sweep.value = -sweepWidth;
    sweep.value = withRepeat(
      withTiming(sweepDistance, { duration: SKELETON_SWEEP_MS, easing: easingStandard }),
      -1,
      false
    );
  }, [sweep, sweepDistance, sweepVisible, sweepWidth]);

  const animatedStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: opacity.value }));
  const sweepStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ translateX: sweep.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setWidth((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
  };

  return {
    active,
    animatedStyle,
    sweepVisible,
    sweepWidth,
    sweepStyle,
    highlightColor: skeletonHighlightColor(dark),
    onLayout,
  };
}

/* ---------------------------------------------------------------- 组件 */

interface SkeletonBaseProps {
  style?: StyleProp<ViewStyle>;
  /** 是否播放呼吸/扫光，默认 true */
  animated?: boolean;
  testID?: string;
}

/** 高光条：绝对定位于容器左侧，横向平移由 sweepStyle 驱动 */
function SkeletonSweep({
  width,
  color,
  style,
}: {
  width: number;
  color: string;
  style: AnimatedStyle<ViewStyle>;
}): React.JSX.Element {
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.sweep, { width, backgroundColor: color }, style]}
    />
  );
}

/**
 * 骨架屏基础块：自带呼吸 + 扫光，variant 决定尺寸与形状。
 * 绝大多数场景直接用 Skeleton / SkeletonText / SkeletonCard / SkeletonList。
 */
export function SkeletonBlock({
  variant,
  style,
  animated = true,
  testID,
}: SkeletonBaseProps & { variant: SkeletonVariant }): React.JSX.Element {
  const { colors } = useTheme();
  const themed = useMemo(() => makeStyles(colors), [colors]);
  const anim = useSkeletonAnimation(variant, animated);

  const sweep = anim.sweepVisible ? (
    <SkeletonSweep width={anim.sweepWidth} color={anim.highlightColor} style={anim.sweepStyle} />
  ) : null;

  if (variant === "chart") {
    return (
      <Animated.View
        testID={testID}
        onLayout={anim.onLayout}
        style={[themed.block, themed.chart, anim.active ? anim.animatedStyle : null, style]}
      >
        {CHART_BARS.map((ratio, index) => (
          <View
            key={index}
            style={[themed.chartBar, { height: `${Math.round(ratio * 100)}%` }]}
          />
        ))}
        {sweep}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      testID={testID}
      onLayout={anim.onLayout}
      style={[themed.block, themed[variant], anim.active ? anim.animatedStyle : null, style]}
    >
      {sweep}
    </Animated.View>
  );
}

/**
 * 通用骨架屏。
 * @param variant 形状，默认 "line"
 * @param lines   仅 variant="line" 生效，默认 1 行
 * @param animated 是否播动画，默认 true
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
  const themed = useMemo(() => makeStyles(colors), [colors]);
  const count = clampSkeletonLines(lines);

  if (variant !== "line" || count === 1) {
    return <SkeletonBlock variant={variant} animated={animated} style={style} testID={testID} />;
  }

  return (
    <View style={[themed.lines, style]} testID={testID}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBlock key={index} variant="line" animated={animated} />
      ))}
    </View>
  );
}

/**
 * 多行文字骨架：最后一行短一截（技法参考 uiverse.io/zanina-yassine/dangerous-pug-69 的卡片文字行）。
 * 与 Web `SkeletonText` 同形：段落占位不要用等长行，否则读起来像表格。
 */
export function SkeletonText({
  lines = 3,
  style,
  animated = true,
  testID,
}: SkeletonBaseProps & { lines?: number }): React.JSX.Element {
  const { colors } = useTheme();
  const themed = useMemo(() => makeStyles(colors), [colors]);
  const count = clampSkeletonLines(lines);

  return (
    <View style={[themed.textBlock, style]} testID={testID}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBlock
          key={index}
          variant="line"
          animated={animated}
          style={index === count - 1 && count > 1 ? themed.textLastLine : undefined}
        />
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
  const themed = useMemo(() => makeStyles(colors), [colors]);
  const total = clampSkeletonLines(count);

  return (
    <View style={themed.stack}>
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
  const themed = useMemo(() => makeStyles(colors), [colors]);
  const total = clampSkeletonLines(count);

  return (
    <View style={themed.stack}>
      {Array.from({ length: total }).map((_, index) => (
        <View key={index} style={themed.listRow}>
          <SkeletonBlock variant="listItem" animated={animated} />
          <View style={themed.listRowBody}>
            <View style={themed.listRowLine} />
            <View style={[themed.listRowLine, themed.listRowLineShort]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** 高光条样式：不依赖主题色（中性 rgba 高光） */
const styles = StyleSheet.create({
  sweep: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
  },
});

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
    textBlock: { gap: spacing.sm, alignSelf: "stretch" },
    textLastLine: { width: `${Math.round(SKELETON_LAST_LINE_RATIO * 100)}%`, alignSelf: "flex-start" },
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
