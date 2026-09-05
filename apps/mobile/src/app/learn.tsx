/* eslint-disable react-hooks/immutability */
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { RingProgress } from "@/components/ring-progress";
import { BarChart, LineChart } from "@/components/charts";
import { useAppStore } from "@/store/app-store";
import { mainPhases, agentPhase } from "@learn-workbench/content";
import type { Phase } from "@learn-workbench/shared";
import { formatDuration, pct } from "@learn-workbench/shared";
import { computeFocusStats } from "@/lib/focus-stats";
import { radius } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { fetchRoadmap, createPhase, reorderPhases, readCachedRoadmap } from "@/lib/roadmap";

const STAGE_GRADS: [string, string][] = [
  ["#2F74C0", "#78C2E8"],
  ["#F28C28", "#FF8F6B"],
  ["#8D7BD8", "#B39AD9"],
  ["#2FB3A6", "#57C7B2"],
  ["#F26B5E", "#FFB77A"],
  ["#4F8CD6", "#78C2E8"],
  ["#3DA35D", "#7AC06E"],
];

const THEME_COLORS: [string, string][] = [
  ["#2F74C0", "#78C2E8"],
  ["#F28C28", "#FF8F6B"],
  ["#8D7BD8", "#B39AD9"],
];

const localKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
};

const weekdayName = (d: Date) => ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];

const PERIODS = [
  { label: "凌晨", start: 0, end: 6 },
  { label: "清晨", start: 6, end: 9 },
  { label: "上午", start: 9, end: 12 },
  { label: "中午", start: 12, end: 14 },
  { label: "下午", start: 14, end: 18 },
  { label: "晚上", start: 18, end: 22 },
  { label: "深夜", start: 22, end: 24 },
] as const;

function buildDayMinutesMap(sessions: ReturnType<typeof useAppStore.getState>["sessions"]) {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = localKey(d);
    map.set(key, (map.get(key) ?? 0) + Math.max(0, Math.round((s.durationSeconds ?? 0) / 60)));
  }
  return map;
}

function buildPeriodBars(sessions: ReturnType<typeof useAppStore.getState>["sessions"], key: string) {
  const bars = PERIODS.map((p) => ({ label: p.label, value: 0 }));
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (Number.isNaN(d.getTime()) || localKey(d) !== key) continue;
    const h = d.getHours();
    const idx = PERIODS.findIndex((p) => h >= p.start && h < p.end);
    if (idx >= 0) bars[idx].value += Math.max(0, Math.round((s.durationSeconds ?? 0) / 60));
  }
  return bars;
}

function buildDailySeries(sessions: ReturnType<typeof useAppStore.getState>["sessions"], endDate: Date) {
  const map = buildDayMinutesMap(sessions);
  const out: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = addDays(endDate, -i);
    out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: map.get(localKey(d)) ?? 0 });
  }
  return out;
}

function buildHeatmap(sessions: ReturnType<typeof useAppStore.getState>["sessions"]) {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = localKey(d);
    map.set(key, (map.get(key) ?? 0) + Math.max(0, Math.round((s.durationSeconds ?? 0) / 60)));
  }
  const days: { key: string; minutes: number }[] = [];
  const now = new Date();
  for (let i = 83; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push({ key: localKey(d), minutes: map.get(localKey(d)) ?? 0 });
  }
  const weeks: { key: string; minutes: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function heatColor(minutes: number): string {
  if (minutes <= 0) return "#F1E7D4";
  if (minutes < 30) return "#FBE0B3";
  if (minutes < 60) return "#F5A34B";
  return "#E35D2F";
}

function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function MonthCalendar({
  selected,
  onSelect,
  onClose,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [view, setView] = useState(() => ({ y: selected.getFullYear(), m: selected.getMonth() }));
  const cells = monthGrid(view.y, view.m);
  const todayKey = localKey(new Date());
  const selectedKey = localKey(selected);

  return (
    <View style={styles.calendar}>
      <View style={styles.calNav}>
        <Pressable
          hitSlop={8}
          style={styles.calNavBtn}
          onPress={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.calTitle}>{view.y} 年 {view.m + 1} 月</Text>
        <Pressable
          hitSlop={8}
          style={styles.calNavBtn}
          onPress={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.calWeekRow}>
        {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
          <Text key={w} style={styles.calWeek}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.calGrid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.calCell} />;
          const key = localKey(d);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          const future = key > todayKey;
          return (
            <Pressable
              key={i}
              style={styles.calCell}
              disabled={future}
              onPress={() => {
                onSelect(d);
                onClose();
              }}
            >
              <View style={[styles.calDay, isSelected && styles.calDaySelected, isToday && !isSelected && styles.calDayToday]}>
                <Text
                  style={[
                    styles.calDayText,
                    isSelected && styles.calDayTextSelected,
                    future && styles.calDayTextDisabled,
                  ]}
                >
                  {d.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function LearnScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const progress = useAppStore((s) => s.progress);
  const sessions = useAppStore((s) => s.sessions);
  const username = useAppStore((s) => s.username);
  const token = useAppStore((s) => s.token);
  const customTopics = useAppStore((s) => s.customTopics);
  const addCustomTopic = useAppStore((s) => s.addCustomTopic);
  const removeCustomTopic = useAppStore((s) => s.removeCustomTopic);
  const sportRecords = useAppStore((s) => s.sports);
  const [stageSheet, setStageSheet] = useState(false);
  const [shareSheet, setShareSheet] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [statDate, setStatDate] = useState<Date>(() => new Date());
  const [roadmap, setRoadmap] = useState<Phase[]>(mainPhases.filter((p) => p.track === "main"));
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(mainPhases[0]?.id ?? null);
  const [contentTopic, setContentTopic] = useState<{ topicId: number; phaseId: number } | null>(null);
  const [customTopicSheet, setCustomTopicSheet] = useState(false);
  const [customTopicTitle, setCustomTopicTitle] = useState("");
  const [customTopicSummary, setCustomTopicSummary] = useState("");
  const [customPhaseSheet, setCustomPhaseSheet] = useState(false);
  const [customPhaseTitle, setCustomPhaseTitle] = useState("");
  const [roadmapLoading, setRoadmapLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setRoadmapLoading(true);
      const cached = await readCachedRoadmap();
      const cachedMain = cached
        .filter((p) => p.track === "main")
        .map((p) => ({ ...p, topics: p.topics ?? [] })) as unknown as Phase[];
      if (alive && cachedMain.length > 0) setRoadmap(cachedMain);
      if (token) {
        const remote = await fetchRoadmap();
        const remoteMain = remote
          .filter((p) => p.track === "main")
          .map((p) => ({ ...p, topics: p.topics ?? [] })) as unknown as Phase[];
        if (alive && remoteMain.length > 0) setRoadmap(remoteMain);
      }
      if (alive) setRoadmapLoading(false);
    };
    void load();
    return () => {
      alive = false;
    };
  }, [token]);

  const stats = useMemo(() => computeFocusStats(sessions), [sessions]);
  const heatmap = useMemo(() => buildHeatmap(sessions), [sessions]);
  const [heatWidth, setHeatWidth] = useState(0);
  const heatWeeks = heatmap.length;
  const heatWeekGap = 4;
  const heatCellGap = 4;
  const heatCell = heatWidth > 0 ? Math.max(8, Math.floor((heatWidth - heatWeekGap * (heatWeeks - 1)) / heatWeeks)) : 13;
  const selectedKey = localKey(statDate);
  const isStatToday = selectedKey === localKey(new Date());
  const selectedMinutes = useMemo(() => buildDayMinutesMap(sessions).get(selectedKey) ?? 0, [sessions, selectedKey]);
  const periodBars = useMemo(() => buildPeriodBars(sessions, selectedKey), [sessions, selectedKey]);
  const dailySeries = useMemo(() => buildDailySeries(sessions, statDate), [sessions, statDate]);
  const firstPhase = roadmap[0];
  const secondPhase = roadmap[1];
  const remainingPhases = roadmap.slice(2);
  const phaseDone = (phase: Phase) => {
    const doneTopics = phase.topics.filter((t) => progress[t.id]?.done).length;
    return { done: doneTopics, total: phase.topics.length };
  };

  const todayMinutes = stats.todayMinutes;
  const todayTarget = 150;
  const ringRatio = Math.min(1, todayMinutes / todayTarget);
  const ringPctNum = Math.round((todayMinutes / todayTarget) * 100);
  const weekMinutes = stats.last14.slice(7).reduce((sum, d) => sum + d.minutes, 0);
  const totalMinutes = sessions.reduce((sum, s) => sum + Math.max(0, Math.round((s.durationSeconds ?? 0) / 60)), 0);
  const sportMinutes = sportRecords.reduce((sum, r) => sum + r.minutes, 0);

  const selectedPhase = roadmap.find((p) => p.id === selectedPhaseId) ?? firstPhase;
  const selectedCustomTopics = useMemo(
    () => customTopics.filter((t) => t.phaseId === selectedPhase?.id),
    [customTopics, selectedPhase?.id]
  );
  const currentThemes = [
    ...(selectedPhase?.topics ?? []),
    ...selectedCustomTopics.map((t, ci) => ({
      id: t.id,
      topicKey: `lwb-custom-${ci}`,
      title: t.title,
      summary: t.summary,
      agentTask: null,
      sortOrder: 100000 + ci,
      resources: [],
      practices: [],
      projects: [],
      checkpoints: [],
      isCustomSubject: true,
    })),
  ].slice(0, 4);

  const shareMessage = [
    `📚 ${username || "苦旅学习者"} 的 ICT 学习周报`,
    "",
    `🔥 连续专注 ${stats.streak} 天 · 累计专注 ${stats.totalFocusDays} 天`,
    `⏱ 今日专注 ${stats.todaySessions} 次 · ${stats.todayMinutes} 分钟`,
    `📈 本周专注 ${formatDuration(weekMinutes)}`,
    `🏃 运动记录 ${sportMinutes} 分钟`,
    "",
    `💪 每一次专注，都是在为未来的自己投票。`,
  ].join("\n");

  const doShare = async () => {
    try {
      await Share.share({ message: shareMessage, title: "我的 ICT 学习统计" });
    } catch {
      // 忽略
    }
  };

  const swapPhase = (from: number, to: number) => {
    if (to < 0 || to >= roadmap.length) return;
    const next = [...roadmap];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setRoadmap(next);
    if (token) {
      reorderPhases(next.map((p) => p.id)).catch(() => {
        // 本机已更新顺序；联网后会在下次拉取时对齐
      });
    }
  };

  const activeTopic = useMemo(() => {
    if (!contentTopic) return null;
    const topic = currentThemes.find(
      (t) => t.id === contentTopic.topicId && ("isCustomSubject" in t === false)
    );
    if (topic) return topic;
    const custom = selectedCustomTopics.find((t) => t.id === contentTopic.topicId);
    if (!custom) return null;
    return {
      id: custom.id,
      topicKey: `lwb-custom-${selectedCustomTopics.indexOf(custom)}`,
      title: custom.title,
      summary: custom.summary,
      agentTask: null,
      sortOrder: 100000 + selectedCustomTopics.indexOf(custom),
      resources: [],
      practices: [],
      projects: [],
      checkpoints: [],
      isCustomSubject: true,
    };
  }, [contentTopic, currentThemes, selectedCustomTopics]);

  const submitCustomTopic = () => {
    const title = customTopicTitle.trim();
    if (!title) {
      Alert.alert("请填写主题标题");
      return;
    }
    if (!selectedPhase) return;
    addCustomTopic(selectedPhase.id, title, customTopicSummary.trim() || null);
    setCustomTopicSheet(false);
  };

  const submitCustomPhase = async () => {
    const title = customPhaseTitle.trim();
    if (!title) {
      Alert.alert("请填写阶段标题");
      return;
    }
    setRoadmapLoading(true);
    try {
      await createPhase(title, null, null);
      const remote = await fetchRoadmap();
      const remoteMain = remote
        .filter((p) => p.track === "main")
        .map((p) => ({ ...p, topics: p.topics ?? [] })) as unknown as Phase[];
      setRoadmap(remoteMain.length > 0 ? remoteMain : roadmap);
      setCustomPhaseSheet(false);
      setStageSheet(true);
    } catch (e) {
      Alert.alert("创建失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setRoadmapLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>学习</Text>
        <Text style={styles.heroSub}>路线图 · 主题 · 统计 · 日志</Text>
      </View>

      <Text style={styles.sectionTitle}>学习阶段</Text>
      {[firstPhase, secondPhase].filter(Boolean).map((phase, i) => {
        const p = phase as Phase;
        const progressInfo = phaseDone(p);
        const active = p.id === selectedPhaseId;
        return (
          <PressableScale
            key={p.id}
            haptic
            onPress={() => setSelectedPhaseId(p.id)}
            style={[styles.stageCard, active && styles.stageCardActive]}
          >
            <View style={[styles.stageBlob, { backgroundColor: STAGE_GRADS[i][1] }]} />
            <View style={styles.stageTop}>
              <Text style={styles.stageTag}>阶段 {i + 1}</Text>
              <Text style={styles.stageName}>{p.title}</Text>
            </View>
            <Text style={styles.stageDesc} numberOfLines={1}>
              {p.summary || p.weeks || ""}
            </Text>
            <View style={styles.stageBar}>
              <View style={[styles.stageBarFill, { width: `${pct(progressInfo.done, progressInfo.total)}%`, backgroundColor: STAGE_GRADS[i][1] }]} />
            </View>
            <Text style={styles.stagePct}>{pct(progressInfo.done, progressInfo.total)}%</Text>
          </PressableScale>
        );
      })}

      <PressableScale style={styles.moreCard} haptic onPress={() => setStageSheet(true)}>
        <View style={styles.moreLeft}>
          <Ionicons name="layers-outline" size={18} color={colors.textMuted} />
          <Text style={styles.moreText}>更多阶段</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </PressableScale>

      <View style={styles.sectionHeadRow}>
        <Text style={styles.sectionTitle}>当前主题</Text>
        <Pressable
          hitSlop={8}
          style={styles.addBtn}
          onPress={() => {
            setCustomTopicTitle("");
            setCustomTopicSummary("");
            setCustomTopicSheet(true);
          }}
        >
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={styles.addBtnText}>添加主题</Text>
        </Pressable>
      </View>
      {currentThemes.map((topic, i) => {
        const c = THEME_COLORS[i % THEME_COLORS.length] ?? THEME_COLORS[0];
        const done = topic && progress[topic.id]?.done ? 1 : 0;
        const total = 6;
        return (
          <PressableScale
            key={topic.topicKey}
            haptic
            onPress={() => setContentTopic({ topicId: topic.id, phaseId: selectedPhase?.id ?? 0 })}
            style={styles.themeCard}
          >
            <View style={[styles.themeBlob, { backgroundColor: c[1] }]} />
            <View style={styles.themeInner}>
              <Text style={styles.themeName}>{topic.title}</Text>
              <Text style={styles.themeMeta} numberOfLines={1}>{topic.summary || "当前主题 · 保持节奏"}</Text>
              <View style={styles.themeDots}>
                {Array.from({ length: total }).map((_, j) => (
                  <View key={j} style={[styles.dot, j < done * total ? styles.dotOn : styles.dotOff]} />
                ))}
              </View>
            </View>
            <Text style={styles.themeNum}>{done}/{total}</Text>
          </PressableScale>
        );
      })}

      <Text style={styles.sectionTitle}>
        学习统计 <Text style={styles.sectionTitleMore}>近 12 周</Text>
      </Text>
      <Card style={styles.statsPanel}>
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>热力统计</Text>
          <Pressable style={styles.shareBtn} onPress={() => setShareSheet(true)}>
            <Ionicons name="share-social-outline" size={14} color={colors.primary} />
            <Text style={styles.shareBtnText}>分享</Text>
          </Pressable>
        </View>

        <View style={styles.dateNav}>
          <Pressable
            style={styles.dateArrow}
            onPress={() => setStatDate((d) => addDays(d, -1))}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
          </Pressable>
          <Pressable style={styles.dateCenter} onPress={() => setCalendarOpen(true)}>
            <Ionicons name="calendar-outline" size={15} color={colors.accentStrong} />
            <Text style={styles.dateText}>{statDate.getMonth() + 1}月{statDate.getDate()}日 · {weekdayName(statDate)}</Text>
          </Pressable>
          <Pressable
            style={[styles.dateArrow, isStatToday && styles.dateArrowDisabled]}
            disabled={isStatToday}
            onPress={() => setStatDate((d) => addDays(d, 1))}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={18} color={isStatToday ? colors.textFaint : colors.primary} />
          </Pressable>
        </View>

        <View style={styles.tomatoHero}>
          <View style={styles.ringWrap}>
            <RingProgress
              size={96}
              strokeWidth={11}
              progress={ringRatio}
              trackColor="rgba(242,140,40,0.14)"
              color={colors.accent}
            />
            <Text style={styles.ringPct}>{ringPctNum}%</Text>
          </View>
          <View style={styles.tomatoHeroRight}>
            <Text style={styles.hLabel}>今日专注 · 目标 2.5 小时</Text>
            <Text style={styles.hVal}>{formatDuration(todayMinutes)}</Text>
          </View>
        </View>

        <View style={styles.tomatoGrid}>
          {[
            { k: "累计专注", v: stats.totalFocusDays, unit: " 天" },
            { k: "累计时长", v: Math.round((totalMinutes / 60) * 10) / 10, unit: " h" },
            { k: "本周", v: Math.round((weekMinutes / 60) * 10) / 10, unit: " h" },
            { k: "今日", v: todayMinutes, unit: " 分" },
          ].map((item) => (
            <View key={item.k} style={styles.tomatoMini}>
              <Text style={styles.tomatoMiniK}>{item.k}</Text>
              <View style={styles.tomatoMiniLine}>
                <Text style={styles.tomatoMiniV}>{item.v}</Text>
                <Text style={styles.tomatoMiniU}>{item.unit}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.heatLabel}>可学习时长分布 · 热力图</Text>
        <View
          style={styles.heat}
          onLayout={(e) => setHeatWidth(Math.round(e.nativeEvent.layout.width))}
        >
          {heatmap.map((week, wi) => (
            <View key={wi} style={[styles.heatWeek, { gap: heatCellGap }]}>
              {week.map((day) => (
                <View
                  key={day.key}
                  style={[
                    styles.heatCell,
                    { width: heatCell, height: heatCell, borderRadius: Math.max(3, heatCell * 0.28), backgroundColor: heatColor(day.minutes) },
                    day.key === selectedKey && styles.heatCellActive,
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
        <View style={styles.heatLegend}>
          <Text style={styles.heatLegendText}>少</Text>
          {["#F1E7D4", "#FBE0B3", "#F5A34B", "#E35D2F"].map((c) => (
            <View key={c} style={[styles.heatSwatch, { backgroundColor: c }]} />
          ))}
          <Text style={styles.heatLegendText}>多</Text>
        </View>

        <Text style={styles.chartLabel}>
          {statDate.getMonth() + 1}月{statDate.getDate()}日 · 学习 {formatDuration(selectedMinutes)}
        </Text>
        <BarChart data={periodBars} height={150} color={colors.primary} colorTo="#78C2E8" />

        <Text style={styles.chartLabel}>近 14 天学习时长</Text>
        <LineChart data={dailySeries} height={150} color={colors.accent} />
      </Card>

      <BottomSheet
        visible={stageSheet}
        onClose={() => setStageSheet(false)}
        title="更多阶段"
        expandable
        height="50%"
        body={(expanded) =>
          expanded ? (
            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              <Pressable style={styles.newStageBtn} onPress={() => {
                setCustomPhaseTitle("");
                setCustomPhaseSheet(true);
              }}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.newStageBtnText}>新建自定义阶段</Text>
              </Pressable>
              {roadmap.map((p, i) => {
                const info = phaseDone(p);
                return (
                  <PressableScale
                    key={p.id}
                    haptic
                    onPress={() => {
                      setSelectedPhaseId(p.id);
                      setStageSheet(false);
                    }}
                    style={styles.reorderCard}
                  >
                    <View style={[styles.reorderNum, { backgroundColor: STAGE_GRADS[i % STAGE_GRADS.length][0] }]}>
                      <Text style={styles.sheetNumText}>{i + 1}</Text>
                    </View>
                    <View style={styles.sheetInfo}>
                      <Text style={styles.sheetName}>{p.title}</Text>
                      <Text style={styles.sheetMeta} numberOfLines={1}>{p.summary || p.weeks || ""}</Text>
                    </View>
                    <Text style={styles.sheetPct}>{pct(info.done, info.total)}%</Text>
                    <View style={styles.reorderBtns}>
                      <Pressable
                        hitSlop={6}
                        disabled={i === 0}
                        style={[styles.reorderBtn, i === 0 && styles.reorderBtnDisabled]}
                        onPress={() => swapPhase(i, i - 1)}
                      >
                        <Ionicons name="chevron-up" size={16} color={i === 0 ? colors.textFaint : colors.primary} />
                      </Pressable>
                      <Pressable
                        hitSlop={6}
                        disabled={i === roadmap.length - 1}
                        style={[styles.reorderBtn, i === roadmap.length - 1 && styles.reorderBtnDisabled]}
                        onPress={() => swapPhase(i, i + 1)}
                      >
                        <Ionicons name="chevron-down" size={16} color={i === roadmap.length - 1 ? colors.textFaint : colors.primary} />
                      </Pressable>
                    </View>
                  </PressableScale>
                );
              })}
              <Text style={styles.reorderHint}>点击上下箭头调整阶段顺序，长按右上角横线可全屏</Text>
            </ScrollView>
          ) : (
            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {agentPhase ? (
                <View style={styles.sheetStageItem}>
                  <View style={[styles.sheetNum, { backgroundColor: colors.primary }]}>
                    <Text style={styles.sheetNumText}>A</Text>
                  </View>
                  <View style={styles.sheetInfo}>
                    <Text style={styles.sheetName}>{agentPhase.title}</Text>
                    <Text style={styles.sheetMeta} numberOfLines={1}>{agentPhase.summary || "全程"}</Text>
                  </View>
                  <Text style={styles.sheetPct}>0%</Text>
                </View>
              ) : null}
              {remainingPhases.map((p, i) => {
                const info = phaseDone(p);
                return (
                  <PressableScale
                    key={p.id}
                    haptic
                    style={styles.sheetStageItem}
                    onPress={() => {
                      setSelectedPhaseId(p.id);
                      setStageSheet(false);
                    }}
                  >
                    <View style={[styles.sheetNum, { backgroundColor: STAGE_GRADS[(i + 2) % STAGE_GRADS.length][0] }]}>
                      <Text style={styles.sheetNumText}>{i + 3}</Text>
                    </View>
                    <View style={styles.sheetInfo}>
                      <Text style={styles.sheetName}>阶段 {i + 3} · {p.title}</Text>
                      <Text style={styles.sheetMeta} numberOfLines={1}>{p.summary || p.weeks || ""}</Text>
                    </View>
                    <Text style={styles.sheetPct}>{pct(info.done, info.total)}%</Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          )
        }
      >
        {null}
      </BottomSheet>

      <BottomSheet visible={shareSheet} onClose={() => setShareSheet(false)} title="分享学习统计" height="50%">
        <View style={styles.sharePreview}>
          <Text style={styles.spTitle}>{username ? `${username} 的 ICT 学习周报` : "我的 ICT 学习周报"}</Text>
          <Text style={styles.spSub}>把专注种成花 · 用热力记录每一次投入</Text>
          <View style={styles.spRows}>
            <View style={styles.spItem}><Text style={styles.spK}>本周专注</Text><Text style={styles.spV}>{formatDuration(weekMinutes)}</Text></View>
            <View style={styles.spItem}><Text style={styles.spK}>连续打卡</Text><Text style={styles.spV}>{stats.streak} 天</Text></View>
            <View style={styles.spItem}><Text style={styles.spK}>任务完成</Text><Text style={styles.spV}>{ringPctNum}%</Text></View>
            <View style={styles.spItem}><Text style={styles.spK}>运动记录</Text><Text style={styles.spV}>{formatDuration(sportMinutes)}</Text></View>
          </View>
        </View>
        <View style={styles.shareActions}>
          <Pressable style={styles.ghostBtn} onPress={doShare}>
            <Text style={styles.ghostBtnText}>复制文案</Text>
          </Pressable>
          <Pressable style={styles.primaryShareBtn} onPress={doShare}>
            <Text style={styles.primaryShareText}>生成图片</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        title="选择日期"
        height="60%"
      >
        <MonthCalendar
          selected={statDate}
          onSelect={(d) => setStatDate(d)}
          onClose={() => setCalendarOpen(false)}
        />
      </BottomSheet>

      <BottomSheet
        visible={customTopicSheet}
        onClose={() => setCustomTopicSheet(false)}
        title="添加学习内容"
        height="46%"
      >
        <View style={styles.formSheet}>
          <Text style={styles.formLabel}>主题标题</Text>
          <TextInput
            style={styles.formInput}
            value={customTopicTitle}
            onChangeText={setCustomTopicTitle}
            placeholder="例如：网络安全命令速查"
            placeholderTextColor={colors.textFaint}
          />
          <Text style={styles.formLabel}>一句话说明（选填）</Text>
          <TextInput
            style={[styles.formInput, styles.formInputArea]}
            value={customTopicSummary}
            onChangeText={setCustomTopicSummary}
            placeholder="这个阶段要掌握什么"
            placeholderTextColor={colors.textFaint}
            multiline
          />
          <Pressable style={styles.primaryShareBtn} onPress={submitCustomTopic}>
            <Text style={styles.primaryShareText}>保存并同步</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={customPhaseSheet}
        onClose={() => setCustomPhaseSheet(false)}
        title="新建学习阶段"
        height="38%"
      >
        <View style={styles.formSheet}>
          <Text style={styles.formLabel}>阶段标题</Text>
          <TextInput
            style={styles.formInput}
            value={customPhaseTitle}
            onChangeText={setCustomPhaseTitle}
            placeholder="例如：项目实战冲刺"
            placeholderTextColor={colors.textFaint}
          />
          <Pressable
            style={[styles.primaryShareBtn, roadmapLoading && styles.btnDisabled]}
            disabled={roadmapLoading}
            onPress={() => void submitCustomPhase()}
          >
            {roadmapLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryShareText}>创建并同步</Text>}
          </Pressable>
        </View>
      </BottomSheet>

      <Modal visible={!!activeTopic} transparent animationType="fade" onRequestClose={() => setContentTopic(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setContentTopic(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {activeTopic ? (
              <>
                <View style={styles.modalHead}>
                  <View style={[styles.modalDot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.modalTitle}>{activeTopic.title}</Text>
                </View>
                <Text style={styles.modalSub}>{activeTopic.summary || "这个阶段的学习内容会在这里展开。"}</Text>
                {(activeTopic.practices?.length ?? 0) > 0 ? (
                  <Text style={styles.modalListTitle}>练习任务</Text>
                ) : null}
                {(activeTopic.practices ?? []).map((pr) => (
                  <View key={pr.id} style={styles.modalRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.modalRowText}>{pr.text}</Text>
                  </View>
                ))}
                {(activeTopic.checkpoints?.length ?? 0) > 0 ? (
                  <Text style={styles.modalListTitle}>阶段验收</Text>
                ) : null}
                {(activeTopic.checkpoints ?? []).map((cp) => (
                  <View key={cp.id} style={styles.modalRow}>
                    <Ionicons name="flag" size={16} color={colors.accent} />
                    <Text style={styles.modalRowText}>{cp.text}</Text>
                  </View>
                ))}
                {"isCustomSubject" in activeTopic ? (
                  <Pressable
                    style={styles.deleteTopicBtn}
                    onPress={() => {
                      removeCustomTopic(contentTopic?.topicId ?? 0);
                      setContentTopic(null);
                    }}
                  >
                    <Ionicons name="trash-outline" size={15} color="#D64545" />
                    <Text style={styles.deleteTopicText}>删除该主题</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 16, paddingBottom: 118, gap: 12 },
  hero: { marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: "800", color: colors.text },
  heroSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.text, marginTop: 8 },
  sectionTitleMore: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(242,140,40,0.25)",
  },
  addBtnText: { color: colors.accentStrong, fontSize: 12, fontWeight: "800" },

  stageCard: {
    borderRadius: radius.lg,
    padding: 16,
    overflow: "hidden",
    minHeight: 104,
    backgroundColor: "#2F74C0",
    shadowColor: "#14548D",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  stageCardActive: { borderWidth: 2.5, borderColor: "rgba(255,255,255,0.85)" },
  stageBlob: { position: "absolute", width: 160, height: 160, borderRadius: 80, right: -46, top: -56, opacity: 0.5 },
  stageTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  stageTag: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "800", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  stageName: { color: "#fff", fontSize: 17, fontWeight: "800", flex: 1 },
  stageDesc: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 6 },
  stageBar: { height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)", marginTop: 12, overflow: "hidden" },
  stageBarFill: { height: "100%", borderRadius: 999 },
  stagePct: { position: "absolute", right: 16, top: 12, color: "rgba(255,255,255,0.88)", fontSize: 12, fontWeight: "800" },

  moreCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  moreLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  moreText: { color: colors.text, fontSize: 14, fontWeight: "700" },

  themeCard: {
    borderRadius: radius.lg,
    padding: 16,
    overflow: "hidden",
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2F74C0",
    shadowColor: "#14548D",
    shadowOpacity: 0.20,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  themeBlob: { position: "absolute", width: 120, height: 120, borderRadius: 60, right: -30, top: -38, opacity: 0.5 },
  themeInner: { flex: 1 },
  themeName: { color: "#fff", fontSize: 15, fontWeight: "800" },
  themeMeta: { color: "rgba(255,255,255,0.78)", fontSize: 11, marginTop: 4 },
  themeDots: { flexDirection: "row", gap: 4, marginTop: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotOn: { backgroundColor: "rgba(255,255,255,0.92)" },
  dotOff: { backgroundColor: "rgba(255,255,255,0.22)" },
  themeNum: { color: "#fff", fontSize: 22, fontWeight: "800", marginLeft: 12 },

  statsPanel: { padding: 16, gap: 14 },
  panelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  panelTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  shareBtnText: { fontSize: 12, fontWeight: "700", color: colors.primary },

  tomatoHero: { flexDirection: "row", alignItems: "center", gap: 16 },
  ringWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  ringPct: { position: "absolute", color: colors.text, fontSize: 20, fontWeight: "800" },
  tomatoHeroRight: { flex: 1, gap: 4 },
  hLabel: { color: colors.textMuted, fontSize: 12 },
  hVal: { color: colors.text, fontSize: 24, fontWeight: "800" },

  tomatoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tomatoMini: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tomatoMiniK: { color: colors.textMuted, fontSize: 11 },
  tomatoMiniLine: { flexDirection: "row", alignItems: "flex-end", gap: 2, marginTop: 6 },
  tomatoMiniV: { color: colors.text, fontSize: 20, fontWeight: "800" },
  tomatoMiniU: { color: colors.textMuted, fontSize: 12, marginBottom: 3 },

  heatLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  heat: { flexDirection: "row", gap: 4, alignItems: "flex-start" },
  heatWeek: { gap: 4 },
  heatCell: { width: 13, height: 13, borderRadius: 4 },
  heatLegend: { flexDirection: "row", alignItems: "center", gap: 5, justifyContent: "flex-end", marginTop: 8 },
  heatLegendText: { color: colors.textMuted, fontSize: 11 },
  heatSwatch: { width: 13, height: 13, borderRadius: 4 },
  heatCellActive: { borderWidth: 2, borderColor: colors.primary },

  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  dateArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dateCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  dateText: { fontSize: 13, fontWeight: "700", color: colors.text },
  dateArrowDisabled: { opacity: 0.4 },

  chartLabel: { fontSize: 13, fontWeight: "700", color: colors.text },

  calendar: { gap: 14 },
  calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  calTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  calWeekRow: { flexDirection: "row" },
  calWeek: { width: `${100 / 7}%`, textAlign: "center", fontSize: 12, fontWeight: "700", color: colors.textMuted },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  calDay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  calDaySelected: { backgroundColor: colors.primary },
  calDayToday: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  calDayText: { fontSize: 14, fontWeight: "600", color: colors.text },
  calDayTextSelected: { color: "#fff", fontWeight: "800" },
  calDayTextDisabled: { color: colors.textFaint },

  sheetScroll: { flex: 1 },
  sheetStageItem: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  sheetNum: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sheetNumText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  sheetInfo: { flex: 1 },
  sheetName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  sheetMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  sheetPct: { color: colors.accent, fontSize: 13, fontWeight: "800" },
  newStageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    paddingVertical: 11,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(242,140,40,0.28)",
  },
  newStageBtnText: { color: colors.accentStrong, fontSize: 13, fontWeight: "800" },
  reorderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  reorderNum: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  reorderBtns: { flexDirection: "row", gap: 4 },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  reorderBtnDisabled: { opacity: 0.45 },
  reorderHint: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 8 },

  formSheet: { gap: 12, paddingTop: 4 },
  formLabel: { color: colors.text, fontSize: 13, fontWeight: "800" },
  formInput: {
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  formInputArea: { minHeight: 84, textAlignVertical: "top" },
  btnDisabled: { opacity: 0.6 },

  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(30,24,12,0.42)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "rgba(255,251,234,0.98)",
    borderRadius: 24,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.7)",
  },
  modalHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  modalDot: { width: 10, height: 10, borderRadius: 5 },
  modalTitle: { color: colors.text, fontSize: 19, fontWeight: "900", flex: 1 },
  modalSub: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  modalListTitle: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: 6, marginBottom: 8 },
  modalRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  modalRowText: { color: colors.text, fontSize: 13, flex: 1, lineHeight: 18 },
  deleteTopicBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFF0F0",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#F3C2C2",
  },
  deleteTopicText: { color: "#D64545", fontSize: 13, fontWeight: "800" },

  sharePreview: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  spTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  spSub: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  spRows: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  spItem: { width: "48%", backgroundColor: colors.canvas, borderRadius: radius.md, padding: 12 },
  spK: { color: colors.textMuted, fontSize: 11 },
  spV: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 6 },
  shareActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  ghostBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 12, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  ghostBtnText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  primaryShareBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  primaryShareText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
