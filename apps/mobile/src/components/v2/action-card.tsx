import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { haptics } from "@/lib/haptics";
import { radius, shadows, typography, type ThemeColors } from "@/theme/tokens";

export type ActionTone = "primary" | "success" | "warning" | "accent" | "teal" | "danger";

const TONE_KEY: Record<ActionTone, keyof ThemeColors> = {
  primary: "primary",
  success: "success",
  warning: "warning",
  accent: "accent",
  teal: "teal",
  danger: "danger",
};

/**
 * v2 行动卡（2×2 网格里的单格）：图标芯片 + 标题 + 说明 + 胶囊按钮文案。
 * 整卡可点（单一下降语义），按钮只是视觉 CTA，避免嵌套 button 的无障碍播报。
 */
export function ActionCard({
  icon,
  tone = "primary",
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: ActionTone;
  title: string;
  subtitle?: string;
  actionLabel: string;
  onAction: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const color = (colors[TONE_KEY[tone]] as string | undefined) ?? colors.primary;
  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onAction();
      }}
      accessibilityRole="button"
      accessibilityLabel={title + (subtitle ? "，" + subtitle : "")}
      style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={[styles.iconChip, { backgroundColor: color + "1A" }]}>
          <ThemedIcon name={icon} size={18} color={color} />
        </View>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      <View style={[styles.cta, { backgroundColor: color + "14" }]}>
        <Text style={[styles.ctaText, { color }]}>{actionLabel}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minHeight: 150,
      padding: 14,
      gap: 9,
      borderRadius: radius.card,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    pressed: { opacity: 0.82 },
    top: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 },
    iconChip: { width: 36, height: 36, borderRadius: radius.control - 2, alignItems: "center", justifyContent: "center" },
    title: { ...typography.callout, fontWeight: "700", color: colors.text, flexShrink: 1 },
    subtitle: { ...typography.meta, color: colors.textMuted, lineHeight: 17 },
    cta: { alignSelf: "flex-start", marginTop: "auto", minHeight: 34, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, justifyContent: "center" },
    ctaText: { ...typography.caption, fontWeight: "700" },
  });
