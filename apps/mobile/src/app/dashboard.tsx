/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
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
import { pct, formatDuration, taskTypeLabels, todayISO } from "@learn-workbench/shared";
import { FocusTimer } from "@/components/focus-timer";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { Celebration } from "@/components/celebration";
import { PressableScale } from "@/components/pressable-scale";
import { haptics } from "@/lib/haptics";
import { radius, shadows } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { computeFocusStats } from "@/lib/focus-stats";
import { getDailyQuote } from "@/lib/quotes";

function useDailyQuote() {
  return useMemo(() => getDailyQuote(), []);
}

function FocusCard({ onStart }: { onStart: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const puff1 = useSharedValue(0);
  const puff2 = useSharedValue(0);

  const blob1 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.16 * puff1.value }, { translateX: 14 * puff1.value }],
    opacity: 0.62 + 0.2 * puff1.value,
  }));
  const blob2 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.2 * puff2.value }, { translateX: -10 * puff2.value }],
    opacity: 0.55 + 0.22 * puff2.value,
  }));

  useMemo(() => {
    puff1.value = withRepeat(withTiming(1, { duration: 4200 }), -1, true);
    puff2.value = withRepeat(withTiming(1, { duration: 5200 }), -1, true);
    return () => {};
  }, [puff1, puff2]);

  return (
    <View style={styles.focusCard}>
      <View style={styles.focusBase} />
      <Animated.View style={[styles.focusBlob1, blob1]} />
      <Animated.View style={[styles.focusBlob2, blob2]} />
      <View style={styles.focusContent}>
        <View style={styles.focusEyebrowRow}>
          <ThemedIcon name="sunny" size={14} color="rgba(255,255,255,0.9)" />
          <Text style={styles.focusEyebrow}>今日焦点 · TODAY FOCUS</Text>
        </View>
        <Text style={styles.focusTitle}>深度学习《React 渲染优化》</Text>
        <Text style={styles.focusSub}>25 分钟沉浸专注 · 从第一章第 3 节继续</Text>
        <PressableScale style={styles.focusCta} haptic onPress={onStart}>
          <ThemedIcon name="play" size={16} color="#2F74C0" />
          <Text style={styles.focusCtaText}>开始专注</Text>
        </PressableScale>
      </View>
    </View>
  );
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
        scale.value = withSequence(withSpring(1.12, { damping: 9, stiffness: 220 }), withSpring(1));
        ty.value = withRepeat(withSequence(withTiming(-8, { duration: 130 }), withTiming(0, { duration: 110 })), 4, false);
        rotate.value = withSequence(withTiming(-6, { duration: 130 }), withTiming(4, { duration: 130 }), withTiming(0, { duration: 120 }));
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
        scale.value = withSequence(withSpring(1.1, { damping: 9, stiffness: 220 }), withSpring(1));
        ty.value = withRepeat(withSequence(withTiming(-9, { duration: 120 }), withTiming(0, { duration: 110 })), 5, false);
        break;
      case "strength":
        ty.value = withRepeat(
          withSequence(withTiming(-3, { duration: 220 }), withTiming(3, { duration: 220 })),
          3,
          true
        );
        scale.value = withRepeat(
          withSequence(withTiming(1.04, { duration: 220 }), withTiming(0.94, { duration: 220 }), withTiming(1, { duration: 180 })),
          2,
          false
        );
        break;
      case "tremble":
        tx.value = withRepeat(withSequence(withTiming(-1.5, { duration: 60 }), withTiming(1.5, { duration: 60 })), 10, true);
        ty.value = withTiming(-2, { duration: 160 });
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
      <ThemedIcon name={icon} ios={sportSfOf(sportKey)} size={22} color={c} />
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
    <BottomSheet visible={visible} onClose={onClose} title="添加运动记录" height="72%">
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
      <PressableScale
        style={styles.saveSport}
        haptic
        onPress={() => {
          if (!current) return;
          addSport(current.key, minutes);
          onClose();
        }}
      >
        <Text style={styles.saveSportText}>
          记录 {current?.name ?? "—"} {minutes} 分钟
        </Text>
      </PressableScale>
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

export default function DashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const progress = useAppStore((s) => s.progress);
  const tasks = useAppStore((s) => s.tasks);
  const checkins = useAppStore((s) => s.checkins);
  const sessions = useAppStore((s) => s.sessions);
  const checkinToday = useAppStore((s) => s.checkinToday);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const addSession = useAppStore((s) => s.addSession);
  const sports = useAppStore((s) => s.sports);
  const removeSport = useAppStore((s) => s.removeSport);

  const [focusOpen, setFocusOpen] = useState(false);
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const quote = useDailyQuote();
  const today = todayISO();
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

  const fireCelebrate = () => {
    setCelebrate(false);
    requestAnimationFrame(() => setCelebrate(true));
    setTimeout(() => setCelebrate(false), 1300);
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

  // 今日建议（规则版）：根据任务/打卡状态给一句可执行的小建议
  const todayTip = useMemo(() => {
    if (todayTasks.length === 0) return "先给今天定一个小目标，路线图会告诉你下一步学什么";
    if (todayDone === 0) return "从第一件事开始，把最重要的做完就赢了一半";
    if (todayDone < todayTasks.length) return "还差 " + (todayTasks.length - todayDone) + " 件事就完成今天，冲一冲";
    if (!checkedInToday) return "任务已全部完成，别忘了打卡留下今天的印记";
    return "今天已满载而归，去复盘或提前看看明天的安排";
  }, [todayTasks, todayDone, checkedInToday]);
  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={heroScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.hero, heroAnim]}>
          <View style={styles.sunGlow} />
          <Text style={styles.heroTitle}>
            {greet}，{"\n"}继续今天的 ICT 学习规划
          </Text>
          <Text style={styles.heroSub}>{todayTip}</Text>

          <View style={styles.quote}>
            <ThemedIcon name="sunny" size={16} color={colors.accent} />
            <Text style={styles.quoteText}>{quote}</Text>
          </View>
        </Animated.View>

        <FocusCard onStart={() => setFocusOpen(true)} />

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>运动 · 健康</Text>
          <Pressable onPress={() => setSportSheetOpen(true)} hitSlop={8} style={styles.addSportBtn}>
            <ThemedIcon name="add" size={16} color={colors.accentStrong} />
            <Text style={styles.addSportText}>添加记录</Text>
          </Pressable>
        </View>

        <Card style={styles.sportCard}>
          <View style={styles.sportTotal}>
            <Text style={styles.sportTotalNum}>{(sportsTotalMinutes / 60).toFixed(1)}</Text>
            <Text style={styles.sportTotalUnit}>小时</Text>
            <Text style={styles.sportTotalNote}>今日能量 · 阳光满分</Text>
          </View>
          {sports.length === 0 ? (
            <Text style={styles.sportEmpty}>今天还没有运动记录，去阳光下动一动吧 ☀️</Text>
          ) : (
            sports.map((r) => {
              const { c1 } = sportColorsOf(r.type);
              return (
                <View key={r.id} style={styles.sportItem}>
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
                </View>
              );
            })
          )}
        </Card>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>今日任务</Text>
          <Text style={styles.sectionMore}>
            {todayDone} / {todayTasks.length} 已完成
          </Text>
        </View>

        {todayTasks.length === 0 ? (
          <Card>
            <Text style={styles.taskEmpty}>今天还没有任务，去学习页添加一个吧</Text>
          </Card>
        ) : (
          todayTasks.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => {
                const willDone = !t.done;
                toggleTaskDone(t.id);
                if (willDone) fireCelebrate();
              }}
              style={styles.task}
            >
              <View style={[styles.taskBox, t.done && styles.taskBoxDone]}>
                {t.done ? <ThemedIcon name="checkmark" size={16} color="#fff" /> : null}
              </View>
              <Text style={[styles.taskTitle, t.done && styles.taskDone]} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={styles.taskMeta}>{taskTypeLabels[t.taskType] ?? t.taskType}</Text>
            </Pressable>
          ))
        )}

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>本周节奏</Text>
        </View>
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
      </Animated.ScrollView>

      <SportSheet visible={sportSheetOpen} onClose={() => setSportSheetOpen(false)} />
      <FocusTimer
        open={focusOpen}
        task={focusTask ? { id: focusTask.id, title: focusTask.title } : { id: null, title: "自由专注" }}
        sessions={sessions}
        onClose={() => setFocusOpen(false)}
        onRecorded={(taskId, seconds) => addSession(taskId, seconds)}
      />
      <Celebration play={celebrate} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 118, gap: 14 },
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
  heroTitle: { fontSize: 26, lineHeight: 32, fontWeight: "800", color: colors.text },
  heroSub: { fontSize: 13, color: colors.textMuted, marginTop: 5 },
  quote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 10,
    paddingRight: 12,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quoteText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.textMuted },

  focusCard: {
    height: 168,
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadows.floating,
  },
  focusBase: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#2F74C0" },
  focusBlob1: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -40,
    right: -20,
    backgroundColor: "#F28C28",
  },
  focusBlob2: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    bottom: -40,
    left: -30,
    backgroundColor: "#5DAE74",
  },
  focusContent: { flex: 1, padding: 18, justifyContent: "space-between" },
  focusEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  focusEyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, color: "rgba(255,255,255,0.92)" },
  focusTitle: { fontSize: 21, fontWeight: "800", color: "#fff", marginTop: 8 },
  focusSub: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 3 },
  focusCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
  },
  focusCtaText: { color: "#2F74C0", fontSize: 13, fontWeight: "800" },

  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  sectionMore: { fontSize: 12, color: colors.textMuted },
  addSportBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  addSportText: { fontSize: 12, fontWeight: "700", color: colors.accentStrong },

  sportCard: { gap: 8 },
  sportTotal: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  sportTotalNum: { fontSize: 30, fontWeight: "800", color: colors.text },
  sportTotalUnit: { fontSize: 13, color: colors.textMuted },
  sportTotalNote: { marginLeft: "auto", fontSize: 11, color: colors.accentStrong },
  sportEmpty: { fontSize: 13, color: colors.textMuted, paddingVertical: 4 },
  sportItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  sportIco: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sportItemInfo: { flex: 1 },
  sportItemName: { fontSize: 14, fontWeight: "700", color: colors.text },
  sportItemTime: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

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
  taskTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  taskDone: { textDecorationLine: "line-through", color: colors.textMuted },
  taskMeta: { fontSize: 12, color: colors.textMuted },
  taskEmpty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 4 },

  statsGrid: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, gap: 6, padding: 14 },
  statIconChip: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statLabel: { fontSize: 12, color: colors.textMuted },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.text },
  statValueUnit: { fontSize: 12, fontWeight: "600", color: colors.textMuted },

  checkinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  checkinRowText: { fontSize: 13, fontWeight: "700", color: colors.accentStrong },

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
  sportTabText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
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
  sportTypeName: { fontSize: 12, fontWeight: "700", color: colors.text },
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
  stepperUnit: { fontSize: 12, color: colors.textMuted },
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
  quickChipText: { fontSize: 13, fontWeight: "700", color: colors.text },
  quickChipTextActive: { color: colors.accentStrong },
  saveSport: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveSportText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
