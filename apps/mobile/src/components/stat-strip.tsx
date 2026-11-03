import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { radius, shadows, spacing, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import type { EntryTone } from "@/components/entry-card";

/**
 * 指标条（v1.62 P0-1）：2–4 格等宽关键指标，一行展示、竖线分隔。
 * 替代今日页/健康页/职业 hero 里各自手写的「值 + 标签」组合。
 *
 * 用法：
 *   <StatStrip items={[{ label: "题库", value: 12, unit: "/20" }, ...]} onPress={() => ...} />
 * 约束：值用 tabularNums；字号/颜色全部走 token；传 onPress 时整条可点并显示右箭头。
 */
export interface StatStripItem {
  label: string;
  value: string | number;
  unit?: string;
  tone?: EntryTone;
}

const TONE_FALLBACK: Record<EntryTone, string> = {
  primary: "primary",
  accent: "accent",
  teal: "teal",
  success: "success",
  warning: "warning",
};

export function StatStrip({
  items,
  onPress,
  actionLabel,
  style,
  accessibilityLabel,
}: {
  items: StatStripItem[];
  onPress?: () => void;
  /** 可点时右侧的说明文字（默认不显示，仅箭头） */
  actionLabel?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const list = items.slice(0, 4);

  const body = (
    <View style={[styles.strip, style]}>
      {list.map((item, index) => {
        const tone = item.tone ?? "primary";
        const colorKey = TONE_FALLBACK[tone] as keyof ThemeColors;
        const valueColor = (colors[colorKey] as string | undefined) ?? colors.text;
        return (
          <View key={item.label + index} style={styles.cell}>
            {index > 0 ? <View pointerEvents="none" style={styles.divider} /> : null}
            <View style={styles.valueRow}>
              <Text style={[styles.value, tabularNums, { color: valueColor }]} numberOfLines={1}>
                {item.value}
              </Text>
              {item.unit ? <Text style={styles.unit} numberOfLines={1}>{item.unit}</Text> : null}
            </View>
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
          </View>
        );
      })}
      {onPress ? (
        <View style={styles.tail}>
          {actionLabel ? <Text style={styles.action}>{actionLabel}</Text> : null}
          <ThemedIcon name="chevron-forward" size={15} color={colors.textFaint} />
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <PressableScale
      haptic
      scaleTo={0.99}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? "查看详情"}
    >
      {body}
    </PressableScale>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    strip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceStrong,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      ...shadows.card,
    },
    cell: {
      flex: 1,
      alignItems: "center",
      gap: 1,
      position: "relative",
      paddingHorizontal: spacing.xs,
    },
    divider: {
      position: "absolute",
      left: 0,
      top: "18%",
      bottom: "18%",
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    valueRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
    value: { ...typography.title2 },
    unit: { ...typography.caption, color: colors.textMuted },
    label: { ...typography.caption, color: colors.textMuted },
    tail: { flexDirection: "row", alignItems: "center", gap: 2, paddingRight: spacing.sm },
    action: { ...typography.caption, color: colors.textMuted },
  });
