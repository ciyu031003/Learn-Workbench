import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { BottomSheet } from "@/components/bottom-sheet";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { taskTypeLabels } from "@learn-workbench/shared/labels";
import type { DailyTask } from "@learn-workbench/shared/schemas";
import { makeStyles } from "./today-styles";

/** v3 任务详情面板：点任务行打开（null = 关闭）。 */
export function TodayTaskDetailSheet({
  detailTask,
  onClose,
  onToggleTask,
  fireBurst,
  maybeCelebratePlan,
  todayDone,
  pendingHabits,
}: {
  detailTask: DailyTask | null;
  onClose: () => void;
  onToggleTask: (id: number) => void;
  fireBurst: (kicker: string, title: string, subtitle?: string) => void;
  maybeCelebratePlan: (tasksDone: number, habitsPending: number) => void;
  todayDone: number;
  pendingHabits: number;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <>
  <BottomSheet
    visible={!!detailTask}
    onClose={() => onClose()}
    title="任务详情"
    subtitle="勾选完成会同步到云端，并计入今日进度"
    icon="checkbox-outline"
    height="54%"
  >
    {detailTask ? (
      <View style={styles.v3Detail}>
        <Text style={styles.v3DetailKicker}>
          {(taskTypeLabels[detailTask.taskType] ?? detailTask.taskType) + " · " + (detailTask.done ? "已完成" : "未完成")}
        </Text>
        <Text style={styles.v3DetailTitle}>{detailTask.title}</Text>
        <View style={styles.v3DetailTags}>
          <Text style={styles.v3DetailTag}>{taskTypeLabels[detailTask.taskType] ?? detailTask.taskType}</Text>
          {detailTask.focusMinutes > 0 ? (
            <Text style={styles.v3DetailTag}>{detailTask.focusMinutes + " 分钟专注"}</Text>
          ) : null}
          <Text style={styles.v3DetailTag}>{detailTask.taskDate}</Text>
        </View>
        <Text style={styles.v3DetailNote}>
          {"这条任务来自今天的学习安排。完成后会写入同步队列，明天的今日页与任务页都会同步这一状态。"}
        </Text>
        <View style={styles.v3DetailActions}>
          <Pressable
            hitSlop={6}
            onPress={() => {
              onClose();
              router.push("/tasks" as never);
            }}
            style={styles.v3DetailGhost}
            accessibilityRole="button"
            accessibilityLabel="去任务页"
          >
            <Text style={styles.v3DetailGhostText}>去任务页</Text>
          </Pressable>
          <Pressable
            hitSlop={6}
            onPress={() => {
              const target = detailTask;
              const willDone = !target.done;
              haptics.light();
              onToggleTask(target.id);
              if (willDone) {
                fireBurst("任务完成", target.title, "已加入今日完成");
                maybeCelebratePlan(todayDone + 1, pendingHabits);
              }
              onClose();
            }}
            style={styles.v3DetailPrimary}
            accessibilityRole="button"
            accessibilityLabel={detailTask.done ? "标记为未完成" : "标记完成"}
          >
            <ThemedIcon name="checkmark" size={15} color="#FFFFFF" />
            <Text style={styles.v3DetailPrimaryText}>{detailTask.done ? "标记未完成" : "标记完成"}</Text>
          </Pressable>
        </View>
      </View>
    ) : null}
  </BottomSheet>
    </>
  );
}
