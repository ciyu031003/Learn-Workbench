import { useCallback, useEffect, useMemo, useState } from "react";
import Animated from "react-native-reanimated";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { Workout } from "@learn-workbench/shared";
import { CalorieHeatmapCard, CalorieTrendCard } from "@/components/calorie-trend";
import { FoodCalendar } from "@/components/food-calendar";
import { GroupLabel } from "@/components/group-label";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { Skeleton, SkeletonCard } from "@/components/skeleton";
import { SportBackfillSheet } from "@/components/sport-backfill-sheet";
import { SportTrendCard } from "@/components/sport-trend-card";
import { ThemedIcon } from "@/components/themed-icon";
import { TrainingLoadCard } from "@/components/training-load-card";
import { loggedDaysInMonth } from "@/lib/nutrition-stats";
import { todayAndYesterday } from "@/lib/nutrition-views";
import { useDayEntries } from "@/lib/use-day-entries";
import { useMonthSummaries } from "@/lib/use-month-summaries";
import { fetchNutritionTarget } from "@/lib/wellbeing-client";
import { getApiUrl } from "@/config";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";

/**
 * 趋势分析（v1.45：把原来的「饮食趋势」底部弹层升级为独立全屏页）。
 *
 * 用户真机反馈：「饮食趋势改为全屏，不要下方抽屉；同时加更多数据做图表分析」。
 * 本页分三段，数据来源互相独立、互不阻塞（任何一段失败都不影响另外两段）：
 *
 *  ① 饮食：`useMonthSummaries`（GET /api/nutrition/summary，按月 7 次并发）→
 *     7/14 天 kcal 曲线 + 26 周点阵热力图 + Food Calendar；点月历某天跳到饮食页对应日期。
 *  ② 运动：本地 store 的 `sports`（计时结束写入 + 本页「补录」写入）→ 7/30 天时长柱状 +
 *     按运动大类分组；零网络请求，离线也能看。
 *  ③ 训练负荷：GET /api/workouts?days=30 → `trainingLoadSeries` 自动选口径
 *     （容量→次数→组数→训练次数）画 30 天柱状，并列出区间合计。
 *
 * 页面是普通 Stack push（不是 Modal/BottomSheet）：有原生转场与侧滑返回，
 * 内容也能长到超过一屏而不被弹层高度限制。
 */
export default function TrendsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const token = useAppStore((s) => s.token);
  const sports = useAppStore((s) => s.sports);
  const { today: todayKey } = useMemo(() => todayAndYesterday(), []);

  const headers = useCallback(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  /* ---------- ① 饮食 ---------- */
  /**
   * 取 7 个月而不是 6：点阵是 26 周 = 182 天，"6 个自然月"从月中往回算只有 165~170 天，
   * 最左侧会出现"有记录却空白"的假空档（与旧弹层同一处取舍，见 lib/use-month-summaries.ts）。
   */
  const { rows, pending, failed, retry } = useMonthSummaries({ visible: true, headers, todayKey, months: 7 });
  const [monthView, setMonthView] = useState(() => ({
    y: Number(todayKey.slice(0, 4)),
    m: Number(todayKey.slice(5, 7)) - 1,
  }));
  const monthDays = useMemo(
    () => loggedDaysInMonth(rows, monthView.y, monthView.m, 24),
    [rows, monthView]
  );
  const { entries: entriesByDate, loading: thumbLoading } = useDayEntries({
    dates: monthDays,
    headers,
    enabled: monthDays.length > 0,
  });
  const monthLogged = monthDays.length;
  const nutritionPending = pending && Object.keys(rows).length === 0;

  /** 热量目标（用于曲线目标虚线与点阵分档）；拿不到就退化为"按区间峰值分档" */
  const [targetKcal, setTargetKcal] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    fetchNutritionTarget(token)
      .then((d) => {
        if (!cancelled) setTargetKcal(Number(d.target?.kcal) || 0);
      })
      .catch(() => {
        // 离线/未登录：保持 0，卡片自动退化为无目标线
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  /* ---------- ③ 训练负荷（②是本地数据，无需请求） ---------- */
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutsFailed, setWorkoutsFailed] = useState(false);
  const loadWorkouts = useCallback(async () => {
    setWorkoutsFailed(false);
    try {
      const r = await fetch(getApiUrl() + "/api/workouts?days=30", { headers: headers() });
      if (!r.ok) {
        setWorkoutsFailed(true);
        return;
      }
      const d = await r.json();
      setWorkouts(Array.isArray(d.workouts) ? d.workouts : []);
    } catch {
      setWorkoutsFailed(true);
    }
  }, [headers]);
  useEffect(() => {
    const t = setTimeout(() => void loadWorkouts(), 0);
    return () => clearTimeout(t);
  }, [loadWorkouts]);

  const [backfillOpen, setBackfillOpen] = useState(false);

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="趋势" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeaderLargeTitle title="趋势" subtitle="饮食热量 · 运动时长 · 训练负荷" />

        {/* ① 饮食 */}
        <GroupLabel accentColor={colors.accent}>饮食趋势</GroupLabel>
        {nutritionPending ? (
          <>
            <Skeleton variant="chart" />
            <SkeletonCard count={1} />
          </>
        ) : failed && Object.keys(rows).length === 0 ? (
          <View style={styles.failBox}>
            <ThemedIcon name="cloud-offline-outline" size={24} color={colors.textFaint} />
            <Text style={styles.failTitle}>饮食趋势加载失败</Text>
            <Text style={styles.failHint}>可能是离线或服务端暂时不可用；已记录的数据不会丢，稍后再试即可。</Text>
            <Pressable style={styles.retry} onPress={retry} accessibilityLabel="重试加载饮食趋势">
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
                每格是一天的食物缩略（本月 {monthLogged} 天有记录）；点某天跳到饮食页那天
              </Text>
              <FoodCalendar
                summary={rows}
                entriesByDate={entriesByDate}
                view={monthView}
                onViewChange={setMonthView}
                onSelect={(key) => router.push({ pathname: "/nutrition", params: { date: key } } as never)}
                onClose={() => {
                  /* 趋势页不关闭面板：选中日期后直接跳到饮食页 */
                }}
                todayKey={todayKey}
                thumbLoading={thumbLoading}
              />
            </View>
            <Text style={styles.source}>
              数据来自近 6 个月的逐日汇总（按月 6 次请求）；缩略图按需补拉，离线时只显示热量。
            </Text>
          </>
        )}

        {/* ② 运动 */}
        <GroupLabel accentColor={colors.accent}>运动趋势</GroupLabel>
        <PressableScale style={styles.addBtn} haptic onPress={() => setBackfillOpen(true)}>
          <ThemedIcon name="add" size={17} color={colors.primary} />
          <Text style={styles.addBtnText}>补录运动</Text>
        </PressableScale>
        <SportTrendCard logs={sports} endKey={todayKey} />

        {/* ③ 训练负荷 */}
        <GroupLabel accentColor={colors.accent}>训练负荷</GroupLabel>
        {workoutsFailed ? (
          <View style={styles.failBox}>
            <ThemedIcon name="cloud-offline-outline" size={24} color={colors.textFaint} />
            <Text style={styles.failTitle}>训练负荷加载失败</Text>
            <Text style={styles.failHint}>需要联网读取训练记录；本机运动数据不受影响。</Text>
            <Pressable style={styles.retry} onPress={() => void loadWorkouts()} accessibilityLabel="重试加载训练负荷">
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          </View>
        ) : (
          <TrainingLoadCard workouts={workouts} days={30} endKey={todayKey} />
        )}
      </Animated.ScrollView>

      <SportBackfillSheet visible={backfillOpen} onClose={() => setBackfillOpen(false)} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /**
     * 真机过渡修复（同 workout.tsx）：推入页 contentStyle 透明，
     * 必须自己铺不透明底色，否则推入动画期间上一屏会透出来。
     */
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 12, paddingBottom: 40 },
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
    addBtn: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    addBtnText: { color: colors.primary, fontSize: typography.callout.fontSize, fontWeight: "800" },
  });
