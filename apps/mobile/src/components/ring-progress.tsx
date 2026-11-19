import { useEffect, useId, useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/theme";
import { MOTION_SLOW, easingStandard, isMotionActive } from "@/theme/motion";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * 简单圆环（学习页周目标 / 专注页计时环）。
 *
 * v13 U2 参数对齐 Web `components/ui/progress-ring.tsx`（技法参考 uiverse.io/VashonG/jolly-yak-23, MIT）：
 * - 默认厚度 10、`strokeLinecap="round"`、进度变化 400ms 标准缓动；
 * - 不传 `color` 时用 **主题化线性渐变** `primary → chart[1]`（浅色即 #2f74c0 → #5b93d6，与 Web 同源）；
 *   传了 `color` 就保持纯色（专注全屏的暖橙沉浸环继续生效）。
 * RN 不支持 conic-gradient，所以这里**仍是 react-native-svg**。
 */
export function RingProgress({
  size = 160,
  strokeWidth = 10,
  progress = 0,
  trackColor,
  color,
  from,
  to,
  children,
}: {
  size?: number;
  strokeWidth?: number;
  progress?: number;
  trackColor?: string;
  /** 纯色描边（传了就覆盖渐变） */
  color?: string;
  /** 渐变起点（默认 colors.primary） */
  from?: string;
  /** 渐变终点（默认 colors.chart[1] = #5B93D6 档） */
  to?: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const rawId = useId();
  const gradientId = useMemo(() => `lwbRing${rawId.replace(/[^a-zA-Z0-9]/g, "")}`, [rawId]);

  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const targetOffset = c * (1 - clamped);

  const gradientStart = from ?? colors.primary;
  const gradientEnd = to ?? colors.chart[1];
  const useGradient = !color;

  /**
   * v19-M2：入场生长——挂载时从 0%（整圈 offset）画到目标值（400ms 标准缓动），
   * 对齐 ProgressArc 的既有模式；减弱动态/低端机直接落终态。
   */
  const active = isMotionActive(reduceMotion);
  const offset = useSharedValue(active ? c : targetOffset);

  useEffect(() => {
    if (!active) {
      offset.value = targetOffset;
      return;
    }
    offset.value = withTiming(targetOffset, { duration: MOTION_SLOW, easing: easingStandard });
  }, [active, offset, targetOffset]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  /**
   * 环心内容不能直接塞进 <Svg>：react-native-svg 只认 SVG 子节点，RN 的 View/Text
   * 会被画在画布原点（左上角），真机上就表现为「14% 压在环顶」。这里把 children
   * 放到绝对定位的覆盖层里居中，调用方（HeroCard）不需要改。
   */
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={gradientStart} />
          <Stop offset="1" stopColor={gradientEnd} />
        </LinearGradient>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={trackColor ?? colors.chartTrack}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={useGradient ? `url(#${gradientId})` : color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        animatedProps={animatedProps}
      />
      </Svg>
      {children ? (
        <View pointerEvents="none" style={styles.center}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
  center: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
