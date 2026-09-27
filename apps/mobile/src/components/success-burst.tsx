import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { MOTION_BASE, easingStandard, isMotionActive } from "@/theme/motion";
import { useTheme } from "@/theme";

/**
 * v19-M3 · 行内成功微庆祝（SuccessBurst）。
 *
 * 场景：打卡/勾选完成的瞬间，在勾选框位置扩散一圈 ripple（≈560ms）后归于不可见——
 * iOS 的满足感来自"点哪哪应"的**局部**反馈，全屏庆祝（CelebrationModal）只留给里程碑。
 *
 * 用法（重放 = 换 key 重挂载，全程共享值、零 React 状态更新）：
 *   {burst[h.id] ? <SuccessBurst key={burst[h.id]} color={accent} /> : null}
 *
 * 布局：根节点 absoluteFillObject + 居中，圆环可以溢出父容器（RN 0.76+ 默认 overflow:visible），
 * 父容器不需要任何配合；pointerEvents="none" 保证不吃触摸。
 *
 * worklet 纪律（CLAUDE.md 硬约束）：两个共享值都声明在 useAnimatedStyle 之前，
 * worklet 内只读共享值与模块级常量。
 */
export function SuccessBurst({ color, size = 36 }: { color?: string; size?: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const active = isMotionActive(reduceMotion);

  // ⚠️ 顺序约束：共享值必须先于引用它们的 worklet 声明
  const ripple = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (!active) return; // 减弱动态：不挂载动画，圆环保持 opacity 0（不可见）
    ripple.value = 0;
    fade.value = 0.85;
    ripple.value = withTiming(1, { duration: MOTION_BASE + 200, easing: Easing.out(Easing.cubic) });
    fade.value = withDelay(140, withTiming(0, { duration: MOTION_BASE, easing: easingStandard }));
  }, [active, ripple, fade]);

  const ring = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: 0.55 + ripple.value * 0.85 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={styles.anchor}>
      <Animated.View
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: size / 2, borderColor: color ?? colors.success },
          ring,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // RN 0.86 的类型里已无 absoluteFillObject，这里显式四边贴齐（等价语义）
  anchor: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  ring: { position: "absolute", borderWidth: 2 },
});
