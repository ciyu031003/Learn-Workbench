import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import type { GrowthScreenData } from "./use-growth-data";

/**
 * 模块 ①：习惯打卡（今日习惯区块）。
 *
 * 从成长页整块搬到数据看板：只给进度与入口（勾选仍在习惯页，避免同一份数据两处写入），
 * 数据来源不变 —— /api/daily 的 habits.scheduled / habits.done。
 */
export function GrowthHabits({ growth }: { growth: GrowthScreenData }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const daily = growth.data;
  const scheduled = daily?.habits.scheduled ?? 0;
  const done = daily?.habits.done ?? 0;
  const hasPlan = scheduled > 0;

  return (
    <PressableScale
      haptic
      scaleTo={0.99}
      hitSlop={4}
      onPress={() => router.push("/habits" as never)}
      accessibilityRole="button"
      accessibilityLabel={
        hasPlan
          ? "今日习惯 已完成 " + done + " / " + scheduled + "，本周完成率 " + growth.habitPct + "%，打开习惯页"
          : "还没有习惯计划，打开习惯页创建"
      }
    >
      <Surface tier="surface" corner={radius.card} style={styles.card}>
        <View style={styles.text}>
          <Text style={styles.title}>今日习惯</Text>
          <Text style={styles.hint} numberOfLines={2}>
            {hasPlan
              ? "已完成 " + done + " / " + scheduled + " · 本周完成率 " + growth.habitPct + "%"
              : "还没有习惯计划，去习惯页建一个每天能坚持的小习惯"}
          </Text>
        </View>
        <Text style={[styles.value, tabularNums]} numberOfLines={1}>
          {hasPlan ? done + "/" + scheduled : "—"}
        </Text>
        <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
      </Surface>
    </PressableScale>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      minHeight: 68,
    },
    text: { flex: 1, minWidth: 0, gap: 3 },
    title: { ...typography.callout, fontWeight: "600", color: colors.text },
    hint: { ...typography.meta, color: colors.textMuted },
    value: { ...typography.hero, color: colors.text },
  });
