import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
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

/** 单个指标格 */
export type MetricGridItem = {
  icon?: keyof typeof Ionicons.glyphMap;
  value: string | number;
  unit?: string;
  label: string;
  tone?: MetricTone;
  /**
   * v2.3：可点格子（睡眠格 → /sleep 详情页）。
   * 不传时整格保持纯展示（与旧版完全一致）；传了才包一层 PressableScale（自带按压反馈）。
   */
  onPress?: () => void;
  /** 读屏文案（默认「标签 数值 单位」） */
  accessibilityLabel?: string;
};

/**
 * v2 指标带：3 格（可 2-4）关键指标，白卡 + 竖线分隔，可选图标与单位。
 * 用于健康页三格、职业页三指标、今日页概览。
 */
export function MetricGrid({
  items,
  style,
}: {
  items: MetricGridItem[];
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const list = items.slice(0, 4);
  return (
    <View style={[styles.wrap, style]}>
      {list.map((item, index) => {
        const color = (colors[TONE_KEY[item.tone ?? "primary"]] as string | undefined) ?? colors.text;
        const body = (
          <>
            {index > 0 ? <View pointerEvents="none" style={styles.divider} /> : null}
            {item.icon ? (
              <View style={[styles.icon, { backgroundColor: color + "14" }]}>
                <ThemedIcon name={item.icon} size={18} color={color} />
              </View>
            ) : null}
            <View style={styles.valueRow}>
              <Text style={[styles.value, tabularNums, item.tone ? { color } : null]} numberOfLines={1}>
                {item.value}
              </Text>
              {item.unit ? (
                <Text style={styles.unit} numberOfLines={1}>
                  {item.unit}
                </Text>
              ) : null}
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
          </>
        );

        if (item.onPress) {
          return (
            <PressableScale
              key={item.label + index}
              haptic
              scaleTo={0.97}
              onPress={item.onPress}
              style={styles.cell}
              accessibilityRole="button"
              accessibilityLabel={
                item.accessibilityLabel ??
                [item.label, item.value, item.unit].filter((part) => part !== undefined && part !== "").join(" ")
              }
            >
              {body}
            </PressableScale>
          );
        }

        return (
          <View key={item.label + index} style={styles.cell}>
            {body}
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
