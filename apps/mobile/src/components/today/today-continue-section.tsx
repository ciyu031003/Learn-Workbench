import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Surface } from "@/components/surface";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { taskTypeLabels } from "@learn-workbench/shared/labels";
import type { DailyTask } from "@learn-workbench/shared/schemas";

/**
 * ④ 继续上次（P1 新增）：把"上次没做完的事"提到首页一眼能看到的位置。
 *
 * 优先级：未完成任务 → 未学完的阶段 → 直接开始专注。
 * 组件本身无副作用：所有跳转/打开弹层都由 today 页传入，保持纯展示。
 */
export function TodayContinueSection({
  unfinishedTask,
  stageDone,
  stageTotal,
  onOpenTask,
  onStartFocus,
}: {
  unfinishedTask: DailyTask | null;
  stageDone: number;
  stageTotal: number;
  onOpenTask: (task: DailyTask) => void;
  onStartFocus: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const hasLearningLeft = stageTotal > 0 && stageDone < stageTotal;
  const kicker = unfinishedTask ? "继续上次" : hasLearningLeft ? "继续学习" : "现在开始";
  const title = unfinishedTask
    ? unfinishedTask.title
    : hasLearningLeft
      ? "还有 " + (stageTotal - stageDone) + " 个知识点没看完"
      : "今天还没有专注记录";
  const meta = unfinishedTask
    ? (taskTypeLabels[unfinishedTask.taskType] ?? unfinishedTask.taskType) +
      (unfinishedTask.focusMinutes > 0 ? " · 已专注 " + unfinishedTask.focusMinutes + " 分钟" : "")
    : hasLearningLeft
      ? "已完成 " + stageDone + " / " + stageTotal
      : "从一个 25 分钟的小目标开始";
  const cta = unfinishedTask ? "打开" : hasLearningLeft ? "去学习" : "开始专注";

  const handlePress = () => {
    haptics.light();
    if (unfinishedTask) {
      onOpenTask(unfinishedTask);
      return;
    }
    if (hasLearningLeft) {
      router.push("/quiz" as never);
      return;
    }
    onStartFocus();
  };

  return (
    <Surface tier="surface" style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={kicker + "：" + title}
        onPress={handlePress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.iconWrap}>
          <ThemedIcon name={unfinishedTask ? "play-forward" : hasLearningLeft ? "book" : "timer-outline"} size={18} color={colors.primary} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{cta}</Text>
          <ThemedIcon name="chevron-forward" size={13} color={colors.primary} />
        </View>
      </Pressable>
    </Surface>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: { overflow: "hidden" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 72,
    },
    rowPressed: { opacity: 0.85 },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    textCol: { flex: 1, gap: 2 },
    kicker: { ...typography.eyebrow, color: colors.textMuted },
    title: { ...typography.headline, color: colors.text },
    meta: { ...typography.meta, color: colors.textMuted },
    cta: { flexDirection: "row", alignItems: "center", gap: 2 },
    ctaText: { ...typography.callout, color: colors.primary, fontWeight: "600" },
  });
