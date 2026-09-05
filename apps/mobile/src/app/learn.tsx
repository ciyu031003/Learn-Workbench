/* eslint-disable react-hooks/immutability */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { RingProgress } from "@/components/ring-progress";
import { BarChart, LineChart } from "@/components/charts";
import { useAppStore } from "@/store/app-store";
import { useSportStore } from "@/store/sport-store";
import { mainPhases, agentPhase } from "@learn-workbench/content";
import { formatDuration, pct } from "@learn-workbench/shared";
import { computeFocusStats } from "@/lib/focus-stats";
import { colors, radius } from "@/theme/tokens";

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

function phaseDoneCount(phaseId: number, progress: ReturnType<typeof useAppStore.getState>["progress"]) {
  const phase = mainPhases.find((p) => p.id === phaseId);
  if (!phase) return 0;
  return phase.topics.filter((t) => progress[t.id]?.done).length;
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
  const insets = useSafeAreaInsets();
  const progress = useAppStore((s) => s.progress);
  const sessions = useAppStore((s) => s.sessions);
  const username = useAppStore((s) => s.username);
  const sportRecords = useSportStore((s) => s.records);
  const [stageSheet, setStageSheet] = useState(false);
  const [shareSheet, setShareSheet] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [statDate, setStatDate] = useState<Date>(() => new Date());

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
  const firstPhase = mainPhases[0];
  const secondPhase = mainPhases[1];
  const remainingPhases = mainPhases.slice(2);
  const firstProgress = firstPhase ? phaseDoneCount(firstPhase.id, progress) : 0;
  const secondProgress = secondPhase ? phaseDoneCount(secondPhase.id, progress) : 0;
  const firstTotal = firstPhase?.topics.length ?? 1;
  const secondTotal = secondPhase?.topics.length ?? 1;

  const todayMinutes = stats.todayMinutes;
  const todayTarget = 150;
  const ringRatio = Math.min(1, todayMinutes / todayTarget);
  const ringPctNum = Math.round((todayMinutes / todayTarget) * 100);
  const weekMinutes = stats.last14.slice(7).reduce((sum, d) => sum + d.minutes, 0);
  const totalMinutes = sessions.reduce((sum, s) => sum + Math.max(0, Math.round((s.durationSeconds ?? 0) / 60)), 0);
  const sportMinutes = sportRecords.reduce((sum, r) => sum + r.minutes, 0);

  const currentThemes = firstPhase?.topics.slice(0, 3) ?? [];

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
      {firstPhase ? (
        <View style={styles.stageCard}>
          <View style={[styles.stageBlob, { backgroundColor: STAGE_GRADS[0][1] }]} />
          <View style={styles.stageTop}>
            <Text style={styles.stageTag}>阶段 1</Text>
            <Text style={styles.stageName}>{firstPhase.title}</Text>
          </View>
          <Text style={styles.stageDesc} numberOfLines={1}>
            {firstPhase.summary || firstPhase.weeks || ""}
          </Text>
          <View style={styles.stageBar}>
            <View style={[styles.stageBarFill, { width: `${pct(firstProgress, firstTotal)}%`, backgroundColor: STAGE_GRADS[0][1] }]} />
          </View>
          <Text style={styles.stagePct}>{pct(firstProgress, firstTotal)}%</Text>
        </View>
      ) : null}
      {secondPhase ? (
        <View style={styles.stageCard}>
          <View style={[styles.stageBlob, { backgroundColor: STAGE_GRADS[1][1] }]} />
          <View style={styles.stageTop}>
            <Text style={styles.stageTag}>阶段 2</Text>
            <Text style={styles.stageName}>{secondPhase.title}</Text>
          </View>
          <Text style={styles.stageDesc} numberOfLines={1}>
            {secondPhase.summary || secondPhase.weeks || ""}
          </Text>
          <View style={styles.stageBar}>
            <View style={[styles.stageBarFill, { width: `${pct(secondProgress, secondTotal)}%`, backgroundColor: STAGE_GRADS[1][1] }]} />
          </View>
          <Text style={styles.stagePct}>{pct(secondProgress, secondTotal)}%</Text>
        </View>
      ) : null}

      <PressableScale style={styles.moreCard} haptic onPress={() => setStageSheet(true)}>
        <View style={styles.moreLeft}>
          <Ionicons name="layers-outline" size={18} color={colors.textMuted} />
          <Text style={styles.moreText}>更多阶段</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </PressableScale>

      <Text style={styles.sectionTitle}>当前主题</Text>
      {currentThemes.map((topic, i) => {
        const c = THEME_COLORS[i % THEME_COLORS.length] ?? THEME_COLORS[0];
        const done = topic && progress[topic.id]?.done ? 1 : 0;
        const total = 6;
        return (
          <View key={topic.id} style={styles.themeCard}>
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
          </View>
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
      >
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
            const done = phaseDoneCount(p.id, progress);
            const total = p.topics.length || 1;
            return (
              <View key={p.id} style={styles.sheetStageItem}>
                <View style={[styles.sheetNum, { backgroundColor: STAGE_GRADS[(i + 2) % STAGE_GRADS.length][0] }]}>
                  <Text style={styles.sheetNumText}>{i + 3}</Text>
                </View>
                <View style={styles.sheetInfo}>
                  <Text style={styles.sheetName}>阶段 {i + 3} · {p.title}</Text>
                  <Text style={styles.sheetMeta} numberOfLines={1}>{p.summary || p.weeks || ""}</Text>
                </View>
                <Text style={styles.sheetPct}>{pct(done, total)}%</Text>
              </View>
            );
          })}
        </ScrollView>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 16, paddingBottom: 118, gap: 12 },
  hero: { marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: "800", color: colors.text },
  heroSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.text, marginTop: 8 },
  sectionTitleMore: { fontSize: 12, fontWeight: "600", color: colors.textMuted },

  stageCard: { borderRadius: radius.lg, padding: 16, overflow: "hidden", minHeight: 104, backgroundColor: "#2F74C0" },
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

  themeCard: { borderRadius: radius.lg, padding: 16, overflow: "hidden", minHeight: 92, flexDirection: "row", alignItems: "center", backgroundColor: "#2F74C0" },
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
