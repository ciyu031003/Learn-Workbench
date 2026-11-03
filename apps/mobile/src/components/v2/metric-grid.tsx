import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

export type MetricTone = "primary" | "success" | "warning" | "accent" | "danger" | "teal";

const TONE_KEY: Record<MetricTone, keyof ThemeColors> = {
  primary: "primary",
  success: "success",
  warning: "warning",
  accent: "accent",
  danger: "danger",
  teal: "teal",
};

/**
 * v2 指标带：3 格（可 2-4）关键指标，白卡 + 竖线分隔，可选图标与单位。
 * 用于健康页三格、职业页三指标、今日页概览。
 */
export function MetricGrid({
  items,
  style,
}: {
  items: { icon?: keyof typeof Ionicons.glyphMap; value: string | number; unit?: string; label: string; tone?: MetricTone }[];
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const list = items.slice(0, 4);
  return (
    <View style={[styles.wrap, style]}>
      {list.map((item, index) => {
        const color = (colors[TONE_KEY[item.tone ?? "primary"]] as string | undefined) ?? colors.text;
        return (
          <View key={item.label + index} style={styles.cell}>
            {index > 0 ? <View pointerEvents="none" style={styles.divider} /> : null}
            {item.icon ? (
              <View style={[styles.icon, { backgroundColor: color + "14" }]}>
                <ThemedIcon name={item.icon} size={18} color={color} />
              </View>
            ) : null}
            <View style={styles.valueRow}>
              <Text style={[styles.value, tabularNums, item.tone ? { color } : null]} numberOfLines={1}>{item.value}</Text>
              {item.unit ? <Text style={styles.unit} numberOfLines={1}>{item.unit}</Text> : null}
            </View>
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceStrong,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
      ...shadows.card,
    },
    cell: { flex: 1, alignItems: "center", gap: 2, position: "relative", paddingHorizontal: spacing.xs },
    divider: { position: "absolute", left: 0, top: "16%", bottom: "16%", width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    icon: { marginBottom: 6, width: 30, height: 30, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
    valueRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
    value: { ...typography.num, color: colors.text },
    unit: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    label: { ...typography.meta, color: colors.textMuted },
  });
