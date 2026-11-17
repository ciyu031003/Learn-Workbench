import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { BottomSheet } from "@/components/bottom-sheet";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import type { DailyTask } from "@learn-workbench/shared/schemas";
import { makeStyles } from "./today-styles";

/** v3 顶栏通知弹层：三条提醒，点一条直达。 */
export function TodayNotificationsSheet({
  notifOpen,
  onClose,
  todayTasks,
  todayDone,
  focusMinutesToday,
  focusGoalLabel,
  dailyFocusGoalMinutes,
  checkedInToday,
  checkinToday,
  streak,
}: {
  notifOpen: boolean;
  onClose: () => void;
  todayTasks: DailyTask[];
  todayDone: number;
  focusMinutesToday: number;
  focusGoalLabel: string;
  dailyFocusGoalMinutes: number;
  checkedInToday: boolean;
  checkinToday: () => void;
  streak: number;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <>
  <BottomSheet
    visible={notifOpen}
    onClose={() => onClose()}
    title="通知"
    subtitle="今天的提醒都在这里，点一条直达"
    icon="notifications-outline"
    height="58%"
  >
    <View style={styles.v3NotifList}>
      <Pressable
        hitSlop={4}
        style={styles.v3NotifRow}
        onPress={() => { onClose(); router.push("/tasks" as never); }}
        accessibilityRole="button"
        accessibilityLabel="今日任务提醒，打开任务页"
      >
        <View style={[styles.v3NotifDot, { backgroundColor: colors.primary }]} />
        <View style={styles.v3NotifBody}>
          <Text style={styles.v3NotifTitle}>{"今日还有 " + (todayTasks.length - todayDone) + " 条任务未完成"}</Text>
          <Text style={styles.v3NotifSub}>按计划完成今天最重要的一件</Text>
        </View>
        <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
      </Pressable>
      <Pressable
        hitSlop={4}
        style={styles.v3NotifRow}
        onPress={() => { onClose(); router.push("/study-stats" as never); }}
        accessibilityRole="button"
        accessibilityLabel="专注目标提醒，打开学习统计"
      >
        <View style={[styles.v3NotifDot, { backgroundColor: colors.accent }]} />
        <View style={styles.v3NotifBody}>
          <Text style={styles.v3NotifTitle}>
            {focusMinutesToday > 0 ? "今日专注 " + focusMinutesToday + " 分 / 目标 " + focusGoalLabel : "今天还没有专注记录"}
          </Text>
          <Text style={styles.v3NotifSub}>
            {focusMinutesToday > 0
              ? "还差 " + Math.max(0, dailyFocusGoalMinutes - focusMinutesToday) + " 分钟到日目标"
              : "从 25 分钟开始，今天就会有第一段进展"}
          </Text>
        </View>
        <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
      </Pressable>
      <Pressable
        hitSlop={4}
        style={styles.v3NotifRow}
        onPress={() => {
          onClose();
          if (!checkedInToday) haptics.success();
          checkinToday();
        }}
        accessibilityRole="button"
        accessibilityLabel="打卡提醒"
      >
        <View style={[styles.v3NotifDot, { backgroundColor: colors.success }]} />
        <View style={styles.v3NotifBody}>
          <Text style={styles.v3NotifTitle}>
            {checkedInToday ? "今日已打卡 · 连续 " + streak + " 天" : "今天还没打卡"}
          </Text>
          <Text style={styles.v3NotifSub}>{checkedInToday ? "保持节奏，明天继续" : "点一下留下今天的印记"}</Text>
        </View>
        <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
      </Pressable>
    </View>
  </BottomSheet>
    </>
  );
}
