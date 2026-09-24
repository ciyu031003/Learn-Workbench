import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
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
 * 日期条（v3 M2 → 2026-09-24 按用户给的参考代码重做版式）。
 *
 * 参考（meeting-card + date-nav + indicator）：圆角卡片里一排"数字块 + 星期块"，
 * 选中日两块拼成一个圆角高亮；下方一排圆点用虚线连起来表示有记录的日子。
 * 保留原有 props（selected / onSelect / weekOffset / onWeekOffsetChange / doneMap），调用方零改动。
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
  /** 有记录的日子（画实心圆点） */
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
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <View style={styles.dateSelector}>
          <ThemedIcon name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={styles.range}>
            {shortMonthDay(dates[0])} – {shortMonthDay(dates[dates.length - 1])}
          </Text>
        </View>
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

      <View style={styles.dayRow}>
        {dates.map((key) => {
          const d = fromDateKey(key);
          const isToday = key === todayKey;
          const isSelected = key === selected;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${shortMonthDay(key)}${isToday ? " 今天" : ""}${(doneMap?.[key] ?? 0) > 0 ? " 有记录" : ""}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                if (!isSelected) haptics.soft();
                onSelect(key);
              }}
              style={styles.dayItem}
            >
              <View
                style={[
                  styles.dayNumber,
                  isToday && !isSelected && styles.dayNumberToday,
                  isSelected && styles.dayActive,
                ]}
              >
                <Text style={[styles.dayNumberText, isSelected && styles.dayTextActive]}>{d.getDate()}</Text>
              </View>
              <View
                style={[
                  styles.dayName,
                  isToday && !isSelected && styles.dayNameToday,
                  isSelected && styles.dayActive,
                ]}
              >
                <Text style={[styles.dayNameText, isSelected && styles.dayTextActive]}>
                  {isToday ? "今天" : WEEK_LABELS[d.getDay()]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* 记录指示：虚线 + 圆点（有记录的日子实心） */}
      <View style={styles.indicatorWrap}>
        <View style={styles.indicatorLine} pointerEvents="none" />
        <View style={styles.indicatorRow}>
          {dates.map((key) => {
            const has = (doneMap?.[key] ?? 0) > 0;
            return <View key={key} style={[styles.dot, has && styles.dotActive]} />;
          })}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      gap: 12,
      padding: 14,
      borderRadius: 24,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    dateSelector: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    range: { ...typography.caption, fontWeight: "600", color: colors.textMuted, ...tabularNums },
    nav: { flexDirection: "row", gap: 6 },
    navBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    navBtnOff: { opacity: 0.45 },

    dayRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    dayItem: { flex: 1, alignItems: "center" },
    dayNumber: {
      width: 36,
      height: 28,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 3,
    },
    dayName: {
      width: 36,
      height: 20,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    dayActive: { backgroundColor: colors.primary },
    dayNumberToday: { borderWidth: 1, borderColor: colors.accent, borderBottomWidth: 0 },
    dayNameToday: { borderWidth: 1, borderColor: colors.accent, borderTopWidth: 0 },
    dayNumberText: { ...typography.body, fontWeight: "800", color: colors.text, ...tabularNums },
    dayNameText: { ...typography.micro, fontSize: 10, fontWeight: "600", color: colors.textMuted },
    dayTextActive: { color: colors.canvas },

    indicatorWrap: { position: "relative", justifyContent: "center", paddingHorizontal: 22 },
    indicatorLine: {
      position: "absolute",
      left: 26,
      right: 26,
      height: 1,
      borderTopWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.borderStrong,
    },
    indicatorRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
    dotActive: { backgroundColor: colors.primary },
  });
