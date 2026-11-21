import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Icon, ICON_SIZE } from "@/components/ui/icon";
import { haptics } from "@/lib/haptics";
import { DURATION } from "@/lib/motion";
import { staggerDelay } from "@/lib/stagger";
import { TEXT_SCALE_POLICY } from "@/lib/text-scale";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { taskTypeLabels } from "@learn-workbench/shared/labels";
import type { DailyTask } from "@learn-workbench/shared/schemas";
import { TodaySectionHead } from "./today-section-head";

/** Day Sheet 只列三件：超出的部分留给任务页，首页不再滚动成一整页任务 */
const MAX_THINGS = 3;

/**
 * ③ 「01 今天只做三件事」：竖线 + 圆形序号节点的清单（最多 3 条）。
 *
 * 整行可点 = 勾选完成（沿用既有 toggleTaskDone），完成态是绿圈 + 标题划线；
 * 勾完最后一件仍走既有的轻量横幅 / 全屏庆祝回调，交互语义和改版前一致。
 */
export function TodayThreeThings({
  tasks,
  todayDone,
  pendingHabits,
  reduced,
  onToggleTask,
  fireBurst,
  maybeCelebratePlan,
  onManage,
}: {
  tasks: DailyTask[];
  todayDone: number;
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

  return (
    <View style={styles.section}>
      <TodaySectionHead
        index="01"
        title="今天只做三件事"
        action={{ label: "调整", accessibilityLabel: "调整今日三件事，打开任务页", onPress: onManage }}
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
        <View style={styles.list}>
          {/* 竖线：贯穿三个序号节点（节点自身不透明，压在线上） */}
          <View pointerEvents="none" style={styles.rail} />
          {things.map((task, i) => {
            const meta =
              (taskTypeLabels[task.taskType] ?? task.taskType) +
              (task.focusMinutes > 0 ? " · " + task.focusMinutes + " 分钟" : "");
            return (
              <Animated.View
                key={task.id}
                entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))}
              >
                <Pressable
                  hitSlop={4}
                  onPress={() => {
                    const willDone = !task.done;
                    haptics.light();
                    onToggleTask(task.id);
                    if (willDone) {
                      fireBurst("任务完成", task.title, "已加入今日完成");
                      maybeCelebratePlan(todayDone + 1, pendingHabits);
                    }
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: task.done }}
                  accessibilityLabel={(task.done ? "取消完成 " : "标记完成 ") + task.title}
                >
                  <View style={[styles.node, task.done ? styles.nodeDone : null]}>
                    {task.done ? (
                      <Icon name="check" size={13} weight="bold" color={colors.surface} />
                    ) : (
                      <Text style={styles.nodeText} {...TEXT_SCALE_POLICY.chrome}>
                        {String(i + 1)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.rowBody}>
                    <Text
                      style={[styles.rowTitle, task.done ? styles.rowTitleDone : null]}
                      numberOfLines={2}
                    >
                      {task.title}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {meta}
                    </Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}

      <Pressable
        hitSlop={8}
        onPress={() => {
          haptics.light();
          onManage();
        }}
        style={styles.moreBtn}
        accessibilityRole="button"
        accessibilityLabel={
          things.length >= MAX_THINGS
            ? "已加满 3 件，打开任务页调整"
            : "还可以再加 " + (MAX_THINGS - things.length) + " 件，打开任务页"
        }
      >
        <Text style={styles.moreText}>
          {things.length >= MAX_THINGS
            ? "已加满 3 件 · 今天不再加"
            : "还可以再加 " + (MAX_THINGS - things.length) + " 件"}
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: { gap: spacing.sm },
    list: { position: "relative", marginTop: spacing.xs },
    rail: {
      position: "absolute",
      left: 12,
      top: 13,
      bottom: 13,
      width: 1,
      backgroundColor: colors.borderStrong,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    rowPressed: { opacity: 0.72 },
    node: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    nodeDone: { backgroundColor: colors.success, borderColor: colors.success },
    nodeText: { ...typography.eyebrow, color: colors.textSecondary },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    rowTitleDone: { color: colors.textMuted, textDecorationLine: "line-through" },
    rowMeta: { ...typography.meta, color: colors.textMuted, marginTop: 3 },
    emptyCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.card,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyCardPressed: { opacity: 0.85 },
    emptyBody: { flex: 1, minWidth: 0 },
    emptyTitle: { ...typography.headline, color: colors.text },
    emptyHint: { ...typography.meta, color: colors.textMuted, marginTop: 3 },
    moreBtn: { alignSelf: "flex-start", marginLeft: 38 },
    moreText: { ...typography.meta, color: colors.textMuted, textDecorationLine: "underline" },
  });
