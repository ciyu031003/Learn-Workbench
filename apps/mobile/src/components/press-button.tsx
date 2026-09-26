/* eslint-disable react-hooks/immutability -- 与 pressable-scale.tsx 同约定：在事件回调里直接写共享值 */
import { useCallback, useMemo, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { radius, typography, type ThemeColors } from "@/theme/tokens";
import { MOTION_BASE, MOTION_FAST, easingStandard, isMotionActive } from "@/theme/motion";
import { useReducedMotion } from "@/lib/motion";
import {
  BUTTON_DISABLED_OPACITY,
  BUTTON_SIZES,
  buttonBackground,
  buttonForeground,
  buttonIconSize,
  type UnifiedButtonVariant,
} from "@/lib/button-spec";
import { haptics } from "@/lib/haptics";

/**
 * v13 U5 · 按压反馈按钮（技法参考 uiverse.io/seyed-mohsen-mousavi/bitter-snail-5 的"按下收一档"，
 * 以及 uiverse.io/elijahgummer/friendly-wasp-61 的"提交中 → 文案切换"，均为 MIT）。
 *
 * 与 `Button` 的分工：`Button` 继续用于绝大多数位置（不替换，避免回归）；
 * 主 CTA（保存/上传/打卡）用 PressButton —— 按下 0.97 缩放 + 标准缓动回落，
 * `loading` 时内嵌 ActivityIndicator 并把文案切成 `loadingLabel`。
 * 降级：MOTION_ENABLED=false 或系统减弱动态 → 按压缩放变成瞬时（时长 0），不影响功能。
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** v17-D（R10）：与 Button 统一为四个变体（新增 ghost）；视觉规格共用 lib/button-spec.ts */
export type PressButtonVariant = UnifiedButtonVariant;

export function PressButton({
  label,
  onPress,
  loadingLabel,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  size = "md",
  fullWidth = true,
  haptic = true,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  /** loading 时替换的文案（默认"处理中…"） */
  loadingLabel?: string;
  variant?: PressButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  fullWidth?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const active = isMotionActive(reduceMotion);
  const off = disabled || loading;

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    // 顺序约束：scale 已在上面声明；worklet 只写共享值，不调用外部普通函数
    scale.value = active
      ? withTiming(0.97, { duration: MOTION_FAST, easing: easingStandard })
      : 0.97;
  }, [active, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = active
      ? withTiming(1, { duration: MOTION_BASE, easing: easingStandard })
      : 1;
  }, [active, scale]);

  const handlePress = useCallback(() => {
    if (!off && haptic) haptics.light();
    onPress?.();
  }, [haptic, off, onPress]);

  const fg = buttonForeground(colors, variant);
  const text = loading ? (loadingLabel ?? "处理中…") : label;

  return (
    <AnimatedPressable
      disabled={off}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy: loading }}
      style={[
        styles.base,
        size === "sm" && styles.baseSm,
        { backgroundColor: buttonBackground(colors, variant) },
        fullWidth && styles.full,
        off && styles.off,
        style,
        animatedStyle,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : null}
      {!loading && icon ? <ThemedIcon name={icon} size={buttonIconSize(size)} color={fg} /> : null}
      <Text style={[styles.label, size === "sm" && styles.labelSm, { color: fg }]} numberOfLines={1}>
        {text}
      </Text>
    </AnimatedPressable>
  );
}

/** 与 PressButton 配套的纯容器（并排等宽） */
export function PressButtonRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[rowStyles.row, style]}>{children}</View>;
}

const rowStyles = StyleSheet.create({ row: { flexDirection: "row", gap: 10 } });

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // v17-D：尺寸取 lib/button-spec.ts 的唯一出口（与 Button 共用）；底色也改由 buttonBackground 计算
    base: {
      height: BUTTON_SIZES.md.height,
      borderRadius: radius.pill,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: BUTTON_SIZES.md.gap,
      paddingHorizontal: BUTTON_SIZES.md.paddingHorizontal,
    },
    baseSm: {
      height: BUTTON_SIZES.sm.height,
      paddingHorizontal: BUTTON_SIZES.sm.paddingHorizontal,
      gap: BUTTON_SIZES.sm.gap,
    },
    full: { alignSelf: "stretch", flex: 1 },
    off: { opacity: BUTTON_DISABLED_OPACITY },
    label: { ...typography.headline, fontWeight: "700" },
    labelSm: { fontSize: 14 },
  });
