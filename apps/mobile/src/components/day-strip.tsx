import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { fromDateKey, recentDateKeys, toDateKey } from "@learn-workbench/shared";
import { haptics } from "@/lib/haptics";
import { typography, tabularNums } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

const WEEK_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
/** 最多可回看 4 周（28 天）历史，避免无限翻页把 UI 做复杂 */
export const DAY_STRIP_MAX_WEEKS = 4;

function shortMonthDay(key: string): string {
  const d = fromDateKey(key);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 日期条（v3 M2）——借「吃一点」的日期 pill：
 * - 7 天窗口，**今天用能量橙描边**（不是填充，克制不抢戏）
 * - 已完成（有记录）的日子在日期上方给一个小 ✓
 * - 选中日 = primarySoft 填充 + primary 描边
 * - ‹ › 按周翻页（上限 4 周），右侧显示当前窗口区间
 */
export function DayStrip({
  selected,
  onSelect,
  weekOffset,
  onWeekOffsetChange,
  doneMap,
  todayKey = toDateKey(new Date()),
  style,
}: {
  /** 选中日期键 YYYY-MM-DD */
  selected: string;
  onSelect: (dateKey: string) => void;
  /** 0 = 以今天结束的窗口；1 = 往前一周 */
  weekOffset: number;
  onWeekOffsetChange: (offset: number) => void;
  /** 有记录的日子（画 ✓） */
  doneMap?: Record<string, number>;
  todayKey?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const windowEnd = useMemo(() => {
    const d = fromDateKey(todayKey);
    d.setDate(d.getDate() - weekOffset * 7);
    return d;
  }, [todayKey, weekOffset]);

  const dates = useMemo(() => recentDateKeys(7, windowEnd), [windowEnd]);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.head}>
        <Text style={styles.range}>
          {shortMonthDay(dates[0])} – {shortMonthDay(dates[dates.length - 1])}
        </Text>
        <View style={styles.nav}>
          <Pressable
            hitSlop={8}
            accessibilityLabel="上一周"
            disabled={weekOffset >= DAY_STRIP_MAX_WEEKS}
            onPress={() => {
              haptics.soft();
              onWeekOffsetChange(Math.min(DAY_STRIP_MAX_WEEKS, weekOffset + 1));
            }}
            style={[styles.navBtn, weekOffset >= DAY_STRIP_MAX_WEEKS && styles.navBtnOff]}
          >
            <ThemedIcon
              name="chevron-back"
              size={16}
              color={weekOffset >= DAY_STRIP_MAX_WEEKS ? colors.textFaint : colors.primary}
            />
          </Pressable>
          <Pressable
            hitSlop={8}
            accessibilityLabel="下一周"
            disabled={weekOffset <= 0}
            onPress={() => {
              haptics.soft();
              onWeekOffsetChange(Math.max(0, weekOffset - 1));
            }}
            style={[styles.navBtn, weekOffset <= 0 && styles.navBtnOff]}
          >
            <ThemedIcon
              name="chevron-forward"
              size={16}
              color={weekOffset <= 0 ? colors.textFaint : colors.primary}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        // 7 个 pill 通常一屏放得下；放不下时可横向滑动
        scrollEnabled={false}
      >
        {dates.map((key) => {
          const d = fromDateKey(key);
          const isToday = key === todayKey;
          const isSelected = key === selected;
          const count = doneMap?.[key] ?? 0;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${shortMonthDay(key)}${isToday ? " 今天" : ""}${count > 0 ? ` ${count} 条记录` : ""}`}
              onPress={() => {
                if (!isSelected) haptics.soft();
                onSelect(key);
              }}
              style={[
                styles.pill,
                isToday && styles.pillToday,
                isSelected && styles.pillSelected,
              ]}
            >
              <Text style={[styles.weekday, isSelected && styles.weekdaySelected]}>
                {isToday ? "今天" : WEEK_LABELS[d.getDay()]}
              </Text>
              <Text style={[styles.day, isSelected && styles.daySelected]}>{d.getDate()}</Text>
              {count > 0 ? (
                <ThemedIcon
                  name="checkmark"
                  size={10}
                  color={isSelected ? colors.primary : colors.success}
                />
              ) : (
                <View style={styles.dotPlaceholder} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 8 },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    range: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
    nav: { flexDirection: "row", gap: 6 },
    navBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    navBtnOff: { opacity: 0.45 },
    row: { gap: 8, paddingVertical: 2 },
    pill: {
      width: 46,
      height: 62,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      backgroundColor: colors.surfaceStrong,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillToday: { borderColor: colors.accent, borderWidth: 2 },
    pillSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 2 },
    weekday: { ...typography.micro, fontSize: 10, fontWeight: "600", color: colors.textMuted },
    weekdaySelected: { color: colors.primary },
    day: { ...typography.headline, fontWeight: "800", color: colors.text, ...tabularNums },
    daySelected: { color: colors.primary },
    dotPlaceholder: { height: 10, width: 10 },
  });
