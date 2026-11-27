import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Alert } from "react-native";
import { useAppStore } from "@/store/app-store";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { usePullRefresh, type RefreshControlLike } from "@/lib/use-pull-refresh";
import { haptics } from "@/lib/haptics";
import { getApiUrl } from "@/config";
import { computeReadiness, type Readiness } from "@/lib/readiness";
import { friendlyError } from "@/lib/friendly-error";
import {
  addHydration,
  fetchHydration,
  fetchNutritionTarget,
  fetchWeight,
  type HydrationToday,
  type NutritionTargetDto,
  type WeightPointDto,
} from "@/lib/wellbeing-client";
import { toDaySummaryMap, todayAndYesterday, type DaySummaryRow } from "@/lib/nutrition-views";
import { buildWeekReport, type WeekReport } from "@/lib/wellness-week";
import { sleepApi, type SleepNight } from "@/lib/sleep-api";
import { INITIAL_FIRST_LOAD_GATE, nextFirstLoadGate, shouldShowSkeleton } from "@/lib/first-load";
import { computeStreak } from "@learn-workbench/shared/domains";
import { STARTUP_HARD_TIMEOUT_MS } from "@/lib/startup-gate";
import { buildCompletion, buildWeekLogDays, countRecordedDays, type GrowthCompletion, type GrowthWeekDay } from "./growth-model";
import { EXERCISE_TARGET_MIN, clockText, lastSevenKeys, round1, weekdayShort } from "./growth-format";

/**
 * 成长页（概览层）与数据看板（二级页）**共用**的取数 / 派生层。
 *
 * 拆出来的原因：重构后两个页面都要同一份真实数据（习惯 / 饮食 / 体重 / 训练 / 饮水 / 睡眠 / 周报），
 * 复制两套 fetch 必然出现「两个页面数字不一致」。这里把 v3 成长页原有的六路并行拉取、
 * 各自独立降级、饮水乐观增量、下拉刷新 / 聚焦刷新原样保留，两个页面只做展示分层。
 *
 * 数据口径（与重构前完全一致，不新增接口、不改 API）：
 *   /api/daily · /api/wellbeing/hydration · /api/wellbeing/weight · /api/workouts
 *   /api/nutrition/summary · /api/nutrition/target 六路并行 + 本机睡眠（lib/sleep-api）。
 * 缺失数据一律「—」（不把「没记录」当 0）；聚合失败保留上次数据并给「重试」。
 *
 * 骨架屏判据（lib/first-load）：**首轮请求真的结束**才落定，而且首轮要等
 * zustand persist 恢复（token 在 store 里）—— 没有用任何固定 setTimeout 假装加载完成。
 * 之后的聚焦刷新 / 下拉刷新只换数据，永不再把骨架屏放回来。
 */

/** /api/daily 响应里本模块用到的字段（完整类型在 shared，这里只读不用） */
export interface GrowthDailyOs {
  learning: { tasksTotal: number; tasksDone: number; focusMinutes: number };
  fitness: {
    workoutName: string | null;
    workoutMinutes: number;
    nutritionKcal: number;
    nutritionTargetKcal: number;
    nutritionRemainingKcal?: number;
    /** 今日饮食明细（最近 5 条；含记录时刻用于「最近一餐」） */
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

/** /api/workouts 响应里本模块用到的字段（完整 Workout 类型在 shared，这里只读不用） */
interface WorkoutLite {
  name?: unknown;
  exercisedOn?: unknown;
  durationSeconds?: unknown;
  items?: unknown;
}

/** 今日训练（来自 /api/workouts?days=7 里 exercised_on = 今天的那条） */
export interface GrowthTodayWorkout {
  name: string;
  minutes: number;
  actions: number;
}

/** 近 7 天柱图的一项（value 0..1，highlight = 今天） */
export interface GrowthTrendItem {
  label: string;
  value: number;
  highlight: boolean;
}

/**
 * 取数 hook 的返回值 = 两个页面展示所需的**全部真实数据与派生值**。
 * 注意：不是 UI state 容器，页面不要往这里塞展示态（弹层 / 勾选等留在页面）。
 */
export interface GrowthScreenData {
  /** 首屏骨架屏（首轮请求真的结束前 + 还没有任何数据） */
  showSkeleton: boolean;
  /** 持久化是否已就绪（hydrate 完成，或卡死兜底放行 —— 见 useStoreHydrated 注释） */
  storeReady: boolean;
  data: GrowthDailyOs | null;
  dailyFailed: boolean;
  summaryFailed: boolean;
  workoutsFailed: boolean;
  load: () => Promise<void>;
  control: RefreshControlLike;

  /** 今日状态分（shared 口径） */
  readiness: Readiness;
  /** 连续打卡天数（store checkins，与本机日期同口径） */
  streakDays: number;
  /** 今日完成度（习惯 / 运动 / 饮水 / 饮食 四项平均；缺项不参与） */
  completion: GrowthCompletion;
  /** 本周 7 天「有没有记录」 */
  weekDays: GrowthWeekDay[];
  recordedDays: number;
  /** 本周健康周报（饮水 / 训练 / 睡眠 / 热量四格） */
  weekReport: WeekReport;

  habitPct: number;

  /* 饮食 */
  dietEntries: NonNullable<GrowthDailyOs["fitness"]["nutritionEntries"]>;
  mealCount: number;
  lastMeal: NonNullable<GrowthDailyOs["fitness"]["nutritionEntries"]>[number] | null;
  mealClock: string | null;
  dietKcal: number | null;
  dietTarget: number;
  dietTargetSource: number | null;
  todaySummary: DaySummaryRow | null;
  nutritionTarget: NutritionTargetDto | null;
  weekRows: DaySummaryRow[];
  recordDays: number;
  avgKcal: number;
  trendItems: GrowthTrendItem[];

  /* 运动 */
  exerciseMinutes: number;
  trainingRecorded: boolean;
  trainingName: string | null;
  trainingActions: number;
  weekWorkouts: number;

  /* 饮水 */
  waterMl: number;
  waterTarget: number;
  waterRecorded: boolean;
  waterByDay: (number | null)[];
  waterBusy: boolean;
  quickWater: (ml: number) => Promise<void>;

  /* 体重 */
  weightValue: WeightPointDto | null;
  weightKicker: string;
  weekWeightDelta: number | null;
  weightSpark: number[];
  weightSparkMin: number;
  weightSparkMax: number;
  weightMeta: string;

  /* 睡眠 */
  sleepHours: number | null;
  sleepRecorded: boolean;
  sleepPillLabel: string;

  /** 一句话今日状态（页面副标题） */
  headerSubtitle: string;
  /** 全无记录（冷启动）——概览层据此给一组轻量起点动作 */
  empty: boolean;
}

/**
 * zustand persist 是否恢复完成（与根布局同一订阅方式，hydration 完成即通知）。
 *
 * 为什么要兜底：zustand 的 storage 读失败时**不会**置 hasHydrated / 不通知监听者，
 * 如果页面死等它，骨架屏会永远留在屏幕上。这里用与根布局 splash 同一个兜底门槛
 * （STARTUP_HARD_TIMEOUT_MS = 4s）放行 —— 只放行「开始取数」，不假装数据已到；
 * 骨架屏仍然只认首轮真实请求的结束。
 */
function useStoreHydrated(): boolean {
  const subscribe = useCallback((cb: () => void) => useAppStore.persist.onFinishHydration(cb), []);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => useAppStore.persist.hasHydrated(),
    () => useAppStore.persist.hasHydrated()
  );
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (hydrated || timedOut) return;
    const timer = setTimeout(() => setTimedOut(true), STARTUP_HARD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hydrated, timedOut]);
  return hydrated || timedOut;
}

/** 首屏请求硬超时：离线 / 弱网时 fetch 可能挂 30s+，骨架屏不能陪它一起等。 */
function fetchWithTimeout(input: string, init: RequestInit = {}, ms = 7000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function useGrowthData(): GrowthScreenData {
  const token = useAppStore((s) => s.token);
  const checkins = useAppStore((s) => s.checkins);
  const hydrated = useStoreHydrated();
  const { today: todayKey } = useMemo(() => todayAndYesterday(), []);

  const [data, setData] = useState<GrowthDailyOs | null>(null);
  const [gate, setGate] = useState(INITIAL_FIRST_LOAD_GATE);
  const [weightPoints, setWeightPoints] = useState<WeightPointDto[]>([]);
  const [weekWorkouts, setWeekWorkouts] = useState(0);
  const [todayWorkout, setTodayWorkout] = useState<GrowthTodayWorkout | null>(null);
  const [weekRows, setWeekRows] = useState<DaySummaryRow[]>([]);
  const [nutritionTarget, setNutritionTarget] = useState<NutritionTargetDto | null>(null);
  const [hydration, setHydration] = useState<HydrationToday | null>(null);
  const [todaySummary, setTodaySummary] = useState<DaySummaryRow | null>(null);
  const [dailyFailed, setDailyFailed] = useState(false);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [waterDelta, setWaterDelta] = useState(0);
  const [waterBusy, setWaterBusy] = useState(false);
  const [sleepNights, setSleepNights] = useState<SleepNight[]>([]);
  const [waterByDay, setWaterByDay] = useState<(number | null)[]>([]);
  const [workoutsFailed, setWorkoutsFailed] = useState(false);
  /** 周报近 6 天饮水的缓存（同一日期窗口 + 同一登录态下结果不变，避免每次聚焦多打 6 个 GET） */
  const weekWaterCache = useRef<{ key: string; days: (number | null)[] } | null>(null);
  /** 并发去重：首屏 mount 时「聚焦回调 + hydration 回落」可能同时触发，只让一轮真正发请求 */
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    // 冷启动先等 persist 恢复（token 在 store 里），否则会发一轮未鉴权请求再补一轮
    if (!hydrated || inFlightRef.current) return;
    inFlightRef.current = true;
    const headers: Record<string, string> = token ? { Authorization: "Bearer " + token } : {};
    try {
      // 周报的近 6 天饮水：命中 ref 就不再请求
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
          fetchWithTimeout(getApiUrl() + "/api/daily?date=" + todayKey, { headers }),
          fetchWeight(token, 30).catch(() => null),
          fetchWithTimeout(getApiUrl() + "/api/workouts?days=7", { headers }).catch(() => null),
          fetchWithTimeout(getApiUrl() + "/api/nutrition/summary?days=7", { headers }).catch(() => null),
          fetchHydration(token).catch(() => null),
          fetchNutritionTarget(token).catch(() => null),
          sleepApi.loadSleepNights().catch(() => [] as SleepNight[]),
          weekWaterPromise,
        ]);
      if (dailyRes.ok) {
        setData(await dailyRes.json());
        setDailyFailed(false);
        setGate((g) => nextFirstLoadGate(g, { type: "load-success" }));
      } else {
        // 401/500 不再静默：页面给「重试」入口，同时保留上一次数据
        setDailyFailed(true);
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
        setSummaryFailed(true);
      }
      if (targetRes) setNutritionTarget(targetRes.target);
      if (hydrationRes) {
        setHydration(hydrationRes);
        setWaterDelta(0); // 拉回来的即真值，清掉乐观增量
      }
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
      inFlightRef.current = false;
      // 兜底落定：任何异常路径都不允许让骨架屏永远留在屏幕上（已落定时幂等）
      setGate((g) => nextFirstLoadGate(g, { type: "load-failure" }));
    }
  }, [hydrated, token, todayKey]);

  // persist 恢复完成（或登录态 / 日期变化）后拉一轮；首帧之后调用，不和首屏渲染抢 JS 线程
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [hydrated, load]);
  // 首屏看门狗：无论有多少个并发请求，9s 后都不允许骨架屏继续占屏（数据晚到会正常覆盖）
  useEffect(() => {
    const timer = setTimeout(() => {
      setGate((g) => nextFirstLoadGate(g, { type: "load-failure" }));
    }, 9000);
    return () => clearTimeout(timer);
  }, []);  // 聚焦刷新（Tab 切回 / 二级页返回都会再拉一次；只换数据，不再出骨架屏）
  useFocusRefresh(load);
  const { control } = usePullRefresh(load, { stickyHeader: true });

  const showSkeleton = shouldShowSkeleton(gate);
  const streakDays = useMemo(() => computeStreak(checkins, { now: new Date() }), [checkins]);

  const habitPct =
    data && data.habits.scheduled > 0 ? Math.round((data.habits.done / data.habits.scheduled) * 100) : 0;

  // 今日状态分（readiness）：保留原算法，只用于概览层的一行状态
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
  const dietTargetSource = nutritionTarget?.kcal ?? data?.fitness.nutritionTargetKcal ?? null;
  const dietTarget =
    dietTargetSource !== null && Number.isFinite(dietTargetSource) && dietTargetSource > 0
      ? Math.round(dietTargetSource)
      : 2000;

  const exerciseMinutes = todayWorkout?.minutes ?? data?.fitness.workoutMinutes ?? 0;
  // 有记录就算「已训练」：时长可以不填（见 workbench 训练记录允许 0 分钟）。
  const trainingRecorded = todayWorkout !== null || exerciseMinutes > 0;
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

  /** 本周健康周报：四路已有数据折成四格指标（缺项一律「—」，不新增接口） */
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

  /** 今日完成度（四项平均；缺项不参与分母） */
  const completion = useMemo(
    () =>
      buildCompletion({
        habitsDone: data ? data.habits.done : null,
        habitsScheduled: data && data.habits.scheduled > 0 ? data.habits.scheduled : null,
        exerciseMinutes: data !== null ? exerciseMinutes : null,
        exerciseTargetMinutes: EXERCISE_TARGET_MIN,
        waterMl: waterRecorded ? waterMl : null,
        waterTargetMl: waterTarget,
        kcal: dietKcal,
        kcalTargetKcal: dietTargetSource,
      }),
    [data, exerciseMinutes, waterRecorded, waterMl, waterTarget, dietKcal, dietTargetSource]
  );

  /** 本周状态：近 7 天哪几天有记录（饮水或饮食） */
  const weekDays = useMemo(
    () =>
      buildWeekLogDays({
        todayKey,
        waterByDay,
        kcalRows: weekRows,
        kcalAvailable: !summaryFailed,
      }),
    [todayKey, waterByDay, weekRows, summaryFailed]
  );
  const recordedDays = countRecordedDays(weekDays);

  /** 冷启动判断：任何一项有记录才算「有数据」，避免空态连续几张卡 */
  const empty =
    !(data !== null && exerciseMinutes > 0) &&
    !waterRecorded &&
    dietKcal === null &&
    weightValue === null &&
    !sleepRecorded;

  /* ---------- 页头副文案（有数据才写具体数字，没有就通用一句） ---------- */
  const headerSubtitle =
    data !== null
      ? "本周记录 " +
        recordedDays +
        " / 7 天 · 连续 " +
        streakDays +
        " 天" +
        (waterRecorded ? " · 今日已补水 " + (waterMl / 1000).toFixed(1) + " L" : "")
      : "运动、饮食与体重，今天的状态在一处看全。";

  /**
   * 就地补水：先乐观更新（点一下立刻看到数字变化），再写服务端；
   * 失败回滚并明确提示（旧版静默 catch，用户看到的就是「点了没反应」）。
   */
  const quickWater = useCallback(
    async (ml: number) => {
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
        Alert.alert("记录饮水失败", friendlyError(e, "网络似乎不太顺，稍后再试"));
      } finally {
        setWaterBusy(false);
      }
    },
    [token, waterBusy]
  );

  return {
    showSkeleton,
    storeReady: hydrated,
    data,
    dailyFailed,
    summaryFailed,
    workoutsFailed,
    load,
    control,
    readiness,
    streakDays,
    completion,
    weekDays,
    recordedDays,
    weekReport,
    habitPct,
    dietEntries,
    mealCount,
    lastMeal,
    mealClock,
    dietKcal,
    dietTarget,
    dietTargetSource,
    todaySummary,
    nutritionTarget,
    weekRows,
    recordDays,
    avgKcal,
    trendItems,
    exerciseMinutes,
    trainingRecorded,
    trainingName,
    trainingActions,
    weekWorkouts,
    waterMl,
    waterTarget,
    waterRecorded,
    waterByDay,
    waterBusy,
    quickWater,
    weightValue,
    weightKicker,
    weekWeightDelta,
    weightSpark,
    weightSparkMin,
    weightSparkMax,
    weightMeta,
    sleepHours,
    sleepRecorded,
    sleepPillLabel,
    headerSubtitle,
    empty,
  };
}
