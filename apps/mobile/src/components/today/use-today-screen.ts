import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import Animated from "react-native-reanimated";
import { useHeaderTopInset } from "@/components/screen-header";
import { useCelebration } from "@/lib/use-celebration";
import { useAppStore } from "@/store/app-store";
import { useFocusSessionStore } from "@/store/focus-session-store";
import { useIdentity } from "@/hooks/use-identity";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useTheme } from "@/theme";
import { fetchLatestEnergy, logEnergy } from "@/lib/energy";
import { computeFocusStats } from "@/lib/focus-stats";
import { fetchAiTip } from "@/lib/ai-tip";
import { fetchHydration, fetchNutritionTarget } from "@/lib/wellbeing-client";
import { toDaySummaryMap } from "@/lib/nutrition-views";
import { localKey } from "@/lib/focus-series";
import { loadLearningAttempts } from "@/lib/learning-progress";
import { readCachedRoadmap } from "@/lib/roadmap";
import { absoluteMediaUrl } from "@/lib/uploads";
import { apiGetJson, apiRequest } from "@/lib/api-request";
import { isScheduled } from "@learn-workbench/shared/dates";
import { computeStreak, todayISOInZone } from "@learn-workbench/shared/domains";
import { isHabitDone } from "@learn-workbench/shared/pure";
import { summarizeLearningAttempts as summarizeLearningEvidence } from "@learn-workbench/shared/learning";
import type { DailyTask, Habit, HabitLog } from "@learn-workbench/shared/schemas";
import type { QuickStartChoice } from "@/components/quick-start-sheet";
import { DEFAULT_FOCUS_GOAL_MINUTES, WEEKDAY_LABELS, buildWeekGrid, isoWeekNo, useDailyQuote, useTodayMotion } from "./today-widgets";
import { makeStyles } from "./today-styles";

/** 今日习惯的渲染行（标题已被任务覆盖的习惯不进这一列，见 linkedHabitNames 过滤）。 */
export type TodayHabitRow = {
  id: number;
  name: string;
  icon: string | null;
  color: string;
  done: boolean;
};

/**
 * V7 Day Sheet（今日改版）用到的纯派生口径。
 * 时间弧固定覆盖 06:00–24:00：18 小时 = 1080 分钟，把「当天分钟数」线性映射到 0..1，
 * 弧的角度由组件按这个进度算，钩子只负责给数值，不关心几何。
 */
const ARC_START_MINUTES = 6 * 60;
const ARC_SPAN_MINUTES = 18 * 60;

/** 月份英文缩写（Day Sheet 大日期下方那行小字，与 demo 的 NOV 一致） */
const MONTH_LABELS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 当天时刻（分钟数）→ 时间弧进度 0..1；凌晨 0–6 点钳到 0，24 点钳到 1 */
function arcProgressOfMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.min(1, (minutes - ARC_START_MINUTES) / ARC_SPAN_MINUTES));
}

/** 专注时长展示：1h 22m / 25m（0 分钟也给出 0m，不用「—」占位，弧下三格是「已经发生的事」） */
function formatFocusMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
  if (total < 60) return total + "m";
  return Math.floor(total / 60) + "h " + pad2(total % 60) + "m";
}

export function useTodayScreen() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const headerTop = useHeaderTopInset("hero");
  const tabBarSpace = useTabBarSpace();
  /** v19-M8：TabBar 双击回顶（再点已聚焦的「今日」时滚回顶部） */
  const todayScrollRef = useRef<Animated.ScrollView>(null);
  useScrollToTopHandler("/today", todayScrollRef);
  /** 入场错峰统一走 lib/stagger（步长取 token）；减弱动态时传 undefined，彻底不动 */
  const { reduced, motionActive } = useTodayMotion();
  const tasks = useAppStore((s) => s.tasks);
  const checkins = useAppStore((s) => s.checkins);
  const sessions = useAppStore((s) => s.sessions);
  const topicProgress = useAppStore((s) => s.progress);
  const checkinToday = useAppStore((s) => s.checkinToday);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const aiTip = useAppStore((s) => s.aiTip);
  const setAiTip = useAppStore((s) => s.setAiTip);
  const token = useAppStore((s) => s.token);
  const identity = useIdentity();
  const openFocus = useFocusSessionStore((s) => s.openFocus);

  /**
   * V7 Day Sheet 的「现在」：只在本页获得焦点时每 30 秒对齐一次。
   * 时间弧进度、弧内时钟胶囊、右上角 HH:MM 与问候语都读同一个时刻，避免三处各取 new Date() 后互相错位。
   * 用 useFocusEffect 而不是常驻 setInterval：Tab 切走后计时器会停，不在后台白跑（也不做循环动画）。
   */
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const timer = setInterval(() => setNow(new Date()), 30_000);
      return () => clearInterval(timer);
    }, [])
  );

  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  /** 里程碑庆祝（今日计划全部完成）：统一走 useCelebration，同一天只弹一次 */
  const { request: celebrationRequest, celebrateOnce, close: closeCelebration } = useCelebration();
  /** 单条任务/习惯完成：轻量横幅，2.4s 自动收起，不打断浏览 */
  const [burst, setBurst] = useState<{ kicker: string; title: string; subtitle?: string } | null>(null);
  /** v3 顶栏通知弹层 */
  const [notifOpen, setNotifOpen] = useState(false);
  /** v3 任务详情面板：点任务行打开（null = 关闭） */
  const [detailTask, setDetailTask] = useState<DailyTask | null>(null);
  /** 今日精力状态（1-5，来自 /api/wellbeing/energy）→ v2 MoodPicker */
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [energyBusy, setEnergyBusy] = useState(false);
  /** v4 P2：一键开始（弹层选学习/运动/正向计时 → 选完立即进入计时） */
  const [quickOpen, setQuickOpen] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<QuickStartChoice | null>(null);
  /**
   * v12 P1-2：今天的习惯排期也进「今日任务」列表（新建习惯时还会自动建一条
   * 「[习惯] 名称」的真任务，这里按标题去重，避免出现两条）。
   */
  const [habitRows, setHabitRows] = useState<TodayHabitRow[]>([]);
  /**
   * 学习进度三格（v1.62 P0-2）：题库今日答题数 / 阶段主题完成度 / 今日专注分钟。
   * 数据源全部沿用既有本地数据（learning-attempts + roadmap 缓存 + sessions），不新增接口。
   */
  const [learningSnapshot, setLearningSnapshot] = useState({ questionsToday: 0, stageDone: 0, stageTotal: 0 });
  /**
   * 健康快照真实数据（P1-3 · task-48）：三个数据源并行拉，null = 拿不到（渲染「—」）。
   * 摄入 = /api/nutrition/summary?days=1 里今天那行的 kcal（没记录≠0，显示「—」）；
   * 目标 = /api/nutrition/target 的 target.kcal（没设目标就不显示分母）；
   * 饮水 = /api/wellbeing/hydration 的 totalMl / targetMl；
   * 训练仍用 store.sports（本地口径，离线也有）。
   */
  const [healthSnapshot, setHealthSnapshot] = useState<{
    intakeKcal: number | null;
    targetKcal: number | null;
    waterMl: number | null;
    waterTargetMl: number | null;
  }>({ intakeKcal: null, targetKcal: null, waterMl: null, waterTargetMl: null });

  const quote = useDailyQuote();
  /** S5-1：业务日期统一东八区（shared/domains），不再用设备本地/UTC 拼日期 */
  const today = todayISOInZone();
  /** isScheduled 需要 Date（按星期判定），字符串 key 只用于取数 */
  const todayDate = useMemo(() => new Date(), []);
  const h = now.getHours();
  const greet = h < 6 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
  /** Hero 的一行日期（v2：问候 + 日期 + 打卡数 + 本周 7 格） */
  const dateLabel = useMemo(
    () => (todayDate.getMonth() + 1) + " 月 " + todayDate.getDate() + " 日 · 周" + WEEKDAY_LABELS[todayDate.getDay()],
    [todayDate]
  );
  /** 本周 7 格：周一 → 周日，业务日期（东八区）参与比较 */
  const week = useMemo(() => buildWeekGrid(today), [today]);

  const todayTasks = tasks.filter((t) => t.taskDate === today);
  const todayDone = todayTasks.filter((t) => t.done).length;

  /** 已经在任务里出现过的习惯（标题形如「[习惯] 名称」） */
  const linkedHabitNames = useMemo(
    () =>
      new Set(
        todayTasks
          .map((t) => (t.title?.startsWith("[习惯] ") ? t.title.slice(5).trim() : null))
          .filter((v): v is string => Boolean(v))
      ),
    [todayTasks]
  );
  const habitOnlyRows = habitRows.filter((h) => !linkedHabitNames.has(h.name));
  const habitOnlyDone = habitOnlyRows.filter((h) => h.done).length;

  const loadHabits = useCallback(async () => {
    try {
      const res = await apiGetJson<{ habits?: Habit[]; logs?: HabitLog[] }>("/api/habits", { token });
      if (!res.ok || !res.data) return;
      const list: Habit[] = Array.isArray(res.data.habits) ? res.data.habits : [];
      const logs: HabitLog[] = Array.isArray(res.data.logs) ? res.data.logs : [];
      const map = new Map<string, number>();
      for (const l of logs) map.set(l.habitId + "|" + String(l.logDate).slice(0, 10), Number(l.value));
      setHabitRows(
        list
          .filter((h) => isScheduled(h.schedule, todayDate))
          .map((h) => {
            const v = map.get(h.id + "|" + today);
            return { id: h.id, name: h.name, icon: h.icon ?? null, color: h.color, done: v !== undefined && isHabitDone(h, v) };
          })
      );
    } catch {
      // 离线：保留上次
    }
  }, [token, today, todayDate]);

  useEffect(() => {
    const t = setTimeout(() => void loadHabits(), 0);
    return () => clearTimeout(t);
  }, [loadHabits]);
  useFocusRefresh(loadHabits);

  /** 今日精力：最近一次记录（接口幂等，按时间倒序取第一条） */
  const loadEnergy = useCallback(async () => {
    const latest = await fetchLatestEnergy(token).catch(() => null);
    if (latest) setEnergyLevel(latest.level);
  }, [token]);
  useEffect(() => {
    const t = setTimeout(() => void loadEnergy(), 0);
    return () => clearTimeout(t);
  }, [loadEnergy]);
  useFocusRefresh(loadEnergy);

  /**
   * 学习进度三格（v1.62 P0-2）：全部读既有本地数据 —
   * 题库今日 = 本地作答记录里今天的条数（与学习页同一口径：shared/learning）；
   * 阶段 = roadmap 缓存里 track=main 的主题 done/total（与学习页 routeSummary 同源）；
   * 专注分钟 = store.sessions 经 computeFocusStats。
   */
  const loadLearning = useCallback(async () => {
    try {
      const [attempts, phases] = await Promise.all([loadLearningAttempts(), readCachedRoadmap()]);
      const todayKey = localKey(new Date());
      const summary = summarizeLearningEvidence(attempts, {
        todayKey,
        dayKey: (iso: string) => localKey(new Date(iso)),
      });
      const topics = phases.filter((p) => p.track === "main").flatMap((p) => p.topics ?? []);
      const done = topics.filter((t) => topicProgress[t.id]?.done).length;
      setLearningSnapshot({ questionsToday: summary.today, stageDone: done, stageTotal: topics.length });
    } catch {
      // 离线：保留上次
    }
  }, [topicProgress]);
  useEffect(() => {
    const t = setTimeout(() => void loadLearning(), 0);
    return () => clearTimeout(t);
  }, [loadLearning]);
  useFocusRefresh(loadLearning);

  /**
   * 健康快照三源（P1-3 · task-48）：并行请求，任一失败只影响自己那一格。
   * 降级策略：未登录 → 全部「—」且不发请求；断网/接口失败 → 保留上次的值（首屏就是「—」）；
   * 有响应但今天没记录 → 摄入显示「—」（不把"没吃"当 0）。
   * 不阻塞首屏：这三条请求在 useEffect/focus 里发，页面先按上一轮（或「—」）渲染。
   */
  const loadHealth = useCallback(async () => {
    if (!token) {
      setHealthSnapshot({ intakeKcal: null, targetKcal: null, waterMl: null, waterTargetMl: null });
      return;
    }
    try {
      const [summaryRes, target, hydration] = await Promise.all([
        apiGetJson<{ summary?: unknown }>("/api/nutrition/summary?days=1", { token }),
        fetchNutritionTarget(token).catch(() => null),
        fetchHydration(token).catch(() => null),
      ]);
      /** 请求失败 → null（保留上次）；成功但今天没条目 → data 里也没有当天行（显示「—」） */
      const summary = summaryRes.ok ? summaryRes.data : null;
      const todayRow = summary ? toDaySummaryMap(summary.summary)[today] : undefined;
      const targetKcal = target?.target?.kcal;
      setHealthSnapshot((prev) => ({
        // 摘要请求成功但今天没条目 → null（「—」）；请求失败（null）→ 保留上次
        intakeKcal: summary ? (todayRow ? todayRow.kcal : null) : prev.intakeKcal,
        targetKcal:
          target !== null
            ? Number.isFinite(Number(targetKcal)) && Number(targetKcal) > 0
              ? Math.round(Number(targetKcal))
              : null
            : prev.targetKcal,
        waterMl: hydration ? Math.max(0, Math.round(Number(hydration.totalMl) || 0)) : prev.waterMl,
        waterTargetMl:
          hydration !== null
            ? Number(hydration.targetMl) > 0
              ? Math.round(Number(hydration.targetMl))
              : null
            : prev.waterTargetMl,
      }));
    } catch {
      // 断网：保留上次（首屏仍显示「—」，不会变成 0 或报错）
    }
  }, [token, today]);
  useEffect(() => {
    const t = setTimeout(() => void loadHealth(), 0);
    return () => clearTimeout(t);
  }, [loadHealth]);
  useFocusRefresh(loadHealth);

  /**
   * v17/v18 收尾：下拉刷新 = 重跑本页网络数据源（习惯/打卡、精力、健康快照）与本地学习进度。
   * 任务、日志与专注会话来自本地 store + 同步引擎，本页不重复拉取，口径未改。
   * 今日是自绘 header 的 hub 页 → stickyHeader: false。
   */
  const refreshToday = useCallback(
    () => Promise.all([loadHabits(), loadEnergy(), loadLearning(), loadHealth()]).then(() => undefined),
    [loadHabits, loadEnergy, loadHealth, loadLearning]
  );
  const { control: todayRefresh } = usePullRefresh(refreshToday, { stickyHeader: false });

  const pickEnergy = async (level: number) => {
    setEnergyLevel(level); // 乐观：点一下立刻高亮
    setEnergyBusy(true);
    try {
      await logEnergy(token, level);
    } catch {
      // 失败保留本地选中，下次进入页面会按服务端纠正
    } finally {
      setEnergyBusy(false);
    }
  };

  /** 首页直接给习惯打卡（乐观 + 失败回滚） */
  const toggleHabit = async (id: number, done: boolean) => {
    setHabitRows((rows) => rows.map((r) => (r.id === id ? { ...r, done: !done } : r)));
    try {
      const r = done
        ? await apiRequest("/api/habits/logs?habitId=" + id + "&date=" + today, { method: "DELETE", token })
        : await apiRequest("/api/habits/logs", {
            method: "POST",
            token,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ habitId: id, date: today, value: 1 }),
          });
      if (!r || !r.ok) throw new Error("打卡失败");
      await loadHabits();
    } catch {
      setHabitRows((rows) => rows.map((r) => (r.id === id ? { ...r, done } : r)));
    }
  };
  const focusStats = computeFocusStats(sessions);
  /** 每日专注目标（分钟）：用户可在设置里改，今日页目标环 / 提醒文案实时跟随 */
  const dailyFocusGoalMinutes = useAppStore(
    (s) => s.dailyFocusGoalMinutes ?? DEFAULT_FOCUS_GOAL_MINUTES,
  );
  const focusGoalLabel =
    dailyFocusGoalMinutes % 60 === 0
      ? dailyFocusGoalMinutes / 60 + " 小时"
      : Math.floor(dailyFocusGoalMinutes / 60) + " 小时 " + (dailyFocusGoalMinutes % 60) + " 分";


  /**
   * S5-1：连续打卡天数走 shared/domains（东八区口径，与 Web /api/dashboard 的 streak 同源）。
   * 旧实现用 toISOString().slice(0,10) 逐日回退 —— 东八区 00:00–08:00 会按 UTC 日期算错。
   */
  const streak = useMemo(() => computeStreak(checkins, { now: new Date() }), [checkins]);

  const checkedInToday = checkins.includes(today);

  const fireBurst = (kicker: string, title: string, subtitle?: string) => {
    setBurst({ kicker, title, subtitle });
  };

  /**
   * 今日计划完成：任务全部勾完（且没有待打卡的独立习惯）才触发全屏庆祝。
   * 去重交给 claimCelebration（kind + 日期），退出重进不会重复弹。
   */
  const pendingHabits = habitOnlyRows.filter((row) => !row.done).length;
  const maybeCelebratePlan = (tasksDone: number, habitsPending: number) => {
    const total = todayTasks.length;
    if (total <= 0) return;
    if (tasksDone >= total && habitsPending <= 0) {
      void celebrateOnce("plan-complete", today);
    }
  };

  // 今日建议（规则版）：根据任务/打卡状态给一句可执行的小建议
  const todayTip = useMemo(() => {
    if (todayTasks.length === 0) return "先给今天定一个小目标，路线图会告诉你下一步学什么";
    if (todayDone === 0) return "从第一件事开始，把最重要的做完就赢了一半";
    if (todayDone < todayTasks.length) return "还差 " + (todayTasks.length - todayDone) + " 件事就完成今天，冲一冲";
    if (!checkedInToday) return "任务已全部完成，别忘了打卡留下今天的印记";
    return "今天已满载而归，去复盘或提前看看明天的安排";
  }, [todayTasks, todayDone, checkedInToday]);

  // AI 每日建议：当日缓存一次；未配置/失败静默回落规则版 todayTip
  useEffect(() => {
    if (aiTip && aiTip.date === today) return;
    void fetchAiTip().then((text) => {
      if (text) setAiTip(text);
    });
  }, [aiTip, today, setAiTip]);
  const heroTip = aiTip && aiTip.date === today && aiTip.text ? aiTip.text : todayTip;

  /** v3 版式：今日学习小卡并入「本周学习」（专注分钟口径）；学习百分比改由专注目标环承载 */
  /** 今日饮水小卡：接口没数据（未登录/断网/没记录）→「—」 */
  const waterLiters = healthSnapshot.waterMl === null ? null : healthSnapshot.waterMl / 1000;
  const waterTargetLiters = healthSnapshot.waterTargetMl === null ? null : healthSnapshot.waterTargetMl / 1000;
  /** 今日饮水环 = totalMl / targetMl；没有目标或没数据 → null（环心「—」） */
  const waterPercent =
    healthSnapshot.waterMl !== null && healthSnapshot.waterTargetMl !== null && healthSnapshot.waterTargetMl > 0
      ? Math.round((healthSnapshot.waterMl / healthSnapshot.waterTargetMl) * 100)
      : null;
  const waterHint =
    waterLiters === null
      ? "点击去记录饮水"
      : waterTargetLiters !== null
        ? waterLiters.toFixed(1) + " L · 目标 " + waterTargetLiters.toFixed(1) + " L"
        : waterLiters.toFixed(1) + " L · 点击去记录";

  /** ---------- v3 一屏原型的派生数据（全部来自既有本地数据，不新增接口） ---------- */
  const focusMinutesToday = focusStats.todayMinutes;
  const focusGoalPercent = Math.min(100, Math.round((focusMinutesToday / dailyFocusGoalMinutes) * 100));
  const focusH = Math.floor(focusMinutesToday / 60);
  const focusM = focusMinutesToday % 60;
  /** 按日专注分钟：last14 = 最近 14 天（含今天），供本周节律柱与 7 天曲线共用 */
  const focusByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of focusStats.last14) map.set(d.date, d.minutes);
    return map;
  }, [focusStats]);
  const weekBars = useMemo(() => {
    const minutes = week.map((d) => focusByDay.get(d.iso) ?? 0);
    const peak = Math.max(1, ...minutes);
    return week.map((d, i) => ({ ...d, minutes: minutes[i], ratio: Math.max(0.08, minutes[i] / peak) }));
  }, [week, focusByDay]);
  const weekNo = isoWeekNo(todayDate);
  const weekFocusMinutes = weekBars.reduce((sum, d) => sum + d.minutes, 0);
  const prevWeekFocusMinutes = focusStats.last14.slice(0, 7).reduce((sum, d) => sum + d.minutes, 0);
  const focusDelta = weekFocusMinutes - prevWeekFocusMinutes;
  const focusDeltaPercent =
    prevWeekFocusMinutes > 0 ? Math.round((focusDelta / prevWeekFocusMinutes) * 100) : null;
  const last7Minutes = focusStats.last14.slice(-7).map((d) => d.minutes);
  const last7Labels = focusStats.last14
    .slice(-7)
    .map((d) => WEEKDAY_LABELS[new Date(d.date + "T00:00:00").getDay()]);
  const weekFocusPercent = Math.min(
    100,
    Math.round((weekFocusMinutes / (dailyFocusGoalMinutes * 7)) * 100)
  );
  const weekFocusHint =
    weekFocusMinutes === 0
      ? "本周还没有专注记录"
      : Math.floor(weekFocusMinutes / 60) + "h " + String(weekFocusMinutes % 60).padStart(2, "0") +
        "m · 较前 7 天 " + (focusDelta >= 0 ? "+" : "") + focusDelta + "m";
  const avatarUri = token ? absoluteMediaUrl(identity.avatarUrl) : null;
  const avatarLetter = token ? identity.initial : "我";
  const greetLine = token ? greet + "，" + identity.name : greet;
  const greetSub =
    todayTasks.length === 0
      ? "今天还没有安排，先定一件最重要的小事。"
      : todayDone < todayTasks.length
        ? "今天 " + todayTasks.length + " 件事，先做完最重要的那件。"
        : "今天 " + todayTasks.length + " 件事都完成了，记得打卡。";
  const insightLead =
    weekFocusMinutes === 0
      ? "本周还没有专注记录，从 25 分钟开始。"
      : "本周累计专注 " + Math.floor(weekFocusMinutes / 60) + "h " +
        String(weekFocusMinutes % 60).padStart(2, "0") + "m，" +
        (focusDelta >= 0
          ? "比前 7 天多 " + focusDelta + " 分钟。"
          : "比前 7 天少 " + Math.abs(focusDelta) + " 分钟。");


  /**
   * 一键开始（弹层）的统一入口：先清掉上一次的选择再打开，等价于原先三处内联写法。
   * 视图层只拿到这个回调，不直接改两份 state。
   */
  const openQuickStart = () => {
    setPendingChoice(null);
    setQuickOpen(true);
  };

  /* ---------------- V7 Day Sheet：一页日程的数据口径（全部来自既有本地数据） ---------------- */

  /** 大日期：21 / NOV / 周六 + 第 47 周 · 09:41（日期取当前时刻，不是 mock） */
  const dateNum = String(now.getDate());
  const monthLabel = MONTH_LABELS[now.getMonth()] ?? MONTH_LABELS[0];
  const weekdayLabel = "周" + WEEKDAY_LABELS[now.getDay()];
  const nowLabel = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
  const nowProgress = arcProgressOfMinutes(now.getHours() * 60 + now.getMinutes());
  const greetFirst = greet + "。";
  /** 第二行是固定文案（demo 是「今天只做三件事。」），第一行才是按小时段派生的真实问候 */
  const greetHeadline = "今天只做三件事。";

  /**
   * 时间弧上的专注块圆点：今日已发生的会话（computeFocusStats 的 todayList 就是今日口径，按开始时间升序）。
   * 超过 3 条时取「最早 / 中间 / 最晚」三个代表点，而不是硬塞 3 个重叠的点。
   */
  const focusDots = (() => {
    const list = focusStats.todayList;
    if (list.length === 0) return [] as { key: string; progress: number; minutes: number }[];
    const picked =
      list.length <= 3
        ? list
        : [0, Math.floor((list.length - 1) / 2), list.length - 1].map((i) => list[i]);
    return picked.map((entry, i) => {
      const [hh, mm] = entry.startTime.split(":").map((v) => Number(v));
      return {
        key: entry.startTime + "#" + i,
        progress: arcProgressOfMinutes(hh * 60 + mm),
        minutes: entry.minutes,
      };
    });
  })();

  /** 弧下三格：今日专注（1h 22m）/ 任务完成（2/3）/ 连续天数 */
  const focusTodayLabel = formatFocusMinutes(focusMinutesToday);
  const taskRatioLabel = todayTasks.length > 0 ? todayDone + "/" + todayTasks.length : "—";

  /** 页面模型：派生数据 + 状态 + 回调，交给 today.tsx 与各区块组件显式接收。 */
  return {
    styles,
    headerTop,
    tabBarSpace,
    todayScrollRef,
    todayRefresh,
    reduced,
    motionActive,
    dateLabel,
    weekNo,
    greetLine,
    greetSub,
    avatarUri,
    avatarLetter,
    quote,
    heroTip,
    todayTasks,
    todayDone,
    learningSnapshot,
    streak,
    checkedInToday,
    checkinToday,
    habitRows,
    habitOnlyRows,
    habitOnlyDone,
    pendingHabits,
    toggleHabit,
    toggleTaskDone,
    fireBurst,
    maybeCelebratePlan,
    focusMinutesToday,
    focusH,
    focusM,
    focusGoalPercent,
    focusGoalLabel,
    dailyFocusGoalMinutes,
    weekFocusMinutes,
    weekFocusPercent,
    weekFocusHint,
    focusDeltaPercent,
    insightLead,
    last7Minutes,
    last7Labels,
    waterPercent,
    waterHint,
    energyLevel,
    energyBusy,
    pickEnergy,
    sportSheetOpen,
    setSportSheetOpen,
    notifOpen,
    setNotifOpen,
    detailTask,
    setDetailTask,
    quickOpen,
    setQuickOpen,
    pendingChoice,
    setPendingChoice,
    openFocus,
    openQuickStart,
    dateNum,
    monthLabel,
    weekdayLabel,
    nowLabel,
    nowProgress,
    greetFirst,
    greetHeadline,
    focusDots,
    focusTodayLabel,
    taskRatioLabel,
    celebrationRequest,
    closeCelebration,
    burst,
    setBurst,
  };
}
