import { useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { MOTION_SLOW, easingStandard } from "@/theme/motion";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** 弧线开口朝下：135° 起、顺时针 270°（Orbix Studia 的「朝目标卷曲」） */
const START_ANGLE = 135;
const SWEEP = 270;

/** 动画总开关：真机若出现 SVG 动画异常，把这里置 false 即回落到静态弧 */
const ARC_ANIMATION_ENABLED = true;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, sweepDeg: number) {
  const s = polar(cx, cy, r, START_ANGLE);
  const e = polar(cx, cy, r, START_ANGLE + sweepDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

/**
 * 进度弧（见 docs/APP端优化方案-v2 §1.5.3B + v3 M1/M5）
 *
 * v13 U2 参数对齐 Web `components/ui/progress-ring.tsx`（厚度 10 / 圆头 / 渐变 `primary → chart[1]` /
 * 400ms 标准缓动 `cubic-bezier(.22,.61,.36,1)`）；RN 不支持 conic-gradient，所以**保持 react-native-svg**。
 *
 * v3 新增：
 * - `overBudget`：超出目标 → 轨道与进度转 danger（不做阻断，只做提示）
 * - `beatOnChange`：数值变化时弧线"跳一下"（strokeWidth ×1.35 @100ms → 回落 300ms），
 *   参数取自开源实测（nutrition-mobile 的 6→12→6 @100/300/500ms 序列）
 * - `flat`：小尺寸微环用（不画端点微光）
 * - 渐变 id 按实例生成，避免一屏多个环时 id 冲撞
 */
export function ProgressArc({
  progress,
  size = 120,
  strokeWidth = 10,
  value,
  label,
  caption,
  from,
  to,
  children,
  style,
  overBudget = false,
  beatOnChange = false,
  showDot = true,
  pulseKey,
}: {
  /** 0..1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** 中心大数字（不传则只显示 children） */
  value?: string | number;
  label?: string;
  caption?: string;
  /** 渐变起点色，默认品牌主色 */
  from?: string;
  /** 渐变终点色，默认强调橙 */
  to?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 超出目标：轨道/进度/端点转 danger */
  overBudget?: boolean;
  /** 数值变化时弧线跳动一次（尊重 reduce-motion） */
  beatOnChange?: boolean;
  /** 端点圆点与微光（小尺寸微环建议关） */
  showDot?: boolean;
  /**
   * 外部「点一下给个反馈」的键（如切换日期）：
   * 即使进度值没变，也会让弧线跳动一次 —— 旧版切「今天/昨天」只有数字变化，圆环毫无反馈。
   */
  pulseKey?: string | number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduce = useReducedMotion();
  const rawId = useId();
  const gradientId = useMemo(() => `lwbArc${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);

  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arcLen = 2 * Math.PI * r * (SWEEP / 360);
  const targetOffset = arcLen * (1 - clamped);
  // v13 U2：默认渐变与 Web 的 `--ring-from/-to` 一致（#2f74c0 → #5b93d6 的 token 等价色）
  const start = overBudget ? colors.danger : (from ?? colors.primary);
  const end = overBudget ? colors.danger : (to ?? colors.chart[1]);

  const offset = useSharedValue(ARC_ANIMATION_ENABLED ? arcLen : targetOffset);
  const beat = useSharedValue(1);
  const seenRef = useRef(false);
  const prevRef = useRef(targetOffset);

  useEffect(() => {
    if (!ARC_ANIMATION_ENABLED || reduce) {
      offset.value = targetOffset;
      return;
    }
    // v13 U2：400ms + 标准缓动（与 Web 的 --motion-slow / --ease-standard 一致）
    offset.value = withTiming(targetOffset, { duration: MOTION_SLOW, easing: easingStandard });
  }, [offset, reduce, targetOffset]);

  /**
   * 跳动一次：**数值变化** 或 **外部 pulseKey 变化**（切日期这类"点一下"）都会触发，
   * 首次挂载不跳（避免进页面就闪）。
   * 合成一个 effect：react-hooks/immutability 不允许在两个 effect 里都改同一个 shared value。
   */
  const pulseSeen = useRef<typeof pulseKey>(undefined);
  useEffect(() => {
    const pulseChanged = pulseKey !== undefined && pulseSeen.current !== undefined && pulseSeen.current !== pulseKey;
    pulseSeen.current = pulseKey;

    const firstPaint = !seenRef.current;
    const valueChanged = !firstPaint && Math.abs(prevRef.current - targetOffset) >= 0.5;
    seenRef.current = true;
    prevRef.current = targetOffset;

    if (firstPaint || reduce || !ARC_ANIMATION_ENABLED) return;
    if (!pulseChanged && !(beatOnChange && valueChanged)) return;
    const strong = pulseChanged && !valueChanged;
    beat.value = withSequence(
      withTiming(strong ? 1.28 : 1.35, { duration: strong ? 110 : 100, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: strong ? 320 : 300, easing: Easing.out(Easing.cubic) })
    );
  }, [beat, beatOnChange, pulseKey, reduce, targetOffset]);

  const animatedProps = useAnimatedProps(() =>
    ARC_ANIMATION_ENABLED
      ? { strokeDashoffset: offset.value, strokeWidth: strokeWidth * beat.value }
      : { strokeDashoffset: offset.value }
  );

  const dot = polar(cx, cy, r, START_ANGLE + SWEEP * clamped);
  const showDotMark = showDot && clamped > 0.02;
  // 完成度极小时不画进度弧（round cap 会退化成一个点）
  const showArc = clamped > 0.004;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={start} />
            <Stop offset="1" stopColor={end} />
          </LinearGradient>
        </Defs>
        {/* 轨道 */}
        <Path
          d={arcPath(cx, cy, r, SWEEP)}
          stroke={overBudget ? colors.dangerSoft : colors.surfaceMuted}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        {/* 进度 */}
        {showArc ? (
          <AnimatedPath
            d={arcPath(cx, cy, r, SWEEP)}
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${arcLen} ${arcLen}`}
            animatedProps={animatedProps}
          />
        ) : null}
        {/* 端点微光 + 圆点 */}
        {showDotMark ? (
          <>
            <Circle cx={dot.x} cy={dot.y} r={strokeWidth * 0.95} fill={end} opacity={0.22} />
            <Circle cx={dot.x} cy={dot.y} r={strokeWidth * 0.34} fill={end} />
          </>
        ) : null}
      </Svg>

      <View style={styles.center} pointerEvents="none">
        {children ?? (
          <>
            <Text style={[styles.value, { fontSize: Math.round(size * 0.24) }]} numberOfLines={1} adjustsFontSizeToFit>
              {value ?? `${Math.round(clamped * 100)}%`}
            </Text>
            {label ? <Text style={styles.label} numberOfLines={1}>{label}</Text> : null}
            {caption ? (
              <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    center: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    value: { fontWeight: "800", letterSpacing: -0.8, color: colors.text, ...tabularNums },
    label: { ...typography.micro, color: colors.textMuted, marginTop: 1 },
    caption: { ...typography.caption, fontWeight: "400", color: colors.textMuted, textAlign: "center", marginTop: 2 },
  });
