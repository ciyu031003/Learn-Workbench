import { useMemo, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { radius, typography } from "@/theme/tokens";
import {
  BUTTON_DISABLED_OPACITY,
  BUTTON_SIZES,
  buttonBackground,
  buttonForeground,
  buttonIconSize,
  type UnifiedButtonVariant,
} from "@/lib/button-spec";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 统一按钮（见 docs/APP端优化方案-v2 §8.3②）
 * - `primary`   实心品牌色，高 48，pill
 * - `secondary` `primarySoft` 底 + 品牌色文字
 * - `ghost`     纯文字
 * - `danger`    危险态（删除/退出）
 * 禁用态 40% 透明。
 */
/** v17-D（R10）：变体清单与 PressButton 统一，见 lib/button-spec.ts */
export type ButtonVariant = UnifiedButtonVariant;

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  loadingLabel,
  disabled = false,
  size = "md",
  fullWidth = true,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  /** v17-D：与 PressButton 对齐 —— loading 时可给一句替换文案（不传则只显示转圈） */
  loadingLabel?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const off = disabled || loading;

  const fg = buttonForeground(colors, variant);

  return (
    <PressableScale
      haptic={!off}
      disabled={off}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.base,
        size === "sm" && styles.baseSm,
        { backgroundColor: buttonBackground(colors, variant) },
        fullWidth && styles.full,
        off && styles.off,
        style,
      ]}
    >
      {loading ? (
        <>
          <ActivityIndicator size="small" color={fg} />
          {loadingLabel ? (
            <Text style={[styles.label, size === "sm" && styles.labelSm, { color: fg }]}>{loadingLabel}</Text>
          ) : null}
        </>
      ) : (
        <>
          {icon ? <ThemedIcon name={icon} size={buttonIconSize(size)} color={fg} /> : null}
          <Text style={[styles.label, size === "sm" && styles.labelSm, { color: fg }]}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

/** 图标按钮（工具条用）：44×44 圆形触控目标 */
export function IconButton({
  icon,
  onPress,
  color,
  bg,
  size = 20,
  accessibilityLabel,
  disabled = false,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  bg?: string;
  size?: number;
  accessibilityLabel: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      haptic={!disabled}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.92}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.iconBtn, { backgroundColor: bg ?? colors.surfaceMuted }, disabled && styles.off, style]}
    >
      <ThemedIcon name={icon} size={size} color={color ?? colors.text} />
    </PressableScale>
  );
}

/** 按钮组（并排等宽） */
export function ButtonRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[rowStyles.row, style]}>{children}</View>;
}

const rowStyles = StyleSheet.create({ row: { flexDirection: "row", gap: 10 } });

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // v17-D：尺寸取 lib/button-spec.ts 的唯一出口（与 PressButton 共用，避免两边漂移）
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
    iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  });
