import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Icon, ICON_SIZE } from "@/components/ui/icon";
import { haptics } from "@/lib/haptics";
import { DURATION } from "@/lib/motion";
import { staggerDelay } from "@/lib/stagger";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { taskTypeLabels } from "@learn-workbench/shared/labels";
import type { DailyTask } from "@learn-workbench/shared/schemas";
import { TodaySectionHead } from "./today-section-head";

/** Day Sheet 只列三件：超出的部分留给任务页，首页不再滚动成一整页任务 */
const MAX_THINGS = 3;

/**
 * 「今天只做三件事」：对齐 demo v12 的白卡清单。
 *
 * 一张白卡包住三行：左侧绿色勾选方块（未完成是灰描边），中间标题 + 类型/时长，
 * 行间用 hairline 分隔。整行可点 = 勾选完成（沿用 toggleTaskDone），
 * 完成态标题划线置灰；勾完最后一件仍走既有的轻量横幅 / 全屏庆祝回调。
 */
export function TodayThreeThings({
  tasks,
  todayDone,
  total,
  pendingHabits,
  reduced,
  onToggleTask,
  fireBurst,
  maybeCelebratePlan,
  onManage,
}: {
  tasks: DailyTask[];
  todayDone: number;
  total?: number;
  pendingHabits: number;
  reduced: boolean;
  onToggleTask: (id: number) => void;
  fireBurst: (kicker: string, title: string, subtitle?: string) => void;
  maybeCelebratePlan: (tasksDone: number, habitsPending: number) => void;
  /** 打开任务页（调整 / 空态 / 「已加满」小字共用同一个真实入口） */
  onManage: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const things = tasks.slice(0, MAX_THINGS);
  const allTotal = Math.max(total ?? tasks.length, things.length);
  const remaining = Math.max(0, allTotal - todayDone);

  return (
    <View style={styles.section}>
      <TodaySectionHead
        title="今天只做三件事"
        meta={allTotal > 0 ? `${todayDone} / ${allTotal} 已完成` : undefined}
        action={{
          label: allTotal > 0 ? `全部 ${allTotal} 项 →` : "调整 →",
          accessibilityLabel: "打开任务页，查看全部任务",
          onPress: onManage,
        }}
      />

      {things.length === 0 ? (
        <Pressable
          hitSlop={4}
          onPress={() => {
            haptics.light();
            onManage();
          }}
          style={({ pressed }) => [styles.emptyCard, pressed && styles.emptyCardPressed]}
          accessibilityRole="button"
          accessibilityLabel="今天还没有安排，去添加任务"
        >
          <View style={styles.emptyBody}>
            <Text style={styles.emptyTitle}>今天还没有安排</Text>
            <Text style={styles.emptyHint}>先定一件最要紧的事，今天就算赢了一半。</Text>
          </View>
          <Icon name="chevron" size={ICON_SIZE.sm} weight="bold" color={colors.primary} />
        </Pressable>
      ) : (
        <View style={styles.card}>
          {things.map((task, i) => {
            const meta =
              (taskTypeLabels[task.taskType] ?? task.taskType) +
              (task.focusMinutes > 0 ? " · " + task.focusMinutes + " 分钟" : "");
            return (
              <Animated.View key={task.id} entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))}>
                <Pressable
                  hitSlop={2}
                  onPress={() => {
                    const willDone = !task.done;
                    haptics.light();
                    onToggleTask(task.id);
                    if (willDone) {
                      fireBurst("任务完成", task.title, "已加入今日完成");
                      maybeCelebratePlan(todayDone + 1, pendingHabits);
                    }
                  }}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.rowPressed]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: task.done }}
                  accessibilityLabel={(task.done ? "取消完成 " : "标记完成 ") + task.title}
                >
                  <View style={[styles.check, task.done ? styles.checkDone : null]}>
                    {task.done ? <Icon name="check" size={14} weight="bold" color="#FFFFFF" /> : null}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, task.done ? styles.rowTitleDone : null]} numberOfLines={2}>
                      {task.title}
                    </Text>
                    <View style={styles.metaRow}>
                      <View style={styles.metaDot} />
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {meta}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
          <View style={styles.foot}>
            <Pressable
              hitSlop={8}
              onPress={() => {
                haptics.light();
                onManage();
              }}
              accessibilityRole="button"
              accessibilityLabel="调整今日任务"
              style={styles.footLeft}
            >
              <Icon name="plus" size={13} weight="bold" color={colors.primary} />
              <Text style={styles.footLink}>
                {things.length >= MAX_THINGS ? "调整今日任务" : `还可再加 ${MAX_THINGS - things.length} 件`}
              </Text>
            </Pressable>
            <Text style={styles.footMeta}>{remaining} 项待完成</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: { gap: spacing.sm },
    card: {
      borderRadius: radius.card,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      ...shadows.card,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
    },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    rowPressed: { opacity: 0.72 },
    check: {
      width: 26,
      height: 26,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    checkDone: { backgroundColor: colors.success, borderColor: colors.success },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    rowTitleDone: { color: colors.textMuted, textDecorationLine: "line-through" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
    metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textFaint },
    rowMeta: { ...typography.meta, color: colors.textMuted },
    foot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    footLeft: { flexDirection: "row", alignItems: "center", gap: 5 },
    footLink: { ...typography.meta, fontWeight: "600", color: colors.primary },
    footMeta: { ...typography.meta, color: colors.textMuted },
    emptyCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.card,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    emptyCardPressed: { opacity: 0.85 },
    emptyBody: { flex: 1, minWidth: 0 },
    emptyTitle: { ...typography.headline, color: colors.text },
    emptyHint: { ...typography.meta, color: colors.textMuted, marginTop: 3 },
  });
