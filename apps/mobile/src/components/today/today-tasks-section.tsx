import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";
import { AnimatedCheckMark } from "@/components/check-mark";
import { EmptyState } from "@/components/empty-state";
import { Surface } from "@/components/surface";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { DURATION } from "@/lib/motion";
import { staggerDelay } from "@/lib/stagger";
import { useTheme } from "@/theme";
import { taskTypeLabels } from "@learn-workbench/shared/labels";
import type { DailyTask } from "@learn-workbench/shared/schemas";
import { makeStyles } from "./today-styles";

/**
 * ⑤ 今日安排：时间轴式任务行（勾选沿用既有 toggleTaskDone + 庆祝）。
 * 勾选 / 打开详情 / 横幅 / 全屏庆祝都由今日页的回调驱动，组件本身无副作用。
 */
export function TodayTasksSection({
  todayTasks,
  todayDone,
  pendingHabits,
  reduced,
  onOpenTask,
  onToggleTask,
  fireBurst,
  maybeCelebratePlan,
}: {
  todayTasks: DailyTask[];
  todayDone: number;
  pendingHabits: number;
  reduced: boolean;
  onOpenTask: (task: DailyTask) => void;
  onToggleTask: (id: number) => void;
  fireBurst: (kicker: string, title: string, subtitle?: string) => void;
  maybeCelebratePlan: (tasksDone: number, habitsPending: number) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <>
{/* ⑤ 今日安排：时间轴式任务行（勾选沿用既有 toggleTaskDone + 庆祝） */}
    <View style={styles.v3SecHead}>
      <Text style={styles.v3SecTitle}>今日安排</Text>
      <Pressable
        hitSlop={10}
        onPress={() => router.push("/tasks" as never)}
        style={styles.v3SecMore}
        accessibilityRole="button"
        accessibilityLabel={todayTasks.length > 0 ? "全部 " + todayTasks.length + " 条，打开任务页" : "管理今日任务"}
      >
        <Text style={styles.v3SecMoreText}>{todayTasks.length > 0 ? "全部 " + todayTasks.length : "管理"}</Text>
        <ThemedIcon name="chevron-forward" size={13} color={colors.primary} />
      </Pressable>
    </View>

    {todayTasks.length === 0 ? (
      <Surface tier="surface" style={styles.taskEmptyCard}>
        <EmptyState
          pattern="chevron"
          icon="calendar-outline"
          title="今天还没有安排"
          hint="从一个 25 分钟的小任务开始，完成后这里会形成你的今日节奏。"
          actionLabel="添加今日任务"
          onAction={() => router.push("/tasks" as never)}
        />
      </Surface>
    ) : (
      <Surface tier="surface" style={styles.v3Card}>
        {todayTasks.slice(0, 5).map((t, i) => (
          <Animated.View
            key={t.id}
            entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))}
          >
            <Pressable
              style={styles.v3SchedRow}
              hitSlop={4}
              onPress={() => {
                haptics.light();
                onOpenTask(t);
              }}
              accessibilityRole="button"
              accessibilityLabel={t.title + (t.done ? "，已完成，打开详情" : "，未完成，打开详情")}
            >
              <Text style={styles.v3SchedType}>{taskTypeLabels[t.taskType] ?? t.taskType}</Text>
              <View style={styles.v3SchedBody}>
                <Text style={[styles.v3SchedTitle, t.done ? styles.v3SchedTitleDone : null]} numberOfLines={2}>
                  {t.title}
                </Text>
                <View style={styles.v3SchedMeta}>
                  {t.focusMinutes > 0 ? (
                    <Text style={styles.v3SchedMetaText}>{t.focusMinutes + " 分钟专注"}</Text>
                  ) : null}
                  {t.done ? <Text style={styles.v3SchedMetaText}>已完成</Text> : null}
                </View>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() => {
                  const willDone = !t.done;
                  haptics.light();
                  onToggleTask(t.id);
                  if (willDone) {
                    fireBurst("任务完成", t.title, "已加入今日完成");
                    maybeCelebratePlan(todayDone + 1, pendingHabits);
                  }
                }}
                style={[styles.v3SchedTick, t.done ? styles.v3SchedTickOn : null]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: t.done }}
                accessibilityLabel={(t.done ? "取消完成 " : "标记完成 ") + t.title}
              >
                <AnimatedCheckMark checked={t.done} size={13} color="#FFFFFF" />
              </Pressable>
            </Pressable>
            {i < Math.min(todayTasks.length, 5) - 1 ? <View style={styles.v3SchedDivider} /> : null}
          </Animated.View>
        ))}
        {/* P1：今日任务首屏最多 5 条，其余卷进「还有 N 项」，避免首页被任务挤爆 */}
        {todayTasks.length > 5 ? (
          <Pressable
            hitSlop={6}
            onPress={() => router.push("/tasks" as never)}
            style={styles.taskMoreRow}
            accessibilityRole="button"
            accessibilityLabel={"还有 " + (todayTasks.length - 5) + " 项任务，打开任务页"}
          >
            <Text style={styles.taskMoreText}>{"还有 " + (todayTasks.length - 5) + " 项"}</Text>
            <ThemedIcon name="chevron-forward" size={13} color={colors.primary} />
          </Pressable>
        ) : null}
      </Surface>
    )}
    </>
  );
}
