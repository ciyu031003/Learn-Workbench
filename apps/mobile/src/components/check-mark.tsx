import { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { MOTION_BASE, MOTION_FAST, MOTION_SLOW, easingStandard, isMotionActive } from "@/theme/motion";

/**
 * v13 U8 · 勾选对勾描边动画（技法参考 uiverse.io/JkHuger/warm-panther-74 (MIT)：
 * 勾选时用 stroke-dasharray/stroke-dashoffset 把对勾"画"出来，完成瞬间轻微放大）。
 *
 * worklet 约束（apps/mobile/CLAUDE.md 硬性要求）：
 * - worklet 里只读写共享值，调 Reanimated API，不调用任何外部普通函数；
 * - 用到的共享值（draw / scale）都声明在 useAnimatedStyle / useAnimatedProps 之前；
 * - 常量（CHECK_PATH_LENGTH、放大器）都是模块级数字，worklet 直接捕获。
 * 降级：MOTION_ENABLED=false 或系统减弱动态 → 直接呈现终态（不画、不弹）。
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** 对勾路径长度（viewBox 0 0 24 24 上 "M4 12.5 L9.5 18 L20 6.5" 的折线长度 ≈ 23.4，取 24 略有余量） */
export const CHECK_PATH_LENGTH = 24;
/** 完成瞬间的放大倍数与回落时长（240ms 内回到 1） */
export const CHECK_POP_SCALE = 1.18;

/** 对勾路径（8pt 网格，viewBox 0 0 24 24） */
export const CHECK_PATH_D = "M4 12.5 L9.5 18 L20 6.5";

export function AnimatedCheckMark({
  checked,
  size = 16,
  color = "#FFFFFF",
  strokeWidth = 2.6,
  style,
  testID,
}: {
  checked: boolean;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const active = isMotionActive(reduceMotion);

  // ⚠️ 顺序约束：shared value 必须在用到它的 worklet 之前声明
  const draw = useSharedValue(checked ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const target = checked ? 1 : 0;
    if (!active) {
      draw.value = target;
      scale.value = 1;
      return;
    }
    draw.value = withTiming(target, { duration: MOTION_SLOW, easing: easingStandard });
    if (checked) {
      // 画完的 240ms 内轻微放大一下（不改变布局，只动 transform）
      scale.value = withSequence(
        withTiming(CHECK_POP_SCALE, { duration: MOTION_FAST, easing: easingStandard }),
        withTiming(1, { duration: MOTION_BASE, easing: easingStandard })
      );
    }
  }, [active, checked, draw, scale]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_PATH_LENGTH * (1 - draw.value),
  }));

  const boxStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View testID={testID} style={[boxStyle, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <AnimatedPath
          d={CHECK_PATH_D}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={CHECK_PATH_LENGTH}
          animatedProps={animatedProps}
        />
      </Svg>
    </Animated.View>
  );
}
