import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { SectionHeader } from "@/components/section-header";
import { EntryCard } from "@/components/entry-card";
import { StatStrip } from "@/components/stat-strip";
import { PressableScale } from "@/components/pressable-scale";
import { SkeletonCard } from "@/components/skeleton";
import { ListGroup } from "@/components/list-row";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { computeReadiness, WEAKEST_LABEL } from "@/lib/readiness";
import { useTheme } from "@/theme";
import { spacing, typography } from "@/theme/tokens";
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

/** 训练默认目标（分钟）：只用于「训练」卡的 meta 提示，口径与旧版 exerciseTarget 一致 */
const EXERCISE_TARGET_MIN = 30;

/**
 * 健康 Hub（v1.62 P0-4a 重构）
 *
 * 结构：紧凑 header（标题 + 今日分/结论）→ 今日状态 StatStrip 三格（摄入 / 训练 / 饮水）
 *      → 今日动作 2×2 mid 入口（饮食剩余额度 / 饮水 +250ml / 训练记录 / 体重趋势）
 *      → 趋势 2 张 hero（运动闪光卡 / 趋势分析）→ 更多 2 行（习惯打卡 / 领域追踪）。
 *
 * 数据口径与交互完全沿用改造前：/api/daily、/api/wellbeing/hydration、/api/nutrition/summary、
 * /api/workouts、fetchWeight 五路拉取 + useFocusRefresh/下拉刷新 + 饮水乐观增量（先 +250 再写服务端，
 * 失败回滚并提示）。训练记录合并进「训练记录」卡，不再单独占一行；首屏入口 = 4 + 2 + 2 = 8（≤9）。
 * 动效只沿用 PressableScale 按压与既有入场错峰（不新增动效点）。
 */
export default function WellnessScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  /** v19-M1：首屏入场错峰（Tab scene 常驻，只在首次挂载播放） */
  const entrance = useScreenEntrance();
  /** v19-M8：TabBar 双击回顶 */
  const wellnessScrollRef = useRef<Animated.ScrollView>(null);
  useScrollToTopHandler("/wellness", wellnessScrollRef);
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
        // ⚠️ 后端返回的是**数组**（逐日行），统一用 toDaySummaryMap 解析
        const map = toDaySummaryMap(d.summary);
        const rows = Object.values(map);
        setWeekRows(rows.map((r) => ({ entryCount: r.entryCount, kcal: r.kcal })));
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
  const { control } = usePullRefresh(load, { stickyHeader: true });

  const habitPct =
    data && data.habits.scheduled > 0 ? Math.round((data.habits.done / data.habits.scheduled) * 100) : 0;

  // 今日状态分（readiness）：保留原算法，只用于 header 的分数与一句结论
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

  const exerciseMinutes = data?.fitness.workoutMinutes ?? 0;

  // 饮水以 /api/wellbeing/hydration 为准（与饮食页同一数据源），加上乐观增量
  const waterMl = (hydration?.totalMl ?? data?.hydration?.totalMl ?? 0) + waterDelta;
  const waterTarget = hydration?.targetMl ?? data?.hydration?.targetMl ?? 2000;
  const waterPct = Math.min(100, Math.round((waterMl / Math.max(1, waterTarget)) * 100));

  const recordDays = weekRows.filter((row) => row.entryCount > 0).length;
  const avgKcal = recordDays > 0 ? Math.round(weekRows.reduce((sum, row) => sum + row.kcal, 0) / recordDays) : 0;

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

  const lastDietEntry = dietEntries.length > 0 ? dietEntries[dietEntries.length - 1] : null;
  const dietMeta =
    (dietRemaining < 0
      ? `已超 ${Math.abs(dietRemaining)} kcal · 已吃 ${dietKcal}/${dietTarget}`
      : `还能吃 ${dietRemaining} kcal · 已吃 ${dietKcal}/${dietTarget}`) +
    (lastDietEntry ? `\n刚记 ${lastDietEntry.name} ${lastDietEntry.kcal} kcal` : "");
  const workoutMeta = `${exerciseMinutes} 分钟 / 目标 ${EXERCISE_TARGET_MIN} 分钟 · 本周 ${weekWorkouts} 次`;
  const weightMeta =
    latestWeight === null
      ? "还没有体重记录"
      : weightDelta === null
        ? `${latestWeight} kg · 近 30 天暂无对比`
        : weightDelta === 0
          ? `${latestWeight} kg · 近 30 天持平`
          : `${latestWeight} kg · 近 30 天 ${weightDelta > 0 ? "+" : ""}${weightDelta} kg`;

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="健康" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        ref={wellnessScrollRef}
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...control} />}
      >
        {/* ① 紧凑 header：标题 + 今日分（去掉原 LargeTitle 大标题/副标题） */}
        <View style={styles.pageHead}>
          <View style={styles.pageHeadText}>
            <Text style={styles.pageTitle}>健康</Text>
            <Text style={styles.pageSubtitle} numberOfLines={1}>
              {readiness.weakest ? "今天最短板 · " + WEAKEST_LABEL[readiness.weakest] : readiness.verdict}
            </Text>
          </View>
          <View style={styles.scoreChip}>
            <Text style={styles.scoreValue}>{readiness.score}</Text>
            <Text style={styles.scoreUnit}>分</Text>
          </View>
        </View>

        {/* 聚合接口失败不再静默：明确提示 + 一键重试（与其他页同一交互） */}
        {dailyFailed ? (
          <PressableScale
            haptic
            scaleTo={0.98}
            style={styles.errorBar}
            accessibilityRole="button"
            accessibilityLabel="重试加载健康数据"
            onPress={() => void load()}
          >
            <ThemedIcon name="cloud-offline-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>
              {data ? "刚才的数据没刷新成功，点这里重试" : "健康数据没加载出来，点这里重试"}
            </Text>
            <ThemedIcon name="refresh" size={16} color={colors.danger} />
          </PressableScale>
        ) : null}

        {/* ② 今日状态：StatStrip 三格（摄入 / 训练 / 饮水，饮水含乐观增量） */}
        <Animated.View entering={entrance(0)}>
          {loading && !data ? (
            <SkeletonCard count={1} />
          ) : (
            <StatStrip
              items={[
                { label: "今日摄入", value: dietKcal, unit: "kcal", tone: "accent" },
                { label: "今日训练", value: exerciseMinutes, unit: "min", tone: "primary" },
                { label: "今日饮水", value: waterMl, unit: "ml", tone: "teal" },
              ]}
            />
          )}
        </Animated.View>

        {/* ③ 今日动作 2×2：饮食剩余 / 饮水 +250 / 训练记录 / 体重趋势 */}
        <SectionHeader title="今日动作" />
        <Animated.View style={styles.grid} entering={entrance(1)}>
          <EntryCard
            size="mid"
            icon="restaurant-outline"
            tone="accent"
            title="饮食"
            meta={dietMeta}
            progress={dietPct / 100}
            style={styles.gridItem}
            onPress={() => router.push("/nutrition" as never)}
          />
          <EntryCard
            size="mid"
            icon="water-outline"
            tone="teal"
            title="饮水"
            meta={`${waterMl} / ${waterTarget} ml · 点一下 +250`}
            progress={waterPct / 100}
            style={styles.gridItem}
            accessibilityLabel="记录 250 毫升饮水"
            onPress={() => void quickWater(250)}
          />
          <EntryCard
            size="mid"
            icon="barbell-outline"
            tone="primary"
            title="训练记录"
            meta={workoutMeta}
            style={styles.gridItem}
            onPress={() => router.push("/workout" as never)}
          />
          <EntryCard
            size="mid"
            icon="body-outline"
            tone="success"
            title="体重趋势"
            meta={weightMeta}
            style={styles.gridItem}
            onPress={() => router.push("/nutrition" as never)}
          />
        </Animated.View>

        {/* ④ 趋势：2 张 hero 卡 */}
        <SectionHeader title="趋势" />
        <Animated.View style={styles.stack} entering={entrance(2)}>
          <EntryCard
            size="hero"
            icon="sparkles-outline"
            tone="warning"
            title="运动闪光卡"
            meta="战绩 · 装备 · 绝技，实时镭射卡面"
            cta="打开我的卡"
            onPress={() => router.push("/sports-card" as never)}
          />
          <EntryCard
            size="hero"
            icon="stats-chart-outline"
            tone="teal"
            title="趋势分析"
            meta={
              recordDays > 0
                ? `近 7 天饮食记录 ${recordDays} 天 · 均 ${avgKcal} kcal · 训练负荷一屏看`
                : "饮食热量 · 运动时长 · 训练负荷，全屏一起看"
            }
            cta="看趋势"
            onPress={() => router.push("/trends" as never)}
          />
        </Animated.View>

        {/* ⑤ 更多：习惯打卡、领域追踪（训练记录已合并进「训练记录」卡） */}
        <SectionHeader title="更多" />
        <Animated.View entering={entrance(3)}>
          <ListGroup>
            <EntryCard
              size="row"
              icon="repeat-outline"
              tone="success"
              title="习惯打卡"
              meta={
                data && data.habits.scheduled > 0
                  ? `今日 ${data.habits.done}/${data.habits.scheduled} · ${habitPct}%`
                  : "连续天数 · 13 周热力图 · 时间段"
              }
              value={data && data.habits.scheduled > 0 ? `${data.habits.done}/${data.habits.scheduled}` : undefined}
              onPress={() => router.push("/habits" as never)}
            />
            <EntryCard
              size="row"
              icon="map-outline"
              tone="primary"
              title="领域追踪"
              meta="跑量 · 体重 · 通用计量"
              last
              onPress={() => router.push("/trackers" as never)}
            />
          </ListGroup>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },

    /* 紧凑 header */
    pageHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    pageHeadText: { flex: 1, minWidth: 0, gap: 2 },
    pageTitle: { ...typography.title2, color: colors.text },
    pageSubtitle: { ...typography.caption, color: colors.textMuted },
    scoreChip: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 2,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
    },
    scoreValue: { ...typography.title2, fontWeight: "800", color: colors.primary },
    scoreUnit: { ...typography.caption, color: colors.primary },

    /* 错误态 */
    errorBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    errorText: { flex: 1, ...typography.caption, fontWeight: "600", color: colors.danger },

    /* 今日动作 2×2 */
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    gridItem: { width: "47.5%", flexGrow: 1 },

    /* 趋势 hero 堆叠 */
    stack: { gap: spacing.sm },
  });
