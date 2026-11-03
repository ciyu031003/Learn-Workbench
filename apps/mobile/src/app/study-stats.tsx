import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { Card } from "@/components/card";
import { SectionHeader } from "@/components/section-header";
import { RingProgress } from "@/components/ring-progress";
import { MonthCalendar } from "@/components/month-calendar";
import { BottomSheet } from "@/components/bottom-sheet";
import { StudyShareSheet } from "@/components/study-share-card";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { BarList, HeatmapCalendar, StatTileRow, StepsBar } from "@/components/v2/charts";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useAppStore } from "@/store/app-store";
import { UNTAGGED_CONTENT, computeFocusStats } from "@/lib/focus-stats";
import { buildStudyCardModel } from "@/lib/study-card-model";
import {
  addDays,
  buildDailySeries,
  buildDayMinutesMap,
  buildPeakPeriod,
  buildPeriodBars,
  buildWeekCompare,
  localKey,
  weekdayName,
} from "@/lib/focus-series";
import { formatDuration } from "@learn-workbench/shared/dates";
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
 * v2.1 P3：图表区换成数据面板组件库（`components/v2/charts`）——
 * 四格指标 → StatTileRow；学习内容 → BarList；12 周热力 → HeatmapCalendar（月历格）；
 * 时段分布 / 近 7 天 → StepsBar。旧的 BarChart / LineChart / 自绘热力格已删除，
 * 数据仍全部来自 store 的 sessions 与 lib/focus-series、lib/focus-stats（零新增接口）。
 *
 * ⚠️ 滚动容器是 `Animated.ScrollView` → 用 `headerScroll.onScroll`；
 * 普通 FlatList/FlashList 必须用 `onScrollJS`（踩坑 99，有静态护栏测试守着）。
 */
const TODAY_TARGET_MIN = 150;

/**
 * 柱顶数值文案：StepsBar 的柱宽约 35~45pt，130% 字号下 4 位数会顶到栏边；
 * 千分钟以上折成 "1.2k"（只有极高强度的那一天才会触发，3 位数仍显示原值）。
 */
const compactMinutes = (minutes: number) =>
  minutes >= 1000 ? `${(minutes / 1000).toFixed(1)}k` : String(Math.round(minutes));

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

  const stats = useMemo(() => computeFocusStats(sessions), [sessions]);
  const contentRows = contentTab === "today" ? stats.byContent : stats.weekByContent;
  const contentTotalMinutes = contentRows.reduce((sum, row) => sum + row.minutes, 0);
  const maxContentMinutes = contentRows.reduce((m, r) => Math.max(m, r.minutes), 0);
  /** 本周 vs 上周环比（不足 14 天记录 → null 不显示） */
  const weekCompare = useMemo(() => buildWeekCompare(stats.last14), [stats.last14]);
  /** 黄金时段（全部会话累计分钟最多的时段） */
  const peakPeriod = useMemo(() => buildPeakPeriod(sessions), [sessions]);

  const selectedKey = localKey(statDate);
  const isStatToday = selectedKey === localKey(new Date());
  /**
   * 日期键 → 当天分钟：热力格与「选中日分钟」共用同一份聚合。
   * HeatmapCalendar 要的是普通对象（Record），Map 在这里一次性展平，避免每帧重建。
   */
  const dayMinutes = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [key, minutes] of buildDayMinutesMap(sessions)) out[key] = minutes;
    return out;
  }, [sessions]);
  const selectedMinutes = dayMinutes[selectedKey] ?? 0;
  const periodBars = useMemo(() => buildPeriodBars(sessions, selectedKey), [sessions, selectedKey]);
  const dailySeries = useMemo(() => buildDailySeries(sessions, statDate), [sessions, statDate]);

  const todayMinutes = stats.todayMinutes;
  const ringRatio = Math.min(1, todayMinutes / TODAY_TARGET_MIN);
  const ringPct = Math.round((todayMinutes / TODAY_TARGET_MIN) * 100);
  const weekMinutes = stats.last14.slice(7).reduce((sum, d) => sum + d.minutes, 0);
  const totalMinutes = sessions.reduce((sum, s) => sum + Math.max(0, Math.round((s.durationSeconds ?? 0) / 60)), 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const weekHours = Math.round((weekMinutes / 60) * 10) / 10;
  const weekDays = stats.last14.slice(7).filter((day) => day.minutes > 0).length;

  /** 时段柱：按当日峰值归一（StepsBar 内部再夹 0..1，脏数据不会画出溢出柱） */
  const periodPeak = periodBars.reduce((peak, bar) => Math.max(peak, bar.value), 0);
  /** 近 7 天柱（日期跟随页面选中的 statDate，与原来的「近 14 天」同口径） */
  const last7 = dailySeries.slice(-7);
  const last7Peak = last7.reduce((peak, day) => Math.max(peak, day.value), 0);
  const last7Total = last7.reduce((sum, day) => sum + day.value, 0);

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

  /**
   * 点热力格切日期：与顶部的日期翻页同一处状态（不新增数据加载）。
   * 未来日期不可选 —— 顶部「后一天」按钮也是到今天就禁用，两处口径保持一致。
   */
  const onPickDay = (key: string) => {
    if (key > localKey(new Date())) return;
    const [year, month, day] = key.split("-").map(Number);
    if (!year || !month || !day) return;
    setStatDate(new Date(year, month - 1, day));
  };

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

        {/* 今日与周期：环 + 四格指标 + 分享入口 */}
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
              {weekCompare && weekCompare.lastWeek > 0 ? (
                <View
                  style={[
                    styles.deltaChip,
                    weekCompare.delta >= 0 ? styles.deltaUp : styles.deltaDown,
                  ]}
                  accessibilityLabel={`本周比上周${weekCompare.delta >= 0 ? "多" : "少"} ${formatDuration(Math.abs(weekCompare.delta))}`}
                >
                  <ThemedIcon
                    name={weekCompare.delta >= 0 ? "trending-up-outline" : "trending-down-outline"}
                    size={13}
                    color={weekCompare.delta >= 0 ? colors.success : colors.danger}
                  />
                  <Text style={[styles.deltaText, weekCompare.delta >= 0 ? { color: colors.success } : { color: colors.danger }]}>
                    本周较上周 {weekCompare.delta >= 0 ? "+" : "−"}{formatDuration(Math.abs(weekCompare.delta))}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <Pressable style={styles.shareBtn} onPress={() => setShareSheet(true)} accessibilityLabel="分享学习统计">
            <ThemedIcon name="share-social-outline" size={15} color={colors.primary} />
            <Text style={styles.shareBtnText}>分享闪光卡</Text>
          </Pressable>
        </Card>

        {/* v2.1 P3：原四格迷你卡 → 标准指标卡（铺在画布上，避免"卡中卡"；两行两列 130% 不挤） */}
        <View style={styles.tileGrid}>
          <StatTileRow
            items={[
              { label: "累计专注", value: totalHours, unit: "h", icon: "time-outline", tone: "primary" },
              { label: "累计天数", value: stats.totalFocusDays, unit: "天", icon: "calendar-outline" },
            ]}
          />
          <StatTileRow
            items={[
              { label: "本周时长", value: weekHours, unit: "h", icon: "trending-up-outline", tone: "accent" },
              { label: "本周天数", value: weekDays, unit: "天", icon: "checkmark-done-outline", tone: "success" },
            ]}
          />
        </View>

        {/* 学习内容维度（今日 / 本周）：排行 + 行内占比条 */}
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
            <BarList
              title={null}
              max={maxContentMinutes}
              items={contentRows.map((row) => ({
                key: row.label,
                label: row.label,
                value: row.minutes,
                valueLabel: formatDuration(row.minutes),
                hint: `${row.sessions} 次${contentTotalMinutes > 0 ? ` · 占 ${Math.round((row.minutes / contentTotalMinutes) * 100)}%` : ""}`,
                color: row.label === UNTAGGED_CONTENT ? colors.textFaint : colors.accent,
              }))}
            />
          )}
        </Card>

        {/* 可学习时长分布（月历热力格）：点格子切日期，与顶部日期翻页同一状态 */}
        <Card style={styles.panel}>
          <SectionHeader
            title="可学习时长分布"
            subtitle={`${statDate.getFullYear()} 年 ${statDate.getMonth() + 1} 月 · 颜色越深专注越多`}
            accentColor={colors.accent}
          />
          <HeatmapCalendar
            year={statDate.getFullYear()}
            month={statDate.getMonth()}
            values={dayMinutes}
            title={null}
            onPressDay={onPickDay}
          />
        </Card>

        {/* 时段与趋势：7 根柱的历史样式，与周柱图同一套面板 */}
        <Card style={styles.panel}>
          <SectionHeader
            title="时段与趋势"
            subtitle={`${statDate.getMonth() + 1}月${statDate.getDate()}日 · 学习 ${formatDuration(selectedMinutes)}`}
            accentColor={colors.accent}
          />
          {peakPeriod ? (
            <View style={styles.peakRow} accessibilityLabel={`黄金时段是${peakPeriod.label}${peakPeriod.range}，累计专注 ${formatDuration(peakPeriod.minutes)}`}>
              <ThemedIcon name="flash-outline" size={14} color={colors.warning} />
              <Text style={styles.peakText}>
                黄金时段：{peakPeriod.label}（{peakPeriod.range}）· 累计专注 {formatDuration(peakPeriod.minutes)}
              </Text>
            </View>
          ) : null}
          <StepsBar
            title="时段分布"
            rangeLabel={formatDuration(selectedMinutes)}
            items={periodBars.map((bar) => ({
              label: bar.label,
              value: periodPeak > 0 ? bar.value / periodPeak : 0,
              highlight: peakPeriod?.label === bar.label,
              valueLabel: peakPeriod?.label === bar.label ? compactMinutes(bar.value) : undefined,
            }))}
          />
          <StepsBar
            title="近 7 天学习分钟"
            rangeLabel={formatDuration(last7Total)}
            items={last7.map((day, index) => ({
              label: weekdayName(addDays(statDate, index - (last7.length - 1))).slice(1),
              value: last7Peak > 0 ? day.value / last7Peak : 0,
              highlight: index === last7.length - 1,
              valueLabel: index === last7.length - 1 ? compactMinutes(day.value) : undefined,
            }))}
          />
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
    tileGrid: { gap: 8 },

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
    dateText: { ...typography.caption, fontWeight: "700", color: colors.text, flexShrink: 1 },

    hero: { flexDirection: "row", alignItems: "center", gap: 18 },
    ringWrap: { width: 108, height: 108, alignItems: "center", justifyContent: "center" },
    ringPct: { position: "absolute", ...typography.title2, fontWeight: "800", color: colors.text, ...tabularNums },
    heroRight: { flex: 1, gap: 4, minWidth: 0 },
    heroLabel: { ...typography.caption, color: colors.textMuted },
    heroValue: { ...typography.title1, fontWeight: "800", color: colors.text, ...tabularNums },
    heroSubRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    heroSub: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    deltaChip: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 2,
    },
    deltaUp: { backgroundColor: colors.successSoft },
    deltaDown: { backgroundColor: colors.dangerSoft },
    deltaText: { ...typography.micro, fontWeight: "800", ...tabularNums },

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

    contentEmpty: { ...typography.caption, color: colors.textMuted },

    peakRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.md,
      backgroundColor: colors.warningSoft,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    peakText: { flex: 1, ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
  });
