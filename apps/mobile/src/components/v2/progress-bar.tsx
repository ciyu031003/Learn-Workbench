import { useEffect, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "@/theme";
import { type ThemeColors } from "@/theme/tokens";
import { useReducedMotion } from "@/lib/motion";
import { isMotionActive } from "@/theme/motion";

/** v2 细进度条：默认主色，tone 可选语义色；值变化时 400ms 填充动画（减弱动态/关闭动效时直接到终态） */
export function ProgressBar({
  value,
  tone = "primary",
  height = 6,
  style,
}: {
  value: number;
  tone?: "primary" | "success" | "warning" | "accent" | "danger";
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduced = useReducedMotion();
  const active = isMotionActive(reduced);
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const progress = useSharedValue(pct);

  useEffect(() => {
    // worklet 内只调用 Reanimated API；不允许动效时直接落到终态
    progress.value = active ? withTiming(pct, { duration: 400 }) : pct;
  }, [active, pct, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: (progress.value * 100) + "%" as `${number}%`,
  }));

  const color = (colors[tone] as string | undefined) ?? colors.primary;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }, style]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, borderRadius: height / 2 },
          fillStyle,
        ]}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    track: { backgroundColor: colors.chartTrack, overflow: "hidden", width: "100%" },
    fill: { height: "100%" },
  });
