import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Surface } from "@/components/surface";
import { ThemedIcon } from "@/components/themed-icon";
import { habitIconName } from "@/lib/habit-icons";
import { useTheme } from "@/theme";
import type { TodayHabitRow } from "./use-today-screen";
import { makeStyles } from "./today-styles";

/** ⑦ 今日习惯（3 列瓦片；沿用 habitRows 打卡 + 乐观更新 + linked 过滤）。 */
export function TodayHabitTiles({
  habitRows,
  habitOnlyRows,
  habitOnlyDone,
  todayDone,
  pendingHabits,
  onToggleHabit,
  fireBurst,
  maybeCelebratePlan,
}: {
  habitRows: TodayHabitRow[];
  habitOnlyRows: TodayHabitRow[];
  habitOnlyDone: number;
  todayDone: number;
  pendingHabits: number;
  onToggleHabit: (id: number, done: boolean) => void;
  fireBurst: (kicker: string, title: string, subtitle?: string) => void;
  maybeCelebratePlan: (tasksDone: number, habitsPending: number) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <>
    {/* ⑦ 今日习惯（3 列瓦片；沿用 habitRows 打卡 + 乐观更新 + linked 过滤） */}
    <View style={styles.v3SecHead}>
      <Text style={styles.v3SecTitle}>今日习惯</Text>
      <Text style={styles.v3SecMeta}>
        {habitOnlyRows.length === 0
          ? "待设置"
          : habitOnlyDone === 0
            ? "从第一项开始"
            : "已完成 " + habitOnlyDone + "/" + habitOnlyRows.length}
      </Text>
    </View>
    {habitOnlyRows.length === 0 ? (
      <Surface tier="surface" style={styles.habitEmpty}>
        <Text style={styles.habitEmptyText}>
          {habitRows.length > 0
            ? "今天排期的习惯都已并入上面的任务，直接勾任务即可"
            : "今天没有排期的习惯，先设一个轻量目标"}
        </Text>
        {habitRows.length === 0 ? (
          <Pressable
            hitSlop={8}
            onPress={() => router.push("/habits" as never)}
            style={styles.habitEmptyAction}
            accessibilityRole="button"
            accessibilityLabel="去设置每日习惯"
          >
            <Text style={styles.habitEmptyActionText}>去设置习惯</Text>
            <ThemedIcon name="chevron-forward" size={12} color={colors.primary} />
          </Pressable>
        ) : null}
      </Surface>
    ) : (
      <View style={styles.v3Habits}>
        {habitOnlyRows.map((row) => (
          <Pressable
            key={"habit-" + row.id}
            hitSlop={6}
            onPress={() => {
              if (!row.done) {
                fireBurst("习惯打卡", row.name, "今天的习惯又稳了一项");
                maybeCelebratePlan(todayDone, pendingHabits - 1);
              }
              void onToggleHabit(row.id, row.done);
            }}
            style={[styles.v3Habit, row.done ? styles.v3HabitOn : null]}
            accessibilityRole="button"
            accessibilityState={{ selected: row.done }}
            accessibilityLabel={row.name + (row.done ? "，已完成" : "，未完成")}
          >
            <ThemedIcon
              name={habitIconName(row.icon)}
              size={18}
              color={row.done ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.v3HabitText, row.done ? styles.v3HabitTextOn : null]} numberOfLines={1}>
              {row.name}
            </Text>
          </Pressable>
        ))}
      </View>
    )}
    </>
  );
}
