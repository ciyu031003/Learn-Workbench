import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { toDateKey } from "@learn-workbench/shared";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { monthGrid, shiftMonth } from "@/lib/month-grid";

/**
 * 整月日历（上下月翻页 + 今天/选中样式 + 未来日期禁用）。
 *
 * 来源：原本内联在 `app/learn.tsx` 里（学习统计的「选择日期」弹层），v4 P4-a 抽成公共组件，
 * 让饮食页的「月」视图也能复用 —— 两处行为保持一致，避免各写一份日历。
 *
 * 与原来唯一的新增能力：`renderDayBadge`，用于在日期格**下方**挂一小块内容
 * （饮食月视图用它显示"当天摄入 kcal 汇总"）；不传时渲染结果与旧实现完全一致。
 */
export function MonthCalendar({
  selected,
  onSelect,
  onClose,
  renderDayBadge,
  initialView,
  onViewChange,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
  /** 日期格下的小徽标（入参是 YYYY-MM-DD 本地日期键；返回 null 表示该天不显示） */
  renderDayBadge?: (dateKey: string) => ReactNode;
  /** 初始展示月份；不传则跟随 selected（保持 learn.tsx 的旧行为） */
  initialView?: { y: number; m: number };
  /** 翻月回调：调用方可以据此按需拉取该月数据 */
  onViewChange?: (view: { y: number; m: number }) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [view, setView] = useState(
    () => initialView ?? { y: selected.getFullYear(), m: selected.getMonth() }
  );
  const cells = monthGrid(view.y, view.m);
  const todayKey = toDateKey(new Date());
  const selectedKey = toDateKey(selected);
  const withBadge = typeof renderDayBadge === "function";

  const go = (delta: number) => {
    const next = shiftMonth(view, delta);
    setView(next);
    onViewChange?.(next);
  };

  return (
    <View style={styles.calendar}>
      <View style={styles.calNav}>
        <Pressable hitSlop={8} style={styles.calNavBtn} onPress={() => go(-1)}>
          <ThemedIcon name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.calTitle}>
          {view.y} 年 {view.m + 1} 月
        </Text>
        <Pressable hitSlop={8} style={styles.calNavBtn} onPress={() => go(1)}>
          <ThemedIcon name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.calWeekRow}>
        {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
          <Text key={w} style={styles.calWeek}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.calGrid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={[styles.calCell, withBadge && styles.calCellTall]} />;
          const key = toDateKey(d);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          const future = key > todayKey;
          return (
            <Pressable
              key={i}
              style={[styles.calCell, withBadge && styles.calCellTall]}
              disabled={future}
              onPress={() => {
                onSelect(d);
                onClose();
              }}
            >
              <View style={[styles.calDay, isSelected && styles.calDaySelected, isToday && !isSelected && styles.calDayToday]}>
                <Text
                  style={[
                    styles.calDayText,
                    isSelected && styles.calDayTextSelected,
                    future && styles.calDayTextDisabled,
                  ]}
                >
                  {d.getDate()}
                </Text>
              </View>
              {withBadge ? <View style={styles.calBadgeSlot}>{renderDayBadge?.(key)}</View> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    calendar: { gap: 14 },
    calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    calNavBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    calTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
    calWeekRow: { flexDirection: "row" },
    calWeek: { width: `${100 / 7}%`, textAlign: "center", fontSize: 12, fontWeight: "700", color: colors.textMuted },
    calGrid: { flexDirection: "row", flexWrap: "wrap" },
    calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
    /** 带徽标时格子要更高（方形格放不下数字 + 汇总），高度固定避免行高抖动 */
    calCellTall: { aspectRatio: undefined, height: 58 },
    calDay: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    calDaySelected: { backgroundColor: colors.primary },
    calDayToday: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
    calDayText: { fontSize: 14, fontWeight: "600", color: colors.text },
    calDayTextSelected: { color: "#fff", fontWeight: "800" },
    calDayTextDisabled: { color: colors.textFaint },
    calBadgeSlot: { height: 16, alignItems: "center", justifyContent: "center" },
  });
