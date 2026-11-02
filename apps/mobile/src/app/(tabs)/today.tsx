import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { useHeaderTopInset } from "@/components/screen-header";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SportThemedIcon, ThemedIcon } from "@/components/themed-icon";
import { AnimatedCheckMark } from "@/components/check-mark";
import { PatternBackdrop } from "@/components/pattern-backdrop";
import { router } from "expo-router";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  cancelAnimation,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useAppStore } from "@/store/app-store";
import type { ExerciseType, Habit, HabitLog } from "@learn-workbench/shared/schemas";
import type { SportItem } from "@learn-workbench/shared/types";
import { SPORT_CATALOG, exerciseTypeOptions, taskTypeLabels } from "@learn-workbench/shared/labels";
import { isScheduled } from "@learn-workbench/shared/dates";
import { computeStreak, todayISOInZone } from "@learn-workbench/shared/domains";
import { isHabitDone } from "@learn-workbench/shared/pure";
import { sportIconOf, sportColorsOf, sportAnimOf, sportSfOf } from "@/lib/sport-view";
import { habitIconName } from "@/lib/habit-icons";
import { getApiUrl } from "@/config";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { isMotionActive } from "@/theme/motion";
import { staggerDelay } from "@/lib/stagger";
import { FocusTimer } from "@/components/focus-timer";
import { QuickStartSheet, type QuickStartChoice } from "@/components/quick-start-sheet";
import { Card } from "@/components/card";
import { SectionHeader } from "@/components/section-header";
import { BottomSheet } from "@/components/bottom-sheet";
import { SheetStickyCta } from "@/components/sheet";
import { CelebrationModal } from "@/components/celebration-modal";
import { EnergyBar } from "@/components/energy-bar";
import { fetchLatestEnergy, logEnergy } from "@/lib/energy";
import { PressableScale } from "@/components/pressable-scale";
import { StatStrip } from "@/components/stat-strip";
import { haptics } from "@/lib/haptics";
import { radius, shadows, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { computeFocusStats } from "@/lib/focus-stats";
import { getDailyQuote } from "@/lib/quotes";
import { fetchAiTip } from "@/lib/ai-tip";
import { buildSportTrend } from "@/lib/sport-trend";
import { localKey } from "@/lib/focus-series";
import { loadLearningAttempts } from "@/lib/learning-progress";
import { readCachedRoadmap } from "@/lib/roadmap";
import { summarizeLearningAttempts as summarizeLearningEvidence } from "@learn-workbench/shared/learning";

/**
 * 每日目标（v1.62 P0-2）：题库 20 题与学习页 DAILY_QUESTION_GOAL 同值（learn.tsx 内部常量，
 * 这里只做展示，不改口径）；运动 30 分钟是今日焦点 chip 的参考线，同样只用于展示进度。
 */
const DAILY_QUESTION_GOAL = 20;
const DAILY_SPORT_GOAL_MINUTES = 30;
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

function useDailyQuote() {
  return useMemo(() => getDailyQuote(), []);
}

/** 今日焦点卡里的快捷 chip（刷题 / 阅读 / 运动）：纯展示 + 点击，动效只用按压缩放 */
function FocusChip({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof ThemedIcon>["name"];
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      haptic
      scaleTo={0.97}
      onPress={onPress}
      hitSlop={8}
      style={styles.chip}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <ThemedIcon name={icon} size={15} color={colors.textMuted} />
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

function SportIcon({
  sportKey,
  name,
  type,
  color,
  active,
  motionActive,
}: {
  sportKey: string;
  name?: string;
  type: ExerciseType;
  color?: string;
  active: boolean;
  motionActive: boolean;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const icon = sportIconOf(sportKey, name);
  const c = color ?? sportColorsOf(type).c1;
  const preset = sportAnimOf(sportKey);

  useEffect(() => {
    if (!motionActive) {
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(rotate);
      cancelAnimation(scale);
      tx.value = 0;
      ty.value = 0;
      rotate.value = 0;
      scale.value = 1;
      return;
    }
    if (!active) {
      tx.value = withTiming(0, { duration: 180 });
      ty.value = withTiming(0, { duration: 180 });
      rotate.value = withTiming(0, { duration: 180 });
      scale.value = withSpring(1);
      return;
    }

    // 动画词汇表：与 Web 端 sport-animated-icon 的 keyframes 分组同源
    switch (preset) {
      case "ball-bounce":
        scale.value = withSequence(withSpring(1.18, { damping: 9, stiffness: 220 }), withSpring(1));
        ty.value = withSequence(withTiming(-18, { duration: 340 }), withTiming(0, { duration: 400 }));
        rotate.value = withSequence(withTiming(-140, { duration: 700 }), withTiming(0, { duration: 0 }));
        break;
      case "racket-sway":
        scale.value = withSequence(withSpring(1.14, { damping: 9, stiffness: 220 }), withSpring(1));
        tx.value = withSequence(
          withRepeat(withSequence(withTiming(-6, { duration: 170 }), withTiming(6, { duration: 170 })), 3, true),
          withTiming(0, { duration: 160 })
        );
        ty.value = withRepeat(withSequence(withTiming(-4, { duration: 170 }), withTiming(4, { duration: 170 })), 3, true);
        break;
      case "stroll":
        scale.value = withSequence(withSpring(1.1, { damping: 9, stiffness: 220 }), withSpring(1));
        rotate.value = withSequence(
          withRepeat(withSequence(withTiming(-12, { duration: 220 }), withTiming(12, { duration: 220 })), 2, true),
          withTiming(0, { duration: 200 })
        );
        ty.value = withRepeat(withSequence(withTiming(-3, { duration: 220 }), withTiming(3, { duration: 220 })), 2, true);
        break;
      case "run-bounce":
        scale.value = withSequence(withSpring(1.16, { damping: 9, stiffness: 220 }), withSpring(1));
        break;
      case "ride":
        scale.value = withSequence(withSpring(1.1, { damping: 9, stiffness: 220 }), withSpring(1));
        tx.value = withRepeat(withSequence(withTiming(-4, { duration: 160 }), withTiming(4, { duration: 160 })), 4, true);
        ty.value = withRepeat(withSequence(withTiming(-3, { duration: 160 }), withTiming(0, { duration: 160 })), 4, true);
        break;
      case "swim":
        scale.value = withSequence(withSpring(1.1, { damping: 9, stiffness: 200 }), withSpring(1));
        ty.value = withSequence(withTiming(-5, { duration: 320 }), withTiming(0, { duration: 320 }), withTiming(-4, { duration: 300 }), withTiming(0, { duration: 300 }));
        rotate.value = withSequence(withTiming(6, { duration: 320 }), withTiming(-6, { duration: 320 }), withTiming(0, { duration: 260 }));
        break;
      case "rope":
        scale.value = withSequence(withSpring(1.16, { damping: 9, stiffness: 220 }), withSpring(1));
        break;
      case "strength":
        scale.value = withSequence(withSpring(1.15, { damping: 9, stiffness: 220 }), withSpring(1));
        break;
      case "tremble":
        scale.value = withSequence(withSpring(1.08, { damping: 12, stiffness: 220 }), withSpring(1));
        break;
      case "breath":
        scale.value = withRepeat(withSequence(withTiming(1.07, { duration: 700 }), withTiming(0.97, { duration: 700 })), 2, true);
        break;
      case "climb":
        scale.value = withSequence(withSpring(1.08, { damping: 9, stiffness: 220 }), withSpring(1));
        ty.value = withRepeat(
          withSequence(withTiming(-7, { duration: 170 }), withTiming(0, { duration: 90 })),
          3,
          false
        );
        break;
      default:
        scale.value = withSequence(withSpring(1.12, { damping: 9, stiffness: 220 }), withSpring(1));
        break;
    }
  }, [active, motionActive, preset, rotate, scale, tx, ty]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

    return (
      <Animated.View style={animatedStyle}>
        <SportThemedIcon name={icon} sf={sportSfOf(sportKey)} size={22} color={c} />
      </Animated.View>
    );
}

function SportSheet({
  visible,
  onClose,
  motionActive,
}: {
  visible: boolean;
  onClose: () => void;
  motionActive: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sports = useAppStore((s) => s.sports);
  const addSport = useAppStore((s) => s.addSport);
  const [tab, setTab] = useState<"recent" | ExerciseType>("recent");
  const [sportKey, setSportKey] = useState("basketball");
  const [minutes, setMinutes] = useState(30);

  // 最近：按记录时间倒序取 distinct 项目（不足时回退常用 featured）
  const items = useMemo(() => {
    if (tab === "recent") {
      const seen: string[] = [];
      for (const r of [...sports].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
        if (!seen.includes(r.sportKey)) seen.push(r.sportKey);
        if (seen.length >= 6) break;
      }
      const recent = seen
        .map((k) => SPORT_CATALOG.find((i) => i.key === k))
        .filter((i): i is SportItem => !!i);
      return recent.length > 0 ? recent : SPORT_CATALOG.filter((i) => i.featured);
    }
    return SPORT_CATALOG.filter((i) => i.type === tab);
  }, [tab, sports]);

  const current = SPORT_CATALOG.find((i) => i.key === sportKey) ?? items[0] ?? SPORT_CATALOG[0];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="添加运动记录"
      subtitle="选项目 → 调时长 → 记录；想看得更全可拖动顶部把手继续上拉"
      icon="barbell-outline"
      // 真机反馈：默认高度不够、内容看不全，必须下滑才见到确认按钮。
      // expandable 的手势只挂在**顶部把手**上，用户不会去拖它，所以把默认高度直接抬高到内容装得下。
      height="88%"
      // 真机反馈：原来不能上拖、内容看不全、必须下滑才能看到确认按钮。
      // 打开 expandable（上拖到 94%）+ 把确认按钮移到吸底 CTA。
      expandable
      footer={
        <SheetStickyCta
          label={`记录 ${current?.name ?? "—"} ${minutes} 分钟`}
          icon="checkmark"
          onPress={() => {
            if (!current) return;
            addSport(current.key, minutes);
            onClose();
          }}
        />
      }
      footerHint="选中的项目与时长会写进今天的运动记录"
    >
      <View style={styles.sportTabRow}>
        <Pressable onPress={() => setTab("recent")} style={[styles.sportTab, tab === "recent" && styles.sportTabActive]}>
          <Text style={[styles.sportTabText, tab === "recent" && styles.sportTabTextActive]}>最近</Text>
        </Pressable>
        {exerciseTypeOptions.map((o) => (
          <Pressable key={o.type} onPress={() => setTab(o.type)} style={[styles.sportTab, tab === o.type && styles.sportTabActive]}>
            <Text style={[styles.sportTabText, tab === o.type && styles.sportTabTextActive]}>
              {o.label.replace("运动", "").replace("训练", "").replace("放松", "").replace("活动", "")}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={styles.sportGridScroll} contentContainerStyle={styles.sportTypeGrid} showsVerticalScrollIndicator={false}>
        {items.map((t) => {
          const active = t.key === current?.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                setSportKey(t.key);
                setMinutes(t.defaultMinutes);
              }}
              style={[styles.sportType, active && styles.sportTypeActive]}
            >
              <View style={[styles.sportTypeIcon, { backgroundColor: `${sportColorsOf(t.type).c1}22` }]}>
                <SportIcon sportKey={t.key} type={t.type} active={active} motionActive={motionActive} />
              </View>
              <Text style={[styles.sportTypeName, active && styles.sportTypeNameActive]} numberOfLines={1}>
                {t.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => setMinutes((m) => Math.max(5, m - 5))}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <View style={styles.stepperVal}>
          <Text style={styles.stepperNum}>{minutes}</Text>
          <Text style={styles.stepperUnit}>分钟</Text>
        </View>
        <Pressable style={styles.stepBtn} onPress={() => setMinutes((m) => Math.min(240, m + 5))}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
      <View style={styles.quickRow}>
        {[15, 30, 45, 60].map((m) => (
          <Pressable
            key={m}
            onPress={() => setMinutes(m)}
            style={[styles.quickChip, minutes === m && styles.quickChipActive]}
          >
            <Text style={[styles.quickChipText, minutes === m && styles.quickChipTextActive]}>{m} 分</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerTop = useHeaderTopInset("hero");
  const tabBarSpace = useTabBarSpace();
  /** v19-M8：TabBar 双击回顶（再点已聚焦的「今日」时滚回顶部） */
  const todayScrollRef = useRef<Animated.ScrollView>(null);
  useScrollToTopHandler("/today", todayScrollRef);
  /** 入场错峰统一走 lib/stagger（步长取 token）；减弱动态时传 undefined，彻底不动 */
  const reduced = useReducedMotion();
  const motionActive = isMotionActive(reduced);
  const tasks = useAppStore((s) => s.tasks);
  const checkins = useAppStore((s) => s.checkins);
  const sessions = useAppStore((s) => s.sessions);
  const topicProgress = useAppStore((s) => s.progress);
  const checkinToday = useAppStore((s) => s.checkinToday);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const addSession = useAppStore((s) => s.addSession);
  const sports = useAppStore((s) => s.sports);
  const addSportSeconds = useAppStore((s) => s.addSportSeconds);
  const aiTip = useAppStore((s) => s.aiTip);
  const setAiTip = useAppStore((s) => s.setAiTip);
  const token = useAppStore((s) => s.token);

  const [focusOpen, setFocusOpen] = useState(false);
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  /** 完成任务的庆祝弹窗（null = 关闭） */
  const [celebrateInfo, setCelebrateInfo] = useState<{ title: string; subtitle?: string } | null>(null);
  /** 今日精力状态（1-5，来自 /api/wellbeing/energy） */
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [energyBusy, setEnergyBusy] = useState(false);
  /** v4 P2：一键开始（弹层选学习/运动/正向计时 → 选完立即进入计时） */
  const [quickOpen, setQuickOpen] = useState(false);
  const [timerAuto, setTimerAuto] = useState<QuickStartChoice | null>(null);
  const [pendingChoice, setPendingChoice] = useState<QuickStartChoice | null>(null);
  const [timerSession, setTimerSession] = useState(0);
  /**
   * v12 P1-2：今天的习惯排期也进「今日任务」列表（新建习惯时还会自动建一条
   * 「[习惯] 名称」的真任务，这里按标题去重，避免出现两条）。
   */
  const [habitRows, setHabitRows] = useState<{ id: number; name: string; icon: string | null; color: string; done: boolean }[]>([]);
  /**
   * 学习进度三格（v1.62 P0-2）：题库今日答题数 / 阶段主题完成度 / 今日专注分钟。
   * 数据源全部沿用既有本地数据（learning-attempts + roadmap 缓存 + sessions），不新增接口。
   */
  const [learningSnapshot, setLearningSnapshot] = useState({ questionsToday: 0, stageDone: 0, stageTotal: 0 });

  const quote = useDailyQuote();
  /** S5-1：业务日期统一东八区（shared/domains），不再用设备本地/UTC 拼日期 */
  const today = todayISOInZone();
  /** isScheduled 需要 Date（按星期判定），字符串 key 只用于取数 */
  const todayDate = useMemo(() => new Date(), []);
  const h = new Date().getHours();
  const greet = h < 6 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
  /** 紧凑 header 的一行日期（v1.62 P0-2：不再用两行大问候标题） */
  const dateLabel = useMemo(
    () => (todayDate.getMonth() + 1) + " 月 " + todayDate.getDate() + " 日 · 周" + WEEKDAY_LABELS[todayDate.getDay()],
    [todayDate]
  );

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
  const habitDone = habitRows.filter((h) => h.done).length;

  const loadHabits = useCallback(async () => {
    try {
      const headers: Record<string, string> = token ? { Authorization: "Bearer " + token } : {};
      const r = await fetch(getApiUrl() + "/api/habits", { headers });
      if (!r.ok) return;
      const d = await r.json();
      const list: Habit[] = Array.isArray(d.habits) ? d.habits : [];
      const logs: HabitLog[] = Array.isArray(d.logs) ? d.logs : [];
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
   * v17/v18 收尾：下拉刷新 = 重跑本页网络数据源（习惯/打卡、精力）与本地学习进度。
   * 任务、日志与专注会话来自本地 store + 同步引擎，本页不重复拉取，口径未改。
   * 今日是自绘紧凑 header 的 hub 页、没有吸顶紧凑栏 → stickyHeader: false。
   */
  const refreshToday = useCallback(
    () => Promise.all([loadHabits(), loadEnergy(), loadLearning()]).then(() => undefined),
    [loadHabits, loadEnergy, loadLearning]
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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    };
    setHabitRows((rows) => rows.map((r) => (r.id === id ? { ...r, done: !done } : r)));
    try {
      const r = done
        ? await fetch(getApiUrl() + "/api/habits/logs?habitId=" + id + "&date=" + today, { method: "DELETE", headers })
        : await fetch(getApiUrl() + "/api/habits/logs", {
            method: "POST",
            headers,
            body: JSON.stringify({ habitId: id, date: today, value: 1 }),
          });
      if (!r.ok) throw new Error("打卡失败");
      await loadHabits();
    } catch {
      setHabitRows((rows) => rows.map((r) => (r.id === id ? { ...r, done } : r)));
    }
  };
  const focusStats = computeFocusStats(sessions);

  /**
   * 健康快照（v1.62 P0-2）：只用今日页既有的运动数据源（store.sports 经 sport-trend 汇总），
   * 今日页没有「摄入 / 饮水」数据源，按任务要求不编造，三格改为今日训练 / 本周训练 / 今日记录。
   */
  const sportTrend = useMemo(() => buildSportTrend(sports, today, 7), [sports, today]);
  const todaySport = sportTrend.points[sportTrend.points.length - 1] ?? { minutes: 0, sessions: 0 };

  /**
   * S5-1：连续打卡天数走 shared/domains（东八区口径，与 Web /api/dashboard 的 streak 同源）。
   * 旧实现用 toISOString().slice(0,10) 逐日回退 —— 东八区 00:00–08:00 会按 UTC 日期算错。
   */
  const streak = useMemo(() => computeStreak(checkins, { now: new Date() }), [checkins]);

  const focusTask = todayTasks.find((t) => !t.done);
  const checkedInToday = checkins.includes(today);

  const fireCelebrate = (title: string, subtitle?: string) => {
    setCelebrateInfo({ title, subtitle });
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

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={todayScrollRef}
        refreshControl={<RefreshControl {...todayRefresh} />}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ① 紧凑 header（v1.62 P0-2）：一行日期 + 打卡 pill，一行 tip（不再用两行大问候标题） */}
        <View style={styles.compactHeader}>
          <View style={styles.compactHeaderRow}>
            <Text style={styles.compactDate} numberOfLines={1}>
              {dateLabel}
            </Text>
            <Pressable
              onPress={() => {
                if (!checkedInToday) haptics.success();
                checkinToday();
              }}
              hitSlop={10}
              style={[styles.checkinPill, checkedInToday && styles.checkinPillDone]}
              accessibilityRole="button"
              accessibilityLabel={checkedInToday ? "今日已打卡，连续 " + streak + " 天" : "点此打卡"}
            >
              <ThemedIcon name={checkedInToday ? "checkmark-circle" : "flame"} size={13} color={checkedInToday ? colors.primary : colors.accent} />
              <Text style={[styles.checkinPillText, checkedInToday && styles.checkinPillTextDone]} numberOfLines={1}>
                {checkedInToday ? "已打卡 · " + streak + " 天" : "点此打卡"}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.compactTip} numberOfLines={2}>
            {greet}，{heroTip}
          </Text>
        </View>

        {/* ② 今日焦点：上半精力（点击即记），下半主按钮「开始专注」+ 三个快捷 chip */}
        <EnergyBar value={energyLevel} onSelect={(l) => void pickEnergy(l)} busy={energyBusy} />

        <Card style={styles.focusCard} variant="hero">
          <PressableScale
            haptic
            scaleTo={0.98}
            onPress={() => {
              // 打开时清掉上一轮遗留的待启动选择：保证「弹层里没点开始计时 → 一定不会启动」的不变量
              setPendingChoice(null);
              setQuickOpen(true);
            }}
            style={styles.startButton}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="开始专注"
          >
            <View style={styles.startIcon}>
              <ThemedIcon name="play" size={18} color={colors.primary} />
            </View>
            <Text style={styles.startTitle} numberOfLines={1}>
              开始专注
            </Text>
            <ThemedIcon name="chevron-forward" size={18} color="rgba(255,255,255,0.9)" />
          </PressableScale>

          <View style={styles.chipRow}>
            <FocusChip
              icon="layers-outline"
              label={"刷题 " + learningSnapshot.questionsToday + "/" + DAILY_QUESTION_GOAL}
              onPress={() => router.push("/quiz" as never)}
            />
            <FocusChip icon="book-outline" label="阅读" onPress={() => router.push("/learn" as never)} />
            <FocusChip
              icon="barbell-outline"
              label={"运动 " + todaySport.minutes + "/" + DAILY_SPORT_GOAL_MINUTES}
              onPress={() => setSportSheetOpen(true)}
            />
          </View>
        </Card>

        {/* ③ 今日任务：前 3 条任务 + 2 条习惯 + 查看全部（勾选/庆祝逻辑保持原样） */}
        <SectionHeader
          title="今日任务"
          subtitle={
            todayDone + "/" + todayTasks.length + " 已完成" + (habitRows.length > 0 ? " · 习惯 " + habitDone + "/" + habitRows.length : "")
          }
          actionLabel="查看全部"
          onAction={() => router.push("/tasks" as never)}
        />

        {todayTasks.length === 0 && habitOnlyRows.length === 0 ? (
          <Card style={styles.taskEmptyCard}>
            {/* v13 U12：任务页空状态的低透明度几何底纹 */}
            <PatternBackdrop variant="chevron" />
            <Text style={styles.taskEmpty}>今天还没有任务，去学习页添加一个吧</Text>
          </Card>
        ) : (
          todayTasks.slice(0, 3).map((t, i) => (
            <Animated.View
              key={t.id}
              style={styles.task}
              entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))}
            >
              <Pressable
                style={styles.taskRow}
                hitSlop={4}
                onPress={() => {
                  const willDone = !t.done;
                  haptics.light();
                  toggleTaskDone(t.id);
                  if (willDone) fireCelebrate(t.title, "今日任务 · 已完成");
                }}
              >
                <View style={[styles.taskBox, t.done && styles.taskBoxDone]}>
                  {/* v13 U8：勾选时用 strokeDashoffset 画对勾（组件常驻，靠 checked 驱动，才有「画」的过程） */}
                  <AnimatedCheckMark checked={t.done} size={16} color="#ffffff" />
                </View>
                <View style={styles.taskBody}>
                  <Text style={[styles.taskTitle, t.done && styles.taskDone]} numberOfLines={1}>
                    {t.title}
                  </Text>
                  <Text style={styles.taskMeta}>{taskTypeLabels[t.taskType] ?? t.taskType}</Text>
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}
        {/* 习惯排期（v12 P1-2）：与任务同列显示，点一下就地打卡 */}
        {habitOnlyRows.slice(0, 2).map((row, i) => (
          <Animated.View
            key={"habit-" + row.id}
            style={styles.task}
            entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i + 3))}
          >
            <Pressable
              style={styles.taskRow}
              hitSlop={4}
              onPress={() => {
                haptics.light();
                if (!row.done) fireCelebrate(row.name, "习惯打卡完成");
                void toggleHabit(row.id, row.done);
              }}
            >
              <View style={[styles.taskBox, row.done && { backgroundColor: row.color, borderColor: row.color }]}>
                <AnimatedCheckMark checked={row.done} size={16} color="#ffffff" />
              </View>
              <View style={styles.taskBody}>
                <View style={styles.taskTitleRow}>
                  <ThemedIcon name={habitIconName(row.icon)} size={14} color={colors.textMuted} />
                  <Text style={[styles.taskTitle, row.done && styles.taskDone]} numberOfLines={1}>
                    {row.name}
                  </Text>
                </View>
                <Text style={styles.taskMeta}>习惯</Text>
              </View>
            </Pressable>
          </Animated.View>
        ))}

        {/* ④ 学习进度（StatStrip 3 格，点击去学习页）：题库今日 / 阶段主题 / 今日专注 */}
        <SectionHeader title="学习进度" />
        <StatStrip
          items={[
            { label: "题库今日", value: learningSnapshot.questionsToday, unit: "/" + DAILY_QUESTION_GOAL, tone: "primary" },
            {
              label: "阶段主题",
              value: learningSnapshot.stageDone,
              unit: "/" + learningSnapshot.stageTotal,
              tone: "teal",
            },
            { label: "今日专注", value: focusStats.todayMinutes, unit: "分", tone: "accent" },
          ]}
          onPress={() => router.push("/learn" as never)}
          accessibilityLabel="打开学习页查看学习进度"
        />

        {/* ⑤ 健康快照（StatStrip 3 格）+「记录运动」入口；数据源 = 今日页既有运动记录，不编造摄入/饮水 */}
        <SectionHeader title="健康快照" actionLabel="记录运动" onAction={() => setSportSheetOpen(true)} />
        <StatStrip
          items={[
            { label: "今日训练", value: todaySport.minutes, unit: "分", tone: "accent" },
            { label: "本周训练", value: sportTrend.totalMinutes, unit: "分", tone: "success" },
            { label: "今日记录", value: todaySport.sessions, unit: "条", tone: "teal" },
          ]}
          onPress={() => router.push("/wellness" as never)}
          accessibilityLabel="查看健康页"
        />

        {/* 每日语录：原「更多」抽屉里的装饰内容，保留为页尾一行（不占入口） */}
        <Text style={styles.quoteFoot} numberOfLines={2}>
          {quote}
        </Text>
      </Animated.ScrollView>

      <SportSheet visible={sportSheetOpen} onClose={() => setSportSheetOpen(false)} motionActive={motionActive} />
      <QuickStartSheet
        visible={quickOpen}
        onClose={() => setQuickOpen(false)}
        onPick={(choice) => {
          /**
           * ⚠️ 两条不变量（v1.4.2）：
           * 1) onPick **只由弹层底部的「开始计时」按钮触发** —— 弹层内的点选只改选择态，
           *    所以「侧滑返回 / 点空白 / 返回键」都只会走 onClose，绝不会开始计时（真机反馈）。
           * 2) 不能在这里直接 setFocusOpen(true)：QuickStartSheet 是 Modal，退场还要 180ms 才卸载，
           *    同帧再 present 全屏 Modal 会出现两个 Modal 叠加（iOS 上表现为「点了没反应」）；
           *    所以先存起来，等它真正关闭（onClosed）后再开。
           */
          setPendingChoice(choice);
        }}
        onClosed={() => {
          if (!pendingChoice) return;
          setTimerAuto(pendingChoice);
          setPendingChoice(null);
          setTimerSession((n) => n + 1);
          setFocusOpen(true);
        }}
      />
      <FocusTimer
        key={timerSession}
        open={focusOpen}
        task={
          /**
           * v5 P2-1：一键开始路径**不再隐式绑定「今天第一个未完成任务」**
           * （用户不可控，专注会被算到无关任务上）；改为用「这次学什么」作为标题。
           */
          timerAuto
            ? {
                id: null,
                title:
                  timerAuto.contentLabel ??
                  (timerAuto.kind === "exercise" ? timerAuto.sportName ?? "运动" : "自由专注"),
              }
            : focusTask
              ? { id: focusTask.id, title: focusTask.title }
              : { id: null, title: "自由专注" }
        }
        sessions={sessions}
        autoStart={!!timerAuto}
        initialTimerMode={timerAuto?.timerMode}
        initialMinutes={timerAuto?.minutes}
        mode={timerAuto?.kind === "exercise" ? "exercise" : "focus"}
        exerciseLabel={timerAuto?.sportName ?? null}
        contentLabel={timerAuto?.kind === "focus" ? timerAuto.contentLabel ?? null : null}
        onClose={() => {
          // 关闭时清空一键开始的配置：否则之后从焦点卡「开始专注」进入计时器时，
          // 会继承上一次的运动类型/时长并再次自动开始（写错数据 + 跳过准备页）。
          setFocusOpen(false);
          setTimerAuto(null);
        }}
        onRecorded={(taskId, seconds, label) =>
          addSession(taskId, seconds, label ?? (taskId ? (focusTask?.title ?? null) : null))
        }
        onExerciseRecorded={(seconds) => {
          if (timerAuto?.sportKey) addSportSeconds(timerAuto.sportKey, seconds);
        }}
      />
      <CelebrationModal
        visible={!!celebrateInfo}
        onClose={() => setCelebrateInfo(null)}
        title={celebrateInfo?.title ?? ""}
        subtitle={celebrateInfo?.subtitle}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
  /* ===== v1.62 P0-2 今日页重构新增（字号全走 typography token，不写裸 fontSize） ===== */
  compactHeader: { gap: 6 },
  compactHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  compactDate: { ...typography.callout, fontWeight: "800", color: colors.text },
  checkinPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  checkinPillDone: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  checkinPillText: { ...typography.micro, fontWeight: "700", color: colors.textMuted },
  checkinPillTextDone: { color: colors.primaryStrong },
  compactTip: { ...typography.caption, lineHeight: 18, color: colors.textSecondary },
  focusCard: { gap: 12 },
  startButton: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    ...shadows.floating,
  },
  startIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  startTitle: { flex: 1, ...typography.headline, fontWeight: "800", color: "#FFFFFF" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary, flexShrink: 1 },
  quoteFoot: { ...typography.caption, lineHeight: 18, color: colors.textMuted, textAlign: "center", paddingHorizontal: 8 },
  /* ===== 新增结束 ===== */
  scroll: { flex: 1 },
  // v4 P2 一键开始：实色大按钮（不占 hero 名额，高度控制在 92 以内）
  quickStart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 92,
    borderRadius: radius.xl,
    // v19-V2：主色走主题 token（暗色下自动提亮为 #6FA8E0，不再发闷）
    backgroundColor: colors.primary,
    ...shadows.floating,
  },
  /** 外环：半透明 + 1pt 高光描边，给"按钮"一个可点的轮廓 */
  quickStartIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
  },
  /**
   * 圆心：纯白实心底 + 主色播放三角。
   * play 三角的视觉重心偏左，paddingLeft 让它在圆里几何居中。
   */
  quickStartIconCore: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
    backgroundColor: "#FFFFFF",
  },
  quickStartBody: { flex: 1, gap: 3 },
  quickStartTitle: { fontSize: 20, fontWeight: "800", color: "#ffffff", letterSpacing: 0.2 },
  quickStartSub: { fontSize: 12.5, color: "rgba(255,255,255,0.88)" },
  content: { padding: 16, gap: 14 },
  hero: { paddingBottom: 6, position: "relative" },
  sunGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -60,
    right: -40,
    backgroundColor: "rgba(255, 210, 130, 0.35)",
  },
  heroEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  heroEyebrow: { ...typography.micro, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.6 },
  heroPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  heroPillDone: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  heroPillText: { fontSize: 10, fontWeight: "700", color: colors.textMuted },
  heroPillTextDone: { color: colors.primaryStrong },
  heroTitle: {
    ...typography.display,
    color: colors.text,
  },
  heroSub: {
    ...typography.callout,
    // v18 对比度：callout(15pt) 属正文字号，textMuted(#8E8E93) 对白底仅约 3.0，低于 WCAG AA 4.5
    color: colors.textSecondary,
    marginTop: 5,
  },
  quote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 10,
    paddingRight: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quoteText: { flex: 1, ...typography.caption, lineHeight: 19, color: colors.textMuted },

  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  sectionTitle: {
    ...typography.title2,
    color: colors.text,
  },
  sectionMore: { ...typography.caption, color: colors.textMuted },
  inlineMore: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 2 },
  inlineMoreText: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
  addSportBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  addSportText: { ...typography.caption, fontWeight: "700", color: colors.accentStrong },

  sportCard: { gap: 8 },
  sportTotal: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  sportTotalNum: { fontSize: 30, fontWeight: "800", color: colors.text },
  sportTotalUnit: { ...typography.caption, color: colors.textMuted },
  sportTotalNote: { marginLeft: "auto", ...typography.micro, color: colors.accentStrong },
  sportEmpty: { ...typography.caption, color: colors.textMuted, paddingVertical: 4 },
  sportItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  sportIco: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sportItemInfo: { flex: 1 },
  sportItemName: { ...typography.callout, fontWeight: "700", color: colors.text },
  sportItemTime: { ...typography.caption, color: colors.textMuted, marginTop: 1 },

  task: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  taskBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  taskBoxDone: { backgroundColor: colors.success, borderColor: colors.success },
  /**
   * 任务 / 习惯行的可点区域。
   *
   * ⚠️ 必须显式写成 row：它是 `styles.task`（row 卡片）的子节点，不声明方向就默认 **column**，
   * 而里面的标题用了 `flex: 1` —— 在 column 里 flexBasis 作用在**高度**上，
   * 父级高度又是内容撑开的（没有剩余空间可分配）→ 标题高度被压成 0，整条文字看不见。
   * 这与 components/press-button.tsx 里记的是同一个 Yoga 陷阱。
   */
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  /** 标题 + 副标题的纵向容器；flex: 1 在这里是横向撑满，安全 */
  taskBody: { flex: 1, minWidth: 0, gap: 1 },
  // flexShrink 而不是 flex：在 taskBody(column) 里高度仍需自适应，
  // 在习惯行的 taskTitleRow(row) 里则靠它把过长标题截断而不是撑破
  taskTitle: { ...typography.callout, fontWeight: "600", color: colors.text, flexShrink: 1 },
  taskDone: { textDecorationLine: "line-through", color: colors.textSecondary },
  taskMeta: { ...typography.caption, color: colors.textMuted },
  taskEmpty: { ...typography.caption, color: colors.textMuted, textAlign: "center", paddingVertical: 4 },
  // v13 U12：底纹绝对定位铺满，卡片要裁切
  taskEmptyCard: { overflow: "hidden" },

  /**
   * 今日概览三格（v1.44.2）：等宽、居中、比原来抽屉里的大卡片更紧凑。
   * 目的是在首屏一眼看完"今天打没打卡 / 专注了多久 / 本周走了多少"。
   * 原来的 statsGrid/statCard/checkinRow 随「本周节奏」一起移到首屏后已无引用，予删。
   */
  overviewGrid: { flexDirection: "row", gap: 10 },
  overviewTile: {
    flex: 1,
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: radius.lg,
    alignItems: "center",
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  overviewIcon: { width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  overviewValueRow: { flexDirection: "row", alignItems: "flex-end" },
  overviewValue: { fontSize: 19, fontWeight: "800", color: colors.text },
  overviewUnit: { ...typography.caption, fontWeight: "600", color: colors.textMuted, marginBottom: 2 },
  overviewLabel: { ...typography.micro, fontWeight: "700", color: colors.textMuted },

  /** 任务 / 习惯行的「图标 + 标题」横排（原来是把 emoji 直接拼进文案） */
  /** 习惯行的「图标 + 标题」横排（父级是 taskBody 的 column，这里不能再写 flex: 1） */
  taskTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },

  sportTabRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  sportTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sportTabActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  sportTabText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
  sportTabTextActive: { color: colors.accentStrong },
  sportGridScroll: { flex: 1 },
  sportTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 6 },
  sportType: {
    width: "30%",
    flexGrow: 1,
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  sportTypeActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  sportTypeIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sportTypeName: { ...typography.caption, fontWeight: "700", color: colors.text },
  sportTypeNameActive: { color: colors.accentStrong },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 18 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontSize: 24, color: colors.text, lineHeight: 26 },
  stepperVal: { alignItems: "center", minWidth: 80 },
  stepperNum: { fontSize: 28, fontWeight: "800", color: colors.text },
  stepperUnit: { ...typography.caption, color: colors.textMuted },
  quickRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 14 },
  quickChip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  quickChipText: { ...typography.caption, fontWeight: "700", color: colors.text },
  quickChipTextActive: { color: colors.accentStrong },
  saveSport: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveSportText: { color: "#fff", ...typography.callout, fontWeight: "800" },
});
