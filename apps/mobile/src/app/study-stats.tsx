import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { Card } from "@/components/card";
import { SectionHeader } from "@/components/section-header";
import { RingProgress } from "@/components/ring-progress";
import { BarChart, LineChart } from "@/components/charts";
import { MonthCalendar } from "@/components/month-calendar";
import { BottomSheet } from "@/components/bottom-sheet";
import { StudyShareSheet } from "@/components/study-share-card";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useAppStore } from "@/store/app-store";
import { UNTAGGED_CONTENT, computeFocusStats } from "@/lib/focus-stats";
import { buildStudyCardModel } from "@/lib/study-card-model";
import {
  HEAT_LEGEND,
  addDays,
  buildDailySeries,
  buildDayMinutesMap,
  buildHeatmap,
  buildPeriodBars,
  heatColor,
  localKey,
  weekdayName,
} from "@/lib/focus-series";
import { formatDuration } from "@learn-workbench/shared";
import { radius, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 学习统计（v1.33.0）—— **独立全屏页面**。
 *
 * 之前它是学习页里的一个 94% 高的 BottomSheet（v2 §Bug 6 收进去的），真机上：
 * ① 弹层里再套「选择日期」弹层，层级与手势都别扭；② 图表+热力图内容很长，弹层滚动区太窄。
 * 现在改成真正的路由（`/study-stats`，push 进栈、原生转场、左滑返回），
 * 计算下沉到 `lib/focus-series.ts`（可单测），页面只负责布局与交互。
 *
 * ⚠️ 滚动容器是 `Animated.ScrollView` → 用 `headerScroll.onScroll`；
 * 普通 FlatList/FlashList 必须用 `onScrollJS`（踩坑 99，有静态护栏测试守着）。
 */
const TODAY_TARGET_MIN = 150;

export default function StudyStatsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const sessions = useAppStore((s) => s.sessions);

  /** 统计查看的日期（默认今天；可前后翻天或点日期挑） */
  const [statDate, setStatDate] = useState(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [shareSheet, setShareSheet] = useState(false);
  const [contentTab, setContentTab] = useState<"today" | "week">("today");
  const [heatWidth, setHeatWidth] = useState(0);

  const stats = useMemo(() => computeFocusStats(sessions), [sessions]);
  const heatmap = useMemo(() => buildHeatmap(sessions), [sessions]);
  const contentRows = contentTab === "today" ? stats.byContent : stats.weekByContent;
  const maxContentMinutes = contentRows.reduce((m, r) => Math.max(m, r.minutes), 0);

  const selectedKey = localKey(statDate);
  const isStatToday = selectedKey === localKey(new Date());
  const selectedMinutes = useMemo(() => buildDayMinutesMap(sessions).get(selectedKey) ?? 0, [sessions, selectedKey]);
  const periodBars = useMemo(() => buildPeriodBars(sessions, selectedKey), [sessions, selectedKey]);
  const dailySeries = useMemo(() => buildDailySeries(sessions, statDate), [sessions, statDate]);

  const todayMinutes = stats.todayMinutes;
  const ringRatio = Math.min(1, todayMinutes / TODAY_TARGET_MIN);
  const ringPct = Math.round((todayMinutes / TODAY_TARGET_MIN) * 100);
  const weekMinutes = stats.last14.slice(7).reduce((sum, d) => sum + d.minutes, 0);
  const totalMinutes = sessions.reduce((sum, s) => sum + Math.max(0, Math.round((s.durationSeconds ?? 0) / 60)), 0);

  // 热力图几何：12 周 × 7 天，按容器实测宽度算格子（与旧弹层口径一致，只把 4 提成常量）
  const HEAT_GAP = 4;
  const heatWeeks = heatmap.length;
  const heatCell = heatWidth > 0 ? Math.max(8, Math.floor((heatWidth - HEAT_GAP * (heatWeeks - 1)) / heatWeeks)) : 13;

  const shareData = useMemo(
    () =>
      buildStudyCardModel({
        todayMinutes: stats.todayMinutes,
        todaySessions: stats.todaySessions,
        streak: stats.streak,
        totalFocusDays: stats.totalFocusDays,
        last14: stats.last14,
        weekMinutes,
        goalMinutes: TODAY_TARGET_MIN,
      }),
    [stats, weekMinutes]
  );

  const onHeatLayout = (e: LayoutChangeEvent) => setHeatWidth(Math.round(e.nativeEvent.layout.width));

  const miniStats = [
    { k: "累计专注", v: stats.totalFocusDays, unit: " 天" },
    { k: "累计时长", v: Math.round((totalMinutes / 60) * 10) / 10, unit: " h" },
    { k: "本周", v: Math.round((weekMinutes / 60) * 10) / 10, unit: " h" },
    { k: "今日", v: todayMinutes, unit: " 分" },
  ];

  return (
    <View style={styles.root}>
      {/* v17-C2b：紧凑栏必须在滚动容器**之外**才能真吸顶（放在内容流里会跟着滚走） */}
      <ScreenHeaderStickyBar title="学习统计" backTo="/learn" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeaderLargeTitle title="学习统计" subtitle="专注分布 · 内容维度 · 时段趋势" />

        {/* 今日与周期：环 + 四格 + 分享入口 */}
        <Card style={styles.panel}>
          <SectionHeader
            title="今日与周期"
            subtitle="点日期可切换查看"
            accentColor={colors.accent}
          />
          <View style={styles.dateNav}>
            <Pressable style={styles.dateArrow} hitSlop={8} onPress={() => setStatDate((d) => addDays(d, -1))} accessibilityLabel="前一天">
              <ThemedIcon name="chevron-back" size={18} color={colors.primary} />
            </Pressable>
            <Pressable style={styles.dateCenter} onPress={() => setCalendarOpen(true)} accessibilityLabel="选择日期">
              <ThemedIcon name="calendar-outline" size={15} color={colors.accentStrong} />
              <Text style={styles.dateText}>
                {statDate.getMonth() + 1}月{statDate.getDate()}日 · {weekdayName(statDate)}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.dateArrow, isStatToday && styles.dateArrowDisabled]}
              disabled={isStatToday}
              hitSlop={8}
              onPress={() => setStatDate((d) => addDays(d, 1))}
              accessibilityLabel="后一天"
            >
              <ThemedIcon name="chevron-forward" size={18} color={isStatToday ? colors.textFaint : colors.primary} />
            </Pressable>
          </View>

          <View style={styles.hero}>
            <View style={styles.ringWrap}>
              <RingProgress size={108} strokeWidth={12} progress={ringRatio} trackColor={colors.accentSoft} color={colors.accent} />
              <Text style={styles.ringPct}>{ringPct}%</Text>
            </View>
            <View style={styles.heroRight}>
              <Text style={styles.heroLabel}>今日专注 · 目标 {formatDuration(TODAY_TARGET_MIN)}</Text>
              <Text style={styles.heroValue}>{formatDuration(todayMinutes)}</Text>
              <View style={styles.heroSubRow}>
                <ThemedIcon name="flame-outline" size={14} color={colors.accentStrong} />
                <Text style={styles.heroSub}>连续 {stats.streak} 天 · 今日 {stats.todaySessions} 次</Text>
              </View>
            </View>
          </View>

          <View style={styles.miniGrid}>
            {miniStats.map((item) => (
              <View key={item.k} style={styles.mini}>
                <Text style={styles.miniKey}>{item.k}</Text>
                <View style={styles.miniLine}>
                  <Text style={styles.miniValue}>{item.v}</Text>
                  <Text style={styles.miniUnit}>{item.unit}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable style={styles.shareBtn} onPress={() => setShareSheet(true)} accessibilityLabel="分享学习统计">
            <ThemedIcon name="share-social-outline" size={15} color={colors.primary} />
            <Text style={styles.shareBtnText}>分享闪光卡</Text>
          </Pressable>
        </Card>

        {/* 学习内容维度（今日 / 本周） */}
        <Card style={styles.panel}>
          <SectionHeader
            title="学习内容"
            subtitle={contentTab === "today" ? "今天绑定了学习内容的专注" : "最近 7 天（含今天）"}
            accentColor={colors.accent}
          />
          <View style={styles.tabs}>
            {(
              [
                { key: "today", label: "今日" },
                { key: "week", label: "本周" },
              ] as const
            ).map((t) => {
              const active = contentTab === t.key;
              return (
                <Pressable
                  key={t.key}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setContentTab(t.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {contentRows.length === 0 ? (
            <Text style={styles.contentEmpty}>
              {contentTab === "today" ? "今天还没有绑定学习内容的专注" : "本周还没有绑定学习内容的专注"}
            </Text>
          ) : (
            <View style={styles.contentList}>
              {contentRows.map((row) => (
                <View key={row.label} style={styles.contentRow}>
                  <View style={styles.contentTop}>
                    <Text style={styles.contentLabel} numberOfLines={1}>
                      {row.label}
                    </Text>
                    <Text style={styles.contentMeta}>
                      {formatDuration(row.minutes)} · {row.sessions} 次
                    </Text>
                  </View>
                  <View style={styles.contentTrack}>
                    <View
                      style={[
                        styles.contentFill,
                        {
                          width: `${maxContentMinutes > 0 ? Math.round((row.minutes / maxContentMinutes) * 100) : 0}%`,
                          backgroundColor: row.label === UNTAGGED_CONTENT ? colors.textFaint : colors.accent,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* 可学习时长分布（近 12 周热力图） */}
        <Card style={styles.panel}>
          <SectionHeader title="可学习时长分布" subtitle="近 12 周 · 颜色越深专注越多" accentColor={colors.accent} />
          <View style={styles.heat} onLayout={onHeatLayout}>
            {heatmap.map((week, wi) => (
              <View key={wi} style={[styles.heatWeek, { gap: HEAT_GAP }]}>
                {week.map((day) => (
                  <View
                    key={day.key}
                    style={[
                      styles.heatCell,
                      {
                        width: heatCell,
                        height: heatCell,
                        borderRadius: Math.max(3, heatCell * 0.28),
                        backgroundColor: heatColor(day.minutes),
                      },
                      day.key === selectedKey && styles.heatCellActive,
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
          <View style={styles.heatLegend}>
            <Text style={styles.heatLegendText}>少</Text>
            {HEAT_LEGEND.map((c) => (
              <View key={c} style={[styles.heatSwatch, { backgroundColor: c }]} />
            ))}
            <Text style={styles.heatLegendText}>多</Text>
          </View>
        </Card>

        {/* 时段与趋势 */}
        <Card style={styles.panel}>
          <SectionHeader
            title="时段与趋势"
            subtitle={`${statDate.getMonth() + 1}月${statDate.getDate()}日 · 学习 ${formatDuration(selectedMinutes)}`}
            accentColor={colors.accent}
          />
          <Text style={styles.chartLabel}>时段分布</Text>
          <BarChart data={periodBars} height={150} color={colors.primary} colorTo={colors.primarySoft} />
          <Text style={[styles.chartLabel, styles.chartLabelGap]}>近 14 天学习时长</Text>
          <LineChart data={dailySeries} height={150} color={colors.accent} />
        </Card>
      </Animated.ScrollView>

      <StudyShareSheet visible={shareSheet} onClose={() => setShareSheet(false)} model={shareData} />

      <BottomSheet
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        title="选择日期"
        subtitle="点某一天，看那天的学习分布"
        icon="calendar-outline"
        height="62%"
      >
        <MonthCalendar selected={statDate} onSelect={(d) => setStatDate(d)} onClose={() => setCalendarOpen(false)} />
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },

    panel: { padding: 16, gap: 14 },

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
    dateArrowDisabled: { opacity: 0.4 },
    dateCenter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.accentSoft,
    },
    dateText: { ...typography.caption, fontWeight: "700", color: colors.text },

    hero: { flexDirection: "row", alignItems: "center", gap: 18 },
    ringWrap: { width: 108, height: 108, alignItems: "center", justifyContent: "center" },
    ringPct: { position: "absolute", ...typography.title2, fontWeight: "800", color: colors.text, ...tabularNums },
    heroRight: { flex: 1, gap: 4, minWidth: 0 },
    heroLabel: { ...typography.caption, color: colors.textMuted },
    heroValue: { ...typography.title1, fontWeight: "800", color: colors.text, ...tabularNums },
    heroSubRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    heroSub: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },

    miniGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    mini: {
      flexBasis: "47%",
      flexGrow: 1,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    miniKey: { ...typography.micro, color: colors.textMuted },
    miniLine: { flexDirection: "row", alignItems: "flex-end", gap: 2, marginTop: 6 },
    miniValue: { ...typography.title2, fontWeight: "800", color: colors.text, ...tabularNums },
    miniUnit: { ...typography.caption, color: colors.textMuted, marginBottom: 3 },

    shareBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.pill,
      paddingVertical: 10,
    },
    shareBtnText: { ...typography.callout, fontWeight: "800", color: colors.primary },

    tabs: { flexDirection: "row", gap: 6 },
    tab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
    tabActive: { backgroundColor: colors.accent },
    tabText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    tabTextActive: { color: "#fff" },

    contentList: { gap: 10 },
    contentRow: { gap: 5 },
    contentTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    contentLabel: { flex: 1, ...typography.callout, fontWeight: "700", color: colors.text },
    contentMeta: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
    contentTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    contentFill: { height: "100%", borderRadius: radius.pill },
    contentEmpty: { ...typography.caption, color: colors.textMuted },

    heat: { flexDirection: "row", gap: 4, alignItems: "flex-start" },
    heatWeek: { gap: 4 },
    heatCell: { width: 13, height: 13, borderRadius: 4 },
    heatCellActive: { borderWidth: 2, borderColor: colors.primary },
    heatLegend: { flexDirection: "row", alignItems: "center", gap: 5, justifyContent: "flex-end" },
    heatLegendText: { ...typography.micro, color: colors.textMuted },
    heatSwatch: { width: 13, height: 13, borderRadius: 4 },

    chartLabel: { ...typography.caption, fontWeight: "700", color: colors.text },
    chartLabelGap: { marginTop: 6 },
  });
