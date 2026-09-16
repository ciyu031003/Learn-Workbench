import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { toDateKey } from "@learn-workbench/shared";
import type { MealEntry } from "@learn-workbench/shared";
import { ThemedIcon } from "@/components/themed-icon";
import { FoodSticker } from "@/components/food-sticker";
import { useTheme } from "@/theme";
import { tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { monthGrid, shiftMonth } from "@/lib/month-grid";
import { compactKcal, type DaySummaryRow } from "@/lib/nutrition-views";

/**
 * Food Calendar（v4 P4-c）：月历每格显示"当天吃了什么的缩略贴纸"+ 当天 kcal。
 *
 * 为什么不用 P4-a 的 `MonthCalendar`：它的 `renderDayBadge` 槽位固定 16pt 高（只够放一行 kcal 文本），
 * 而缩略图需要更高的格子；且 `MonthCalendar` 同时被学习统计页用作「选择日期」，不该为饮食页改形态。
 * 这里复用同一套**纯逻辑**（`monthGrid`/`shiftMonth`，已抽到 `lib/month-grid`）与同一套视觉语言
 * （同样的翻月导航、周日为第一列），但格子布局自己掌握。
 *
 * 数据分工：
 *  - **kcal 汇总**来自 `summary`（一次请求覆盖整月，随视图窗口已有）；
 *  - **食物缩略图**需要每天明细，由调用方用 `useDayEntries` 按需补拉后传 `entriesByDate`。
 *    因此缩略图是"渐进出现"的：先出 kcal，明细到了再长出贴纸（不会因为明细慢而让整月空白）。
 */
export function FoodCalendar({
  summary,
  entriesByDate,
  view,
  onViewChange,
  onSelect,
  onClose,
  todayKey,
  thumbLoading = false,
}: {
  /** 当月逐日汇总（用于 kcal 数字与"这天有没有记录"） */
  summary: Record<string, DaySummaryRow>;
  /** 已拉到的每日明细（键 = YYYY-MM-DD）；缺失的日子只显示 kcal */
  entriesByDate: Record<string, MealEntry[]>;
  view: { y: number; m: number };
  onViewChange: (v: { y: number; m: number }) => void;
  onSelect: (dateKey: string) => void;
  onClose: () => void;
  /** 今天（未来日期禁用） */
  todayKey: string;
  /** 缩略图还在加载（顶部提示"正在加载缩略图"） */
  thumbLoading?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const cells = useMemo(() => monthGrid(view.y, view.m), [view.y, view.m]);

  const go = (delta: number) => onViewChange(shiftMonth(view, delta));

  const monthLogged = useMemo(() => {
    const prefix = `${view.y}-${String(view.m + 1).padStart(2, "0")}-`;
    return Object.values(summary).filter((r) => r.date.startsWith(prefix) && r.entryCount > 0).length;
  }, [summary, view]);

  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <Pressable hitSlop={8} style={styles.navBtn} onPress={() => go(-1)} accessibilityLabel="上一个月">
          <ThemedIcon name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>
            {view.y} 年 {view.m + 1} 月
          </Text>
          <Text style={styles.navSub}>
            {monthLogged > 0 ? `${monthLogged} 天有记录` : "还没有记录"}
            {thumbLoading ? " · 缩略图加载中…" : ""}
          </Text>
        </View>
        <Pressable hitSlop={8} style={styles.navBtn} onPress={() => go(1)} accessibilityLabel="下一个月">
          <ThemedIcon name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
          <Text key={w} style={styles.week}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={`empty-${i}`} style={styles.cell} />;
          const key = toDateKey(d);
          const row = summary[key];
          const logged = !!row && row.entryCount > 0;
          const entries = entriesByDate[key] ?? [];
          const isToday = key === todayKey;
          const future = key > todayKey;
          return (
            <Pressable
              key={key}
              style={[styles.cell, isToday && styles.cellToday]}
              disabled={future}
              onPress={() => {
                onSelect(key);
                onClose();
              }}
              accessibilityLabel={`${d.getMonth() + 1}月${d.getDate()}日${logged ? `，摄入 ${row!.kcal} 千卡` : "，没有记录"}`}
            >
              <Text style={[styles.dayText, future && styles.dayTextDisabled, isToday && styles.dayTextToday]}>
                {d.getDate()}
              </Text>
              {logged ? (
                <>
                  <DayThumbs entries={entries} />
                  <Text style={styles.kcalText}>{compactKcal(row!.kcal)}</Text>
                </>
              ) : (
                <View style={styles.emptySlot} />
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint}>每格是一天的食物缩略：先显示热量，明细到达后补上贴纸</Text>
    </View>
  );
}

/** 一天最多 3 个贴纸（第 4 个起丢弃，用计数表示重复），极小的尺寸只求"认得出是什么" */
function DayThumbs({ entries }: { entries: MealEntry[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // 同一天重复吃同一种食物时只留一个贴纸（+ 计数），否则三个位置会被"米饭×3"占满
  const uniq = useMemo(() => {
    const seen = new Map<string, number>();
    for (const e of entries) {
      const name = e.name.trim();
      if (!name) continue;
      seen.set(name, (seen.get(name) ?? 0) + 1);
    }
    return [...seen.entries()].slice(0, 3);
  }, [entries]);

  if (uniq.length === 0) {
    // 明细还没到（或这天只有汇总没有明细）：留白，kcal 数字仍然在下面
    return <View style={styles.emptySlot} />;
  }

  return (
    <View style={styles.thumbRow}>
      {uniq.map(([name, times]) => (
        <View key={name} style={styles.thumbCell}>
          <FoodSticker name={name} size={20} />
          {times > 1 ? <Text style={styles.thumbTimes}>{times}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    navTitleWrap: { alignItems: "center", gap: 2 },
    navTitle: { ...typography.headline, color: colors.text },
    navSub: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    weekRow: { flexDirection: "row" },
    week: { width: `${100 / 7}%`, textAlign: "center", ...typography.micro, color: colors.textMuted, fontWeight: "700" },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: {
      width: `${100 / 7}%`,
      height: 62,
      alignItems: "center",
      paddingTop: 4,
      gap: 1,
    },
    cellToday: {
      backgroundColor: colors.accentSoft,
      borderRadius: 12,
    },
    dayText: { ...typography.caption, fontWeight: "700", color: colors.text, ...tabularNums },
    dayTextDisabled: { color: colors.textFaint },
    dayTextToday: { color: colors.accentStrong, fontWeight: "900" },
    thumbRow: { flexDirection: "row", alignItems: "center", gap: 1, height: 22 },
    thumbCell: { position: "relative" },
    thumbTimes: {
      position: "absolute",
      right: -3,
      bottom: -2,
      ...typography.micro,
      fontSize: 8,
      lineHeight: 10,
      color: "#fff",
      backgroundColor: colors.accentStrong,
      borderRadius: 6,
      paddingHorizontal: 3,
      overflow: "hidden",
      fontWeight: "800",
    },
    emptySlot: { height: 22, alignItems: "center", justifyContent: "center" },
    dotText: { ...typography.micro, color: colors.textFaint },
    kcalText: { ...typography.micro, fontSize: 9, color: colors.textMuted, fontWeight: "700", ...tabularNums },
    hint: { ...typography.micro, fontSize: 9, color: colors.textFaint, textAlign: "center", fontWeight: "500" },
  });
