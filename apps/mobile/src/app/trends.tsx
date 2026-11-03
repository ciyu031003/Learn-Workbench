import { useCallback, useEffect, useMemo, useState } from "react";
import Animated from "react-native-reanimated";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { Workout } from "@learn-workbench/shared/schemas";
import { fromDateKey, toDateKey } from "@learn-workbench/shared/dates";
import { exerciseTypeLabels } from "@learn-workbench/shared/labels";
import { CalorieHeatmapCard } from "@/components/calorie-trend";
import { Card } from "@/components/card";
import { FoodCalendar } from "@/components/food-calendar";
import { GroupLabel } from "@/components/group-label";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { ChipGroup } from "@/components/sheet";
import { Skeleton, SkeletonCard } from "@/components/skeleton";
import { SportBackfillSheet } from "@/components/sport-backfill-sheet";
import { ThemedIcon } from "@/components/themed-icon";
import { TrainingLoadCard } from "@/components/training-load-card";
import { AreaChart, BarList, ChartHeader, SegmentRing, StatTileRow, StepsBar } from "@/components/v2/charts";
import { addDays, localKey, weekdayName } from "@/lib/focus-series";
import { formatMonthDayRange } from "@/lib/chart-math";
import { buildTrendSeries, loggedDaysInMonth } from "@/lib/nutrition-stats";
import { setNavPendingParams } from "@/lib/nav-pending";
import { groupThousands, todayAndYesterday } from "@/lib/nutrition-views";
import { buildSportTrend, formatSportDuration, type SportTrendFilter } from "@/lib/sport-trend";
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
 *     7/14 天 kcal 面积图 + 26 周点阵热力图 + Food Calendar；点月历某天跳到饮食页对应日期。
 *  ② 运动：本地 store 的 `sports`（计时结束写入 + 本页「补录」写入）→ 每日柱状 +
 *     分项排行；零网络请求，离线也能看。
 *  ③ 训练负荷：GET /api/workouts?days=30 → `trainingLoadSeries` 自动选口径
 *     （容量→次数→组数→训练次数）画 30 天柱状，并列出区间合计。
 *
 * v2.1 P3：图表区换成数据面板组件库（`components/v2/charts`）——
 * 顶部三格 → StatTileRow；热量曲线 → AreaChart（7/14 天切换照旧）；
 * 目标达成 → SegmentRing；运动 → StepsBar（近 7 天）+ BarList（分项排行）。
 * 数据口径与原实现完全一致：仍是同一批 rows / sports / workouts，零新增接口、零改后端契约。
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

  /** 热量目标（用于面积图 caption 与达成环）；拿不到就退化为"没有目标"分支 */
  const [targetKcal, setTargetKcal] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    fetchNutritionTarget(token)
      .then((d) => {
        if (!cancelled) setTargetKcal(Number(d.target?.kcal) || 0);
      })
      .catch(() => {
        // 离线/未登录：保持 0，卡片自动退化为无目标环
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

  /* ---------- 面板状态（只换聚合窗口，不重新取数） ---------- */
  const [calorieDays, setCalorieDays] = useState<7 | 14>(7);
  const [sportDays, setSportDays] = useState<7 | 30>(7);
  const [sportFilter, setSportFilter] = useState<SportTrendFilter>("ALL");

  /**
   * 顶部总览（v1.50 → v2.1 StatTileRow）：三段数据的「一眼版」，
   * 全部复用本页已加载的数据，零新增请求。
   */
  const dietWeek = useMemo(() => {
    const todayDate = fromDateKey(todayKey);
    let loggedDays = 0;
    let kcalSum = 0;
    for (let i = 0; i < 7; i += 1) {
      const row = rows[localKey(addDays(todayDate, -i))];
      if (row && row.kcal > 0) {
        loggedDays += 1;
        kcalSum += row.kcal;
      }
    }
    return { loggedDays, avgKcal: loggedDays > 0 ? Math.round(kcalSum / loggedDays) : 0 };
  }, [rows, todayKey]);

  /** 近 7 天运动 + 上一个 7 天（只取两个已聚合的区间合计算环比，口径与柱状一致） */
  const sport7 = useMemo(() => buildSportTrend(sports, todayKey, 7), [sports, todayKey]);
  const sportPrev7 = useMemo(
    () => buildSportTrend(sports, toDateKey(addDays(fromDateKey(todayKey), -7)), 7),
    [sports, todayKey]
  );
  const sportDeltaPct =
    sportPrev7.totalMinutes > 0
      ? Math.round(((sport7.totalMinutes - sportPrev7.totalMinutes) / sportPrev7.totalMinutes) * 100)
      : null;

  /** 热量曲线：窗口跟随 7/14 天切换（`buildTrendSeries` 一次给出本期 + 上一周期） */
  const calorie = useMemo(() => buildTrendSeries(rows, todayKey, calorieDays), [rows, todayKey, calorieDays]);
  /** 稳定引用：React Compiler 只接受与推断一致的依赖（`calorie.current` 而不是整个 series） */
  const calorieCurrent = calorie.current;
  const calorieLabels = useMemo(() => {
    if (calorieCurrent.length <= 7) return calorieCurrent.map((point) => point.label);
    // 14 天：横轴只标隔天的 M/D（AreaChart 的轴是等分标签行，标满会挤成一团）
    return calorieCurrent
      .filter((_, index) => index % 2 === 0)
      .map((point) => {
        const date = fromDateKey(point.key);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      });
  }, [calorieCurrent]);

  /** 运动面板：窗口跟随 7/30 天、筛选跟随 ChipGroup（纯本地聚合） */
  const sport = useMemo(
    () => buildSportTrend(sports, todayKey, sportDays, sportFilter),
    [sports, todayKey, sportDays, sportFilter]
  );
  const sportFilterOptions = useMemo(
    () => sport.byType.map((item) => ({ key: item.type, label: exerciseTypeLabels[item.type], badge: item.sessions })),
    [sport.byType]
  );
  /** 柱图固定看「最近 7 天」（窗口切到 30 天时，柱仍是对最近一周的可读切面） */
  const sportBars = useMemo(() => {
    const tail = sport.points.slice(-7);
    const peak = tail.reduce((max, point) => Math.max(max, point.minutes), 0);
    return tail.map((point, index) => ({
      label: weekdayName(fromDateKey(point.key)).slice(1),
      value: peak > 0 ? point.minutes / peak : 0,
      highlight: index === tail.length - 1,
      valueLabel: index === tail.length - 1 ? String(Math.round(point.minutes)) : undefined,
    }));
  }, [sport.points]);
  const sportRangeLabel = useMemo(() => {
    const tail = sport.points.slice(-7);
    if (tail.length < 2) return undefined;
    return formatMonthDayRange(tail[0].key, tail[tail.length - 1].key);
  }, [sport.points]);
  const sportTypeItems = useMemo(
    () =>
      sport.byType.map((item) => ({
        key: item.type,
        label: exerciseTypeLabels[item.type],
        value: item.minutes,
        valueLabel: formatSportDuration(item.minutes),
        hint: `${item.sessions} 次`,
      })),
    [sport.byType]
  );

  /** 热量目标达成：日均 ÷ 目标（目标缺失或没有记录 → 不出这一块，不臆造百分比） */
  const showGoalRing = targetKcal > 0 && calorie.daysLogged > 0;
  const goalRatio = showGoalRing ? Math.round((calorie.avgKcal / targetKcal) * 100) : 0;
  const goalRest = Math.max(0, targetKcal - calorie.avgKcal);

  const rangeToggle = (
    <View style={styles.rangeToggle}>
      {([7, 14] as const).map((days) => {
        const active = calorieDays === days;
        return (
          <Pressable
            key={days}
            onPress={() => setCalorieDays(days)}
            hitSlop={7}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`近 ${days} 天`}
            style={[styles.rangeItem, active && styles.rangeItemActive]}
          >
            <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{days} 天</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const sportToggle = (
    <View style={styles.rangeToggle}>
      {([7, 30] as const).map((days) => {
        const active = sportDays === days;
        return (
          <Pressable
            key={days}
            onPress={() => setSportDays(days)}
            hitSlop={7}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`近 ${days} 天运动`}
            style={[styles.rangeItem, active && styles.rangeItemActive]}
          >
            <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{days} 天</Text>
          </Pressable>
        );
      })}
    </View>
  );

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

        {/* 总览：三段数据的一眼版（复用本页数据，零新增请求） */}
        <StatTileRow
          items={[
            {
              label: "近 7 天饮食",
              value: nutritionPending ? "…" : dietWeek.loggedDays > 0 ? `${dietWeek.loggedDays}/7` : "—",
              unit: dietWeek.loggedDays > 0 ? "天" : undefined,
              icon: "restaurant-outline",
              tone: "accent",
            },
            {
              label: "近 7 天运动",
              value: sport7.totalMinutes > 0 ? Math.round((sport7.totalMinutes / 60) * 10) / 10 : "—",
              unit: sport7.totalMinutes > 0 ? "h" : undefined,
              icon: "barbell-outline",
              tone: "primary",
              delta: sportDeltaPct !== null ? { value: sportDeltaPct } : undefined,
            },
            {
              label: "近 30 天训练",
              value: workouts.length > 0 ? workouts.length : "—",
              unit: workouts.length > 0 ? "次" : undefined,
              icon: "fitness-outline",
              tone: "success",
            },
          ]}
        />

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
            <Card style={styles.panel}>
              {/* 卡头只放短文案：右侧还有 7/14 天切换，130% 字号下长 caption 会被挤断 */}
              <ChartHeader
                title={`近 ${calorieDays} 天热量`}
                caption={`日均 ${groupThousands(calorie.avgKcal)} kcal`}
                right={rangeToggle}
              />
              {calorie.totalKcal > 0 || calorie.priorTotalKcal > 0 ? (
                <>
                  <AreaChart
                    title={null}
                    height={150}
                    min={0}
                    legend
                    labels={calorieLabels}
                    series={[
                      { key: "current", label: "本期", values: calorie.current.map((point) => point.kcal) },
                      { key: "prior", label: "上一周期", values: calorie.prior, color: colors.textFaint },
                    ]}
                  />
                  <View style={styles.hintRow}>
                    <Text style={styles.chartHint}>{`${calorie.daysLogged}/${calorieDays} 天有记录`}</Text>
                    <Text style={styles.chartHint}>
                      {calorie.deltaPct === null
                        ? "暂无可对比的上一周期"
                        : `较上一周期 ${calorie.deltaPct > 0 ? "+" : ""}${calorie.deltaPct}%`}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.chartEmpty}>
                  <ThemedIcon name="pulse-outline" size={22} color={colors.textFaint} />
                  <Text style={styles.chartEmptyText}>还没有足够的数据画曲线，先记两条饮食吧</Text>
                </View>
              )}

              {showGoalRing ? (
                <SegmentRing
                  title={`近 ${calorieDays} 天日均 vs 目标`}
                  segments={[
                    {
                      key: "intake",
                      label: "日均摄入",
                      value: calorie.avgKcal,
                      valueLabel: `${groupThousands(calorie.avgKcal)} kcal`,
                    },
                    {
                      key: "rest",
                      label: "距目标余量",
                      value: goalRest,
                      valueLabel: `${groupThousands(goalRest)} kcal`,
                    },
                  ]}
                  score={`${goalRatio}%`}
                  scoreLabel="目标达成率"
                  caption={`目标 ${groupThousands(targetKcal)} kcal`}
                  size={156}
                />
              ) : null}
            </Card>

            <CalorieHeatmapCard map={rows} endKey={todayKey} targetKcal={targetKcal} />
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
                // 字符串 href（v2.1 评审修复）：对象形式 push 在同名路由复用实例时参数会被
                // 冻结（与 408 专区 bug 同根因，见 quiz/chapter.tsx 的防冻注释）
                onSelect={(key) => {
                  // v1.51：follow-effect 对「params 本身冻结」无效，目标参数改登记场外通道
                  setNavPendingParams("nutrition", { date: key });
                  router.push(`/nutrition?date=${key}` as never);
                }}
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

        <Card style={styles.panel}>
          <ChartHeader
            title={`运动 · 近 ${sportDays} 天`}
            caption={
              sport.totalSessions > 0
                ? `合计 ${formatSportDuration(sport.totalMinutes)}`
                : sportFilter === "ALL"
                  ? "该区间还没有记录"
                  : "该类型在本区间没有记录"
            }
            right={sportToggle}
          />
          {sport.byType.length > 0 ? (
            <>
              <Text style={styles.chartHint}>{`${sport.totalSessions} 次 · ${sport.activeDays}/${sportDays} 天有记录`}</Text>
              <ChipGroup
                options={sportFilterOptions}
                selected={[sportFilter]}
                onToggle={(key) => setSportFilter(key as SportTrendFilter)}
                multiple={false}
                wrap
                allKey="ALL"
                allLabel="全部"
              />
              <StepsBar title="每日时长（近 7 天）" rangeLabel={sportRangeLabel} items={sportBars} />
              <BarList title="分项排行" items={sportTypeItems} />
            </>
          ) : (
            <Text style={styles.chartEmptyText}>还没有运动记录，用上面的「补录」加一条试试</Text>
          )}
        </Card>

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
    panel: { gap: 12 },
    rangeToggle: { flexDirection: "row", gap: 6 },
    rangeItem: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
      backgroundColor: colors.surfaceMuted,
    },
    rangeItemActive: { backgroundColor: colors.primarySoft },
    rangeText: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    rangeTextActive: { color: colors.primary, fontWeight: "800" },
    chartHint: { ...typography.meta, color: colors.textMuted },
    hintRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
    chartEmpty: { alignItems: "center", gap: 6, paddingVertical: 22 },
    chartEmptyText: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
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
