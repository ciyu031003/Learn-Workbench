import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderStickyBar, useHeaderTopInset, useLargeTitleHeader } from "@/components/screen-header";
import { PageHead } from "@/components/v2/page-head";
import { SectionTitle } from "@/components/v2/section-title";
import { MetricGrid } from "@/components/v2/metric-grid";
import { ActionCard } from "@/components/v2/action-card";
import { BarChart } from "@/components/v2/bar-chart";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { EntryCard } from "@/components/entry-card";
import { PressableScale } from "@/components/pressable-scale";
import { SkeletonCard } from "@/components/skeleton";
import { ListGroup } from "@/components/list-row";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { computeReadiness, WEAKEST_LABEL } from "@/lib/readiness";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { addHydration, fetchHydration, fetchWeight, type HydrationToday, type WeightPointDto } from "@/lib/wellbeing-client";
import { toDaySummaryMap, todayAndYesterday } from "@/lib/nutrition-views";
import { formatSleepHours, formatSleepHoursValue, isFreshSleepEntry, loadSleepEntry, type SleepEntry } from "@/lib/sleep";
import { SleepSheet } from "@/components/sleep-sheet";
import { haptics } from "@/lib/haptics";
import { getApiUrl } from "@/config";
import { fromDateKey, toDateKey } from "@learn-workbench/shared/dates";

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

/** 无记录的统一占位（三态里的「无记录」档，与空态文案共用） */
const NO_RECORD = "—";

/** 周柱图的星期标签：周一 → 周日（与饮食页 WEEK_TILE_LABELS 同序） */
const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"] as const;

/**
 * 以 `todayKey` 为终点的 7 个**本地**日期键（today-6 … today）。
 * 与 `/api/nutrition/summary?days=7` 的窗口完全一致 —— 后端也是「以今天为终点往前 7 天」，
 * 所以柱图能逐日对上，不会出现"周一还显示上上周"的错位。
 */
function lastSevenKeys(todayKey: string): string[] {
  const base = fromDateKey(todayKey);
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    keys.push(toDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() - i)));
  }
  return keys;
}

/** 日期键 → 单字星期（柱图 x 轴标签） */
function weekdayShort(dateKey: string): string {
  return WEEKDAY_SHORT[fromDateKey(dateKey).getDay()];
}

/**
 * 健康 Hub（v2.0 重排 · 原型 V3「页头 → 指标带 → 行动卡 → 周趋势 → 更多」）
 *
 * 结构：① PageHead（eyebrow + 标题 + 说明）+ 今日状态行（readiness 分数 / 最短板）
 *      → ② MetricGrid 三格（饮水 / 训练 / 睡眠，三态：有数据 / 无记录「—」/ 失败保留上次）
 *      → ③ 2×2 ActionCard（饮食记录 / 饮水 +250ml / 训练记录 / 睡眠）
 *      → ④ SectionTitle「本周趋势」+ BarChart（7 天，今日高亮；无记录走空态）
 *      → ⑤ 「更多」入口（习惯打卡 / 领域追踪 / 体重趋势 / 趋势分析 / 运动闪光卡，全部保留）
 *
 * 数据口径与交互**完全沿用改造前**：/api/daily、/api/wellbeing/hydration、/api/nutrition/summary、
 * /api/workouts、fetchWeight 五路并行拉取（各自独立降级，互不拖垮）+ useFocusRefresh/下拉刷新
 * + 饮水乐观增量（先 +250 再写服务端，失败回滚并提示）。聚合接口失败时保留上次数据并给「重试」条。
 *
 * 睡眠（v2.0.1 真机反馈修复）：原来睡眠卡把用户丢去「领域追踪」、指标格恒为「—」，体验错误。
 * 现在睡眠卡打开「睡眠记录」BottomSheet：进入先自动读 Android Health Connect 的昨晚睡眠
 * （读不到就手动填，任何设备都能记），保存到本机 AsyncStorage（lwb.sleep.v1），
 * 指标格直接显示本机这一晚的小时数（没有/过期仍为「—」，不编造数据）。
 * 动效只沿用 PressableScale 按压与既有入场错峰（不新增动效点）。
 */
export default function WellnessScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  /** v2.0.1：Tab 页页头让开状态栏/刘海（与今日/学习/我的同口径） */
  const headerTop = useHeaderTopInset("hero");
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
  /** 近 7 天逐日饮食行（带日期，供柱图逐日对上；旧版只留了 entryCount/kcal） */
  const [weekRows, setWeekRows] = useState<{ date: string; entryCount: number; kcal: number }[]>([]);
  /**
   * 饮水与饮食改为「与饮食页同源」的两路数据：
   * - 饮水直接用 /api/wellbeing/hydration（饮食页也是它）；
   * - 今日摄入用 /api/nutrition/summary 的当天行兜底。
   */
  const { today: todayKey, yesterday: yesterdayKey } = useMemo(() => todayAndYesterday(), []);
  const [hydration, setHydration] = useState<HydrationToday | null>(null);
  const [todayKcal, setTodayKcal] = useState<number | null>(null);
  /** 聚合接口失败时的显式状态（不再静默显示 0） */
  const [dailyFailed, setDailyFailed] = useState(false);
  /** 饮食趋势接口失败：与「本周没记录」区分开，空态里给重试而不是假空 */
  const [summaryFailed, setSummaryFailed] = useState(false);
  /** 正在补水的乐观增量（ml） */
  const [waterDelta, setWaterDelta] = useState(0);
  /** 本机睡眠存档（v2.0.1）：健康页睡眠格与行动卡都读它 */
  const [sleepEntry, setSleepEntry] = useState<SleepEntry | null>(null);
  const [sleepSheetOpen, setSleepSheetOpen] = useState(false);

  const load = useCallback(async () => {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [dailyRes, weightRes, workoutRes, summaryRes, hydrationRes, sleepLocal] = await Promise.all([
        fetch(`${getApiUrl()}/api/daily?date=${todayKey}`, { headers }),
        fetchWeight(token, 30).catch(() => null),
        fetch(getApiUrl() + "/api/workouts?days=7", { headers }).catch(() => null),
        fetch(getApiUrl() + "/api/nutrition/summary?days=7", { headers }).catch(() => null),
        fetchHydration(token).catch(() => null),
        // 睡眠是本机存档（lib/sleep.ts）：与五路远端请求并行，单读失败不影响其它数据
        loadSleepEntry().catch(() => null),
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
        const rows = Object.values(map).sort((a, b) => (a.date < b.date ? -1 : 1));
        setWeekRows(rows.map((r) => ({ date: r.date, entryCount: r.entryCount, kcal: r.kcal })));
        setTodayKcal(map[todayKey]?.kcal ?? 0);
        setSummaryFailed(false);
      } else {
        // 单独降级：饮食趋势失败只影响「本周趋势」，别把页头/行动卡一起打挂
        setSummaryFailed(true);
      }
      if (hydrationRes) {
        setHydration(hydrationRes);
        setWaterDelta(0); // 拉回来的即真值，清掉乐观增量
      }
      setSleepEntry(sleepLocal);
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

  // 今日状态分（readiness）：保留原算法，只用于页头下方的一行状态（分数 + 结论）
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

  const exerciseMinutes = data?.fitness.workoutMinutes ?? 0;

  // 饮水以 /api/wellbeing/hydration 为准（与饮食页同一数据源），加上乐观增量
  const waterMl = (hydration?.totalMl ?? data?.hydration?.totalMl ?? 0) + waterDelta;
  const waterTarget = hydration?.targetMl ?? data?.hydration?.targetMl ?? 2000;

  const recordDays = weekRows.filter((row) => row.entryCount > 0).length;
  const avgKcal = recordDays > 0 ? Math.round(weekRows.reduce((sum, row) => sum + row.kcal, 0) / recordDays) : 0;

  /** 近 7 天的柱图数据：value = 当日热量 / 目标热量（0–1），今天高亮 */
  const trendKeys = useMemo(() => lastSevenKeys(todayKey), [todayKey]);
  const trendMap = useMemo(() => {
    const map: Record<string, { entryCount: number; kcal: number }> = {};
    for (const row of weekRows) map[row.date] = row;
    return map;
  }, [weekRows]);
  const trendItems = useMemo(
    () =>
      trendKeys.map((key) => {
        const row = trendMap[key];
        const logged = (row?.entryCount ?? 0) > 0;
        return {
          label: weekdayShort(key),
          value: logged ? Math.min(1, (row?.kcal ?? 0) / Math.max(1, dietTarget)) : 0,
          highlight: key === todayKey,
        };
      }),
    [trendKeys, trendMap, dietTarget, todayKey]
  );

  const latestWeight = weightPoints.length > 0 ? weightPoints[weightPoints.length - 1].weightKg : null;
  const weightDelta =
    latestWeight !== null && weightPoints.length > 1
      ? Math.round((latestWeight - weightPoints[0].weightKg) * 10) / 10
      : null;

  /**
   * 就地补水：**先乐观更新**（点一下立刻看到数字与柱图/指标变化），
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

  /* 三态口径：有记录 → 数值；今天没记录 → 「—」；接口失败 → 保留上一次（不改 state） */
  const waterRecorded = waterMl > 0;
  const trainingRecorded = exerciseMinutes > 0;
  /**
   * 睡眠只认「昨晚」：起床日记在 date 上（今天或昨天），更早的存档不再显示，
   * 指标格回到「—」，免得几天后还挂着旧数字。
   */
  const sleepHours = isFreshSleepEntry(sleepEntry, todayKey, yesterdayKey) ? (sleepEntry?.hours ?? null) : null;
  const sleepRecorded = sleepHours !== null;

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="健康" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        ref={wellnessScrollRef}
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...control} />}
      >
        {/* ① 页头：eyebrow + 27px 标题 + 说明；今日状态（readiness）作为页头右下的一行 */}
        <View style={styles.headBlock}>
          <PageHead
            eyebrow="PERSONAL WORKSPACE"
            title="健康"
            subtitle="用轻量记录照顾状态，让学习与职业成长保持可持续。"
            style={styles.pageHead}
          />
          <View style={styles.statusRow}>
            <Text style={styles.statusHint} numberOfLines={1}>
              {readiness.weakest ? "今天最短板 · " + WEAKEST_LABEL[readiness.weakest] : readiness.verdict}
            </Text>
            <View
              style={styles.scoreChip}
              accessible
              accessibilityLabel={`今日状态 ${readiness.score} 分`}
            >
              <Text style={styles.scoreValue}>{readiness.score}</Text>
              <Text style={styles.scoreUnit}>分</Text>
            </View>
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

        {/* ② 指标带三格：饮水 / 训练 / 睡眠（有数据 → 数值；无记录 → 「—」；失败保留上次） */}
        <Animated.View entering={entrance(0)}>
          {loading && !data ? (
            <SkeletonCard count={1} />
          ) : (
            <MetricGrid
              items={[
                {
                  icon: "water-outline",
                  value: waterRecorded ? waterMl : NO_RECORD,
                  unit: waterRecorded ? "ml" : undefined,
                  label: "饮水",
                  tone: "teal",
                },
                {
                  icon: "barbell-outline",
                  value: trainingRecorded ? exerciseMinutes : NO_RECORD,
                  unit: trainingRecorded ? "min" : undefined,
                  label: "训练",
                  tone: "primary",
                },
                {
                  icon: "moon-outline",
                  value: sleepRecorded ? formatSleepHoursValue(sleepHours) : NO_RECORD,
                  unit: sleepRecorded ? "h" : undefined,
                  label: "睡眠",
                },
              ]}
            />
          )}
        </Animated.View>

        {/* ③ 今日动作 2×2：饮食记录 / 饮水 +250ml / 训练记录 / 睡眠 */}
        <SectionTitle title="今日动作" />
        <Animated.View style={styles.grid} entering={entrance(1)}>
          <View style={styles.gridItem}>
            <ActionCard
              icon="restaurant-outline"
              tone="accent"
              title="饮食记录"
              subtitle={dietMeta}
              actionLabel="记一餐"
              onAction={() => router.push("/nutrition" as never)}
            />
          </View>
          <View style={styles.gridItem}>
            <ActionCard
              icon="water-outline"
              tone="teal"
              title="饮水"
              subtitle={`${waterMl} / ${waterTarget} ml · 点一下 +250`}
              actionLabel="+250ml"
              onAction={() => void quickWater(250)}
            />
          </View>
          <View style={styles.gridItem}>
            <ActionCard
              icon="barbell-outline"
              tone="primary"
              title="训练记录"
              subtitle={workoutMeta}
              actionLabel="记训练"
              onAction={() => router.push("/workout" as never)}
            />
          </View>
          <View style={styles.gridItem}>
            <ActionCard
              icon="moon-outline"
              tone="success"
              title="睡眠"
              subtitle={
                sleepRecorded
                  ? `昨晚 ${formatSleepHours(sleepHours)} · 可修正`
                  : "读取系统健康数据，或手动记昨晚时长"
              }
              actionLabel={sleepRecorded ? "修正" : "记录"}
              onAction={() => setSleepSheetOpen(true)}
            />
          </View>
        </Animated.View>

        {/* ④ 本周趋势：7 天柱图（今日高亮）；没有任何记录时走空态，不画一条全 0 的图 */}
        <SectionTitle title="本周趋势" />
        <Animated.View entering={entrance(2)}>
          {loading && !data ? (
            <SkeletonCard count={1} />
          ) : recordDays > 0 ? (
            <Card style={styles.trendCard}>
              <View style={styles.trendHead}>
                <View style={styles.trendHeadText}>
                  <Text style={styles.trendValue}>{avgKcal}</Text>
                  <Text style={styles.trendCaption}>近 7 天日均 kcal</Text>
                </View>
                <Text style={styles.trendMeta}>{recordDays}/7 天有记录</Text>
              </View>
              <BarChart items={trendItems} height={96} />
              <Text style={styles.trendFoot}>柱高按每日目标 {dietTarget} kcal 计</Text>
            </Card>
          ) : summaryFailed ? (
            <Card style={styles.trendCard}>
              <EmptyState
                pattern="none"
                icon="cloud-offline-outline"
                title="本周趋势没加载出来"
                hint="网络似乎不太顺，点一下重试；其他卡片的数据照常显示。"
                actionLabel="重试"
                onAction={() => void load()}
              />
            </Card>
          ) : (
            <Card style={styles.trendCard}>
              <EmptyState
                pattern="none"
                icon="stats-chart-outline"
                title="本周还没有饮食记录"
                hint="记一餐之后，这里会按天画出热量柱图，今天会高亮显示。"
                actionLabel="去记一餐"
                onAction={() => router.push("/nutrition" as never)}
              />
            </Card>
          )}
        </Animated.View>

        {/* ⑤ 更多：习惯打卡 / 领域追踪 / 体重趋势 / 趋势分析 / 运动闪光卡（既有入口一个都不删） */}
        <SectionTitle title="更多" />
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
              onPress={() => router.push("/trackers" as never)}
            />
            <EntryCard
              size="row"
              icon="body-outline"
              tone="success"
              title="体重趋势"
              meta={weightMeta}
              onPress={() => router.push("/nutrition" as never)}
            />
            <EntryCard
              size="row"
              icon="stats-chart-outline"
              tone="teal"
              title="趋势分析"
              meta={
                recordDays > 0
                  ? `近 7 天饮食记录 ${recordDays} 天 · 均 ${avgKcal} kcal · 训练负荷一屏看`
                  : "饮食热量 · 运动时长 · 训练负荷，全屏一起看"
              }
              onPress={() => router.push("/trends" as never)}
            />
            <EntryCard
              size="row"
              icon="sparkles-outline"
              tone="warning"
              title="运动闪光卡"
              meta="战绩 · 装备 · 绝技，实时镭射卡面"
              last
              onPress={() => router.push("/sports-card" as never)}
            />
          </ListGroup>
        </Animated.View>
      </Animated.ScrollView>

      {/* 睡眠记录弹层（v2.0.1）：自动读系统健康数据，失败即降级手动输入 */}
      <SleepSheet
        visible={sleepSheetOpen}
        todayKey={todayKey}
        entry={sleepEntry}
        onClose={() => setSleepSheetOpen(false)}
        onSaved={setSleepEntry}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },

    /* 页头 + 今日状态行 */
    headBlock: { gap: 10 },
    pageHead: { marginBottom: 0 },
    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    statusHint: { flex: 1, minWidth: 0, ...typography.meta, color: colors.textMuted },
    scoreChip: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 2,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },
    scoreValue: { ...typography.num, color: colors.primary },
    scoreUnit: { ...typography.caption, color: colors.primary },

    /* 错误态 */
    errorBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    errorText: { flex: 1, ...typography.caption, fontWeight: "600", color: colors.danger },

    /* 今日动作 2×2（外层定宽，ActionCard 自身 flex:1 只负责填满格子） */
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    gridItem: { width: "47.5%" },

    /* 本周趋势 */
    trendCard: { gap: spacing.md },
    trendHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.sm },
    trendHeadText: { flex: 1, minWidth: 0 },
    trendValue: { ...typography.hero, ...tabularNums, color: colors.text },
    trendCaption: { ...typography.meta, color: colors.textMuted },
    trendMeta: { ...typography.meta, color: colors.textFaint },
    trendFoot: { ...typography.meta, color: colors.textFaint },
  });
