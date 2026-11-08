import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import Animated from "react-native-reanimated";
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderStickyBar, useHeaderTopInset, useLargeTitleHeader } from "@/components/screen-header";
import { PageHead } from "@/components/v2/page-head";
import { SectionTitle } from "@/components/v2/section-title";
import { BarChart } from "@/components/v2/bar-chart";
import { ActivityRings, AreaChart, StatTileRow, type StatTileProps, type StatTone } from "@/components/v2/charts";
import { ProgressBar } from "@/components/v2/progress-bar";
import { Surface } from "@/components/surface";
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
import {
  INITIAL_FIRST_LOAD_GATE,
  nextFirstLoadGate,
  shouldShowSkeleton,
} from "@/lib/first-load";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { haptics } from "@/lib/haptics";
import { getApiUrl } from "@/config";
import {
  addHydration,
  fetchHydration,
  fetchNutritionTarget,
  fetchWeight,
  type HydrationToday,
  type NutritionTargetDto,
  type WeightPointDto,
} from "@/lib/wellbeing-client";
import {
  groupThousands,
  toDaySummaryMap,
  todayAndYesterday,
  type DaySummaryRow,
} from "@/lib/nutrition-views";
import { buildWeekReport, type WeekTile } from "@/lib/wellness-week";
import { sleepApi, type SleepNight } from "@/lib/sleep-api";
import { clamp01 } from "@/lib/chart-math";
import { fromDateKey, toDateKey } from "@learn-workbench/shared/dates";

interface DailyOs {
  learning: { tasksTotal: number; tasksDone: number; focusMinutes: number };
  fitness: {
    workoutName: string | null;
    workoutMinutes: number;
    nutritionKcal: number;
    nutritionTargetKcal: number;
    nutritionRemainingKcal?: number;
    /** 今日饮食明细（最近 5 条；v3 M11 深化，含记录时刻用于「最近一餐」） */
    nutritionEntries?: {
      id: number;
      name: string;
      meal: "breakfast" | "lunch" | "dinner" | "snack";
      kcal: number;
      createdAt?: string;
    }[];
  };
  hydration?: { totalMl: number; targetMl: number };
  habits: { scheduled: number; done: number };
}

/** /api/workouts 响应里本页要用到的字段（完整 Workout 类型在 shared，这里只读不用） */
interface WorkoutLite {
  name?: unknown;
  exercisedOn?: unknown;
  durationSeconds?: unknown;
  items?: unknown;
}

/** 训练默认目标（分钟）：只用于「运动」环与图例的分母，口径与旧版 exerciseTarget 一致 */
const EXERCISE_TARGET_MIN = 30;

/** 无记录的统一占位（三态里的「无记录」档，与空态文案共用） */
const NO_RECORD = "—";

/** 「最近一餐」的餐次中文名（与后端 meal_entries.meal 枚举一一对应） */
const MEAL_LABELS: Record<"breakfast" | "lunch" | "dinner" | "snack", string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
};

/** 周柱图的星期标签：周一 → 周日（与饮食页 WEEK_TILE_LABELS 同序） */
const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"] as const;

/**
 * 以 todayKey 为终点的 7 个**本地**日期键（today-6 … today）。
 * 与 /api/nutrition/summary?days=7 的窗口完全一致 —— 后端也是「以今天为终点往前 7 天」，
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

/** 保留一位小数（体重 / 变化量） */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** ISO 时刻 → 本地 HH:mm（脏数据返回 null，不抛异常） */
function clockText(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

/** 日期键 → 「11 月 8 日」 */
function monthDayLabel(key: string): string {
  const d = fromDateKey(key);
  return d.getMonth() + 1 + " 月 " + d.getDate() + " 日";
}

/** lib 只给展示串；图标与语义色调由页面决定 */
function weekTile(tile: WeekTile, icon: StatTileProps["icon"], tone: StatTone): StatTileProps {
  return { label: tile.label, value: tile.value, unit: tile.unit, hint: tile.hint, icon, tone };
}

/** 页内记录行（饮水 / 饮食 / 训练）：整行可点，图标芯片 + 标题 + 副文案 + 右侧数值 + 箭头 */
function RecordRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  value,
  last = false,
  accessibilityLabel,
  onPress,
}: {
  icon: ComponentProps<typeof ThemedIcon>["name"];
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  value: string;
  last?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      haptic
      scaleTo={1}
      pressedStyle={styles.recordPressed}
      onPress={onPress}
      hitSlop={6}
      style={styles.recordRow}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: false }}
    >
      <View style={[styles.recordIcon, { backgroundColor: iconBg }]}>
        <ThemedIcon name={icon} size={17} color={iconColor} />
      </View>
      <View style={styles.recordBody}>
        <Text style={styles.recordTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.recordSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={[styles.recordValue, tabularNums]} numberOfLines={1}>
        {value}
      </Text>
      <ThemedIcon name="chevron-forward" size={15} color={colors.textFaint} />
      {last ? null : <View pointerEvents="none" style={styles.recordDivider} />}
    </PressableScale>
  );
}

/** 快捷记录胶囊（就地饮水 / 睡眠详情）：保留旧版的两个动作入口 */
function QuickPill({
  icon,
  label,
  accessibilityLabel,
  disabled = false,
  onPress,
}: {
  icon: ComponentProps<typeof ThemedIcon>["name"];
  label: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      haptic
      scaleTo={0.97}
      pressedStyle={styles.quickPillPressed}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={styles.quickPill}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, busy: disabled }}
    >
      <ThemedIcon name={icon} size={15} color={colors.primary} />
      <Text style={styles.quickPillText} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** 三大营养素一行：标签 + 进度条 + 「已摄入 / 目标」；缺数据一律「—」，不编造 0 */
function MacroRow({
  label,
  tone,
  value,
  target,
  unit,
}: {
  label: string;
  tone: "primary" | "success" | "accent";
  value: number | null;
  target: number | null;
  unit: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ratio = value !== null && target !== null && target > 0 ? clamp01(value / target) : 0;
  const valueText =
    value === null
      ? NO_RECORD
      : target !== null && target > 0
        ? Math.round(value) + " / " + Math.round(target) + unit
        : Math.round(value) + unit;
  return (
    <View style={styles.macroRow}>
      <Text style={styles.macroLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.macroTrack}>
        <ProgressBar value={ratio} tone={tone} height={6} />
      </View>
      <Text style={[styles.macroValue, tabularNums]} numberOfLines={1}>
        {valueText}
      </Text>
    </View>
  );
}

/**
 * 健康 Hub（v3 浅色科技风重排 · 对齐《移动端 UI 优化提案》健康页）
 *
 * 结构：① PageHead（eyebrow「Health · 每日状态」+ 标题「健康」+ 今天状态副文案）+ readiness 一行
 *      → ② 三环活动卡（运动 / 饮水 / 饮食 完成度 + 中心今日完成百分比 + 右侧数值图例）
 *      → ③ 饮食摄入卡（最近一餐 / 今日摄入 ÷ 目标 / 蛋白·碳水·脂肪三条）
 *      → ④ 体重卡（今晨或最近体重 + 本周变化 + 近七日 sparkline）
 *      → ⑤ 训练卡（今日训练 + 记录按钮 + 全部记录入口）
 *      → ⑥ 今日记录三行（饮水 / 饮食 / 训练，点进对应页面）+ 快捷记录胶囊（+250ml / 睡眠）
 *      → ⑦ 本周趋势（7 天热量柱图）+ 本周健康周报（四格指标）+ 更多（习惯/领域/体重/趋势/闪光卡）
 *
 * 数据口径与交互完全沿用改造前：/api/daily、/api/wellbeing/hydration、/api/wellbeing/weight、
 * /api/workouts、/api/nutrition/summary、/api/nutrition/target 六路并行拉取（各自独立降级、互不拖垮）
 * + useFocusRefresh / 下拉刷新 + 饮水乐观增量（先 +250 再写服务端，失败回滚并提示）。
 * 缺失数据一律「—」（不把"没记录"当 0）；聚合接口失败保留上次数据并给「重试」条。
 *
 * 与 demo 的差异（如实标注）：demo 三环为「运动 / 站立 / 活动」，App 没有站立与活动热量的数据源，
 * 这里改用同样真实可得的「运动 / 饮水 / 饮食」三项每日达成率，中心百分比 = 三项平均；
 * 训练卡 demo 是照片实景卡，仓库里没有对应训练实景图，改用主色软底卡（不新增图片资源）。
 * 睡眠入口保留在「快捷记录」胶囊与本周周报里；详情仍走独立页 /sleep。
 * 动效只沿用 useScreenEntrance 入场错峰与既有 PressableScale 按压（不新增动效点）。
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
  /**
   * v2.2.2：骨架屏闸门（lib/first-load）。首轮请求结束即落定，之后聚焦刷新 / 下拉刷新
   * 只换数据、不再把骨架屏放回来 —— 页面已有内容时永远不会被骨架屏顶掉。
   */
  const [gate, setGate] = useState(INITIAL_FIRST_LOAD_GATE);
  const showSkeleton = shouldShowSkeleton(gate);
  const [weightPoints, setWeightPoints] = useState<WeightPointDto[]>([]);
  const [weekWorkouts, setWeekWorkouts] = useState(0);
  /** 今日训练（来自 /api/workouts?days=7 里 exercised_on = 今天的那条；名称之外还能给动作数） */
  const [todayWorkout, setTodayWorkout] = useState<{ name: string; minutes: number; actions: number } | null>(null);
  /** 近 7 天逐日饮食行（带日期与三大营养素，供柱图逐日对上 + 今日宏量条） */
  const [weekRows, setWeekRows] = useState<DaySummaryRow[]>([]);
  /** 今日饮食目标（/api/nutrition/target；宏观目标蛋白/碳水/脂肪也在这里） */
  const [nutritionTarget, setNutritionTarget] = useState<NutritionTargetDto | null>(null);
  const { today: todayKey } = useMemo(() => todayAndYesterday(), []);
  /** 饮水与饮食改为「与饮食页同源」的两路数据（饮食页也是这两个接口） */
  const [hydration, setHydration] = useState<HydrationToday | null>(null);
  /** 今日饮食汇总行（summary 里今天那行；没有记录 = null，不把"没吃"当 0） */
  const [todaySummary, setTodaySummary] = useState<DaySummaryRow | null>(null);
  /** 聚合接口失败时的显式状态（不再静默显示 0） */
  const [dailyFailed, setDailyFailed] = useState(false);
  /** 饮食趋势接口失败：与「本周没记录」区分开，空态里给重试而不是假空 */
  const [summaryFailed, setSummaryFailed] = useState(false);
  /** 正在补水的乐观增量（ml） */
  const [waterDelta, setWaterDelta] = useState(0);
  /** 补水写请求进行中：按钮置 busy，避免连点造成重复记录 */
  const [waterBusy, setWaterBusy] = useState(false);
  /** 最近一晚睡眠（v2.3）：快捷记录胶囊与本周周报都读它，详情统一去 /sleep */
  const [sleepNights, setSleepNights] = useState<SleepNight[]>([]);
  /**
   * v2.2 周报：近 7 天逐日饮水（最后一项=今天，由主请求的 hydration 填）。
   * 过去 6 天的记录只受「历史日期 + 登录态」影响，同一天内不会变 —— 用 ref 缓存，
   * 避免每次聚焦刷新都多打 6 个 GET（仍是同一个 /api/wellbeing/hydration?date=，不新增接口）。
   */
  const [waterByDay, setWaterByDay] = useState<(number | null)[]>([]);
  const [workoutsFailed, setWorkoutsFailed] = useState(false);
  const weekWaterCache = useRef<{ key: string; days: (number | null)[] } | null>(null);

  const load = useCallback(async () => {
    const headers: Record<string, string> = token ? { Authorization: "Bearer " + token } : {};
    try {
      // 周报的近 6 天饮水：同一日期窗口 + 同一登录态下结果不会变，命中 ref 就不再请求
      const pastKeys = lastSevenKeys(todayKey).slice(0, 6);
      const weekCacheKey = (token ? "u:" : "a:") + pastKeys.join(",");
      const cachedWeek = weekWaterCache.current?.key === weekCacheKey ? weekWaterCache.current.days : null;
      const weekWaterPromise = (async (): Promise<(number | null)[]> => {
        if (cachedWeek) return cachedWeek;
        const days = await Promise.all(
          pastKeys.map((key) =>
            fetchHydration(token, key)
              .then((item) => Math.max(0, Math.round(item.totalMl)))
              .catch(() => null)
          )
        );
        // 全部拿到才缓存：有失败的日子下次聚焦会重试
        if (days.every((value) => value !== null)) weekWaterCache.current = { key: weekCacheKey, days };
        return days;
      })();
      const [dailyRes, weightRes, workoutRes, summaryRes, hydrationRes, targetRes, sleepLocal, weekWater] =
        await Promise.all([
          fetch(getApiUrl() + "/api/daily?date=" + todayKey, { headers }),
          fetchWeight(token, 30).catch(() => null),
          fetch(getApiUrl() + "/api/workouts?days=7", { headers }).catch(() => null),
          fetch(getApiUrl() + "/api/nutrition/summary?days=7", { headers }).catch(() => null),
          fetchHydration(token).catch(() => null),
          // 饮食目标（含蛋白/碳水/脂肪目标）：与 summary 同源，失败只影响宏量条，不影响其它卡片
          fetchNutritionTarget(token).catch(() => null),
          // 睡眠是本机多晚记录（lib/sleep-api）：与六路远端请求并行，单读失败不影响其它数据
          sleepApi.loadSleepNights().catch(() => [] as SleepNight[]),
          // 周报饮水（过去 6 天）：复用同一个 /api/wellbeing/hydration?date=，失败按 null 参与降级
          weekWaterPromise,
        ]);
      if (dailyRes.ok) {
        setData(await dailyRes.json());
        setDailyFailed(false);
        setGate((g) => nextFirstLoadGate(g, { type: "load-success" }));
      } else {
        // 401/500 不再静默：页面给「重试」入口，同时保留上一次数据
        setDailyFailed(true);
        // 首轮就失败 → 闸门落定（页面走自己的降级 / 重试条，不再用骨架屏占位）
        setGate((g) => nextFirstLoadGate(g, { type: "load-failure" }));
      }
      if (weightRes) setWeightPoints(weightRes.points);
      if (workoutRes && workoutRes.ok) {
        const d = await workoutRes.json();
        const list: WorkoutLite[] = Array.isArray(d?.workouts) ? (d.workouts as WorkoutLite[]) : [];
        setWeekWorkouts(list.length);
        let todays: WorkoutLite | null = null;
        for (const item of list) {
          const day = typeof item?.exercisedOn === "string" ? item.exercisedOn.slice(0, 10) : "";
          if (day === todayKey) {
            todays = item;
            break;
          }
        }
        setTodayWorkout(
          todays
            ? {
                name:
                  typeof todays.name === "string" && todays.name.trim().length > 0
                    ? todays.name.trim()
                    : "训练",
                minutes: Math.max(0, Math.round(Number(todays.durationSeconds) / 60) || 0),
                actions: Array.isArray(todays.items) ? todays.items.length : 0,
              }
            : null
        );
        setWorkoutsFailed(false);
      } else {
        // 训练接口失败：周报显示「—」，不能用假的 0 次冒充
        setWorkoutsFailed(true);
      }
      if (summaryRes && summaryRes.ok) {
        const d = await summaryRes.json();
        // 后端返回的是数组（逐日行），统一用 toDaySummaryMap 解析（含蛋白/碳水/脂肪）
        const map = toDaySummaryMap(d.summary);
        const rows = Object.values(map).sort((a, b) => (a.date < b.date ? -1 : 1));
        setWeekRows(rows);
        setTodaySummary(map[todayKey] ?? null);
        setSummaryFailed(false);
      } else {
        // 单独降级：饮食趋势失败只影响「本周趋势」，别把页头/卡片一起打挂
        setSummaryFailed(true);
      }
      if (targetRes) setNutritionTarget(targetRes.target);
      if (hydrationRes) {
        setHydration(hydrationRes);
        setWaterDelta(0); // 拉回来的即真值，清掉乐观增量
      }
      // 周报逐日饮水：过去 6 天 + 今天（今天复用同一次 hydration 请求，不再多打一次）
      setWaterByDay([
        ...weekWater,
        hydrationRes ? Math.max(0, Math.round(hydrationRes.totalMl)) : null,
      ]);
      setSleepNights(Array.isArray(sleepLocal) ? sleepLocal : []);
    } catch {
      // 离线保留上次数据，但标记失败让页面提示
      setDailyFailed(true);
      setGate((g) => nextFirstLoadGate(g, { type: "load-failure" }));
    } finally {
      // 兜底落定：任何异常路径都不允许让骨架屏永远留在屏幕上（已落定时这里是幂等的）
      setGate((g) => nextFirstLoadGate(g, { type: "load-failure" }));
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
  const mealCount = dietEntries.length;
  const lastMeal = mealCount > 0 ? dietEntries[0] : null;
  const mealClock = clockText(lastMeal?.createdAt);

  /** 今日摄入：优先 summary 里今天那行（饮食页同源）；summary 失败时退回 daily 聚合值；无记录 = null */
  const dietKcal = !summaryFailed
    ? (todaySummary?.kcal ?? null)
    : mealCount > 0
      ? (data?.fitness.nutritionKcal ?? null)
      : null;
  /** 目标来源（可能是 null）：显示层缺省「—」，计算层再给 2000 兜底 */
  const dietTargetSource = nutritionTarget?.kcal ?? data?.fitness.nutritionTargetKcal ?? null;
  const dietTarget =
    dietTargetSource !== null && Number.isFinite(dietTargetSource) && dietTargetSource > 0
      ? Math.round(dietTargetSource)
      : 2000;

  const exerciseMinutes = todayWorkout?.minutes ?? data?.fitness.workoutMinutes ?? 0;
  const trainingRecorded = exerciseMinutes > 0;
  const trainingName = todayWorkout?.name ?? data?.fitness.workoutName ?? null;
  const trainingActions = todayWorkout?.actions ?? 0;

  // 饮水以 /api/wellbeing/hydration 为准（与饮食页同一数据源），加上乐观增量
  const waterMl = (hydration?.totalMl ?? data?.hydration?.totalMl ?? 0) + waterDelta;
  const waterTarget = hydration?.targetMl ?? data?.hydration?.targetMl ?? 2000;
  const waterRecorded = waterMl > 0;

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

  /* ---------- 体重：今晨 / 本周变化 / 近七日 sparkline ---------- */
  const latestWeight = weightPoints.length > 0 ? weightPoints[weightPoints.length - 1] : null;
  const todayWeight = weightPoints.find((point) => point.date === todayKey) ?? null;
  const weightValue = todayWeight ?? latestWeight;
  const weightKicker = todayWeight ? "体重 · 今晨" : "体重 · 最近";
  const weekKeySet = useMemo(() => new Set(lastSevenKeys(todayKey)), [todayKey]);
  const weekWeightPoints = useMemo(
    () => weightPoints.filter((point) => weekKeySet.has(point.date)),
    [weightPoints, weekKeySet]
  );
  const weekWeightDelta =
    weekWeightPoints.length >= 2
      ? round1(weekWeightPoints[weekWeightPoints.length - 1].weightKg - weekWeightPoints[0].weightKg)
      : null;
  const weightSpark = useMemo(() => weekWeightPoints.map((point) => point.weightKg), [weekWeightPoints]);
  const weightSparkMin = weightSpark.length > 0 ? Math.min(...weightSpark) - 0.3 : 0;
  const weightSparkMax = weightSpark.length > 0 ? Math.max(...weightSpark) + 0.3 : 1;
  const weightDelta30 =
    latestWeight !== null && weightPoints.length > 1
      ? round1(latestWeight.weightKg - weightPoints[0].weightKg)
      : null;
  const weightMeta =
    latestWeight === null
      ? "还没有体重记录"
      : weightDelta30 === null
        ? latestWeight.weightKg + " kg · 近 30 天暂无对比"
        : weightDelta30 === 0
          ? latestWeight.weightKg + " kg · 近 30 天持平"
          : latestWeight.weightKg +
            " kg · 近 30 天 " +
            (weightDelta30 > 0 ? "+" : "") +
            weightDelta30 +
            " kg";

  /* ---------- 睡眠：最近一晚（本机多晚记录，取最新一晚） ---------- */
  const latestSleep = sleepNights.length > 0 ? sleepNights[0] : null;
  const sleepHours = latestSleep ? latestSleep.durationMin / 60 : null;
  const sleepRecorded = latestSleep !== null;
  const sleepPillLabel = sleepHours === null ? "记录睡眠" : "睡眠 " + sleepHours.toFixed(1) + " h";

  /**
   * v2.2 本周健康周报：把页面已经拉到的四路数据（饮水逐日 / 训练次数 / 本机睡眠 / 饮食逐日）
   * 折成「四格指标」。缺项一律「—」，不新增接口、不编造 0。
   */
  const weekReport = useMemo(
    () =>
      buildWeekReport({
        waterByDay,
        waterTargetMl: waterTarget,
        workoutCount: workoutsFailed ? null : weekWorkouts,
        sleepHours,
        kcalRows: weekRows,
        kcalTarget: dietTarget,
        kcalAvailable: !summaryFailed,
      }),
    [waterByDay, waterTarget, workoutsFailed, weekWorkouts, sleepHours, weekRows, dietTarget, summaryFailed]
  );

  /* ---------- 三环活动卡：运动 / 饮水 / 饮食（全部真实数据，缺项环画空、图例「—」） ---------- */
  const moveRatio = data !== null ? clamp01(exerciseMinutes / EXERCISE_TARGET_MIN) : null;
  const waterRatio = waterRecorded && waterTarget > 0 ? clamp01(waterMl / waterTarget) : null;
  const dietRatio =
    dietKcal !== null && dietTargetSource !== null && dietTarget > 0 ? clamp01(dietKcal / dietTarget) : null;
  const ringRatios = [moveRatio, waterRatio, dietRatio].filter((value): value is number => value !== null);
  const ringPercent =
    ringRatios.length > 0
      ? Math.round((ringRatios.reduce((sum, value) => sum + value, 0) / ringRatios.length) * 100)
      : null;
  const moveLabel = data !== null ? exerciseMinutes + " / " + EXERCISE_TARGET_MIN + " 分" : NO_RECORD;
  const waterLabel =
    waterRecorded ? (waterMl / 1000).toFixed(1) + " / " + (waterTarget / 1000).toFixed(1) + " L" : NO_RECORD;
  const dietLabel =
    dietKcal !== null
      ? groupThousands(dietKcal) + " / " + (dietTargetSource ? groupThousands(dietTarget) : NO_RECORD) + " 千卡"
      : NO_RECORD;
  const ringItems = [
    {
      key: "move",
      label: "运动",
      value: moveRatio ?? 0,
      valueLabel: moveLabel,
      color: colors.primary,
      targetText: "/ " + EXERCISE_TARGET_MIN + " 分",
      valueText: data !== null ? String(exerciseMinutes) : NO_RECORD,
    },
    {
      key: "water",
      label: "饮水",
      value: waterRatio ?? 0,
      valueLabel: waterLabel,
      color: colors.chart[2],
      targetText: "/ " + (waterTarget / 1000).toFixed(1) + " L",
      valueText: waterRecorded ? (waterMl / 1000).toFixed(1) : NO_RECORD,
    },
    {
      key: "diet",
      label: "饮食",
      value: dietRatio ?? 0,
      valueLabel: dietLabel,
      color: colors.success,
      targetText: dietTargetSource ? "/ " + groupThousands(dietTarget) + " 千卡" : "/ " + NO_RECORD + " 千卡",
      valueText: dietKcal !== null ? groupThousands(dietKcal) : NO_RECORD,
    },
  ];

  /* ---------- 页头副文案（有数据才写具体数字，没有就通用一句） ---------- */
  const headerSubtitle = data
    ? [
        "今天已运动 " + exerciseMinutes + " 分钟",
        dietKcal !== null ? "摄入 " + groupThousands(dietKcal) + " 千卡" : "还没有饮食记录",
        trainingRecorded ? "今天已经练过了" : "还差一次训练",
      ].join("，") + "。"
    : "运动、饮食与体重，今天的状态在一处看全。";

  /**
   * 就地补水：先乐观更新（点一下立刻看到数字与图例变化），
   * 再写服务端；失败则回滚并明确提示（旧版静默 catch，用户看到的就是"点了没反应"）。
   */
  const quickWater = async (ml: number) => {
    if (waterBusy) return;
    haptics.light();
    setWaterBusy(true);
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
    } finally {
      setWaterBusy(false);
    }
  };

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
        {/* ① 页头：eyebrow + 27px 标题 + 今天状态副文案；readiness 作为页头右下的一行 */}
        <View style={styles.headBlock}>
          <PageHead
            eyebrow="HEALTH · 每日状态"
            title="健康"
            subtitle={headerSubtitle}
            style={styles.pageHead}
          />
          <View style={styles.statusRow}>
            <Text style={styles.statusHint} numberOfLines={1}>
              {readiness.weakest ? "今天最短板 · " + WEAKEST_LABEL[readiness.weakest] : readiness.verdict}
            </Text>
            <View style={styles.scoreChip} accessible accessibilityLabel={"今日状态 " + readiness.score + " 分"}>
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
            hitSlop={4}
            style={styles.errorBar}
            accessibilityRole="button"
            accessibilityLabel="重试加载健康数据"
            accessibilityState={{ disabled: false }}
            onPress={() => void load()}
          >
            <ThemedIcon name="cloud-offline-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>
              {data ? "刚才的数据没刷新成功，点这里重试" : "健康数据没加载出来，点这里重试"}
            </Text>
            <ThemedIcon name="refresh" size={16} color={colors.danger} />
          </PressableScale>
        ) : null}

        {/* ② 三环活动卡：运动 / 饮水 / 饮食 + 中心今日完成百分比 + 右侧图例 */}
        <Animated.View entering={entrance(0)}>
          {showSkeleton ? (
            <SkeletonCard count={1} />
          ) : (
            <Surface tier="surface" corner={radius.panel} padded={false} style={styles.ringsCard}>
              <View style={styles.ringsRow}>
                <View style={styles.ringWrap}>
                  <ActivityRings rings={ringItems} size={124} thickness={9} gap={4} legend={false} title={null} />
                  <View pointerEvents="none" style={styles.ringCenter}>
                    <Text
                      style={[styles.ringPercent, tabularNums]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {ringPercent === null ? NO_RECORD : ringPercent + "%"}
                    </Text>
                    <Text style={styles.ringCenterLabel}>今日完成</Text>
                  </View>
                </View>
                <View style={styles.legend}>
                  {ringItems.map((item) => (
                    <View key={item.key} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text style={[styles.legendValue, tabularNums]} numberOfLines={1}>
                        {item.valueText}
                      </Text>
                      <Text style={styles.legendTarget} numberOfLines={1}>
                        {item.targetText}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </Surface>
          )}
        </Animated.View>

        {/* ③ 饮食摄入卡：最近一餐 / 今日摄入 ÷ 目标 / 三大宏量条（整卡点进饮食页） */}
        <Animated.View entering={entrance(1)}>
          <PressableScale
            haptic
            scaleTo={0.99}
            hitSlop={4}
            style={styles.pressWrap}
            accessibilityRole="button"
            accessibilityLabel={
              "饮食记录，" +
              (dietKcal !== null ? "今日摄入 " + groupThousands(dietKcal) + " 千卡" : "今日还没有记录") +
              "，打开饮食页"
            }
            accessibilityState={{ disabled: false }}
            onPress={() => router.push("/nutrition" as never)}
          >
            <Surface tier="surface" corner={radius.card} padded={false} style={styles.dietCard}>
              <View style={styles.mealTop}>
                <View style={styles.mealThumb}>
                  <ThemedIcon name="restaurant-outline" size={22} color={colors.accentStrong} />
                </View>
                <View style={styles.mealBody}>
                  <Text style={styles.mealKicker} numberOfLines={1}>
                    {lastMeal
                      ? (mealClock ? mealClock + " · " : "") + MEAL_LABELS[lastMeal.meal]
                      : "最近一餐"}
                  </Text>
                  <Text style={styles.mealTitle} numberOfLines={1}>
                    {lastMeal ? lastMeal.name : "还没有饮食记录"}
                  </Text>
                  <Text style={styles.mealMeta} numberOfLines={1}>
                    {lastMeal ? "点开查看并补记今天的饮食" : "点一下去记今天第一餐"}
                  </Text>
                </View>
                <View style={styles.mealKcal}>
                  <Text style={[styles.mealKcalValue, tabularNums]} numberOfLines={1}>
                    {lastMeal ? String(lastMeal.kcal) : NO_RECORD}
                  </Text>
                  <Text style={styles.mealKcalUnit}>千卡</Text>
                </View>
              </View>

              <View style={styles.dietTotal}>
                <Text style={styles.dietTotalLabel}>今日摄入 / 目标</Text>
                <Text style={[styles.dietTotalValue, tabularNums]} numberOfLines={1}>
                  {dietKcal !== null ? groupThousands(dietKcal) : NO_RECORD}
                  <Text style={styles.dietTotalTarget}>
                    {dietTargetSource ? " / " + groupThousands(dietTarget) + " 千卡" : " / " + NO_RECORD + " 千卡"}
                  </Text>
                </Text>
              </View>

              <View style={styles.macros}>
                <MacroRow
                  label="蛋白"
                  tone="primary"
                  value={todaySummary?.proteinG ?? null}
                  target={nutritionTarget?.proteinG ?? null}
                  unit="g"
                />
                <MacroRow
                  label="碳水"
                  tone="success"
                  value={todaySummary?.carbsG ?? null}
                  target={nutritionTarget?.carbsG ?? null}
                  unit="g"
                />
                <MacroRow
                  label="脂肪"
                  tone="accent"
                  value={todaySummary?.fatG ?? null}
                  target={nutritionTarget?.fatG ?? null}
                  unit="g"
                />
              </View>
            </Surface>
          </PressableScale>
        </Animated.View>

        {/* ④ 体重卡：今晨（或最近一次）+ 本周变化 + 近七日 sparkline */}
        <Animated.View entering={entrance(2)}>
          <Surface tier="surface" corner={radius.card} padded={false} style={styles.weightCard}>
            <View style={styles.weightBody}>
              <Text style={styles.weightKicker}>{weightKicker}</Text>
              <Text style={[styles.weightValue, tabularNums]} numberOfLines={1}>
                {weightValue ? weightValue.weightKg.toFixed(1) : NO_RECORD}
                <Text style={styles.weightUnit}> kg</Text>
              </Text>
              <Text
                style={[
                  styles.weightDelta,
                  weekWeightDelta === null
                    ? styles.weightDeltaMuted
                    : weekWeightDelta < 0
                      ? styles.weightDeltaDown
                      : weekWeightDelta > 0
                        ? styles.weightDeltaUp
                        : styles.weightDeltaMuted,
                ]}
                numberOfLines={1}
              >
                {weekWeightDelta === null
                  ? "本周变化 " + NO_RECORD
                  : weekWeightDelta === 0
                    ? "本周持平"
                    : "本周 " + (weekWeightDelta > 0 ? "+" : "−") + Math.abs(weekWeightDelta) + " kg"}
              </Text>
              <Text style={styles.weightHint} numberOfLines={1}>
                {weightValue ? "记录于 " + monthDayLabel(weightValue.date) : "记录第一次体重，之后能看趋势"}
              </Text>
            </View>
            <View
              style={styles.weightSpark}
              accessible
              accessibilityLabel={
                "近七日体重 " + (weightSpark.length > 0 ? weightSpark.join("、") : NO_RECORD)
              }
            >
              {weightSpark.length >= 2 ? (
                <AreaChart
                  series={[{ values: weightSpark }]}
                  height={56}
                  min={weightSparkMin}
                  max={weightSparkMax}
                  showEndDot
                  legend={false}
                />
              ) : (
                <Text style={styles.weightSparkEmpty}>{NO_RECORD}</Text>
              )}
            </View>
          </Surface>
        </Animated.View>

        {/* ⑤ 训练卡：今日训练 + 记录训练按钮 + 全部训练记录入口 */}
        <Animated.View entering={entrance(3)}>
          <Surface tier="surface" corner={radius.card} padded={false} style={styles.trainCard}>
            <View style={styles.trainHead}>
              <View style={styles.trainIcon}>
                <ThemedIcon name="barbell-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.trainBody}>
                <Text style={styles.trainKicker}>今日训练</Text>
                <Text style={styles.trainTitle} numberOfLines={1}>
                  {trainingName ?? "还没有训练记录"}
                </Text>
                <Text style={styles.trainMeta} numberOfLines={1}>
                  {trainingRecorded
                    ? exerciseMinutes +
                      " 分钟" +
                      (trainingActions > 0 ? " · " + trainingActions + " 个动作" : "") +
                      " · 本周 " +
                      (workoutsFailed ? NO_RECORD : weekWorkouts) +
                      " 次"
                    : "记录一次训练，今天的状态会更完整"}
                </Text>
              </View>
              <PressableScale
                haptic
                scaleTo={0.94}
                hitSlop={10}
                onPress={() => router.push("/workout-add" as never)}
                style={styles.trainGo}
                accessibilityRole="button"
                accessibilityLabel={trainingRecorded ? "再记录一次训练" : "记录今天的训练"}
                accessibilityState={{ disabled: false }}
              >
                <ThemedIcon name="play" size={15} color={colors.canvas} />
              </PressableScale>
            </View>
            <View style={styles.trainFoot}>
              <Text style={styles.trainFootText}>
                {"训练记录 · 本周 " + (workoutsFailed ? NO_RECORD : weekWorkouts) + " 次"}
              </Text>
              <Pressable
                hitSlop={10}
                onPress={() => router.push("/workout" as never)}
                style={styles.trainLink}
                accessibilityRole="button"
                accessibilityLabel="查看全部训练记录"
                accessibilityState={{ disabled: false }}
              >
                <Text style={styles.trainLinkText}>全部记录</Text>
                <ThemedIcon name="chevron-forward" size={12} color={colors.primary} />
              </Pressable>
            </View>
          </Surface>
        </Animated.View>

        {/* ⑥ 今日记录三行：饮水 / 饮食 / 训练，点进对应页面 */}
        <SectionTitle title="今日记录" right={<Text style={styles.sectionMeta}>共 3 条</Text>} />
        <Animated.View entering={entrance(4)}>
          <ListGroup>
            <RecordRow
              icon="water-outline"
              iconColor={colors.teal}
              iconBg={colors.surfaceMuted}
              title="饮水"
              subtitle={"目标 " + (waterTarget / 1000).toFixed(1) + " L"}
              value={waterRecorded ? (waterMl / 1000).toFixed(1) + " L" : NO_RECORD}
              accessibilityLabel={
                "饮水 " + (waterRecorded ? (waterMl / 1000).toFixed(1) + " 升" : "无记录") + "，打开饮食页的饮水记录"
              }
              onPress={() => router.push("/nutrition" as never)}
            />
            <RecordRow
              icon="restaurant-outline"
              iconColor={colors.accentStrong}
              iconBg={colors.accentSoft}
              title="饮食"
              subtitle={
                summaryFailed
                  ? "饮食汇总没加载出来"
                  : mealCount > 0
                    ? "最近记录 " + mealCount + " 条"
                    : "今天还没有记录"
              }
              value={dietKcal !== null ? groupThousands(dietKcal) + " 千卡" : NO_RECORD}
              accessibilityLabel={
                "饮食 " + (dietKcal !== null ? groupThousands(dietKcal) + " 千卡" : "无记录") + "，打开饮食记录"
              }
              onPress={() => router.push("/nutrition" as never)}
            />
            <RecordRow
              icon="barbell-outline"
              iconColor={colors.primary}
              iconBg={colors.primarySoft}
              title="训练"
              subtitle={workoutsFailed ? "本周训练次数没加载出来" : "本周 " + weekWorkouts + " 次"}
              value={trainingRecorded ? exerciseMinutes + " 分钟" : NO_RECORD}
              last
              accessibilityLabel={
                "训练 " + (trainingRecorded ? exerciseMinutes + " 分钟" : "无记录") + "，打开训练记录"
              }
              onPress={() => router.push("/workout" as never)}
            />
          </ListGroup>
        </Animated.View>

        {/* 快捷记录：保留旧版「就地 +250ml 饮水」与睡眠入口（详情仍走 /sleep） */}
        <View style={styles.quickRow}>
          <QuickPill
            icon="add"
            label={waterBusy ? "记录中…" : "饮水 +250 ml"}
            accessibilityLabel="记录饮水 250 毫升"
            disabled={waterBusy}
            onPress={() => void quickWater(250)}
          />
          <QuickPill
            icon="moon-outline"
            label={sleepPillLabel}
            accessibilityLabel={
              sleepRecorded ? "打开睡眠详情，最近一晚 " + sleepHours?.toFixed(1) + " 小时" : "记录睡眠"
            }
            onPress={() => router.push("/sleep" as never)}
          />
        </View>

        {/* ⑦ 本周趋势：7 天柱图（今日高亮）；没有任何记录时走空态，不画一条全 0 的图 */}
        <SectionTitle title="本周趋势" />
        <Animated.View entering={entrance(5)}>
          {showSkeleton ? (
            <SkeletonCard count={1} />
          ) : recordDays > 0 ? (
            <Surface tier="surface" corner={radius.card} padded={false} style={styles.trendCard}>
              <View style={styles.trendHead}>
                <View style={styles.trendHeadText}>
                  <Text style={[styles.trendValue, tabularNums]}>{avgKcal}</Text>
                  <Text style={styles.trendCaption}>近 7 天日均 kcal</Text>
                </View>
                <Text style={styles.trendMeta}>{recordDays + "/7 天有记录"}</Text>
              </View>
              <BarChart items={trendItems} height={96} />
              <Text style={styles.trendFoot}>{"柱高按每日目标 " + dietTarget + " kcal 计"}</Text>
            </Surface>
          ) : summaryFailed ? (
            <Surface tier="surface" corner={radius.card} padded={false} style={styles.trendCard}>
              <EmptyState
                pattern="none"
                icon="cloud-offline-outline"
                title="本周趋势没加载出来"
                hint="网络似乎不太顺，点一下重试；其他卡片的数据照常显示。"
                actionLabel="重试"
                onAction={() => void load()}
              />
            </Surface>
          ) : (
            <Surface tier="surface" corner={radius.card} padded={false} style={styles.trendCard}>
              <EmptyState
                pattern="none"
                icon="stats-chart-outline"
                title="本周还没有饮食记录"
                hint="记一餐之后，这里会按天画出热量柱图，今天会高亮显示。"
                actionLabel="去记一餐"
                onAction={() => router.push("/nutrition" as never)}
              />
            </Surface>
          )}
        </Animated.View>

        {/* ⑦-2 本周健康周报（v2.2）：四格周指标（原有活动环已由上方三环卡承接，数据不丢） */}
        <SectionTitle title="本周健康周报" />
        <Animated.View entering={entrance(6)} style={styles.weekBlock}>
          {showSkeleton ? (
            <SkeletonCard count={1} />
          ) : (
            <>
              <View style={styles.tileGrid}>
                <StatTileRow
                  items={[
                    weekTile(weekReport.water, "water-outline", "teal"),
                    weekTile(weekReport.workout, "barbell-outline", "primary"),
                  ]}
                />
                <StatTileRow
                  items={[
                    weekTile(weekReport.sleep, "moon-outline", "success"),
                    weekTile(weekReport.kcal, "restaurant-outline", "accent"),
                  ]}
                />
              </View>
              <Text style={styles.weekCaption}>{weekReport.caption}</Text>
              {weekReport.empty ? (
                <Text style={styles.weekEmpty}>
                  本周还没有记录——先记一条饮水、训练或睡眠，周报就会亮起来。
                </Text>
              ) : null}
            </>
          )}
        </Animated.View>

        {/* ⑧ 更多：习惯打卡 / 领域追踪 / 体重趋势 / 趋势分析 / 运动闪光卡（既有入口一个都不删） */}
        <SectionTitle title="更多" />
        <Animated.View entering={entrance(7)}>
          <ListGroup>
            <EntryCard
              size="row"
              icon="repeat-outline"
              tone="success"
              title="习惯打卡"
              meta={
                data && data.habits.scheduled > 0
                  ? "今日 " + data.habits.done + "/" + data.habits.scheduled + " · " + habitPct + "%"
                  : "连续天数 · 13 周热力图 · 时间段"
              }
              value={data && data.habits.scheduled > 0 ? data.habits.done + "/" + data.habits.scheduled : undefined}
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
                  ? "近 7 天饮食记录 " + recordDays + " 天 · 均 " + avgKcal + " kcal · 训练负荷一屏看"
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
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /** v2.2.2：根容器必须不透明 —— Tab 场景叠放叠滑时不透出下层（与 sceneStyle 的 canvas 双保险） */
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },

    /* 页头 + 今日状态行 */
    headBlock: { gap: 8 },
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

    /* ② 三环活动卡 */
    ringsCard: { padding: 17 },
    ringsRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    ringWrap: { width: 124, height: 124, alignItems: "center", justifyContent: "center" },
    ringCenter: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
    },
    ringPercent: { ...typography.num, color: colors.text },
    ringCenterLabel: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
    legend: { flex: 1, minWidth: 0, gap: 10 },
    legendRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    legendDot: { width: 7, height: 7, borderRadius: 4 },
    legendLabel: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
    legendValue: { ...typography.caption, fontWeight: "700", color: colors.text },
    legendTarget: { ...typography.meta, color: colors.textMuted, flexShrink: 1 },

    /* ③ 饮食摄入卡 */
    pressWrap: { borderRadius: radius.card },
    dietCard: { padding: 14 },
    mealTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    mealThumb: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
      flexShrink: 0,
    },
    mealBody: { flex: 1, minWidth: 0, gap: 2 },
    mealKicker: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
    mealTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    mealMeta: { ...typography.meta, color: colors.textMuted },
    mealKcal: { alignItems: "flex-end", flexShrink: 0 },
    mealKcalValue: { ...typography.headline, fontWeight: "700", color: colors.text },
    mealKcalUnit: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
    dietTotal: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 14,
      paddingTop: 13,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    dietTotalLabel: { ...typography.meta, color: colors.textMuted },
    dietTotalValue: { ...typography.hero, color: colors.text },
    dietTotalTarget: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    macros: { marginTop: 11, gap: 8 },
    macroRow: { flexDirection: "row", alignItems: "center", gap: 9 },
    macroLabel: { ...typography.caption, fontWeight: "600", color: colors.textSecondary, width: 34 },
    macroTrack: { flex: 1, minWidth: 0 },
    macroValue: { ...typography.meta, color: colors.textMuted, width: 78, textAlign: "right" },

    /* ④ 体重卡 */
    weightCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 15 },
    weightBody: { flex: 1, minWidth: 0, gap: 3 },
    weightKicker: { ...typography.meta, color: colors.textMuted },
    weightValue: { ...typography.title2, color: colors.text },
    weightUnit: { ...typography.caption, fontWeight: "500", color: colors.textMuted },
    weightDelta: { ...typography.micro, fontWeight: "600" },
    weightDeltaDown: { color: colors.success },
    weightDeltaUp: { color: colors.accentStrong },
    weightDeltaMuted: { color: colors.textMuted },
    weightHint: { ...typography.meta, color: colors.textFaint },
    weightSpark: { width: 118, height: 56, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    weightSparkEmpty: { ...typography.hero, color: colors.textFaint },

    /* ⑤ 训练卡 */
    trainCard: { padding: 16, gap: 12, backgroundColor: colors.primarySoft },
    trainHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    trainIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
      flexShrink: 0,
    },
    trainBody: { flex: 1, minWidth: 0, gap: 2 },
    trainKicker: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
    trainTitle: { ...typography.headline, color: colors.text },
    trainMeta: { ...typography.meta, color: colors.textMuted },
    trainGo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      flexShrink: 0,
    },
    trainFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    trainFootText: { ...typography.meta, color: colors.textMuted },
    trainLink: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 24 },
    trainLinkText: { ...typography.caption, fontWeight: "600", color: colors.primary },

    /* ⑥ 今日记录行 + 快捷记录 */
    sectionMeta: { ...typography.meta, color: colors.textFaint },
    recordRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 58,
    },
    recordPressed: { backgroundColor: colors.surfaceMuted },
    recordIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    recordBody: { flex: 1, minWidth: 0, gap: 2 },
    recordTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    recordSub: { ...typography.meta, color: colors.textMuted },
    recordValue: { ...typography.callout, fontWeight: "700", color: colors.text },
    recordDivider: {
      position: "absolute",
      bottom: 0,
      left: 58,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    quickRow: { flexDirection: "row", gap: 8, marginTop: 2 },
    quickPill: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
    },
    quickPillPressed: { backgroundColor: colors.surfaceMuted },
    quickPillText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary, flexShrink: 1 },

    /* ⑦ 本周趋势 */
    trendCard: { padding: 16, gap: 12 },
    trendHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.sm },
    trendHeadText: { flex: 1, minWidth: 0 },
    trendValue: { ...typography.hero, color: colors.text },
    trendCaption: { ...typography.meta, color: colors.textMuted },
    trendMeta: { ...typography.meta, color: colors.textFaint },
    trendFoot: { ...typography.meta, color: colors.textFaint },

    /* ⑦-2 本周健康周报 */
    weekBlock: { gap: spacing.sm },
    tileGrid: { gap: spacing.sm },
    weekCaption: { ...typography.meta, color: colors.textFaint, textAlign: "center" },
    weekEmpty: { ...typography.meta, color: colors.textMuted, lineHeight: 19 },
  });
