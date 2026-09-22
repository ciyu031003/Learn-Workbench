import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { isMotionActive } from "@/theme/motion";

/**
 * v13 U4 · 轻提示（技法参考 uiverse.io/Yaya12085/smooth-seahorse-63 的"图标徽章 + 标题 + 副标题"
 * 与 uiverse.io/WittyHydra/nervous-zebra-0 的"底部细进度条 = 剩余停留时间"，均为 MIT）。
 *
 * 调用 API 与旧的内联文字 toast 一致：给一段 message 就会显示，超时由调用方移除；
 * 这里额外接受可选 detail / kind / lifeMs，缺省时行为与旧版完全一样。
 * 降级：MOTION_ENABLED=false 或系统减弱动态 → 不画倒计时条（不播放动画）。
 */

export type ToastKind = "success" | "error" | "info";

/** 旧版各调用点的超时（2200 / 2400）落在这个默认值附近 */
export const TOAST_DEFAULT_LIFE_MS = 2400;

const KIND_ICON: Record<ToastKind, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "alert-circle",
  info: "information-circle",
};

/** 语义色（成功 / 失败 / 信息）走后端 token，不新造颜色 */
export function toastTone(colors: ThemeColors, kind: ToastKind): { bg: string; fg: string } {
  if (kind === "success") return { bg: colors.successSoft, fg: colors.success };
  if (kind === "error") return { bg: colors.dangerSoft, fg: colors.danger };
  return { bg: colors.primarySoft, fg: colors.primary };
}

export function InlineToast({
  message,
  detail,
  kind = "success",
  lifeMs = TOAST_DEFAULT_LIFE_MS,
  onClose,
  style,
  testID,
}: {
  message: string;
  /** 可选副标题 */
  detail?: string;
  kind?: ToastKind;
  /** 与调用方 setTimeout 的超时保持一致，用于画倒计时条 */
  lifeMs?: number;
  onClose?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const tone = useMemo(() => toastTone(colors, kind), [colors, kind]);
  const styles = useMemo(() => makeStyles(colors, kind), [colors, kind]);
  const reduceMotion = useReducedMotion();
  const active = isMotionActive(reduceMotion);

  const progress = useSharedValue(1);

  useEffect(() => {
    if (!active) return;
    progress.value = 1;
    // 线性收缩：进度条宽度 = 剩余停留时间（技法参考 nervous-zebra-0）
    progress.value = withTiming(0, {
      duration: Math.max(200, lifeMs),
      easing: Easing.linear,
    });
  }, [active, lifeMs, message, progress]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.wrap, style]}
    >
      <View style={styles.badge}>
        <ThemedIcon name={KIND_ICON[kind]} size={16} color={tone.fg} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{message}</Text>
        {detail ? <Text style={styles.detail} numberOfLines={2}>{detail}</Text> : null}
      </View>

      {onClose ? (
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityLabel="关闭提示"
          style={styles.close}
        >
          <ThemedIcon name="close" size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {active ? <Animated.View pointerEvents="none" style={[styles.bar, barStyle]} /> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors, kind: ToastKind) => {
  const tone = toastTone(colors, kind);

  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      paddingRight: spacing.xl + spacing.sm,
      overflow: "hidden",
      ...shadows.floating,
    },
    badge: {
      width: 32,
      height: 32,
      borderRadius: radius.sm + 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tone.bg,
    },
    body: { flex: 1, minWidth: 0, gap: 2 },
    title: { ...typography.callout, fontWeight: "700", color: colors.text },
    detail: { ...typography.micro, fontWeight: "500", color: colors.textMuted, lineHeight: 15 },
    close: { position: "absolute", right: 6, top: 6, padding: 4 },
    bar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 2,
      transformOrigin: "left center",
      backgroundColor: tone.fg,
    },
  });
};
