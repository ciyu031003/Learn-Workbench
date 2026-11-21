import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { taskTypeLabels } from "@learn-workbench/shared/labels";
import type { DailyTask } from "@learn-workbench/shared/schemas";
import { TodaySectionHead } from "./today-section-head";

/**
 * ⑤ 「03 继续上次」：一行卡片。
 *
 * 左 P1 徽章，中间是「上次没做完的那件事」（未完成任务标题；没有就退回到
 * 路线图里没学完的知识点数量），右侧「继续 →」。
 * 点击语义：有未完成任务 → 打开任务详情弹层；否则跳 /quiz（与「知识点没看完」对应）。
 */
export function TodayContinueLine({
  unfinishedTask,
  stageDone,
  stageTotal,
  onOpenTask,
}: {
  unfinishedTask: DailyTask | null;
  stageDone: number;
  stageTotal: number;
  onOpenTask: (task: DailyTask) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const learningLeft = Math.max(0, stageTotal - stageDone);
  const hasLearningLeft = stageTotal > 0 && learningLeft > 0;

  const title = unfinishedTask
    ? unfinishedTask.title
    : hasLearningLeft
      ? "还有 " + learningLeft + " 个知识点没看完"
      : "去学习舱挑一个知识点继续";
  const meta = unfinishedTask
    ? (taskTypeLabels[unfinishedTask.taskType] ?? unfinishedTask.taskType) +
      (unfinishedTask.focusMinutes > 0 ? " · 已专注 " + unfinishedTask.focusMinutes + " 分钟" : "")
    : stageTotal > 0
      ? "阶段已完成 " + stageDone + " / " + stageTotal
      : "从今天的路线图开始";

  const handlePress = () => {
    haptics.light();
    if (unfinishedTask) {
      onOpenTask(unfinishedTask);
      return;
    }
    router.push("/quiz" as never);
  };

  return (
    <View style={styles.section}>
      <TodaySectionHead
        index="03"
        title="继续上次"
        action={{
          label: "去学习 →",
          accessibilityLabel: "去学习页",
          onPress: () => router.push("/learn" as never),
        }}
      />
      <Pressable
        hitSlop={4}
        onPress={handlePress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={"继续上次：" + title}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>P1</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>继续 →</Text>
        </View>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: { gap: spacing.sm },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.card,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    cardPressed: { opacity: 0.85 },
    badge: {
      width: 34,
      height: 34,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    badgeText: { ...typography.eyebrow, letterSpacing: 0.5, color: colors.primaryStrong },
    body: { flex: 1, minWidth: 0 },
    title: { ...typography.callout, fontWeight: "600", color: colors.text },
    meta: { ...typography.meta, color: colors.textMuted, marginTop: 3 },
    cta: { flexDirection: "row", alignItems: "center", gap: 2 },
    ctaText: { ...typography.meta, fontWeight: "600", color: colors.primary },
  });
