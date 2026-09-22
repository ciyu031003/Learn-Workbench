import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "@/theme";
import { palettes, radius, shadows, type ThemeColors } from "@/theme/tokens";
import { MOTION_BASE, easingOvershoot, isMotionActive } from "@/theme/motion";
import { haptics } from "@/lib/haptics";

/**
 * v13 U9 · 日夜开关（技法参考 uiverse.io/JkHuger/itchy-turtle-45 (MIT)：
 * `cubic-bezier(.8,.5,.2,1.4)` 过冲 + 滑块内嵌太阳/月亮图标）。
 *
 * 只表达"浅 ↔ 深"两态；设置页的"跟随系统"仍走原有三档入口。
 * 两个状态都用本项目 token：浅色档 = accentSoft 底 + 太阳；深色档 = 专注暗色 `focusCanvas` 底 + 月亮。
 * 降级：MOTION_ENABLED=false 或系统减弱动态 → 直接跳到位（无过冲）。
 */
const TRACK_W = 58;
const TRACK_H = 32;
const KNOB = 26;
const PAD = 3;
const TRAVEL = TRACK_W - KNOB - PAD * 2;

export type DayNightValue = "light" | "dark";

export function DayNightSwitch({
  value,
  onChange,
  disabled = false,
  style,
  accessibilityLabel = "切换深色模式",
}: {
  value: DayNightValue;
  onChange?: (next: DayNightValue) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const active = isMotionActive(reduceMotion);
  const dark = value === "dark";

  // ⚠️ 顺序约束：shared value 声明在 useAnimatedStyle 之前
  const progress = useSharedValue(dark ? 1 : 0);

  useEffect(() => {
    const target = dark ? 1 : 0;
    progress.value = active
      ? withTiming(target, { duration: MOTION_BASE, easing: easingOvershoot })
      : target;
  }, [active, dark, progress]);

  const knobStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: dark, disabled }}
      onPress={() => {
        if (disabled) return;
        haptics.soft();
        onChange?.(dark ? "light" : "dark");
      }}
      style={[styles.track, dark ? styles.trackDark : styles.trackLight, disabled && styles.off, style]}
    >
      <Animated.View style={[styles.knob, dark ? styles.knobDark : styles.knobLight, knobStyle]}>
        <Ionicons
          name={dark ? "moon" : "sunny"}
          size={15}
          color={dark ? palettes.dark.text : colors.accentStrong}
        />
      </Animated.View>
      <View pointerEvents="none" style={styles.glyphRow}>
        <Ionicons name="sunny-outline" size={12} color={colors.textFaint} />
        <Ionicons name="moon-outline" size={12} color={colors.textFaint} />
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    track: {
      width: TRACK_W,
      height: TRACK_H,
      borderRadius: radius.pill,
      borderWidth: 1,
      justifyContent: "center",
      paddingHorizontal: PAD,
      overflow: "hidden",
    },
    trackLight: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.border,
    },
    trackDark: {
      // 夜航：固定用专注暗色（与"专注全屏沉浸"同源的深色，不随主题切换）
      backgroundColor: palettes.light.focusCanvas,
      borderColor: palettes.light.focusBorder,
    },
    knob: {
      width: KNOB,
      height: KNOB,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      ...shadows.card,
    },
    knobLight: { backgroundColor: colors.surfaceStrong },
    knobDark: { backgroundColor: palettes.dark.surfaceStrong },
    glyphRow: {
      position: "absolute",
      left: PAD + 4,
      right: PAD + 4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    off: { opacity: 0.5 },
  });
