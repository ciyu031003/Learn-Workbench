import { useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { router } from "expo-router";
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
import { useHeaderTopInset } from "@/components/screen-header";
import { SportThemedIcon, ThemedIcon } from "@/components/themed-icon";
import { AnimatedCheckMark } from "@/components/check-mark";
import { PatternBackdrop } from "@/components/pattern-backdrop";
import { FocusTimer } from "@/components/focus-timer";
import { QuickStartSheet, type QuickStartChoice } from "@/components/quick-start-sheet";
import { BottomSheet } from "@/components/bottom-sheet";
import { SheetStickyCta } from "@/components/sheet";
import { CelebrationModal } from "@/components/celebration-modal";
import { RingProgress } from "@/components/ring-progress";
import { PressableScale } from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { PageHead } from "@/components/v2/page-head";
import { SectionTitle } from "@/components/v2/section-title";
import { MoodPicker } from "@/components/v2/mood-picker";
import { HabitRow } from "@/components/v2/habit-row";
import { ProgressBar } from "@/components/v2/progress-bar";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { useAppStore } from "@/store/app-store";
import type { ExerciseType, Habit, HabitLog } from "@learn-workbench/shared/schemas";
import type { SportItem } from "@learn-workbench/shared/types";
import { SPORT_CATALOG, exerciseTypeOptions, taskTypeLabels } from "@learn-workbench/shared/labels";
import { isScheduled, pct } from "@learn-workbench/shared/dates";
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
import { fetchLatestEnergy, logEnergy } from "@/lib/energy";
import { haptics } from "@/lib/haptics";
import { radius, shadows, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { computeFocusStats } from "@/lib/focus-stats";
import { getDailyQuote } from "@/lib/quotes";
import { fetchAiTip } from "@/lib/ai-tip";
import { buildSportTrend } from "@/lib/sport-trend";
import { fetchHydration, fetchNutritionTarget } from "@/lib/wellbeing-client";
import { toDaySummaryMap } from "@/lib/nutrition-views";
import { localKey } from "@/lib/focus-series";
import { withAlpha } from "@/lib/chart-math";
import { TEXT_SCALE_POLICY } from "@/lib/text-scale";
import { loadLearningAttempts } from "@/lib/learning-progress";
import { readCachedRoadmap } from "@/lib/roadmap";
import { summarizeLearningAttempts as summarizeLearningEvidence } from "@learn-workbench/shared/learning";

/**
 * 每日目标（v1.62 P0-2）：题库 20 题与学习页 DAILY_QUESTION_GOAL 同值（learn.tsx 内部常量，
 * 这里只做展示，不改口径）；运动 30 分钟是目标条「训练」的参考线，同样只用于展示进度。
 */
const DAILY_QUESTION_GOAL = 20;
const DAILY_SPORT_GOAL_MINUTES = 30;
/** 阅读目标（v2）：今日页没有阅读分钟数据源，目标条按「0/30m」展示，不编造进度 */
const DAILY_READING_GOAL_MINUTES = 30;
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;
/** 本周 7 格：周一起（中文习惯），与原型 V3 一致 */
const WEEK_INITIALS = ["一", "二", "三", "四", "五", "六", "日"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function useDailyQuote() {
  return useMemo(() => getDailyQuote(), []);
}

/**
 * 本周 7 格（周一起）的日期键。
 * 业务日期来自 todayISOInZone()（东八区口径），这里只在**日期字符串**上做算术：
 * 先归一成 UTC 正午再逐日偏移，避免设备时区 / 夏令时把格子挪错一天。
 */
function buildWeekGrid(todayIso: string): { iso: string; label: string }[] {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayIso);
  const base = parts
    ? Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : Date.now();
  const monday = base - ((new Date(base).getUTCDay() + 6) % 7) * DAY_MS;
  return WEEK_INITIALS.map((label, i) => ({
    iso: new Date(monday + i * DAY_MS).toISOString().slice(0, 10),
    label,
  }));
}

/** 专注模式胶囊（刷题 / 阅读 / 训练）：沿用原焦点卡的三个入口，点击跳到对应页面 */
function ModePill({
  icon,
  label,
  onPress,
  accessibilityLabel,
}: {
  icon: ComponentProps<typeof ThemedIcon>["name"];
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      haptic
      scaleTo={0.97}
      onPress={onPress}
      hitSlop={8}
      style={styles.pill}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <ThemedIcon name={icon} size={14} color={colors.primary} />
      <Text style={styles.pillText} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * 双列小卡（今日学习 / 今日饮水）：整张卡可点。
 * v2.2：语义色图标芯片 + 顶部轻微渐变 + 同色描边，环加粗（6→10）并放大到 86，
 * 环心主数值提到 typography.num（20/800）；无数据仍显示「—」，颜色降到 textSecondary 保证可读。
 * 数值是「环内徽标」性质的紧凑 UI，按 lib/text-scale 的 chrome 策略封顶 1.3 倍，
 * 保证 130% 系统字号下仍完整落在环心里（不截断）。
 */
function MiniStatCard({
  label,
  percent,
  hint,
  icon,
  tone = "primary",
  onPress,
  accessibilityLabel,
}: {
  label: string;
  /** 0–100 的百分比；null = 没有数据（环心显示「—」） */
  percent: number | null;
  hint: string;
  icon: ComponentProps<typeof ThemedIcon>["name"];
  tone?: "primary" | "accent";
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ratio = percent === null ? 0 : Math.max(0, Math.min(100, percent)) / 100;
  const isAccent = tone === "accent";
  const strong = isAccent ? colors.accent : colors.primary;
  const soft = isAccent ? colors.accentSoft : colors.primarySoft;
  /** 每个实例独立 id：SVG 渐变 id 全局可见，固定 id 在多实例复用时会串色 */
  const rawId = useId();
  const gradientId = useMemo(() => "miniCard" + rawId.replace(/[^a-zA-Z0-9]/g, ""), [rawId]);
  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.miniCard,
        { borderColor: withAlpha(strong, 0.24) },
        pressed && styles.miniCardPressed,
      ]}
    >
      {/* 轻微渐变：语义 soft 从左上淡出到卡面（只用 token，卡片 overflow:hidden 兜住圆角） */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor={soft} stopOpacity={1} />
            <Stop offset="1" stopColor={soft} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={"url(#" + gradientId + ")"} />
      </Svg>

      <View style={styles.miniHead}>
        <View style={[styles.miniIcon, { backgroundColor: soft, borderColor: withAlpha(strong, 0.22) }]}>
          <ThemedIcon name={icon} size={14} color={strong} />
        </View>
        <Text style={styles.miniLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <View style={styles.miniRing}>
        <RingProgress
          size={86}
          strokeWidth={10}
          progress={ratio}
          trackColor={colors.surfaceMuted}
          from={isAccent ? colors.accent : colors.primary}
          to={isAccent ? colors.sun : colors.chart[1]}
        />
        <View pointerEvents="none" style={styles.miniRingLabel}>
          <Text
            style={[styles.miniRingValue, tabularNums, percent === null && styles.miniRingMuted]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            {...TEXT_SCALE_POLICY.chrome}
          >
            {percent === null ? "—" : percent + "%"}
          </Text>
        </View>
      </View>

      {/* 不设 numberOfLines：130% 系统字号下长 hint 换行而不是被省略号截断 */}
      <Text style={styles.miniHint}>
        {hint}
      </Text>
    </Pressable>
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
      { rotate: rotate.value + "deg" },
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
          label={"记录 " + (current?.name ?? "—") + " " + minutes + " 分钟"}
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
              <View style={[styles.sportTypeIcon, { backgroundColor: sportColorsOf(t.type).c1 + "22" }]}>
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
  /** 今日精力状态（1-5，来自 /api/wellbeing/energy）→ v2 MoodPicker */
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
  const h = new Date().getHours();
  const greet = h < 6 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
  /** Hero 的一行日期（v2：问候 + 日期 + 打卡数 + 本周 7 格） */
  const dateLabel = useMemo(
    () => (todayDate.getMonth() + 1) + " 月 " + todayDate.getDate() + " 日 · 周" + WEEKDAY_LABELS[todayDate.getDay()],
    [todayDate]
  );
  /** 本周 7 格：周一 → 周日，业务日期（东八区）参与比较 */
  const week = useMemo(() => buildWeekGrid(today), [today]);
  const weekChecked = useMemo(() => week.filter((d) => checkins.includes(d.iso)).length, [week, checkins]);

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
      const headers = { Authorization: "Bearer " + token };
      const [summary, target, hydration] = await Promise.all([
        fetch(getApiUrl() + "/api/nutrition/summary?days=1", { headers })
          .then((r) => (r.ok ? (r.json() as Promise<{ summary?: unknown }>) : null))
          .catch(() => null),
        fetchNutritionTarget(token).catch(() => null),
        fetchHydration(token).catch(() => null),
      ]);
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
   * 健康/运动快照（v1.62 P0-2）：只用今日页既有的运动数据源（store.sports 经 sport-trend 汇总）。
   * v2 双列小卡只看「今日学习 / 今日饮水」；训练进度放在专注卡的目标条里。
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

  /** 今日学习小卡：本地数据全空（未登录 / 新装 / 还没学）时渲染「—」而不是假 0 */
  const learningEmpty =
    learningSnapshot.questionsToday === 0 &&
    learningSnapshot.stageTotal === 0 &&
    focusStats.todayMinutes === 0;
  /** 今日学习环 = 阶段主题完成度（与旧「学习进度」百分比同源）；无 roadmap 缓存 → null（「—」） */
  const learningPercent =
    learningSnapshot.stageTotal > 0
      ? pct(learningSnapshot.stageDone, learningSnapshot.stageTotal)
      : null;
  const learningHint = learningEmpty
    ? "今天还没有学习记录"
    : "专注 " + focusStats.todayMinutes + " 分" +
      (learningSnapshot.stageTotal > 0
        ? " · 阶段 " + learningSnapshot.stageDone + "/" + learningSnapshot.stageTotal
        : "");
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

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={todayScrollRef}
        refreshControl={<RefreshControl {...todayRefresh} />}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ① 页头（原型 V3）：eyebrow + 27/800 主标题 + 一句说明 */}
        <PageHead
          eyebrow="PERSONAL WORKSPACE"
          title="今日"
          subtitle="先定一件最重要的小事，按节奏完成今天的计划。"
        />

        {/*
          ② 实景带（每日一景 = 本屏视觉锚点）：
          高山云海实景 + 顶部场景说明 + 时分问候 + 连续打卡 + 本周 7 格（白格已打卡 / 橘格今天）。
          白字靠上下暗场保证可读；图片本地打包，不依赖网络。
        */}
        <View style={styles.hero}>
          <Image
            source={require("../../../assets/images/scene-hero.jpg")}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          {/* 上下暗场：实景上的白字可读，且不遮挡画面中部（SVG 渐变，无硬边） */}
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id="heroScrimTop" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#08131B" stopOpacity={0.42} />
                <Stop offset="1" stopColor="#08131B" stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="heroScrimBottom" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#08131B" stopOpacity={0} />
                <Stop offset="1" stopColor="#08131B" stopOpacity={0.55} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="120" fill="url(#heroScrimTop)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroScrimBottom)" />
          </Svg>

          {/* 顶部：场景说明 + 打卡 pill */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroSceneRow}>
              <ThemedIcon name="image-outline" size={13} color="#FFFFFF" />
              <Text style={styles.heroSceneText}>每日一景 · 云海日出</Text>
            </View>
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
              <ThemedIcon
                name={checkedInToday ? "checkmark-circle" : "flame"}
                size={14}
                color={checkedInToday ? colors.primary : colors.accent}
              />
              <Text style={[styles.checkinText, checkedInToday && styles.checkinTextDone]} numberOfLines={1}>
                {checkedInToday ? "已打卡 · " + streak + " 天" : "打卡"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.heroHeadText}>
            <Text style={styles.heroGreet}>{greet}</Text>
            <Text style={styles.heroDate}>{dateLabel}</Text>
          </View>

          {/* 连续打卡：数值（30/800）与标签（11/400）拉开三档，标签只做说明不抢视线 */}
          {streak > 0 ? (
            <View style={styles.heroStreakRow}>
              <Text style={[styles.heroStreakNum, tabularNums]}>{streak}</Text>
              <Text style={styles.heroStreakUnit}>天</Text>
              <Text style={styles.heroStreakLabel}>连续打卡</Text>
            </View>
          ) : (
            <Text style={styles.heroStreakHint}>0 天 · 完成第一个习惯即可开启</Text>
          )}

          <View style={styles.heroWeekHead}>
            <Text style={styles.heroWeekTitle}>本周打卡</Text>
            <Text style={[styles.heroWeekMeta, tabularNums]}>
              <Text style={styles.heroWeekMetaNum}>{weekChecked}</Text>
              {"/7 天"}
            </Text>
          </View>
          <View style={styles.heroWeekRow} accessible accessibilityLabel={"本周已打卡 " + weekChecked + " 天"}>
            {week.map((d) => {
              const checked = checkins.includes(d.iso);
              const isToday = d.iso === today;
              return (
                <View key={d.iso} style={styles.heroWeekCell}>
                  <View
                    style={[
                      styles.heroWeekDot,
                      checked && styles.heroWeekDotDone,
                      isToday && !checked && styles.heroWeekDotToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.heroWeekText,
                        checked && styles.heroWeekTextDone,
                        isToday && !checked && styles.heroWeekTextToday,
                      ]}
                    >
                      {d.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.heroTipRow}>
            <View style={styles.heroTipDot} />
            <Text style={styles.heroTip} numberOfLines={2}>
              {heroTip}
            </Text>
          </View>
        </View>

        {/* ③ 今天的状态（v2 MoodPicker 替换旧 EnergyBar；数据与提交沿用 /api/wellbeing/energy） */}
        <MoodPicker value={energyLevel} onSelect={(l) => void pickEnergy(l)} busy={energyBusy} />

        {/*
          ④ 专注卡（Surface tier=glassStrong，本屏唯一的强玻璃锚点）：
          eyebrow + 标题 + 专注模式胶囊 + 开始专注 CTA + 三格目标条（刷题 / 阅读 / 训练）。
          CTA 沿用 focusOpen / FocusTimer / QuickStartSheet 的既有链路，不新增动画调用点。
        */}
        <Surface tier="glassStrong" corner={radius.panel} style={styles.focusCard}>
          <View style={styles.focusHead}>
            <View style={styles.focusHeadText}>
              <Text style={styles.eyebrow}>FOCUS SPACE</Text>
              <Text style={styles.focusTitle}>给重要的事留一段完整时间</Text>
              <Text style={styles.focusSub}>选一种模式，从 25 分钟开始</Text>
            </View>
            <View style={styles.focusModePill}>
              <Text style={styles.focusModeText}>专注模式</Text>
            </View>
          </View>

          <View style={styles.pillRow}>
            <ModePill
              icon="layers-outline"
              label="刷题"
              accessibilityLabel="刷题，去题库"
              onPress={() => router.push("/quiz" as never)}
            />
            <ModePill
              icon="book-outline"
              label="阅读"
              accessibilityLabel="阅读，去学习页"
              onPress={() => router.push("/learn" as never)}
            />
            <ModePill
              icon="barbell-outline"
              label="训练"
              accessibilityLabel="训练，添加运动记录"
              onPress={() => setSportSheetOpen(true)}
            />
          </View>

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
            <View style={styles.startTextWrap}>
              <Text style={styles.startTitle} numberOfLines={1}>
                开始专注
              </Text>
              <Text style={styles.startSub} numberOfLines={1}>
                选内容与时长，立即进入计时
              </Text>
            </View>
            <ThemedIcon name="chevron-forward" size={18} color={colors.canvas} />
          </PressableScale>

          {/* 三格目标条：标签（12/600 弱化）与数值（15/800 语义色）拉开权重，条加粗到 8 */}
          <View style={styles.goalList}>
            <View style={styles.goalRow}>
              <View style={styles.goalHead}>
                <View style={styles.goalName}>
                  <View style={[styles.goalDot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.goalLabel}>刷题</Text>
                </View>
                <Text style={[styles.goalValue, tabularNums, { color: colors.primary }]}>
                  {learningSnapshot.questionsToday}/{DAILY_QUESTION_GOAL}
                </Text>
              </View>
              <ProgressBar value={learningSnapshot.questionsToday / DAILY_QUESTION_GOAL} tone="primary" height={8} />
            </View>
            <View style={styles.goalRow}>
              <View style={styles.goalHead}>
                <View style={styles.goalName}>
                  <View style={[styles.goalDot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.goalLabel}>阅读</Text>
                </View>
                {/* 阅读分钟没有本地/接口数据源（不新增接口）→ 按任务书显示 0/30m，不编造进度 */}
                <Text style={[styles.goalValue, tabularNums, { color: colors.accent }]}>
                  {0}/{DAILY_READING_GOAL_MINUTES}m
                </Text>
              </View>
              <ProgressBar value={0} tone="accent" height={8} />
            </View>
            <View style={styles.goalRow}>
              <View style={styles.goalHead}>
                <View style={styles.goalName}>
                  <View style={[styles.goalDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.goalLabel}>训练</Text>
                </View>
                <Text style={[styles.goalValue, tabularNums, { color: colors.success }]}>
                  {todaySport.minutes}/{DAILY_SPORT_GOAL_MINUTES}m
                </Text>
              </View>
              <ProgressBar value={todaySport.minutes / DAILY_SPORT_GOAL_MINUTES} tone="success" height={8} />
            </View>
          </View>
        </Surface>

        {/* ⑤ 今日习惯（v2 HabitRow）：沿用 habitRows 打卡 + 乐观更新 + linked 过滤 */}
        <SectionTitle
          title="今日习惯"
          right={
            <Text style={styles.sectionMeta}>
              已完成 {habitOnlyDone}/{habitOnlyRows.length}
            </Text>
          }
        />
        {habitOnlyRows.length === 0 ? (
          <Surface tier="surface" style={styles.habitEmpty}>
            <Text style={styles.habitEmptyText}>
              {habitRows.length > 0
                ? "今天排期的习惯都已并入上面的任务，直接勾任务即可"
                : "今天没有排期的习惯，去健康页添加一个"}
            </Text>
          </Surface>
        ) : (
          habitOnlyRows.map((row, i) => (
            <Animated.View
              key={"habit-" + row.id}
              entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))}
            >
              <HabitRow
                icon={habitIconName(row.icon)}
                title={row.name}
                subtitle="习惯"
                done={row.done}
                onToggle={() => {
                  if (!row.done) fireCelebrate(row.name, "习惯打卡完成");
                  void toggleHabit(row.id, row.done);
                }}
              />
            </Animated.View>
          ))
        )}

        {/* ⑥ 今日任务（紧凑行式，放在习惯之后；勾选/庆祝逻辑与 1.66 一致） */}
        <SectionTitle
          title="今日任务"
          right={<Text style={styles.sectionMeta}>{todayDone}/{todayTasks.length} 已完成</Text>}
          actionLabel="查看全部"
          onAction={() => router.push("/tasks" as never)}
        />

        {todayTasks.length === 0 ? (
          <Surface tier="surface" style={styles.taskEmptyCard}>
            {/* v13 U12：任务页空状态的低透明度几何底纹 */}
            <PatternBackdrop variant="chevron" />
            <Text style={styles.taskEmpty}>今天还没有任务，去学习页添加一个吧</Text>
          </Surface>
        ) : (
          <Surface tier="surface" style={styles.listCard}>
            {todayTasks.slice(0, 3).map((t, i) => (
              <Animated.View
                key={t.id}
                entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))}
              >
                <Pressable
                  style={styles.taskRowCompact}
                  hitSlop={4}
                  onPress={() => {
                    const willDone = !t.done;
                    haptics.light();
                    toggleTaskDone(t.id);
                    if (willDone) fireCelebrate(t.title, "今日任务 · 已完成");
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: t.done }}
                  accessibilityLabel={t.title + (t.done ? "，已完成" : "，未完成")}
                >
                  <View style={[styles.taskBox, t.done && styles.taskBoxDone]}>
                    {/* v13 U8：勾选时用 strokeDashoffset 画对勾（组件常驻，靠 checked 驱动，才有「画」的过程） */}
                    {/* 审查修复：canvas 对 success 绿底仅 2.88（< 非文本 3.0），白色对绿底 3.18 */}
                    <AnimatedCheckMark checked={t.done} size={16} color="#FFFFFF" />
                  </View>
                  <View style={styles.taskBody}>
                    <Text style={[styles.taskTitle, t.done && styles.taskDone]} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={styles.taskMeta}>{taskTypeLabels[t.taskType] ?? t.taskType}</Text>
                  </View>
                  <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
                </Pressable>
                {i < Math.min(todayTasks.length, 3) - 1 ? <View style={styles.rowDivider} /> : null}
              </Animated.View>
            ))}
          </Surface>
        )}

        {/* ⑦ 双列小卡：今日学习（本地题库/专注） / 今日饮水（接口）；点击沿用原跳转 */}
        <View style={styles.dualRow}>
          <MiniStatCard
            label="今日学习"
            percent={learningPercent}
            hint={learningHint}
            icon="book-outline"
            onPress={() => router.push("/learn" as never)}
            accessibilityLabel="今日学习，打开学习页"
          />
          <MiniStatCard
            label="今日饮水"
            percent={waterPercent}
            hint={waterHint}
            icon="water-outline"
            tone="accent"
            onPress={() => router.push("/wellness" as never)}
            accessibilityLabel="今日饮水，打开健康页"
          />
        </View>

        {/* 每日语录：原「更多」抽屉里的装饰内容，保留为页尾一行（不占入口） */}
        <Text style={styles.quoteFoot} numberOfLines={2}>
          {quote}
        </Text>
      </Animated.ScrollView>

      <SportSheet visible={sportSheetOpen} onClose={() => setSportSheetOpen(false)} motionActive={motionActive} />
      <QuickStartSheet
        visible={quickOpen}
        /**
         * v2.0.1 真机反馈：专注开始界面要一屏展示、不要上下滑动。
         * oneScreen = 近全屏、不滚动的一屏启动页（时长档位 + 计时方式 + 底部励志短句），
         * 仍然只产出 QuickStartChoice，onPick / onClosed 的既有链路（先关弹层再开计时器）不变。
         */
        oneScreen
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
    /** v2.2.2：根容器必须不透明 —— Tab 场景叠放叠滑时不透出下层（与 sceneStyle 的 canvas 双保险） */
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 17, paddingBottom: 24, gap: 14 },

    // ---- 实景带（每日一景，白字 + 暗场）----
    hero: {
      gap: 12,
      padding: 18,
      borderRadius: radius.panel,
      overflow: "hidden",
      ...shadows.card,
    },
    heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    heroSceneRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    heroSceneText: { ...typography.micro, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.4 },
    heroHeadText: { gap: 2 },
    heroGreet: { ...typography.hero, color: "#FFFFFF" },
    heroDate: { ...typography.meta, color: "rgba(255,255,255,0.78)" },
    checkinPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      minHeight: 36,
      paddingHorizontal: 13,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.55)",
      backgroundColor: "rgba(255,255,255,0.20)",
    },
    checkinPillDone: { borderColor: "rgba(255,255,255,0.85)", backgroundColor: "rgba(255,255,255,0.88)" },
    checkinText: { ...typography.caption, fontWeight: "700", color: "#FFFFFF" },
    checkinTextDone: { color: colors.primaryStrong },
    heroStreakRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
    /* 数值 30/800 → 单位 11/700 → 标签 11/400：三级重量差撑开层级 */
    heroStreakNum: { ...typography.display, color: "#FFFFFF" },
    heroStreakUnit: { ...typography.micro, fontWeight: "700", color: "rgba(255,255,255,0.85)" },
    heroStreakLabel: { ...typography.meta, color: "rgba(255,255,255,0.72)", marginLeft: 2 },
    heroStreakHint: { ...typography.meta, color: "rgba(255,255,255,0.72)", marginTop: -4 },
    heroWeekHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
    heroWeekTitle: { ...typography.meta, fontWeight: "600", color: "rgba(255,255,255,0.82)" },
    heroWeekMeta: { ...typography.meta, color: "rgba(255,255,255,0.72)" },
    heroWeekMetaNum: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
    heroWeekRow: { flexDirection: "row", gap: 6 },
    heroWeekCell: { flex: 1, minWidth: 0 },
    heroWeekDot: {
      height: 32,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.16)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.35)",
    },
    heroWeekDotDone: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
    /* 今天格强制阳光橘（提案：橘只给「今天」一个角色） */
    heroWeekDotToday: { backgroundColor: colors.accent, borderColor: colors.accent, borderWidth: 1 },
    heroWeekText: { ...typography.meta, fontWeight: "700", color: "rgba(255,255,255,0.72)" },
    heroWeekTextDone: { color: colors.text },
    heroWeekTextToday: { color: "#FFFFFF" },
    heroTipRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
    heroTipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#FFFFFF", marginTop: 6 },
    heroTip: { ...typography.meta, color: "rgba(255,255,255,0.82)", lineHeight: 16, flex: 1, minWidth: 0 },

    // ---- 专注卡（glassStrong）----
    focusCard: { padding: 18, gap: 14 },
    focusModePill: {
      minHeight: 28,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.glassBorder,
      justifyContent: "center",
    },
    focusModeText: { ...typography.micro, fontWeight: "700", color: colors.primaryStrong },
    focusHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
    focusHeadText: { flex: 1, minWidth: 0, gap: 3 },
    eyebrow: { ...typography.eyebrow, color: colors.textFaint },
    focusTitle: { ...typography.title2, color: colors.text },
    focusSub: { ...typography.meta, color: colors.textMuted },
    focusToday: { alignItems: "flex-end", minWidth: 56 },
    focusTodayNum: { ...typography.num, color: colors.primary },
    focusTodayUnit: { ...typography.meta, color: colors.textMuted },
    pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    pill: {
      flexGrow: 1,
      flexBasis: "30%",
      minWidth: 0,
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
    },
    pillText: { ...typography.caption, fontWeight: "700", color: colors.primaryStrong, flexShrink: 1 },
    startButton: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      borderRadius: radius.card,
      backgroundColor: colors.primary,
      ...shadows.brand,
    },
    startIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.canvas,
    },
    startTextWrap: { flex: 1, minWidth: 0, gap: 1 },
    startTitle: { ...typography.headline, fontWeight: "800", color: colors.canvas },
    startSub: { ...typography.meta, color: colors.canvas, opacity: 0.72 },
    goalList: {
      gap: 12,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    goalRow: { gap: 7 },
    goalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    goalName: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
    goalDot: { width: 6, height: 6, borderRadius: 3 },
    goalLabel: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
    goalValue: { ...typography.callout, fontWeight: "800" },

    // ---- 区块右侧计数 ----
    sectionMeta: { ...typography.meta, fontWeight: "700", color: colors.textMuted, marginLeft: "auto", paddingLeft: 8 },

    // ---- 今日任务（紧凑行式：一张实底卡 + 行分隔线）----
    listCard: { paddingVertical: 6, paddingHorizontal: 8, gap: 0 },
    taskRowCompact: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingVertical: 8 },
    rowDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 32,
      marginVertical: 2,
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
    taskRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    taskBody: { flex: 1, minWidth: 0, gap: 1 },
    taskTitle: { ...typography.callout, fontWeight: "600", color: colors.text, flexShrink: 1 },
    taskDone: { textDecorationLine: "line-through", color: colors.textSecondary },
    taskMeta: { ...typography.caption, color: colors.textMuted },
    taskEmpty: { ...typography.caption, color: colors.textMuted, textAlign: "center", paddingVertical: 4 },
    taskEmptyCard: { overflow: "hidden", alignItems: "center", paddingVertical: 22 },

    // ---- 今日习惯 ----
    habitEmpty: { paddingVertical: 16 },
    habitEmptyText: { ...typography.caption, color: colors.textMuted, textAlign: "center" },

    // ---- 双列小卡 ----
    dualRow: { flexDirection: "row", gap: 12, alignItems: "stretch" },
    miniCard: {
      flex: 1,
      minWidth: 0,
      minHeight: 176,
      gap: 8,
      padding: 14,
      borderRadius: radius.card,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      /** 顶部渐变要跟着圆角裁掉，否则四角会露出生硬的方角色块 */
      overflow: "hidden",
      ...shadows.card,
    },
    miniCardPressed: { opacity: 0.85 },
    miniHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    miniIcon: {
      width: 28,
      height: 28,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth * 2,
      alignItems: "center",
      justifyContent: "center",
    },
    /** 标签压在语义 soft 渐变上：用 textSecondary 保证 12pt 小字仍过 WCAG（textMuted 在 soft 底上只有 ~4.2） */
    miniLabel: { ...typography.caption, fontWeight: "700", color: colors.textSecondary, flexShrink: 1 },
    miniRing: { width: 86, height: 86, alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: 2 },
    miniRingLabel: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    miniRingValue: { ...typography.num, color: colors.text },
    miniRingMuted: { color: colors.textSecondary },
    miniHint: { ...typography.meta, color: colors.textMuted, lineHeight: 17 },

    quoteFoot: { ...typography.caption, lineHeight: 18, color: colors.textMuted, textAlign: "center", paddingHorizontal: 8 },

    // ---- 运动弹层（沿用 v1 视觉；不动交互）----
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
  });
