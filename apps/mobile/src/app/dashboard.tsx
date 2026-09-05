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
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useAppStore } from "@/store/app-store";
import { useSportStore, SPORT_TYPES, type SportKind } from "@/store/sport-store";
import { mainPhases, agentPhase } from "@learn-workbench/content";
import { pct, formatDuration, taskTypeLabels, todayISO } from "@learn-workbench/shared";
import { FocusTimer } from "@/components/focus-timer";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { Celebration } from "@/components/celebration";
import { PressableScale } from "@/components/pressable-scale";
import { colors, radius, shadows } from "@/theme/tokens";
import { computeFocusStats } from "@/lib/focus-stats";
import { getDailyQuote } from "@/lib/quotes";

function useDailyQuote() {
  return useMemo(() => getDailyQuote(), []);
}

function FocusCard({ onStart }: { onStart: () => void }) {
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
          <Ionicons name="sunny" size={14} color="rgba(255,255,255,0.9)" />
          <Text style={styles.focusEyebrow}>今日焦点 · TODAY FOCUS</Text>
        </View>
        <Text style={styles.focusTitle}>深度学习《React 渲染优化》</Text>
        <Text style={styles.focusSub}>25 分钟沉浸专注 · 从第一章第 3 节继续</Text>
        <PressableScale style={styles.focusCta} haptic onPress={onStart}>
          <Ionicons name="play" size={16} color="#2F74C0" />
          <Text style={styles.focusCtaText}>开始专注</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function SportIcon({
  kind,
  icon,
  color,
  active,
}: {
  kind: SportKind;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  active: boolean;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      tx.value = withTiming(0, { duration: 180 });
      ty.value = withTiming(0, { duration: 180 });
      rotate.value = withTiming(0, { duration: 180 });
      scale.value = withSpring(1);
      return;
    }

    if (kind === "basketball") {
      scale.value = withSequence(withSpring(1.18, { damping: 9, stiffness: 220 }), withSpring(1));
      ty.value = withSequence(withTiming(-18, { duration: 340 }), withTiming(0, { duration: 400 }));
      rotate.value = withSequence(withTiming(-140, { duration: 700 }), withTiming(0, { duration: 0 }));
      tx.value = withTiming(0, { duration: 180 });
    } else if (kind === "badminton") {
      scale.value = withSequence(withSpring(1.14, { damping: 9, stiffness: 220 }), withSpring(1));
      tx.value = withSequence(
        withRepeat(withSequence(withTiming(-6, { duration: 170 }), withTiming(6, { duration: 170 })), 3, true),
        withTiming(0, { duration: 160 })
      );
      ty.value = withRepeat(withSequence(withTiming(-4, { duration: 170 }), withTiming(4, { duration: 170 })), 3, true);
      rotate.value = withTiming(0, { duration: 180 });
    } else if (kind === "walk") {
      scale.value = withSequence(withSpring(1.1, { damping: 9, stiffness: 220 }), withSpring(1));
      rotate.value = withSequence(
        withRepeat(withSequence(withTiming(-12, { duration: 220 }), withTiming(12, { duration: 220 })), 2, true),
        withTiming(0, { duration: 200 })
      );
      ty.value = withRepeat(withSequence(withTiming(-3, { duration: 220 }), withTiming(3, { duration: 220 })), 2, true);
      tx.value = withTiming(0, { duration: 180 });
    } else {
      scale.value = withSequence(withSpring(1.12, { damping: 9, stiffness: 220 }), withSpring(1));
      tx.value = withTiming(0, { duration: 180 });
      ty.value = withTiming(0, { duration: 180 });
      rotate.value = withTiming(0, { duration: 180 });
    }
  }, [active, kind, rotate, scale, tx, ty]);

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
      <Ionicons name={icon} size={22} color={color} />
    </Animated.View>
  );
}

function SportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const addSport = useSportStore((s) => s.addSport);
  const [kind, setKind] = useState<SportKind>("basketball");
  const [minutes, setMinutes] = useState(30);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="添加运动记录" height="64%">
      <View style={styles.sportTypeGrid}>
        {SPORT_TYPES.map((t) => {
          const active = t.key === kind;
          return (
            <Pressable
              key={t.key}
              onPress={() => setKind(t.key)}
              style={[styles.sportType, active && styles.sportTypeActive]}
            >
              <View style={[styles.sportTypeIcon, { backgroundColor: `${t.c1}22` }]}>
                <SportIcon kind={t.key} icon={t.icon} color={t.c1} active={active} />
              </View>
              <Text style={[styles.sportTypeName, active && styles.sportTypeNameActive]}>{t.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => setMinutes((m) => Math.max(15, m - 15))}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <View style={styles.stepperVal}>
          <Text style={styles.stepperNum}>{minutes}</Text>
          <Text style={styles.stepperUnit}>分钟</Text>
        </View>
        <Pressable style={styles.stepBtn} onPress={() => setMinutes((m) => Math.min(240, m + 15))}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
      <View style={styles.quickRow}>
        {[30, 60, 90].map((m) => (
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
          addSport(kind, minutes);
          onClose();
        }}
      >
        <Text style={styles.saveSportText}>保存这条记录</Text>
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
  const insets = useSafeAreaInsets();
  const progress = useAppStore((s) => s.progress);
  const tasks = useAppStore((s) => s.tasks);
  const checkins = useAppStore((s) => s.checkins);
  const sessions = useAppStore((s) => s.sessions);
  const checkinToday = useAppStore((s) => s.checkinToday);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const addSession = useAppStore((s) => s.addSession);
  const sports = useSportStore((s) => s.records);
  const removeSport = useSportStore((s) => s.removeSport);

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

  const fireCelebrate = () => {
    setCelebrate(false);
    requestAnimationFrame(() => setCelebrate(true));
    setTimeout(() => setCelebrate(false), 1300);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.sunGlow} />
          <Text style={styles.heroTitle}>
            {greet}，{"\n"}继续今天的 ICT 学习规划
          </Text>
          <Text style={styles.heroSub}>今天 · 一个焦点 · 可折叠任务</Text>

          <View style={styles.quote}>
            <Ionicons name="sunny" size={16} color={colors.accent} />
            <Text style={styles.quoteText}>{quote}</Text>
          </View>
        </View>

        <FocusCard onStart={() => setFocusOpen(true)} />

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>运动 · 健康</Text>
          <Pressable onPress={() => setSportSheetOpen(true)} hitSlop={8} style={styles.addSportBtn}>
            <Ionicons name="add" size={16} color={colors.accentStrong} />
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
            sports.map((r) => (
              <View key={r.id} style={styles.sportItem}>
                <View style={[styles.sportIco, { backgroundColor: `${r.c1}1f` }]}>
                  <Ionicons name={r.icon} size={20} color={r.c1} />
                </View>
                <View style={styles.sportItemInfo}>
                  <Text style={styles.sportItemName}>{r.name}</Text>
                  <Text style={styles.sportItemTime}>{formatSport(r.minutes)} · 已完成</Text>
                </View>
                <Pressable onPress={() => removeSport(r.id)} hitSlop={8}>
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))
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
                {t.done ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
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
              <Ionicons name="flame" size={18} color={colors.accent} />
            </View>
            <Text style={styles.statLabel}>连续打卡</Text>
            <Text style={styles.statValue}>{streak}<Text style={styles.statValueUnit}> 天</Text></Text>
          </Card>
          <Card style={styles.statCard}>
            <View style={[styles.statIconChip, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="timer" size={18} color={colors.primary} />
            </View>
            <Text style={styles.statLabel}>今日专注</Text>
            <Text style={styles.statValue}>{focusStats.todayMinutes}<Text style={styles.statValueUnit}> 分</Text></Text>
          </Card>
          <Card style={styles.statCard}>
            <View style={[styles.statIconChip, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="trending-up" size={18} color={colors.success} />
            </View>
            <Text style={styles.statLabel}>本周进度</Text>
            <Text style={styles.statValue}>{overall}<Text style={styles.statValueUnit}>%</Text></Text>
          </Card>
        </View>

        <Pressable style={styles.checkinRow} onPress={checkinToday}>
          <Text style={styles.checkinRowText}>今日打卡 · 给自己一个正向信号</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.accentStrong} />
        </Pressable>
      </ScrollView>

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

const styles = StyleSheet.create({
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

  sportTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sportType: {
    width: "30%",
    flexGrow: 1,
    alignItems: "center",
    gap: 6,
    padding: 12,
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
