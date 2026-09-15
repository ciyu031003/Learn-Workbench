import { useEffect } from "react";
import { StyleSheet, Text, TextInput, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * 动画总开关：若某机型上 `animatedProps.text` 表现异常（数字不更新），
 * 置 false 即回落到普通 Text（静态但正确）。
 */
const NUMBER_ANIMATION_ENABLED = true;

/**
 * 会滚动的数字（v3 M10）
 *
 * 手法来自开源实测：`Animated.createAnimatedComponent(TextInput)` + `useAnimatedProps`
 * 直接改 `text`，**不触发 React 重渲染**（nutrition-mobile 的 500ms withTiming）。
 * 用途：剩余热量 / 饮水 ml / 体重 / 百分比。
 *
 * 约定：无障碍读屏读的是最终值（`accessibilityLabel` 用真实数字，不用动画中间值）。
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 500,
  style,
  prefix,
  suffix,
  accessibilityLabel,
}: {
  value: number;
  /** 小数位（体重用 2，热量用 0） */
  decimals?: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
  accessibilityLabel?: string;
}) {
  const reduce = useReducedMotion();
  const safe = Number.isFinite(value) ? value : 0;
  const factor = Math.pow(10, Math.max(0, Math.min(3, decimals)));

  const anim = useSharedValue(safe);
  useEffect(() => {
    if (reduce) {
      anim.value = safe;
      return;
    }
    anim.value = withTiming(safe, { duration, easing: Easing.out(Easing.cubic) });
  }, [anim, duration, reduce, safe]);

  const animatedProps = useAnimatedProps(() => {
    const v = Math.round(anim.value * factor) / factor;
    return {
      text: `${prefix ?? ""}${decimals > 0 ? v.toFixed(decimals) : String(Math.round(v))}${suffix ?? ""}`,
    } as never;
  });

  const readout = `${prefix ?? ""}${decimals > 0 ? safe.toFixed(decimals) : String(Math.round(safe))}${suffix ?? ""}`;

  // reduce-motion 或动画关闭：直接用普通 Text（静态但一定正确）
  if (!NUMBER_ANIMATION_ENABLED || reduce) {
    return (
      <Text style={[styles.text, style]} accessibilityLabel={accessibilityLabel ?? readout}>
        {readout}
      </Text>
    );
  }

  return (
    <AnimatedTextInput
      editable={false}
      // 非受控：数值全部由 animatedProps.text 驱动（受控值会与动画打架）
      value={undefined}
      defaultValue={readout}
      underlineColorAndroid="transparent"
      // 数字宽度稳定：避免滚动时抖动
      accessibilityLabel={accessibilityLabel ?? readout}
      accessibilityRole="text"
      animatedProps={animatedProps}
      style={[styles.text, style]}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});

/** 供测试/复用：把数值格式化成与组件一致的字符串 */
export function formatMetric(value: number, decimals = 0, prefix = "", suffix = ""): string {
  const safe = Number.isFinite(value) ? value : 0;
  const f = Math.pow(10, Math.max(0, Math.min(3, decimals)));
  const v = Math.round(safe * f) / f;
  return `${prefix}${decimals > 0 ? v.toFixed(decimals) : String(Math.round(v))}${suffix}`;
}
