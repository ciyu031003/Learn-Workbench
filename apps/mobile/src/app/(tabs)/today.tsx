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
import { MoodPicker } from "@/components/v2/mood-picker";
import { AreaChart } from "@/components/v2/charts";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { useAppStore } from "@/store/app-store";
import { useIdentity } from "@/hooks/use-identity";
import { absoluteMediaUrl } from "@/lib/uploads";
import type { DailyTask, ExerciseType, Habit, HabitLog } from "@learn-workbench/shared/schemas";
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
import { fetchLatestEnergy, logEnergy } from "@/lib/energy";
import { haptics } from "@/lib/haptics";
import { radius, shadows, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { computeFocusStats } from "@/lib/focus-stats";
import { getDailyQuote } from "@/lib/quotes";
import { fetchAiTip } from "@/lib/ai-tip";
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
/** 每日专注目标（v3 原型「日目标」环）：180 分钟，只用于展示进度百分比，不改任何统计口径 */
const DAILY_FOCUS_GOAL_MINUTES = 180;
/** 实景带取景时刻：本地打包图的静态展示信息，不随设备时间变化 */
const SCENE_TIME = "06:52";

/** ISO 周号（与原型「第 46 周」同口径） */
function isoWeekNo(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
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
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
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
  const addSportSeconds = useAppStore((s) => s.addSportSeconds);
  const aiTip = useAppStore((s) => s.aiTip);
  const setAiTip = useAppStore((s) => s.setAiTip);
  const token = useAppStore((s) => s.token);
  const identity = useIdentity();

  const [focusOpen, setFocusOpen] = useState(false);
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  /** 完成任务的庆祝弹窗（null = 关闭） */
  const [celebrateInfo, setCelebrateInfo] = useState<{ title: string; subtitle?: string } | null>(null);
  /** v3 顶栏通知弹层 */
  const [notifOpen, setNotifOpen] = useState(false);
  /** v3 任务详情面板：点任务行打开（null = 关闭） */
  const [detailTask, setDetailTask] = useState<DailyTask | null>(null);
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
  const focusGoalPercent = Math.min(100, Math.round((focusMinutesToday / DAILY_FOCUS_GOAL_MINUTES) * 100));
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
    Math.round((weekFocusMinutes / (DAILY_FOCUS_GOAL_MINUTES * 7)) * 100)
  );
  const weekFocusHint =
    weekFocusMinutes === 0
      ? "本周还没有专注记录"
      : Math.floor(weekFocusMinutes / 60) + "h " + String(weekFocusMinutes % 60).padStart(2, "0") +
        "m · 较前 7 天 " + (focusDelta >= 0 ? "+" : "") + focusDelta + "m";
  const mainSubject = focusStats.weekByContent[0]?.label ?? null;
  const pomodoroNo = focusStats.todaySessions + 1;
  const quickStartLabel = "25 分钟 · " + (mainSubject ?? "自由专注") + " · 第 " + pomodoroNo + " 个番茄";
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

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={todayScrollRef}
        refreshControl={<RefreshControl {...todayRefresh} />}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ① 顶栏：wordmark + 通知 + 头像（原型 v3 一屏结构） */}
        <View style={styles.v3Topline}>
          <Text style={styles.v3Wordmark}>LEARN · WORKBENCH</Text>
          <View style={styles.v3TopActions}>
            <Pressable
              hitSlop={10}
              onPress={() => { haptics.light(); setNotifOpen(true); }}
              style={styles.v3IconBtn}
              accessibilityRole="button"
              accessibilityLabel="通知"
            >
              <ThemedIcon name="notifications-outline" size={19} color={colors.text} />
              {/* 对齐 demo .icon-btn.notif：右上角一枚橙色未读小圆点（避开已存在的 v3NotifDot 命名） */}
              <View pointerEvents="none" style={styles.v3BellDot} />
            </Pressable>
            <Pressable
              hitSlop={10}
              onPress={() => router.push("/settings" as never)}
              style={styles.v3Avatar}
              accessibilityRole="button"
              accessibilityLabel="打开我的（设置）"
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.v3AvatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.v3AvatarText}>{avatarLetter}</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* ② 问候区（在实景带之外）：日期 · 星期 · 周号 / 问候 / 今天几件事 */}
        <View style={styles.v3Greet}>
          <View style={styles.v3GreetDate}>
            <Text style={styles.v3GreetDateText}>{dateLabel}</Text>
            <View style={styles.v3GreetDot} />
            <Text style={styles.v3GreetDateText}>{"第 " + weekNo + " 周"}</Text>
          </View>
          <Text style={styles.v3GreetTitle} accessibilityRole="header">
            {greetLine}
          </Text>
          <Text style={styles.v3GreetSub}>{greetSub}</Text>
        </View>

        {/* ③ 实景带（每日一景）：本地打包图 + 上下暗场保证白字可读 */}
        <View style={styles.v3Scene}>
          <Image
            source={require("../../../assets/images/scene-hero.jpg")}
            style={[StyleSheet.absoluteFill, styles.sceneImgFill]}
            resizeMode="cover"
          />
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id="v3SceneScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#06121A" stopOpacity={0.44} />
                <Stop offset="0.34" stopColor="#06121A" stopOpacity={0.04} />
                <Stop offset="1" stopColor="#06121A" stopOpacity={0.46} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#v3SceneScrim)" />
          </Svg>
          <View style={styles.v3SceneCap}>
            <View style={styles.v3SceneName}>
              <View style={styles.v3SceneDot} />
              <Text style={styles.v3SceneNameText}>每日一景 · 云海日出</Text>
            </View>
            <Text style={styles.v3SceneTime}>{SCENE_TIME}</Text>
          </View>
        </View>

        {/* ④ 今日专注：与实景带分开，避免图片被半透明卡片压住 */}
        <Surface tier="elevated" corner={26} style={styles.v3FocusShell}>
          <View style={styles.v3FsHead}>
            <View style={styles.v3FsHeadText}>
              <View style={styles.v3FsKicker}>
                <ThemedIcon name="timer-outline" size={13} color={colors.accent} />
                <Text style={styles.v3FsKickerText}>今日专注</Text>
              </View>
              <View
                style={styles.v3FsBig}
                accessible
                accessibilityLabel={"今日专注 " + focusH + " 小时 " + focusM + " 分，日目标完成 " + focusGoalPercent + "%"}
              >
                <Text style={[styles.v3FsBigNum, tabularNums]}>{focusH}</Text>
                <Text style={styles.v3FsBigUnit}>h</Text>
                <Text style={[styles.v3FsBigNum, tabularNums]}>{focusM}</Text>
                <Text style={styles.v3FsBigUnit}>m</Text>
              </View>
            </View>
            <View style={styles.v3FsBadge}>
              <RingProgress
                size={56}
                strokeWidth={5}
                progress={focusGoalPercent / 100}
                trackColor={colors.surfaceMuted}
                from={colors.primary}
                to={colors.chart[1]}
              />
              <View pointerEvents="none" style={styles.v3FsBadgeLabel}>
                <Text style={[styles.v3FsBadgeValue, tabularNums]}>{focusGoalPercent}%</Text>
                <Text style={styles.v3FsBadgeText}>日目标</Text>
              </View>
            </View>
          </View>

          {/* 本周节律：七格柱，今天给阳光橘 */}
          <View
            style={styles.v3Week}
            accessible
            accessibilityLabel={"本周已打卡 " + weekChecked + " 天，本周专注 " + weekFocusMinutes + " 分钟"}
          >
            {weekBars.map((d) => (
              <View key={d.iso} style={styles.v3Wb}>
                <View style={styles.v3WbSlot}>
                  <View
                    style={[
                      styles.v3WbBar,
                      { height: Math.max(4, Math.round(38 * d.ratio)) },
                      d.minutes === 0 ? styles.v3WbBarIdle : null,
                      d.iso === today ? styles.v3WbBarToday : null,
                    ]}
                  />
                </View>
                <Text style={[styles.v3WbLabel, d.iso === today ? styles.v3WbLabelToday : null]}>{d.label}</Text>
              </View>
            ))}
          </View>

          {/* 三格指标：今日任务 / 刷题进度 / 连续打卡（打卡格可直接点） */}
          <View style={styles.v3Stats}>
            <View style={styles.v3Stat}>
              <Text style={[styles.v3StatValue, tabularNums]}>
                {todayDone}
                <Text style={styles.v3StatSuffix}>{"/" + todayTasks.length}</Text>
              </Text>
              <Text style={styles.v3StatLabel}>今日任务</Text>
            </View>
            <View style={[styles.v3Stat, styles.v3StatDivider]}>
              <Text style={[styles.v3StatValue, tabularNums]}>
                {learningSnapshot.questionsToday}
                <Text style={styles.v3StatSuffix}>{"/" + DAILY_QUESTION_GOAL}</Text>
              </Text>
              <Text style={styles.v3StatLabel}>刷题进度</Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                if (!checkedInToday) haptics.success();
                checkinToday();
              }}
              style={[styles.v3Stat, styles.v3StatDivider]}
              accessibilityRole="button"
              accessibilityLabel={checkedInToday ? "今日已打卡，连续 " + streak + " 天" : "点此打卡"}
            >
              <Text style={[styles.v3StatValue, tabularNums]}>
                {streak}
                <Text style={styles.v3StatSuffix}>天</Text>
              </Text>
              <Text style={styles.v3StatLabel}>{checkedInToday ? "连续打卡" : "打卡开启"}</Text>
            </Pressable>
          </View>

          <PressableScale
            haptic
            scaleTo={0.99}
            onPress={() => {
              setPendingChoice(null);
              setQuickOpen(true);
            }}
            style={styles.v3Cta}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={"开始专注 " + quickStartLabel}
          >
            {/* 对齐 demo .focus-cta：160° 蓝色渐变（#3C86CE → #1E5C9E），整层绝对定位被圆角裁掉 */}
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <LinearGradient id="v3CtaGradient" x1="0" y1="0" x2="0.34" y2="1">
                  <Stop offset="0" stopColor="#3C86CE" />
                  <Stop offset="1" stopColor="#1E5C9E" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#v3CtaGradient)" />
            </Svg>
            <View style={styles.v3CtaPlay}>
              <ThemedIcon name="play" size={15} color="#FFFFFF" />
            </View>
            <View style={styles.v3CtaText}>
              <Text style={styles.v3CtaTitle} numberOfLines={1}>开始专注</Text>
              <Text style={styles.v3CtaSub} numberOfLines={1}>{quickStartLabel}</Text>
            </View>
            <ThemedIcon name="chevron-forward" size={14} color="rgba(255,255,255,0.72)" />
          </PressableScale>

          {/* 保留刷题 / 阅读 / 训练三个既有入口（v3 原型没有，但功能不丢） */}
          <View style={styles.pillRow}>
            <ModePill icon="layers-outline" label="刷题" accessibilityLabel="刷题，去题库" onPress={() => router.push("/quiz" as never)} />
            <ModePill icon="book-outline" label="阅读" accessibilityLabel="阅读，去学习页" onPress={() => router.push("/learn" as never)} />
            <ModePill icon="barbell-outline" label="训练" accessibilityLabel="训练，记录运动" onPress={() => setSportSheetOpen(true)} />
          </View>
        </Surface>

        {/* ⑤ 今日安排：时间轴式任务行（勾选沿用既有 toggleTaskDone + 庆祝） */}
        <View style={styles.v3SecHead}>
          <Text style={styles.v3SecTitle}>今日安排</Text>
          <Pressable
            hitSlop={10}
            onPress={() => router.push("/tasks" as never)}
            style={styles.v3SecMore}
            accessibilityRole="button"
            accessibilityLabel={"全部 " + todayTasks.length + " 条，打开任务页"}
          >
            <Text style={styles.v3SecMoreText}>{"全部 " + todayTasks.length}</Text>
            <ThemedIcon name="chevron-forward" size={13} color={colors.primary} />
          </Pressable>
        </View>

        {todayTasks.length === 0 ? (
          <Surface tier="surface" style={styles.taskEmptyCard}>
            <PatternBackdrop variant="chevron" />
            <Text style={styles.taskEmpty}>今天还没有任务，去学习页添加一个吧</Text>
          </Surface>
        ) : (
          <Surface tier="surface" style={styles.v3Card}>
            {todayTasks.slice(0, 5).map((t, i) => (
              <Animated.View
                key={t.id}
                entering={reduced ? undefined : FadeInDown.duration(DURATION.base).delay(staggerDelay(i))}
              >
                <Pressable
                  style={styles.v3SchedRow}
                  hitSlop={4}
                  onPress={() => {
                    haptics.light();
                    setDetailTask(t);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t.title + (t.done ? "，已完成，打开详情" : "，未完成，打开详情")}
                >
                  <Text style={styles.v3SchedType}>{taskTypeLabels[t.taskType] ?? t.taskType}</Text>
                  <View style={styles.v3SchedBody}>
                    <Text style={[styles.v3SchedTitle, t.done ? styles.v3SchedTitleDone : null]} numberOfLines={2}>
                      {t.title}
                    </Text>
                    <View style={styles.v3SchedMeta}>
                      <Text style={styles.v3SchedTag}>{taskTypeLabels[t.taskType] ?? t.taskType}</Text>
                      {t.focusMinutes > 0 ? (
                        <Text style={styles.v3SchedMetaText}>{t.focusMinutes + " 分钟专注"}</Text>
                      ) : null}
                      {t.done ? <Text style={styles.v3SchedMetaText}>已完成</Text> : null}
                    </View>
                  </View>
                  <Pressable
                    hitSlop={10}
                    onPress={() => {
                      const willDone = !t.done;
                      haptics.light();
                      toggleTaskDone(t.id);
                      if (willDone) fireCelebrate(t.title, "今日任务 · 已完成");
                    }}
                    style={[styles.v3SchedTick, t.done ? styles.v3SchedTickOn : null]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: t.done }}
                    accessibilityLabel={(t.done ? "取消完成 " : "标记完成 ") + t.title}
                  >
                    <AnimatedCheckMark checked={t.done} size={13} color="#FFFFFF" />
                  </Pressable>
                </Pressable>
                {i < Math.min(todayTasks.length, 5) - 1 ? <View style={styles.v3SchedDivider} /> : null}
              </Animated.View>
            ))}
          </Surface>
        )}

        {/* ⑥ 双列小卡：本周学习 / 今日饮水 */}
        <View style={styles.dualRow}>
          <MiniStatCard
            label="本周学习"
            percent={weekFocusPercent}
            hint={weekFocusHint}
            icon="book-outline"
            onPress={() => router.push("/learn" as never)}
            accessibilityLabel="本周学习，打开学习页"
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

        {/* ⑦ 今日习惯（3 列瓦片；沿用 habitRows 打卡 + 乐观更新 + linked 过滤） */}
        <View style={styles.v3SecHead}>
          <Text style={styles.v3SecTitle}>今日习惯</Text>
          <Text style={styles.v3SecMeta}>{"已完成 " + habitOnlyDone + "/" + habitOnlyRows.length}</Text>
        </View>
        {habitOnlyRows.length === 0 ? (
          <Surface tier="surface" style={styles.habitEmpty}>
            <Text style={styles.habitEmptyText}>
              {habitRows.length > 0
                ? "今天排期的习惯都已并入上面的任务，直接勾任务即可"
                : "今天没有排期的习惯，去健康页添加一个"}
            </Text>
          </Surface>
        ) : (
          <View style={styles.v3Habits}>
            {habitOnlyRows.map((row) => (
              <Pressable
                key={"habit-" + row.id}
                hitSlop={6}
                onPress={() => {
                  if (!row.done) fireCelebrate(row.name, "习惯打卡完成");
                  void toggleHabit(row.id, row.done);
                }}
                style={[styles.v3Habit, row.done ? styles.v3HabitOn : null]}
                accessibilityRole="button"
                accessibilityState={{ selected: row.done }}
                accessibilityLabel={row.name + (row.done ? "，已完成" : "，未完成")}
              >
                <ThemedIcon
                  name={habitIconName(row.icon)}
                  size={18}
                  color={row.done ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.v3HabitText, row.done ? styles.v3HabitTextOn : null]} numberOfLines={1}>
                  {row.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ⑧ 洞察：本周专注对比 + 近 7 天曲线 */}
        <View style={styles.v3Insight}>
          <View style={styles.v3InsightTop}>
            <Text style={styles.v3InsightLead}>{insightLead}</Text>
            {focusDeltaPercent === null ? null : (
              <Text style={styles.v3InsightDelta}>
                {(focusDeltaPercent >= 0 ? "+" : "") + focusDeltaPercent + "%"}
              </Text>
            )}
          </View>
          <AreaChart
            series={[{ values: last7Minutes }]}
            labels={last7Labels}
            height={62}
            showEndDot={false}
            legend={false}
            style={styles.v3Spark}
          />
          <View style={styles.v3InsightFoot}>
            <Text style={styles.v3InsightFootText}>近 7 天 · 单位分钟</Text>
            <Pressable
              hitSlop={10}
              onPress={() => router.push("/study-stats" as never)}
              style={styles.v3InsightGo}
              accessibilityRole="button"
              accessibilityLabel="看完整洞察"
            >
              <Text style={styles.v3InsightGoText}>看完整洞察</Text>
              <ThemedIcon name="chevron-forward" size={12} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* 今天的状态：精力记录（保留既有 /api/wellbeing/energy 链路） */}
        <MoodPicker value={energyLevel} onSelect={(l) => void pickEnergy(l)} busy={energyBusy} />

        {/* 今日建议：AI 可用时用 AI，否则规则版 */}
        <View style={styles.v3Tip}>
          <View style={styles.v3TipDot} />
          <Text style={styles.v3TipText} numberOfLines={2}>{heroTip}</Text>
        </View>

        <Text style={styles.quoteFoot} numberOfLines={2}>{quote}</Text>
      </Animated.ScrollView>

      <SportSheet visible={sportSheetOpen} onClose={() => setSportSheetOpen(false)} motionActive={motionActive} />
      <QuickStartSheet
        visible={quickOpen}
        oneScreen
        onClose={() => setQuickOpen(false)}
        onPick={(choice) => {
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
      <BottomSheet
        visible={!!detailTask}
        onClose={() => setDetailTask(null)}
        title="任务详情"
        subtitle="勾选完成会同步到云端，并计入今日进度"
        icon="checkbox-outline"
        height="54%"
      >
        {detailTask ? (
          <View style={styles.v3Detail}>
            <Text style={styles.v3DetailKicker}>
              {(taskTypeLabels[detailTask.taskType] ?? detailTask.taskType) + " · " + (detailTask.done ? "已完成" : "未完成")}
            </Text>
            <Text style={styles.v3DetailTitle}>{detailTask.title}</Text>
            <View style={styles.v3DetailTags}>
              <Text style={styles.v3DetailTag}>{taskTypeLabels[detailTask.taskType] ?? detailTask.taskType}</Text>
              {detailTask.focusMinutes > 0 ? (
                <Text style={styles.v3DetailTag}>{detailTask.focusMinutes + " 分钟专注"}</Text>
              ) : null}
              <Text style={styles.v3DetailTag}>{detailTask.taskDate}</Text>
            </View>
            <Text style={styles.v3DetailNote}>
              {"这条任务来自今天的学习安排。完成后会写入同步队列，明天的今日页与任务页都会同步这一状态。"}
            </Text>
            <View style={styles.v3DetailActions}>
              <Pressable
                hitSlop={6}
                onPress={() => {
                  setDetailTask(null);
                  router.push("/tasks" as never);
                }}
                style={styles.v3DetailGhost}
                accessibilityRole="button"
                accessibilityLabel="去任务页"
              >
                <Text style={styles.v3DetailGhostText}>去任务页</Text>
              </Pressable>
              <Pressable
                hitSlop={6}
                onPress={() => {
                  const target = detailTask;
                  const willDone = !target.done;
                  haptics.light();
                  toggleTaskDone(target.id);
                  if (willDone) fireCelebrate(target.title, "今日任务 · 已完成");
                  setDetailTask(null);
                }}
                style={styles.v3DetailPrimary}
                accessibilityRole="button"
                accessibilityLabel={detailTask.done ? "标记为未完成" : "标记完成"}
              >
                <ThemedIcon name="checkmark" size={15} color="#FFFFFF" />
                <Text style={styles.v3DetailPrimaryText}>{detailTask.done ? "标记未完成" : "标记完成"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </BottomSheet>
      <BottomSheet
        visible={notifOpen}
        onClose={() => setNotifOpen(false)}
        title="通知"
        subtitle="今天的提醒都在这里，点一条直达"
        icon="notifications-outline"
        height="58%"
      >
        <View style={styles.v3NotifList}>
          <Pressable
            hitSlop={4}
            style={styles.v3NotifRow}
            onPress={() => { setNotifOpen(false); router.push("/tasks" as never); }}
            accessibilityRole="button"
            accessibilityLabel="今日任务提醒，打开任务页"
          >
            <View style={[styles.v3NotifDot, { backgroundColor: colors.primary }]} />
            <View style={styles.v3NotifBody}>
              <Text style={styles.v3NotifTitle}>{"今日还有 " + (todayTasks.length - todayDone) + " 条任务未完成"}</Text>
              <Text style={styles.v3NotifSub}>按计划完成今天最重要的一件</Text>
            </View>
            <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
          </Pressable>
          <Pressable
            hitSlop={4}
            style={styles.v3NotifRow}
            onPress={() => { setNotifOpen(false); router.push("/study-stats" as never); }}
            accessibilityRole="button"
            accessibilityLabel="专注目标提醒，打开学习统计"
          >
            <View style={[styles.v3NotifDot, { backgroundColor: colors.accent }]} />
            <View style={styles.v3NotifBody}>
              <Text style={styles.v3NotifTitle}>{"今日专注 " + focusMinutesToday + " 分 / 目标 " + DAILY_FOCUS_GOAL_MINUTES + " 分"}</Text>
              <Text style={styles.v3NotifSub}>{"还差 " + Math.max(0, DAILY_FOCUS_GOAL_MINUTES - focusMinutesToday) + " 分钟到日目标"}</Text>
            </View>
            <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
          </Pressable>
          <Pressable
            hitSlop={4}
            style={styles.v3NotifRow}
            onPress={() => {
              setNotifOpen(false);
              if (!checkedInToday) haptics.success();
              checkinToday();
            }}
            accessibilityRole="button"
            accessibilityLabel="打卡提醒"
          >
            <View style={[styles.v3NotifDot, { backgroundColor: colors.success }]} />
            <View style={styles.v3NotifBody}>
              <Text style={styles.v3NotifTitle}>
                {checkedInToday ? "今日已打卡 · 连续 " + streak + " 天" : "今天还没打卡"}
              </Text>
              <Text style={styles.v3NotifSub}>{checkedInToday ? "保持节奏，明天继续" : "点一下留下今天的印记"}</Text>
            </View>
            <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ThemeColors, dark = false) =>
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

    // ---- v3 一屏原型（2026-11-08 今日页版式对齐 demo）----
    v3Topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 2 },
    v3Wordmark: { ...typography.eyebrow, color: colors.textFaint, letterSpacing: 1.6 },
    v3TopActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    v3IconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
    },
    v3BellDot: {
      position: "absolute",
      top: 8,
      right: 9,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.accent,
    },
    v3Avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      overflow: "hidden",
    },
    v3AvatarImage: { width: "100%", height: "100%", borderRadius: 19 },
    v3AvatarText: { ...typography.callout, fontWeight: "700", color: "#FFFFFF" },
    v3Greet: { gap: 6, paddingHorizontal: 2, marginTop: 6 },
    v3GreetDate: { flexDirection: "row", alignItems: "center", gap: 8 },
    v3GreetDateText: { ...typography.caption, fontWeight: "600", color: colors.textSecondary },
    v3GreetDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textFaint },
    /* demo h1 字重 680：RN 取最接近的 700（pageTitle 默认 800 偏粗） */
    v3GreetTitle: { ...typography.pageTitle, fontWeight: "700", color: colors.text },
    v3GreetSub: { ...typography.meta, color: colors.textMuted, lineHeight: 17 },
    v3Scene: { height: 150, borderRadius: 26, overflow: "hidden", marginTop: 4, ...shadows.card },
    /** Web 上 react-native-web 会按原图尺寸布局绝对定位图片（导致只看左上角）：显式 100% 让 cover 生效，原生同值无影响 */
    sceneImgFill: { width: "100%", height: "100%" },
    v3SceneCap: { position: "absolute", left: 16, right: 16, top: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    v3SceneName: { flexDirection: "row", alignItems: "center", gap: 7 },
    v3SceneDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
    v3SceneNameText: { ...typography.caption, fontWeight: "600", color: "rgba(255,255,255,0.94)" },
    v3SceneTime: { ...typography.micro, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
    /** 实景带与专注卡分离：保留 content 的 14pt 间距，不再用负 margin 重叠 */
    v3FocusShell: { marginTop: 0, padding: 18 },
    v3FsHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    v3FsHeadText: { gap: 2 },
    v3FsKicker: { flexDirection: "row", alignItems: "center", gap: 6 },
    v3FsKickerText: { ...typography.caption, fontWeight: "600", color: colors.textSecondary },
    v3FsBig: { flexDirection: "row", alignItems: "baseline", gap: 1, marginTop: 7 },
    /* 对齐 demo .big：40/500（走 typography.numLg，避免裸字号棘轮） */
    v3FsBigNum: { ...typography.numLg, color: colors.text },
    v3FsBigUnit: { ...typography.caption, color: colors.textMuted, marginRight: 3 },
    v3FsBadge: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
    v3FsBadgeLabel: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
    v3FsBadgeValue: { ...typography.caption, fontWeight: "700", color: colors.text },
    v3FsBadgeText: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    v3Week: { flexDirection: "row", gap: 4, marginTop: 17 },
    v3Wb: { flex: 1, alignItems: "center", gap: 6 },
    v3WbSlot: { height: 38, width: "100%", alignItems: "center", justifyContent: "flex-end" },
    v3WbBar: {
      width: 16,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderBottomLeftRadius: 3,
      borderBottomRightRadius: 3,
      backgroundColor: withAlpha(colors.primary, dark ? 0.52 : 0.34),
    },
    v3WbBarIdle: { backgroundColor: withAlpha(colors.primary, dark ? 0.24 : 0.14) },
    v3WbBarToday: { backgroundColor: colors.accent },
    v3WbLabel: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    v3WbLabelToday: { color: colors.accent, fontWeight: "700" },
    v3Stats: { flexDirection: "row", marginTop: 15, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    v3Stat: { flex: 1, gap: 2 },
    /* 对齐 demo .fs-stat：第 2、3 格左侧细分隔线 + 左内边距 */
    v3StatDivider: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: "rgba(15,25,29,0.07)",
      paddingLeft: 14,
    },
    v3StatValue: { ...typography.callout, fontWeight: "600", color: colors.text },
    v3StatSuffix: { ...typography.caption, fontWeight: "500", color: colors.textMuted },
    v3StatLabel: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    v3Cta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      minHeight: 50,
      marginTop: 15,
      paddingLeft: 8,
      paddingRight: 14,
      borderRadius: radius.pill,
      overflow: "hidden",
      backgroundColor: colors.primary, // 渐变层未就绪时的兜底
      ...shadows.brand,
    },
    v3CtaPlay: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
    v3CtaText: { flex: 1, minWidth: 0, gap: 1 },
    v3CtaTitle: { ...typography.headline, fontWeight: "700", color: "#FFFFFF" },
    v3CtaSub: { ...typography.micro, fontWeight: "500", color: "rgba(255,255,255,0.72)" },
    v3SecHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, paddingHorizontal: 2 },
    v3SecTitle: { ...typography.section, color: colors.text },
    v3SecMore: { flexDirection: "row", alignItems: "center", gap: 1 },
    v3SecMoreText: { ...typography.caption, fontWeight: "600", color: colors.primary },
    v3SecMeta: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    v3Card: { paddingVertical: 2, paddingHorizontal: 14 },
    v3SchedRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 13 },
    v3SchedType: { width: 36, ...typography.micro, fontWeight: "600", color: colors.textMuted, paddingTop: 3 },
    v3SchedBody: { flex: 1, minWidth: 0, gap: 4 },
    v3SchedTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    v3SchedTitleDone: { color: colors.textSecondary, textDecorationLine: "line-through" },
    v3SchedMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    v3SchedTag: { ...typography.micro, fontWeight: "600", color: colors.primary },
    v3SchedMetaText: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    v3SchedTick: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    v3SchedTickOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    v3SchedDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 47 },
    v3Habits: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    v3Habit: {
      flexGrow: 1,
      flexBasis: "30%",
      minWidth: 0,
      minHeight: 62,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 6,
    },
    v3HabitOn: { backgroundColor: colors.primarySoft, borderColor: withAlpha(colors.primary, 0.18) },
    v3HabitText: { ...typography.micro, fontWeight: "600", color: colors.textSecondary },
    v3HabitTextOn: { color: colors.primaryStrong },
    v3Insight: {
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    v3InsightTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
    v3InsightLead: { ...typography.caption, fontWeight: "600", lineHeight: 20, color: colors.textSecondary, flex: 1, minWidth: 0 },
    v3InsightDelta: { ...typography.micro, fontWeight: "700", color: colors.success },
    v3Spark: { marginTop: 6 },
    v3InsightFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
    v3InsightFootText: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    v3InsightGo: { flexDirection: "row", alignItems: "center", gap: 2 },
    v3InsightGoText: { ...typography.micro, fontWeight: "600", color: colors.primary },
    v3Tip: { flexDirection: "row", alignItems: "flex-start", gap: 7, paddingHorizontal: 2 },
    v3TipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 6 },
    v3TipText: { ...typography.meta, color: colors.textMuted, lineHeight: 17, flex: 1, minWidth: 0 },
    v3NotifList: { gap: 4 },
    v3NotifRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 13 },
    v3NotifDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    v3NotifBody: { flex: 1, minWidth: 0, gap: 3 },
    v3NotifTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    v3NotifSub: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    v3Detail: { gap: 10, paddingBottom: 8 },
    v3DetailKicker: { ...typography.caption, fontWeight: "600", color: colors.textSecondary },
    v3DetailTitle: { ...typography.title2, color: colors.text },
    v3DetailTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    v3DetailTag: {
      ...typography.micro,
      fontWeight: "600",
      color: colors.primaryStrong,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
      overflow: "hidden",
    },
    v3DetailNote: { ...typography.caption, lineHeight: 20, color: colors.textMuted },
    v3DetailActions: { flexDirection: "row", gap: 10, marginTop: 6 },
    v3DetailGhost: {
      flex: 1,
      minHeight: 46,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    v3DetailGhostText: { ...typography.callout, fontWeight: "600", color: colors.textSecondary },
    v3DetailPrimary: {
      flex: 1.4,
      minHeight: 46,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    v3DetailPrimaryText: { ...typography.callout, fontWeight: "700", color: "#FFFFFF" },
  });

