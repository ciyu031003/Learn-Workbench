import { useCallback, useEffect, useMemo, useState } from "react";
import Animated from "react-native-reanimated";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { PressableScale } from "@/components/pressable-scale";
import { SkeletonCard } from "@/components/skeleton";
import { GlassSurface } from "@/components/surface";
import { ProgressArc } from "@/components/progress-arc";
import { StatLine } from "@/components/stat";
import { ListGroup, ListRow } from "@/components/list-row";
import { GroupLabel } from "@/components/group-label";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { computeReadiness, WEAKEST_LABEL } from "@/lib/readiness";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { addHydration, fetchHydration, fetchWeight, type HydrationToday, type WeightPointDto } from "@/lib/wellbeing-client";
import { toDaySummaryMap, todayAndYesterday } from "@/lib/nutrition-views";
import { haptics } from "@/lib/haptics";
import { getApiUrl } from "@/config";

interface DailyOs {
  learning: { tasksTotal: number; tasksDone: number; focusMinutes: number };
  fitness: {
    workoutName: string | null;
    workoutMinutes: number;
    nutritionKcal: number;
    nutritionTargetKcal: number;
    nutritionRemainingKcal?: number;
    /** 今日饮食明细（最近 5 条，v3 M11 深化） */
    nutritionEntries?: { id: number; name: string; meal: "breakfast" | "lunch" | "dinner" | "snack"; kcal: number }[];
  };
  hydration?: { totalMl: number; targetMl: number };
  habits: { scheduled: number; done: number };
}

/** v7 P2：hero 的四项分解（权重与 lib/readiness 一致），点一下直达对应模块 */
const BREAKDOWN: { key: "tasks" | "habits" | "workout" | "nutrition"; label: string; color: string; href: string }[] = [
  { key: "tasks", label: "任务", color: "#2F74C0", href: "/tasks" },
  { key: "habits", label: "习惯", color: "#8D7BD8", href: "/habits" },
  { key: "workout", label: "训练", color: "#E1781C", href: "/workout" },
  { key: "nutrition", label: "饮食", color: "#2FB3A6", href: "/nutrition" },
];

const DIET_COLOR = "#E1781C";
const WATER_COLOR = "#2FB3A6";
const WEIGHT_COLOR = "#8D7BD8";
const HABIT_COLOR = "#8D7BD8";
const RECORD_COLOR = "#3DA35D";
const CARD_COLOR = "#C79A3E";

function tintOf(color: string) {
  return { iconColor: color, iconBg: color + "22" };
}

/**
 * 健康 Hub（v7 P2 三层结构）：
 *  ① 今日状态 —— 进度弧 + 四项分解条 + 本周概览（训练/记录/均值）
 *  ② 今日动作 —— 饮食 / 饮水 / 训练 / 体重 四张可交互卡（都能就地记一笔）
 *  ③ 趋势与档案 —— 饮食趋势 / 训练记录 / 习惯 / 领域记录 的轻量入口
 */
export default function WellnessScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [data, setData] = useState<DailyOs | null>(null);
  const [loading, setLoading] = useState(true);
  const [weightPoints, setWeightPoints] = useState<WeightPointDto[]>([]);
  const [weekWorkouts, setWeekWorkouts] = useState(0);
  const [weekRows, setWeekRows] = useState<{ entryCount: number; kcal: number }[]>([]);
  /**
   * 饮水与饮食改为「与饮食页同源」的两路数据：
   * - 饮水直接用 /api/wellbeing/hydration（饮食页也是它）；
   * - 今日摄入用 /api/nutrition/summary 的当天行兜底。
   * 这样不再只依赖 /api/daily 的聚合结果，避免"饮食页有、健康页没有"（v12 P0-2/P0-3）。
   */
  const { today: todayKey } = useMemo(() => todayAndYesterday(), []);
  const [hydration, setHydration] = useState<HydrationToday | null>(null);
  const [todayKcal, setTodayKcal] = useState<number | null>(null);
  /** 聚合接口失败时的显式状态（不再静默显示 0） */
  const [dailyFailed, setDailyFailed] = useState(false);
  /** 正在补水的乐观增量（ml） */
  const [waterDelta, setWaterDelta] = useState(0);

  const load = useCallback(async () => {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [dailyRes, weightRes, workoutRes, summaryRes, hydrationRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/daily?date=${todayKey}`, { headers }),
        fetchWeight(token, 30).catch(() => null),
        fetch(getApiUrl() + "/api/workouts?days=7", { headers }).catch(() => null),
        fetch(getApiUrl() + "/api/nutrition/summary?days=7", { headers }).catch(() => null),
        fetchHydration(token).catch(() => null),
      ]);
      if (dailyRes.ok) {
        setData(await dailyRes.json());
        setDailyFailed(false);
      } else {
        // 401/500 不再静默：页面给「重试」入口，同时保留上一次数据
        setDailyFailed(true);
      }
      if (weightRes) setWeightPoints(weightRes.points);
      if (workoutRes && workoutRes.ok) {
        const d = await workoutRes.json();
        setWeekWorkouts(Array.isArray(d.workouts) ? d.workouts.length : 0);
      }
      if (summaryRes && summaryRes.ok) {
        const d = await summaryRes.json();
        // ⚠️ 后端返回的是**数组**（逐日行）。旧代码当 map 用，`map[todayKey]` 恒为 undefined，
        // 于是"饮食页有记录、健康主页没数字"（2026-09-22 真机反馈）。统一用 toDaySummaryMap 解析。
        const map = toDaySummaryMap(d.summary);
        const rows = Object.values(map);
        setWeekRows(rows.map((r) => ({ entryCount: r.entryCount, kcal: r.kcal })));
        // 当天有记录就用当天行（与饮食页同源）；当天确实没记录时置 0（而不是 null 让上层回落到可能滞后的聚合值）
        setTodayKcal(map[todayKey]?.kcal ?? 0);
      }
      if (hydrationRes) {
        setHydration(hydrationRes);
        setWaterDelta(0); // 拉回来的即真值，清掉乐观增量
      }
    } catch {
      // 离线保留上次数据，但标记失败让页面提示
      setDailyFailed(true);
    } finally {
      setLoading(false);
    }
  }, [token, todayKey]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  useFocusRefresh(load);
  /** v18：统一走 usePullRefresh（本页有吸顶紧凑栏 → stickyHeader: true），偏移与配色由 hook 集中计算 */
  const { control } = usePullRefresh(load, { stickyHeader: true });

  const habitPct =
    data && data.habits.scheduled > 0 ? Math.round((data.habits.done / data.habits.scheduled) * 100) : 0;

  // 今日状态分（readiness）：一个分数 + 一句结论 + 四项分解（v7 P2 加分解）
  const readiness = useMemo(
    () =>
      computeReadiness({
        tasksTotal: data?.learning.tasksTotal ?? 0,
        tasksDone: data?.learning.tasksDone ?? 0,
        habitsScheduled: data?.habits.scheduled ?? 0,
        habitsDone: data?.habits.done ?? 0,
        workoutMinutes: data?.fitness.workoutMinutes ?? 0,
        nutritionKcal: data?.fitness.nutritionKcal ?? 0,
        nutritionTargetKcal: data?.fitness.nutritionTargetKcal ?? 0,
      }),
    [data]
  );

  const dietEntries = data?.fitness.nutritionEntries ?? [];
  // 当天摄入优先取「饮食页同源」的 summary 行，聚合接口滞后时不会显示 0
  const dietKcal = todayKcal ?? data?.fitness.nutritionKcal ?? 0;
  const dietTarget = data?.fitness.nutritionTargetKcal ?? 2000;
  const dietRemaining = data?.fitness.nutritionRemainingKcal ?? (data ? dietTarget - dietKcal : 0);
  const dietPct = dietTarget > 0 ? Math.min(100, Math.round((dietKcal / dietTarget) * 100)) : 0;

  // v11 P2（参考图 1）：三个关键指标 + 「今日目标」进度条
  const exerciseMinutes = data?.fitness.workoutMinutes ?? 0;
  const exerciseTarget = 30;
  const reachGoals = [
    { key: "water", label: "饮水", unit: "ml", value: data?.hydration?.totalMl ?? 0, target: data?.hydration?.targetMl ?? 2000, href: "/wellness" },
    { key: "exercise", label: "训练", unit: "min", value: exerciseMinutes, target: exerciseTarget, href: "/workout" },
  ];
  const mainGoal = reachGoals.reduce(
    (worst, item) => {
      const ratio = item.target > 0 ? item.value / item.target : 0;
      return ratio < worst.ratio ? { item, ratio } : worst;
    },
    {
      item: reachGoals[0],
      ratio: reachGoals[0].target > 0 ? reachGoals[0].value / reachGoals[0].target : 0,
    }
  );
  const goalPct = Math.min(100, Math.round(mainGoal.ratio * 100));

  // 饮水以 /api/wellbeing/hydration 为准（与饮食页同一数据源），加上乐观增量
  const waterMl = (hydration?.totalMl ?? data?.hydration?.totalMl ?? 0) + waterDelta;
  const waterTarget = hydration?.targetMl ?? data?.hydration?.targetMl ?? 2000;
  const waterPct = Math.min(100, Math.round((waterMl / Math.max(1, waterTarget)) * 100));

  const recordDays = weekRows.filter((r) => r.entryCount > 0).length;
  const avgKcal = recordDays > 0 ? Math.round(weekRows.reduce((sum, r) => sum + r.kcal, 0) / recordDays) : 0;

  const latestWeight = weightPoints.length > 0 ? weightPoints[weightPoints.length - 1].weightKg : null;
  const weightDelta =
    latestWeight !== null && weightPoints.length > 1
      ? Math.round((latestWeight - weightPoints[0].weightKg) * 10) / 10
      : null;

  /**
   * 就地补水：**先乐观更新**（点一下立刻看到数字与进度条变化），
   * 再写服务端；失败则回滚并明确提示（旧版静默 catch，用户看到的就是"点了没反应"）。
   */
  const quickWater = async (ml: number) => {
    haptics.light();
    setWaterDelta((d) => d + ml); // 乐观
    try {
      await addHydration(token, ml);
      const fresh = await fetchHydration(token).catch(() => null);
      if (fresh) {
        setHydration(fresh);
        setWaterDelta(0);
      }
    } catch (e) {
      setWaterDelta((d) => Math.max(0, d - ml)); // 回滚
      Alert.alert("记录饮水失败", e instanceof Error ? e.message : "网络似乎不太顺，稍后再试");
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="健康" scrollY={headerScroll.scrollY} />
    <Animated.ScrollView onScroll={headerScroll.onScroll} scrollEventThrottle={16}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl {...control} />}
    >
      <ScreenHeaderLargeTitle title="健康" subtitle="训练 · 饮食 · 习惯，照顾好身体才有持续成长" />

      {/* 聚合接口失败不再静默：明确提示 + 一键重试（v12 P0-2/P0-3） */}
      {dailyFailed ? (
        <PressableScale haptic scaleTo={0.98} style={styles.errorBar} onPress={() => void load()}>
          <ThemedIcon name="cloud-offline-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>
            {data ? "刚才的数据没刷新成功，点这里重试" : "健康数据没加载出来，点这里重试"}
          </Text>
          <ThemedIcon name="refresh" size={16} color={colors.danger} />
        </PressableScale>
      ) : null}

      {/* ① 今日状态：进度弧 + 四项分解 + 本周概览 */}
      {loading && !data ? (
        <SkeletonCard count={1} />
      ) : (
        <GlassSurface corner={radius.xl} style={styles.hero}>
          {/* 大圆环（参考图 1）：中心是完成度，环下一句结论 */}
          <View style={styles.ringWrap}>
            <ProgressArc
              progress={readiness.score / 100}
              size={168}
              strokeWidth={13}
              value={readiness.score}
              label="已完成"
              caption=""
            />
          </View>
          <Text style={styles.heroVerdict}>
            {readiness.weakest ? "今天最短板 · " + WEAKEST_LABEL[readiness.weakest] : readiness.verdict}
          </Text>

          {/* 三指标行（今日摄入 / 今日训练 / 今日饮水） */}
          <View style={styles.metricRow}>
            <PressableScale haptic scaleTo={0.98} style={styles.metricCell} onPress={() => router.push("/nutrition" as never)}>
              <ThemedIcon name="restaurant-outline" size={16} color={DIET_COLOR} />
              <Text style={styles.metricValue}>
                {dietKcal}
                <Text style={styles.metricUnit}> kcal</Text>
              </Text>
              <Text style={styles.metricLabel}>今日摄入</Text>
            </PressableScale>
            <PressableScale haptic scaleTo={0.98} style={styles.metricCell} onPress={() => router.push("/workout" as never)}>
              <ThemedIcon name="barbell-outline" size={16} color={DIET_COLOR} />
              <Text style={styles.metricValue}>
                {exerciseMinutes}
                <Text style={styles.metricUnit}> min</Text>
              </Text>
              <Text style={styles.metricLabel}>今日训练</Text>
            </PressableScale>
            <PressableScale haptic scaleTo={0.98} style={styles.metricCell} onPress={() => router.push("/wellness" as never)}>
              <ThemedIcon name="water-outline" size={16} color={WATER_COLOR} />
              <Text style={styles.metricValue}>
                {waterMl}
                <Text style={styles.metricUnit}> ml</Text>
              </Text>
              <Text style={styles.metricLabel}>今日饮水</Text>
            </PressableScale>
          </View>

          {/* 今日目标进度条（取最没达标的那一项） */}
          <PressableScale
            haptic
            scaleTo={0.99}
            style={styles.goalCard}
            accessibilityLabel={`今日目标 ${mainGoal.item.label} ${goalPct}%`}
            onPress={() => router.push(mainGoal.item.href as never)}
          >
            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>今日目标</Text>
              <Text style={styles.goalValue}>
                {mainGoal.item.label} {mainGoal.item.value} / {mainGoal.item.target} {mainGoal.item.unit} ›
              </Text>
            </View>
            <View style={styles.goalTrack}>
              <View style={[styles.goalFill, { width: `${Math.max(2, goalPct)}%` }]} />
            </View>
          </PressableScale>

          {/* 本周概览（保留，压缩成一行） */}
          <View style={styles.weekRow}>
            <StatLine label="本周训练" value={`${weekWorkouts} 次`} />
            <StatLine label="饮食记录" value={recordDays > 0 ? `${recordDays} 天 · 均 ${avgKcal}` : "未记录"} />
            <StatLine
              label="习惯完成"
              value={data && data.habits.scheduled > 0 ? `${data.habits.done}/${data.habits.scheduled} · ${habitPct}%` : "无排期"}
            />
          </View>

          <View style={styles.breakdown}>
            {BREAKDOWN.map((b) => {
              const pct = Math.round((readiness.parts[b.key] ?? 0) * 100);
              return (
                <PressableScale
                  key={b.key}
                  haptic
                  scaleTo={0.99}
                  style={styles.breakdownRow}
                  accessibilityLabel={`${b.label}完成度 ${pct}%`}
                  onPress={() => router.push(b.href as never)}
                >
                  <Text style={styles.breakdownLabel}>{b.label}</Text>
                  <View style={styles.breakdownTrack}>
                    <View style={[styles.breakdownFill, { width: `${Math.max(2, pct)}%`, backgroundColor: b.color }]} />
                  </View>
                  <Text style={styles.breakdownPct}>{pct}%</Text>
                </PressableScale>
              );
            })}
          </View>
        </GlassSurface>
      )}

      <GroupLabel>今日动作</GroupLabel>
      <View style={styles.actionGrid}>
        {/* 饮食：剩余额度 */}
        <PressableScale
          haptic
          scaleTo={0.98}
          style={styles.actionCard}
          accessibilityLabel="打开今日饮食"
          onPress={() => router.push("/nutrition" as never)}
        >
          <View style={styles.actionHead}>
            <ThemedIcon name="restaurant-outline" size={16} color={DIET_COLOR} />
            <Text style={styles.actionTitle}>饮食</Text>
          </View>
          <Text style={[styles.actionValue, dietRemaining < 0 && { color: colors.danger }]}>
            {dietRemaining}
            <Text style={styles.actionUnit}> kcal</Text>
          </Text>
          <Text style={styles.actionHint}>
            {dietRemaining < 0 ? `已超 ${Math.abs(dietRemaining)}` : "还能吃"} · 已吃 {dietKcal}/{dietTarget}
          </Text>
          <View style={styles.actionTrack}>
            <View style={[styles.actionFill, { width: `${dietPct}%`, backgroundColor: DIET_COLOR }]} />
          </View>
          {dietEntries.length > 0 ? (
            <Text style={styles.actionFoot} numberOfLines={1}>
              刚记：{dietEntries[dietEntries.length - 1].name} {dietEntries[dietEntries.length - 1].kcal} kcal
            </Text>
          ) : (
            <Text style={styles.actionFoot}>点这里记第一条 ›</Text>
          )}
        </PressableScale>

        {/* 饮水：液面条 + 一点即记 */}
        <View style={styles.actionCard}>
          <View style={styles.actionHead}>
            <ThemedIcon name="water-outline" size={16} color={WATER_COLOR} />
            <Text style={styles.actionTitle}>饮水</Text>
          </View>
          <Text style={styles.actionValue}>
            {waterMl}
            <Text style={styles.actionUnit}> / {waterTarget} ml</Text>
          </Text>
          <View style={styles.actionTrack}>
            <View style={[styles.actionFill, { width: `${waterPct}%`, backgroundColor: WATER_COLOR }]} />
          </View>
          <View style={styles.waterQuick}>
            {[200, 300, 500].map((ml) => (
              <PressableScale
                key={ml}
                haptic
                scaleTo={0.94}
                style={styles.waterChip}
                accessibilityLabel={`记录 ${ml} 毫升饮水`}
                onPress={() => void quickWater(ml)}
              >
                <Text style={styles.waterChipText}>+{ml}</Text>
              </PressableScale>
            ))}
          </View>
        </View>

        {/* 训练 */}
        <PressableScale
          haptic
          scaleTo={0.98}
          style={styles.actionCard}
          accessibilityLabel="记录一次训练"
          onPress={() => router.push("/workout" as never)}
        >
          <View style={styles.actionHead}>
            <ThemedIcon name="barbell-outline" size={16} color={DIET_COLOR} />
            <Text style={styles.actionTitle}>训练</Text>
          </View>
          <Text style={styles.actionValue}>
            {data?.fitness.workoutMinutes ?? 0}
            <Text style={styles.actionUnit}> 分钟</Text>
          </Text>
          <Text style={styles.actionHint}>
            {data?.fitness.workoutName ? data.fitness.workoutName : "今天还没练"} · 本周 {weekWorkouts} 次
          </Text>
          <Text style={styles.actionFoot}>记录一次训练 ›</Text>
        </PressableScale>

        {/* 体重 */}
        <PressableScale
          haptic
          scaleTo={0.98}
          style={styles.actionCard}
          accessibilityLabel="查看体重趋势"
          onPress={() => router.push("/nutrition" as never)}
        >
          <View style={styles.actionHead}>
            <ThemedIcon name="body-outline" size={16} color={WEIGHT_COLOR} />
            <Text style={styles.actionTitle}>体重</Text>
          </View>
          <Text style={styles.actionValue}>
            {latestWeight !== null ? latestWeight : "--"}
            <Text style={styles.actionUnit}> kg</Text>
          </Text>
          <Text
            style={[
              styles.actionHint,
              weightDelta !== null && weightDelta !== 0 && { color: weightDelta > 0 ? colors.danger : colors.success },
            ]}
          >
            {weightDelta === null
              ? "还没有体重记录"
              : weightDelta === 0
                ? "近 30 天持平"
                : `近 30 天 ${weightDelta > 0 ? "+" : ""}${weightDelta} kg`}
          </Text>
          <Text style={styles.actionFoot}>{latestWeight === null ? "点这里记一次 ›" : "看趋势与目标 ›"}</Text>
        </PressableScale>
      </View>

      <GroupLabel>运动档案</GroupLabel>
      <ListGroup>
        <ListRow
          {...tintOf(CARD_COLOR)}
          icon="sparkles-outline"
          title="运动闪光卡"
          subtitle="战绩 · 装备 · 绝技，实时镭射卡面"
          showChevron
          last
          onPress={() => router.push("/sports-card" as never)}
        />
      </ListGroup>

      <GroupLabel>趋势与档案</GroupLabel>
      <ListGroup>
        <ListRow
          {...tintOf(WATER_COLOR)}
          icon="restaurant-outline"
          title="饮食趋势与目标"
          subtitle="7 天曲线 · 6 个月日历 · 热量目标 · 食物营养库"
          showChevron
          onPress={() => router.push("/nutrition" as never)}
        />
        <ListRow
          {...tintOf(DIET_COLOR)}
          icon="barbell-outline"
          title="训练记录"
          subtitle="动作库 · 组数次数 · 训练容量"
          showChevron
          onPress={() => router.push("/workout" as never)}
        />
        <ListRow
          {...tintOf(HABIT_COLOR)}
          icon="repeat-outline"
          title="习惯打卡"
          subtitle="连续天数 · 13 周热力图 · 时间段"
          showChevron
          onPress={() => router.push("/habits" as never)}
        />
        <ListRow
          {...tintOf(RECORD_COLOR)}
          icon="stats-chart-outline"
          title="领域记录"
          subtitle="跑量 · 体重 · 通用计量"
          showChevron
          last
          onPress={() => router.push("/trackers" as never)}
        />
      </ListGroup>
    </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },
    /* ① 今日状态 */
    errorBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    errorText: { flex: 1, fontSize: typography.caption.fontSize, fontWeight: "600", color: colors.danger },
    hero: { gap: spacing.md, paddingVertical: spacing.lg },
    heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
    heroStats: { flex: 1, minWidth: 0, gap: spacing.sm },
    /* v11 P2（参考图 1）：大圆环 + 三指标 + 今日目标 */
    ringWrap: { alignItems: "center", paddingTop: 4, paddingBottom: 2 },
    heroVerdict: { textAlign: "center", ...typography.micro, fontWeight: "600", color: colors.textMuted },
    metricRow: {
      flexDirection: "row",
      marginTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },
    metricCell: { flex: 1, alignItems: "center", gap: 3 },
    metricValue: { ...typography.title2, fontWeight: "800", color: colors.text, ...tabularNums },
    metricUnit: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    metricLabel: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    goalCard: {
      marginTop: spacing.md,
      gap: 8,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    goalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    goalLabel: { ...typography.micro, fontWeight: "700", color: colors.text },
    goalValue: { ...typography.micro, fontWeight: "600", color: colors.textMuted, ...tabularNums },
    goalTrack: { height: 7, borderRadius: 999, backgroundColor: colors.surfaceStrong, overflow: "hidden" },
    goalFill: { height: 7, borderRadius: 999, backgroundColor: colors.primary },
    weekRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },

    breakdown: { gap: 8, paddingTop: spacing.md },
    breakdownRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    breakdownLabel: { width: 30, ...typography.micro, fontWeight: "700", color: colors.textMuted },
    breakdownTrack: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
    },
    breakdownFill: { height: 6, borderRadius: 999 },
    breakdownPct: { width: 36, textAlign: "right", ...typography.micro, fontWeight: "700", color: colors.text, ...tabularNums },
    /* ② 今日动作 */
    actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    actionCard: {
      width: "47.5%",
      flexGrow: 1,
      minHeight: 124,
      gap: 6,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    actionHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    actionTitle: { ...typography.micro, fontWeight: "700", color: colors.textMuted },
    actionValue: { ...typography.title2, fontWeight: "800", color: colors.text, ...tabularNums },
    actionUnit: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    actionHint: { ...typography.micro, fontWeight: "500", color: colors.textMuted, ...tabularNums },
    actionFoot: { marginTop: "auto", ...typography.micro, fontWeight: "700", color: colors.primary },
    actionTrack: { height: 5, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    actionFill: { height: 5, borderRadius: 999 },
    waterQuick: { marginTop: 6, flexDirection: "row", gap: 6 },
    waterChip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
    },
    waterChipText: { ...typography.micro, fontWeight: "800", color: colors.text, ...tabularNums },
  });
