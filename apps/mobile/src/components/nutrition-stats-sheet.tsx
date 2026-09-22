import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { CalorieHeatmapCard, CalorieTrendCard } from "@/components/calorie-trend";
import { FoodCalendar } from "@/components/food-calendar";
import { Skeleton, SkeletonCard } from "@/components/skeleton";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";
import { loggedDaysInMonth } from "@/lib/nutrition-stats";
import { useDayEntries } from "@/lib/use-day-entries";
import { useMonthSummaries } from "@/lib/use-month-summaries";

/**
 * 饮食趋势面板（v4 P4-c 的容器）：7 天曲线 + 6 个月点阵热力图 + Food Calendar 缩略图。
 *
 * **取数策略（零后端改动）**：
 *  - 后端 `summary` 单次上限 31 天，拿不到"近 6 个月" → 拆成 6 个自然月的请求（`monthWindowsBack`），
 *    `Promise.all` 并发，总耗时≈单次；
 *  - 只在**打开面板时**才拉（懒加载），饮食页首屏不受影响；同一个窗口重复打开不重拉（`loadedKey` 记忆）；
 *  - 月历的食物缩略图另需**每日明细**（后端只有单日查询）→ 只对"该月有记录的天"补拉、
 *    并发上限 4、进程内缓存，最坏情况由 `cap` 兜住（详见 `useDayEntries`）。
 *
 * 三个"渐进出结果"的顺序是有意的：先出 kcal 曲线（1 批请求），再出点阵，最后缩略图补上；
 * 任何一步失败都只是少一块，不会让整个面板变成空白或报错。
 */
export function NutritionStatsSheet({
  visible,
  onClose,
  headers,
  targetKcal,
  todayKey,
  onPickDate,
}: {
  visible: boolean;
  onClose: () => void;
  headers: () => Record<string, string>;
  /** 目标热量（点阵按它分档，让跨月可比） */
  targetKcal: number;
  todayKey: string;
  /** 点月历某天 → 关闭面板并切到那天的日视图 */
  onPickDate: (dateKey: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  /**
   * 6 个月逐日汇总（取数策略与取舍见 lib/use-month-summaries.ts）。
   *
   * 取 **7** 个月而不是 6：点阵图是 26 周 = 182 天，而"6 个自然月"从中旬往回算往往只有
   * 165~170 天 → 最左侧两三周会出现"明明有记录却显示空白"的假空档。多取一个月（多 1 个请求）
   * 就能把 182 天全覆盖，显示仍然是 26 周（≈6 个月）。
   */
  const { rows, pending, failed, retry, reload } = useMonthSummaries({ visible, headers, todayKey, months: 7 });
  /**
   * 每次**打开**面板都强制刷新一次：hook 的缓存键是「月窗口 + 今天」，
   * 同一天内新增记录不会改变键 —— 用户"开→关→记一条→开"会看到旧总量（审查发现）。
   * 只在 false→true 时刷新，避免打开期间反复请求。
   */
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) reload();
    wasVisible.current = visible;
  }, [visible, reload]);
  /** Food Calendar 当前翻到的月份（翻月只影响缩略图补拉范围，不重新请求汇总） */
  const [monthView, setMonthView] = useState(() => ({
    y: Number(todayKey.slice(0, 4)),
    m: Number(todayKey.slice(5, 7)) - 1,
  }));

  /** 月历缩略图：只补拉"当前展示月份里有记录的天"（新→旧，cap 24） */
  const monthDays = useMemo(
    () => loggedDaysInMonth(rows, monthView.y, monthView.m, 24),
    [rows, monthView]
  );
  const { entries: entriesByDate, loading: thumbLoading } = useDayEntries({
    dates: monthDays,
    headers,
    enabled: visible && monthDays.length > 0,
  });

  const monthLogged = monthDays.length;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="饮食趋势" height="92%">
      <View style={styles.wrap}>
        {pending && Object.keys(rows).length === 0 ? (
          /* v13 U1：面板真实内容是"7 天曲线 + 26 周点阵 + 月历"，骨架用图表 + 卡片形状 */
          <>
            <Skeleton variant="chart" />
            <SkeletonCard count={1} />
          </>
        ) : failed && Object.keys(rows).length === 0 ? (
          <View style={styles.failBox}>
            <ThemedIcon name="cloud-offline-outline" size={24} color={colors.textFaint} />
            <Text style={styles.failTitle}>趋势数据加载失败</Text>
            <Text style={styles.failHint}>可能是离线或服务端暂时不可用；已记录的数据不会丢，稍后再试即可。</Text>
            <Pressable style={styles.retry} onPress={retry} accessibilityLabel="重试加载趋势">
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CalorieTrendCard map={rows} endKey={todayKey} targetKcal={targetKcal} />
            <CalorieHeatmapCard map={rows} endKey={todayKey} targetKcal={targetKcal} weeks={26} />
            <View style={styles.calendarCard}>
              <Text style={styles.calendarTitle}>Food Calendar</Text>
              <Text style={styles.calendarSub}>
                每格是一天的食物缩略（本月 {monthLogged} 天有记录）
              </Text>
              <FoodCalendar
                summary={rows}
                entriesByDate={entriesByDate}
                view={monthView}
                onViewChange={setMonthView}
                onSelect={onPickDate}
                onClose={onClose}
                todayKey={todayKey}
                thumbLoading={thumbLoading}
              />
            </View>
            <Text style={styles.source}>
              数据来自近 6 个月的逐日汇总（按月 6 次请求）；缩略图按需补拉，离线时只显示热量。
            </Text>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 12, paddingTop: 2 },
    failBox: { alignItems: "center", gap: 6, paddingVertical: 40, paddingHorizontal: 16 },
    failTitle: { ...typography.headline, color: colors.text },
    failHint: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
    retry: {
      marginTop: 6,
      paddingHorizontal: 20,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    retryText: { ...typography.caption, color: "#fff", fontWeight: "800" },
    calendarCard: {
      padding: 14,
      borderRadius: 20,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 4,
    },
    calendarTitle: { ...typography.headline, color: colors.text },
    calendarSub: { ...typography.micro, color: colors.textMuted, fontWeight: "500", marginBottom: 6 },
    source: { ...typography.micro, fontSize: 9, color: colors.textFaint, textAlign: "center", fontWeight: "500" },
  });
