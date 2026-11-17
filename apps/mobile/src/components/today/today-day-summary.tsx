import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Surface } from "@/components/surface";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * ⑦ 日终总结（P1 新增，默认折叠）：闭合「每日行动」链路的最后一步。
 *
 * 只读现有数据（今日完成数 / 专注分钟 / 连续天数），不新增任何持久化字段：
 * 复盘正文写进既有的「学习记录」页（/logs），避免为了一个输入框改数据模型。
 */
export function TodayDaySummary({
  doneCount,
  taskCount,
  focusMinutes,
  streakDays,
}: {
  doneCount: number;
  taskCount: number;
  focusMinutes: number;
  streakDays: number;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const cells = [
    { label: "今日完成", value: taskCount > 0 ? doneCount + "/" + taskCount : "0", hint: taskCount > 0 ? "任务" : "暂无任务" },
    { label: "专注时长", value: String(focusMinutes), hint: "分钟" },
    { label: "连续打卡", value: String(streakDays), hint: "天" },
  ];

  return (
    <Surface tier="surface" style={styles.card}>
      <View style={styles.row}>
        {cells.map((c, i) => (
          <View key={c.label} style={[styles.cell, i > 0 && styles.cellDivider]}>
            <Text style={styles.value} numberOfLines={1}>
              {c.value}
            </Text>
            <Text style={styles.label} numberOfLines={1}>
              {c.label}
            </Text>
            <Text style={styles.hint} numberOfLines={1}>
              {c.hint}
            </Text>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="写今日复盘，打开学习记录"
        hitSlop={6}
        onPress={() => {
          haptics.light();
          router.push("/logs" as never);
        }}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <ThemedIcon name="create-outline" size={14} color={colors.primary} />
        <Text style={styles.ctaText}>写今日复盘</Text>
        <ThemedIcon name="chevron-forward" size={13} color={colors.primary} />
      </Pressable>
    </Surface>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: { paddingVertical: spacing.sm },
    row: { flexDirection: "row", alignItems: "stretch" },
    cell: { flex: 1, alignItems: "center", gap: 1, paddingVertical: spacing.xs },
    cellDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
    value: { ...typography.hero, color: colors.text },
    label: { ...typography.meta, color: colors.textSecondary },
    hint: { ...typography.meta, color: colors.textMuted },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      minHeight: 44,
      marginTop: spacing.xs,
      marginHorizontal: spacing.lg,
      borderRadius: radius.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    ctaPressed: { opacity: 0.7 },
    ctaText: { ...typography.callout, color: colors.primary, fontWeight: "600" },
  });
