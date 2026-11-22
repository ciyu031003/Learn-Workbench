import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { haptics } from "@/lib/haptics";
import { TEXT_SCALE_POLICY } from "@/lib/text-scale";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";
import type { TodayHabitRow } from "./use-today-screen";

/**
 * 今日习惯（紧凑版）：一行标签式入口，替代改版前那三列习惯瓦片。
 *
 * Day Sheet 不再放仪表盘，但「今天该打的卡」是真实交互，必须留：
 * 只渲染今天排期的习惯（hook 已经按 isScheduled 过滤并和任务去重），点一下原地切换完成态，
 * 服务端失败由 hook 回滚。没有排期习惯时整块不渲染，不占位置。
 */
export function TodayHabitLine({
  habits,
  onToggleHabit,
  fireBurst,
  onPlanProgress,
}: {
  habits: TodayHabitRow[];
  onToggleHabit: (id: number, done: boolean) => void;
  /** 打卡成功时的轻庆祝（V7 重构时丢了，2.8.1 还原） */
  fireBurst?: (kicker: string, title: string, subtitle?: string) => void;
  /** 打卡后重新评估「今日计划是否全部完成」，用于弹出全屏庆祝 */
  onPlanProgress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (habits.length === 0) return null;
  const done = habits.filter((h) => h.done).length;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.label} {...TEXT_SCALE_POLICY.chrome}>
          今日习惯
        </Text>
        <Text style={styles.count} {...TEXT_SCALE_POLICY.chrome}>
          {done + "/" + habits.length}
        </Text>
      </View>
      <View style={styles.chips}>
        {habits.map((habit) => (
          <Pressable
            key={habit.id}
            hitSlop={6}
            onPress={() => {
              // 与改版前的三列习惯瓦片保持一致：只有「从未完成→完成」才庆祝，取消勾选不打扰
              if (!habit.done) {
                fireBurst?.("习惯打卡", habit.name, "今天的习惯又稳了一项");
                onPlanProgress?.();
              }
              haptics.light();
              onToggleHabit(habit.id, habit.done);
            }}
            style={({ pressed }) => [
              styles.chip,
              habit.done ? styles.chipDone : null,
              pressed && styles.chipPressed,
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: habit.done }}
            accessibilityLabel={(habit.done ? "取消打卡 " : "打卡 ") + habit.name}
          >
            {habit.done ? (
              <Icon name="check" size={12} weight="bold" color={colors.success} />
            ) : null}
            <Text style={[styles.chipText, habit.done ? styles.chipTextDone : null]} numberOfLines={1}>
              {habit.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: { gap: spacing.sm },
    head: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
    label: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    count: { ...typography.eyebrow, color: colors.textMuted },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      minHeight: 30,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipDone: { backgroundColor: colors.successSoft, borderColor: colors.success },
    chipPressed: { opacity: 0.8 },
    chipText: { ...typography.meta, fontWeight: "600", color: colors.textSecondary },
    chipTextDone: { color: colors.success },
  });
