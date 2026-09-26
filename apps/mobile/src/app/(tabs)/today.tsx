/* eslint-disable react-hooks/immutability */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHeaderTopInset } from "@/components/screen-header";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import { SportThemedIcon, ThemedIcon } from "@/components/themed-icon";
import { AnimatedCheckMark } from "@/components/check-mark";
import { PatternBackdrop } from "@/components/pattern-backdrop";
import { router } from "expo-router";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  useAnimatedScrollHandler,
  interpolate,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useAppStore } from "@/store/app-store";
import { SPORT_CATALOG, exerciseTypeOptions, type ExerciseType, type SportItem } from "@learn-workbench/shared";
import { sportIconOf, sportColorsOf, sportAnimOf, sportSfOf } from "@/lib/sport-view";
import { mainPhases, agentPhase } from "@learn-workbench/content";
import {
  isHabitDone,
  isScheduled,
  pct,
  formatDuration,
  taskTypeLabels,
  todayISO,
  type Habit,
  type HabitLog,
} from "@learn-workbench/shared";
import { getApiUrl } from "@/config";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { DURATION, useReducedMotion } from "@/lib/motion";
import { staggerDelay } from "@/lib/stagger";
import { FocusTimer } from "@/components/focus-timer";
import { QuickStartSheet, type QuickStartChoice } from "@/components/quick-start-sheet";
import { DailyOsSummary } from "@/components/daily-os-summary";
import { Card } from "@/components/card";
import { SectionHeader } from "@/components/section-header";
import { BottomSheet } from "@/components/bottom-sheet";
import { SheetStickyCta } from "@/components/sheet";
import { CelebrationModal } from "@/components/celebration-modal";
import { EnergyBar } from "@/components/energy-bar";
import { fetchLatestEnergy, logEnergy } from "@/lib/energy";
import { PressableScale } from "@/components/pressable-scale";
import { haptics } from "@/lib/haptics";
import { radius, shadows, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { computeFocusStats } from "@/lib/focus-stats";
import { getDailyQuote } from "@/lib/quotes";
import { fetchAiTip } from "@/lib/ai-tip";

function useDailyQuote() {
  return useMemo(() => getDailyQuote(), []);
}

function SportIcon({
  sportKey,
  name,
  type,
  color,
  active,
}: {
  sportKey: string;
  name?: string;
  type: ExerciseType;
  color?: string;
  active: boolean;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const icon = sportIconOf(sportKey, name);
  const c = color ?? sportColorsOf(type).c1;
  const preset = sportAnimOf(sportKey);

  useEffect(() => {
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
  }, [active, preset, rotate, scale, tx, ty]);

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

function SportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
                <SportIcon sportKey={t.key} type={t.type} active={active} />
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

function formatSport(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} 小时 ${m} 分`;
  if (h) return `${h} 小时`;
  return `${m} 分钟`;
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerTop = useHeaderTopInset("hero");
  const tabBarSpace = useTabBarSpace();
  /** 入场错峰统一走 lib/stagger（步长取 token）；减弱动态时传 undefined，彻底不动 */
  const reduced = useReducedMotion();
  const progress = useAppStore((s) => s.progress);
  const tasks = useAppStore((s) => s.tasks);
  const checkins = useAppStore((s) => s.checkins);
  const sessions = useAppStore((s) => s.sessions);
  const checkinToday = useAppStore((s) => s.checkinToday);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const addSession = useAppStore((s) => s.addSession);
  const sports = useAppStore((s) => s.sports);
  const addSportSeconds = useAppStore((s) => s.addSportSeconds);
  const removeSport = useAppStore((s) => s.removeSport);
  const aiTip = useAppStore((s) => s.aiTip);
  const setAiTip = useAppStore((s) => s.setAiTip);
  const token = useAppStore((s) => s.token);

  const [focusOpen, setFocusOpen] = useState(false);
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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
   * `[习惯] 名称` 的真任务，这里按标题去重，避免出现两条）。
   */
  const [habitRows, setHabitRows] = useState<{ id: number; name: string; icon: string | null; color: string; done: boolean }[]>([]);

  const quote = useDailyQuote();
  const today = todayISO();
  /** isScheduled 需要 Date（按星期判定），字符串 key 只用于取数 */
  const todayDate = useMemo(() => new Date(), []);
  const h = new Date().getHours();
  const greet = h < 6 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";

  const allTopics = useMemo(
    () => mainPhases.flatMap((p) => p.topics).concat(agentPhase?.topics ?? []),
    []
  );
  const doneCount = allTopics.filter((t) => progress[t.id]?.done).length;
  const overall = pct(doneCount, allTopics.length);

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
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(getApiUrl() + "/api/habits", { headers });
      if (!r.ok) return;
      const d = await r.json();
      const list: Habit[] = Array.isArray(d.habits) ? d.habits : [];
      const logs: HabitLog[] = Array.isArray(d.logs) ? d.logs : [];
      const map = new Map<string, number>();
      for (const l of logs) map.set(`${l.habitId}|${String(l.logDate).slice(0, 10)}`, Number(l.value));
      setHabitRows(
        list
          .filter((h) => isScheduled(h.schedule, todayDate))
          .map((h) => {
            const v = map.get(`${h.id}|${today}`);
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
   * v17/v18 收尾：下拉刷新 = 重跑本页两个网络数据源（习惯/打卡与精力）。
   * 任务、日志与专注会话来自本地 store + 同步引擎，本页不重复拉取，口径未改。
   * 今日是自绘 hero 的 hub 页、没有吸顶紧凑栏 → stickyHeader: false。
   */
  const refreshToday = useCallback(
    () => Promise.all([loadHabits(), loadEnergy()]).then(() => undefined),
    [loadHabits, loadEnergy]
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
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    setHabitRows((rows) => rows.map((r) => (r.id === id ? { ...r, done: !done } : r)));
    try {
      const r = done
        ? await fetch(`${getApiUrl()}/api/habits/logs?habitId=${id}&date=${today}`, { method: "DELETE", headers })
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
  const sportsTotalMinutes = sports.reduce((sum, r) => sum + r.minutes, 0);

  const streak = useMemo(() => {
    const set = new Set(checkins);
    let s = 0;
    const d = new Date();
    if (!set.has(today)) d.setDate(d.getDate() - 1);
    while (set.has(d.toISOString().slice(0, 10))) {
      s += 1;
      d.setDate(d.getDate() - 1);
    }
    return s;
  }, [checkins, today]);

  const focusTask = todayTasks.find((t) => !t.done);
  const checkedInToday = checkins.includes(today);

  const fireCelebrate = (title: string, subtitle?: string) => {
    setCelebrateInfo({ title, subtitle });
  };

  // iOS 大标题联动：滚动时 Hero 轻微上浮、缩小、淡出
  const heroProgress = useSharedValue(0);
  const heroScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      heroProgress.value = e.contentOffset.y;
    },
  });
  const heroAnim = useAnimatedStyle(() => {
    const p = heroProgress.value;
    return {
      transform: [
        { translateY: interpolate(p, [0, 120], [0, -10], { extrapolateRight: "clamp" }) },
        { scale: interpolate(p, [0, 120], [1, 0.94], { extrapolateRight: "clamp" }) },
      ],
      opacity: interpolate(p, [0, 140], [1, 0.55], { extrapolateRight: "clamp" }),
    };
  });

  const sunPulse = useSharedValue(0);
  useEffect(() => {
    sunPulse.value = withRepeat(withTiming(1, { duration: 4400 }), -1, true);
  }, [sunPulse]);
  const sunAnim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.08 * sunPulse.value }],
    opacity: 0.28 + 0.14 * sunPulse.value,
  }));

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (aiTip && aiTip.date === today) return;
    void fetchAiTip().then((text) => {
      if (text) setAiTip(text);
    });
  }, [aiTip, today, setAiTip]);
  const heroTip = aiTip && aiTip.date === today && aiTip.text ? aiTip.text : todayTip;
  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={heroScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl {...todayRefresh} />}
        style={styles.scroll}
        scrollEnabled
        contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.hero, heroAnim]}>
          <Animated.View style={[styles.sunGlow, sunAnim]} />
          {/* v12 P1-3：加一行「日期 + 打卡状态」小标，和健康/饮食页一样有信息层级 */}
          <View style={styles.heroEyebrowRow}>
            <Text style={styles.heroEyebrow}>{today}</Text>
            <View style={[styles.heroPill, checkedInToday && styles.heroPillDone]}>
              <Text style={[styles.heroPillText, checkedInToday && styles.heroPillTextDone]}>
                {checkedInToday ? "今日已打卡" : "今天还没打卡"}
              </Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>
            {greet}，{"\n"}继续今天的 ICT 学习规划
          </Text>
          <Text style={styles.heroSub}>{heroTip}</Text>
        </Animated.View>

        {/* 精力状态快捷选取（参考用户给的 reaction-bar） */}
        <EnergyBar value={energyLevel} onSelect={(l) => void pickEnergy(l)} busy={energyBusy} />

        {/* v4 P2 一键开始：首页唯一的大动作按钮（实色强调色，不用玻璃——首屏已有两个 hero，避免互相抢戏） */}
        <PressableScale
          haptic
          scaleTo={0.97}
          onPress={() => {
            // 打开时清掉上一轮遗留的待启动选择：保证"弹层里没点开始计时 → 一定不会启动"的不变量
            setPendingChoice(null);
            setQuickOpen(true);
          }}
        >
          <View style={styles.quickStart}>
            <View style={styles.quickStartIcon}>
              <ThemedIcon name="play" size={24} color="#fff" />
            </View>
            <View style={styles.quickStartBody}>
              <Text style={styles.quickStartTitle}>一键开始</Text>
              <Text style={styles.quickStartSub}>倒计时 / 正向计时 · 学习或运动</Text>
            </View>
            <ThemedIcon name="chevron-forward" size={20} color="rgba(255,255,255,0.9)" />
          </View>
        </PressableScale>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>今日任务</Text>
          <Text style={styles.sectionMore}>
            {todayDone} / {todayTasks.length} 已完成
            {habitRows.length > 0 ? ` · 习惯 ${habitDone}/${habitRows.length}` : ""}
          </Text>
        </View>

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
                onPress={() => {
                  const willDone = !t.done;
                  haptics.light();
                  toggleTaskDone(t.id);
                  if (willDone) fireCelebrate(t.title, "今日任务 · 已完成");
                }}
              >
              <View style={[styles.taskBox, t.done && styles.taskBoxDone]}>
                {/* v13 U8：勾选时用 strokeDashoffset 画对勾（组件常驻，靠 checked 驱动，才有"画"的过程） */}
                <AnimatedCheckMark checked={t.done} size={16} color="#ffffff" />
              </View>
              <Text style={[styles.taskTitle, t.done && styles.taskDone]} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={styles.taskMeta}>{taskTypeLabels[t.taskType] ?? t.taskType}</Text>
              </Pressable>
            </Animated.View>
          ))
        )}
        {/* 习惯排期（v12 P1-2）：与任务同列显示，点一下就地打卡 */}
        {habitOnlyRows.slice(0, 2).map((h, i) => (
          <Animated.View
            key={"habit-" + h.id}
            style={styles.task}
            entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i + 3))}
          >
            <Pressable
              onPress={() => {
                haptics.light();
                if (!h.done) fireCelebrate(h.name, "习惯打卡完成");
                void toggleHabit(h.id, h.done);
              }}
            >
            <View style={[styles.taskBox, h.done && { backgroundColor: h.color, borderColor: h.color }]}>
              <AnimatedCheckMark checked={h.done} size={16} color="#ffffff" />
            </View>
            <Text style={[styles.taskTitle, h.done && styles.taskDone]} numberOfLines={1}>
              {h.icon ? h.icon + " " : "🔁 "}
              {h.name}
            </Text>
            <Text style={styles.taskMeta}>习惯</Text>
            </Pressable>
          </Animated.View>
        ))}

        {todayTasks.length > 3 || habitOnlyRows.length > 2 ? (
          <Pressable onPress={() => router.push("/tasks" as never)} hitSlop={6} style={styles.inlineMore}>
            <Text style={styles.inlineMoreText}>
              还有 {Math.max(0, todayTasks.length - 3) + Math.max(0, habitOnlyRows.length - 2)} 条 · 查看全部
            </Text>
            <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
          </Pressable>
        ) : null}

        {/* 我的一天：完成度 + 剩余领域入口（学习/运动已并入上面的「一键开始」，不再重复） */}
        <DailyOsSummary />

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>运动 · 健康</Text>
          <Pressable onPress={() => setSportSheetOpen(true)} hitSlop={8} style={styles.addSportBtn}>
            <ThemedIcon name="add" size={16} color={colors.accentStrong} />
            <Text style={styles.addSportText}>添加记录</Text>
          </Pressable>
        </View>

        {/* 首屏只留汇总；逐条明细收进「更多」（v2 §3） */}
        <Card style={styles.sportCard}>
          <View style={styles.sportTotal}>
            <Text style={styles.sportTotalNum}>{(sportsTotalMinutes / 60).toFixed(1)}</Text>
            <Text style={styles.sportTotalUnit}>小时</Text>
            <Text style={styles.sportTotalNote}>今日能量 · 阳光满分</Text>
          </View>
          <Pressable onPress={() => setMoreOpen(true)} hitSlop={6} style={styles.inlineMore}>
            <Text style={styles.inlineMoreText}>
              {sports.length === 0 ? "今天还没有运动记录，去阳光下动一动吧" : `${sports.length} 条记录 · 查看明细`}
            </Text>
            <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
          </Pressable>
        </Card>

        {/* 更多：本周节奏 / 打卡 / 运动明细 / AI 建议（首屏只留重点块） */}
        <SectionHeader title="更多" subtitle="本周节奏 · 打卡 · 运动明细 · AI 建议" actionLabel="展开" onAction={() => setMoreOpen(true)} />
      </Animated.ScrollView>

      <BottomSheet visible={moreOpen} onClose={() => setMoreOpen(false)} title="更多" height="82%">
        <SectionHeader title="本周节奏" />
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <View style={[styles.statIconChip, { backgroundColor: colors.accentSoft }]}>
              <ThemedIcon name="flame" size={18} color={colors.accent} />
            </View>
            <Text style={styles.statLabel}>连续打卡</Text>
            <Text style={styles.statValue}>{streak}<Text style={styles.statValueUnit}> 天</Text></Text>
          </Card>
          <Card style={styles.statCard}>
            <View style={[styles.statIconChip, { backgroundColor: colors.primarySoft }]}>
              <ThemedIcon name="timer" size={18} color={colors.primary} />
            </View>
            <Text style={styles.statLabel}>今日专注</Text>
            <Text style={styles.statValue}>{focusStats.todayMinutes}<Text style={styles.statValueUnit}> 分</Text></Text>
          </Card>
          <Card style={styles.statCard}>
            <View style={[styles.statIconChip, { backgroundColor: colors.successSoft }]}>
              <ThemedIcon name="trending-up" size={18} color={colors.success} />
            </View>
            <Text style={styles.statLabel}>本周进度</Text>
            <Text style={styles.statValue}>{overall}<Text style={styles.statValueUnit}>%</Text></Text>
          </Card>
        </View>

        <Pressable
          style={styles.checkinRow}
          onPress={() => {
            if (!checkedInToday) haptics.success();
            checkinToday();
          }}
        >
          <Text style={styles.checkinRowText}>今日打卡 · 给自己一个正向信号</Text>
          <ThemedIcon name="chevron-forward" size={18} color={colors.accentStrong} />
        </Pressable>

        <SectionHeader title="运动明细" actionLabel="添加" onAction={() => { setMoreOpen(false); setSportSheetOpen(true); }} />
        {sports.length === 0 ? (
          <Text style={styles.sportEmpty}>今天还没有运动记录，去阳光下动一动吧</Text>
        ) : (
          sports.map((r, i) => {
            const { c1 } = sportColorsOf(r.type);
            return (
              <Animated.View
                key={r.id}
                style={styles.sportItem}
                entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))}
              >
                <View style={[styles.sportIco, { backgroundColor: `${c1}1f` }]}>
                  <SportIcon sportKey={r.sportKey} name={r.name} type={r.type} color={c1} active={false} />
                </View>
                <View style={styles.sportItemInfo}>
                  <Text style={styles.sportItemName}>{r.name}</Text>
                  <Text style={styles.sportItemTime}>{formatSport(r.minutes)} · 已完成</Text>
                </View>
                <Pressable onPress={() => removeSport(r.clientId)} hitSlop={8}>
                  <ThemedIcon name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </Animated.View>
            );
          })
        )}

        <SectionHeader title="今日建议" />
        <Card>
          <Text style={styles.quoteText}>{quote}</Text>
          <Text style={styles.heroSub}>{heroTip}</Text>
        </Card>
      </BottomSheet>

      <SportSheet visible={sportSheetOpen} onClose={() => setSportSheetOpen(false)} />
      <QuickStartSheet
        visible={quickOpen}
        onClose={() => setQuickOpen(false)}
        onPick={(choice) => {
          /**
           * ⚠️ 两条不变量（v1.4.2）：
           * 1) `onPick` **只由弹层底部的「开始计时」按钮触发** —— 弹层内的点选只改选择态，
           *    所以"侧滑返回 / 点空白 / 返回键"都只会走 `onClose`，绝不会开始计时（真机反馈）。
           * 2) 不能在这里直接 `setFocusOpen(true)`：QuickStartSheet 是 Modal，退场还要 180ms 才卸载，
           *    同帧再 present 全屏 Modal 会出现两个 Modal 叠加（iOS 上表现为"点了没反应"）；
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
           * v5 P2-1：一键开始路径**不再隐式绑定"今天第一个未完成任务"**
           * （用户不可控，专注会被算到无关任务上）；改为用"这次学什么"作为标题。
           * 「今日轮播卡 → 开始专注」这条既有路径（timerAuto 为空）仍然绑定 focusTask。
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
          // 关闭时清空一键开始的配置：否则之后从轮播卡「开始专注」进入计时器时，
          // 会继承上一次的运动类型/时长并再次自动开始（写错数据 + 跳过准备页）。
          setFocusOpen(false);
          setTimerAuto(null);
        }}
        onRecorded={(taskId, seconds, label) =>
          // 轮播卡绑定今日任务时用任务标题兜底（一键开始路径 label 由用户选择决定）
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
    backgroundColor: "#2F74C0",
    ...shadows.floating,
  },
  quickStartIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
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
    color: colors.text,
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
  taskTitle: { flex: 1, ...typography.callout, fontWeight: "600", color: colors.text },
  taskDone: { textDecorationLine: "line-through", color: colors.textMuted },
  taskMeta: { ...typography.caption, color: colors.textMuted },
  taskEmpty: { ...typography.caption, color: colors.textMuted, textAlign: "center", paddingVertical: 4 },
  // v13 U12：底纹绝对定位铺满，卡片要裁切
  taskEmptyCard: { overflow: "hidden" },

  statsGrid: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, gap: 6, padding: 14 },
  statIconChip: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statLabel: { ...typography.caption, color: colors.textMuted },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.text },
  statValueUnit: { ...typography.caption, fontWeight: "600", color: colors.textMuted },

  checkinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  checkinRowText: { ...typography.caption, fontWeight: "700", color: colors.accentStrong },

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
