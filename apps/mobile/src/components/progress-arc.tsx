import { useEffect, useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

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
 * 进度弧（见 docs/APP端优化方案-v2 §1.5.3B —— 借 Orbix Studia 的「progress arc」手法）
 *
 * 「72% 不像一个统计数字，而像一种势能」：把「今日完成度」从横条升级为弧线，
 * 弧长 = 完成度、端点带小圆点与微光、中心是大号记分牌数字。
 *
 * 动效：进入时 dashoffset 420ms ease-out；**尊重 reduce-motion（直接到位）**。
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
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduce = useReducedMotion();

  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arcLen = 2 * Math.PI * r * (SWEEP / 360);
  const targetOffset = arcLen * (1 - clamped);
  const start = from ?? colors.primary;
  const end = to ?? colors.accentStrong;

  const offset = useSharedValue(ARC_ANIMATION_ENABLED ? arcLen : targetOffset);
  useEffect(() => {
    if (!ARC_ANIMATION_ENABLED || reduce) {
      offset.value = targetOffset;
      return;
    }
    offset.value = withTiming(targetOffset, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [offset, reduce, targetOffset]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  const dot = polar(cx, cy, r, START_ANGLE + SWEEP * clamped);
  const showDot = clamped > 0.02;
  // 完成度极小时不画进度弧（round cap 会退化成一个点）
  const showArc = clamped > 0.004;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="lwbArc" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={start} />
            <Stop offset="1" stopColor={end} />
          </LinearGradient>
        </Defs>
        {/* 轨道 */}
        <Path
          d={arcPath(cx, cy, r, SWEEP)}
          stroke={colors.surfaceMuted}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        {/* 进度 */}
        {showArc ? (
          <AnimatedPath
            d={arcPath(cx, cy, r, SWEEP)}
            stroke="url(#lwbArc)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${arcLen} ${arcLen}`}
            animatedProps={animatedProps}
          />
        ) : null}
        {/* 端点微光 + 圆点 */}
        {showDot ? (
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
