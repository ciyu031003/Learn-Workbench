import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useBlurTarget } from "@/components/blur-target";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme";
import { isMotionActive } from "@/theme/motion";
import { radius, type ThemeColors } from "@/theme/tokens";

/**
 * 液态玻璃分段控件（对齐 demo `.seg-pill` / `.glass-seg`）。
 *
 * 与旧的分段控件相比：
 * - 底板走 BlurView + 30% 染色，不再是一块实色矩形；
 * - 选中指示器是**滑动的玻璃胶囊**（spring 平移），不是每个按钮各自瞬间变色；
 * - 左右切换时指示器与文字同步过渡，减少「弹入弹出」的突兀感。
 *
 * 动效纪律：worklet 内只读写共享值 + Reanimated API。
 */
export type GlassSegmentOption<T extends string> = { key: T; label: string };

const HEIGHT = 40;
const PAD = 4;
const PILL_HEIGHT = HEIGHT - PAD * 2;

export function GlassSegment<T extends string>({
  options,
  value,
  onChange,
  style,
  accessibilityLabel,
  tone = "light",
}: {
  options: readonly GlassSegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** light = 浅色画布上的玻璃；dark = 深色沉浸页（登录 / 图表演示） */
  tone?: "light" | "dark";
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark, tone === "dark"), [colors, dark, tone]);
  const blurTarget = useBlurTarget();
  const reduced = useReducedMotion();
  const active = isMotionActive(reduced);
  const [trackWidth, setTrackWidth] = useState(0);

  const slot = trackWidth > 0 ? (trackWidth - PAD * 2) / Math.max(1, options.length) : 0;
  const index = Math.max(0, options.findIndex((option) => option.key === value));

  const x = useSharedValue(0);
  useEffect(() => {
    const target = index * slot;
    x.value = active ? withSpring(target, { damping: 21, stiffness: 260, mass: 0.65 }) : target;
  }, [active, index, slot, x]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={[styles.shell, style]}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {Platform.OS !== "android" || blurTarget ? (
        <BlurView
          intensity={46}
          tint={dark ? "dark" : "light"}
          blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
          blurTarget={blurTarget ?? undefined}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View pointerEvents="none" style={styles.tint} />
      <View pointerEvents="none" style={styles.sheen} />

      {slot > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.pill, { width: slot }, indicatorStyle]}>
          <View style={styles.pillSheen} />
        </Animated.View>
      ) : null}

      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => {
              if (selected) return;
              haptics.light();
              onChange(option.key);
            }}
          >
            <Text style={[styles.label, selected && styles.labelOn]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean, onDark: boolean) =>
  StyleSheet.create({
    shell: {
      height: HEIGHT,
      flexDirection: "row",
      alignItems: "stretch",
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: onDark ? "rgba(255,255,255,0.20)" : dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.72)",
      overflow: "hidden",
      paddingHorizontal: PAD,
      backgroundColor: "transparent",
    },
    tint: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: onDark ? "rgba(6,14,22,0.34)" : dark ? "rgba(16,24,30,0.40)" : "rgba(255,255,255,0.22)",
    },
    sheen: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "48%",
      backgroundColor: onDark ? "rgba(255,255,255,0.07)" : dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.26)",
    },
    pill: {
      position: "absolute",
      top: PAD,
      left: PAD,
      height: PILL_HEIGHT,
      borderRadius: radius.pill,
      backgroundColor: onDark ? "rgba(255,255,255,0.88)" : dark ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.78)",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: onDark ? "rgba(255,255,255,0.62)" : dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.92)",
      shadowColor: "#1B4F87",
      shadowOpacity: dark ? 0 : 0.14,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
      elevation: 0,
    },
    pillSheen: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "50%",
      borderTopLeftRadius: radius.pill,
      borderTopRightRadius: radius.pill,
      backgroundColor: dark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.5)",
    },
    item: { flex: 1, alignItems: "center", justifyContent: "center", zIndex: 1 },
    label: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
      color: onDark ? "rgba(255,255,255,0.72)" : dark ? "rgba(255,255,255,0.64)" : colors.textMuted,
    },
    labelOn: { fontWeight: "700", color: onDark ? "#0F191D" : colors.text },
  });