import { useMemo, useRef, type ComponentProps } from "react";
import Animated from "react-native-reanimated";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderStickyBar, useHeaderTopInset, useLargeTitleHeader } from "@/components/screen-header";
import { ActivityRings } from "@/components/v2/charts";
import { PressableScale } from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { GrowthOverviewSkeleton } from "@/components/growth/growth-skeleton";
import { GrowthReveal } from "@/components/growth/growth-reveal";
import { NO_RECORD } from "@/components/growth/growth-format";
import { useGrowthData } from "@/components/growth/use-growth-data";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { WEAKEST_LABEL } from "@/lib/readiness";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 成长（wellness）· 概览层。
 *
 * 重构后这一页**只回答一眼要看清的三件事**：
 *   ① 今日完成度（环形 + 习惯/运动/饮水/饮食 四项分解）
 *   ② 三个概览数字（连续打卡 / 本周记录 / 今日状态分）
 *   ③ 本周状态（近 7 天哪几天有记录，今天用阳光橘单独标记）
 *
 * 原来的五个模块（习惯打卡 / 领域追踪 / 体重趋势 / 趋势分析 / 运动闪光卡）与
 * 饮食·训练·今日记录明细整块搬到二级页「数据看板」（路由 /growth-insights），
 * 入口是本页右上角的「数据看板」按钮（icon + 文案），不打扰首屏。
 *
 * 取数 / 派生 / 骨架屏闸门统一在 components/growth/use-growth-data.ts（与数据看板共用同一份真实数据）；
 * 本文件只做组合与视觉。动效只用 components/growth/growth-reveal.tsx 的声明式淡入上移，
 * 不新增逐帧动效点（见 scripts/check-motion-budget.mjs）。
 */
export default function WellnessScreen() {
  const growth = useGrowthData();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  /** Tab 页页头让开状态栏/刘海（与今日/学习/我的同口径） */
  const headerTop = useHeaderTopInset("hero");
  /** TabBar 双击回顶（v19-M8） */
  const wellnessScrollRef = useRef<Animated.ScrollView>(null);
  useScrollToTopHandler("/wellness", wellnessScrollRef);

  const openInsights = () => router.push("/growth-insights" as never);

  const percentText = growth.completion.percent === null ? NO_RECORD : growth.completion.percent + "%";
  const statusHint = growth.readiness.weakest
    ? "今天最短板 · " + WEAKEST_LABEL[growth.readiness.weakest]
    : growth.readiness.verdict;
  /** 首轮就失败时不能把「没加载出来」说成「没有记录」 */
  const weekCaption =
    growth.data === null && growth.dailyFailed
      ? "数据没加载出来 · 点上方重试"
      : growth.recordedDays > 0
        ? "近 7 天有记录 " + growth.recordedDays + " 天 · " + statusHint
        : "近 7 天还没有记录 · " + statusHint;
  const scoreText = growth.data === null ? NO_RECORD : String(growth.readiness.score);

  const metricColors: Record<"habits" | "exercise" | "water" | "diet", string> = {
    habits: colors.lavender,
    exercise: colors.primary,
    water: colors.teal,
    diet: colors.success,
  };

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="成长" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        ref={wellnessScrollRef}
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...growth.control} />}
      >
        {/* 页头：eyebrow + 标题 + 右上角「数据看板」入口（明显但不是首屏主角） */}
        <View style={styles.head}>
          <Text style={styles.eyebrow}>成长 · 每日状态</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title} accessibilityRole="header">
              成长
            </Text>
            <PressableScale
              haptic
              scaleTo={0.96}
              hitSlop={8}
              onPress={openInsights}
              style={styles.insightsBtn}
              accessibilityRole="button"
              accessibilityLabel="打开数据看板"
            >
              <ThemedIcon name="stats-chart-outline" size={15} color={colors.primary} />
              <Text style={styles.insightsBtnText}>数据看板</Text>
              <ThemedIcon name="chevron-forward" size={12} color={colors.primary} />
            </PressableScale>
          </View>
          <Text style={styles.subtitle}>{growth.headerSubtitle}</Text>
        </View>

        {/* 聚合接口失败不再静默：明确提示 + 一键重试（与其他页同一交互） */}
        {growth.dailyFailed ? (
          <PressableScale
            haptic
            scaleTo={0.98}
            hitSlop={4}
            style={styles.errorBar}
            accessibilityRole="button"
            accessibilityLabel="重试加载成长数据"
            onPress={() => void growth.load()}
          >
            <ThemedIcon name="cloud-offline-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>
              {growth.data ? "刚才的数据没刷新成功，点这里重试" : "成长数据没加载出来，点这里重试"}
            </Text>
            <ThemedIcon name="refresh" size={16} color={colors.danger} />
          </PressableScale>
        ) : null}

        {/* 骨架屏 → 内容：淡入 + 6px 上移（时长走 DURATION）；判据是首轮请求真的结束 */}
        {growth.showSkeleton ? (
          <GrowthOverviewSkeleton />
        ) : (
          <GrowthReveal index={0}>
            <Surface tier="surface" corner={radius.panel} padded={false} style={styles.card}>
              {/* ① 今日完成度：环 + 四项完成度分解（点开数据看板看明细） */}
              <PressableScale
                haptic
                scaleTo={0.99}
                hitSlop={4}
                onPress={openInsights}
                style={styles.ringRow}
                accessibilityRole="button"
                accessibilityLabel={"今日完成度 " + percentText + "，打开数据看板"}
              >
                <View style={styles.ringWrap}>
                  <ActivityRings
                    rings={[
                      {
                        key: "today",
                        label: "今日完成度",
                        value: growth.completion.ratio ?? 0,
                        valueLabel: percentText,
                        color: colors.primary,
                      },
                    ]}
                    size={132}
                    thickness={12}
                    gap={4}
                    legend={false}
                    title={null}
                  />
                  <View pointerEvents="none" style={styles.ringCenter}>
                    <Text
                      style={[styles.ringValue, tabularNums]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {percentText}
                    </Text>
                    <Text style={styles.ringLabel}>今日完成度</Text>
                  </View>
                </View>
                <View style={styles.metrics}>
                  {growth.completion.metrics.map((metric) => (
                    <View key={metric.key} style={styles.metricRow}>
                      <View style={[styles.metricDot, { backgroundColor: metricColors[metric.key] }]} />
                      <Text style={styles.metricLabel} numberOfLines={1}>
                        {metric.label}
                      </Text>
                      <Text style={[styles.metricValue, tabularNums]} numberOfLines={1}>
                        {metric.ratio === null ? NO_RECORD : Math.round(metric.ratio * 100) + "%"}
                      </Text>
                    </View>
                  ))}
                </View>
              </PressableScale>

              <View style={styles.divider} />

              {/* ② 三个概览数字（点开数据看板看完整周报） */}
              <PressableScale
                haptic
                scaleTo={0.99}
                hitSlop={4}
                onPress={openInsights}
                style={styles.stats}
                accessibilityRole="button"
                accessibilityLabel={
                  "连续打卡 " +
                  growth.streakDays +
                  " 天，本周记录 " +
                  growth.recordedDays +
                  " 天，今日状态 " +
                  scoreText +
                  " 分，打开数据看板"
                }
              >
                <StatCell label="连续打卡" value={String(growth.streakDays)} unit="天" />
                <View style={styles.statDivider} />
                <StatCell label="本周记录" value={String(growth.recordedDays)} unit="/ 7 天" />
                <View style={styles.statDivider} />
                <StatCell label="今日状态" value={scoreText} unit="分" />
              </PressableScale>

              <View style={styles.divider} />

              {/* ③ 本周状态：7 天有没有记录；今天用阳光橘（全 App 只给「今天」的角色） */}
              <PressableScale
                haptic
                scaleTo={0.99}
                hitSlop={6}
                onPress={openInsights}
                style={styles.weekWrap}
                accessibilityRole="button"
                accessibilityLabel={"本周记录 " + growth.recordedDays + " 天，打开数据看板"}
              >
                <View style={styles.weekHead}>
                  <Text style={styles.weekTitle}>本周状态</Text>
                  <Text style={styles.weekMeta}>{growth.recordedDays + " / 7 天"}</Text>
                </View>
                <View style={styles.weekCols}>
                  {growth.weekDays.map((day) => (
                    <View key={day.key} style={styles.weekCol}>
                      <View
                        style={[
                          styles.weekBar,
                          day.recorded ? styles.weekBarOn : styles.weekBarOff,
                          day.isToday ? styles.weekBarToday : null,
                        ]}
                      />
                      <Text style={[styles.weekLabel, day.isToday ? styles.weekLabelToday : null]}>
                        {day.label}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.weekCaption}>{weekCaption}</Text>
              </PressableScale>
            </Surface>

            {/* 冷启动（全无记录）：一组轻量起点动作，不堆卡片 */}
            {growth.empty ? (
              <View style={styles.startBlock}>
                <PressableScale
                  haptic
                  scaleTo={0.98}
                  hitSlop={8}
                  onPress={() => void growth.quickWater(250)}
                  style={styles.startPrimary}
                  accessibilityRole="button"
                  accessibilityLabel="先记一杯水 250 毫升"
                >
                  <ThemedIcon name="water-outline" size={17} color={colors.canvas} />
                  <Text style={styles.startPrimaryText}>先记一杯水 · 250 ml</Text>
                </PressableScale>
                <View style={styles.startRow}>
                  <StartAction
                    icon="restaurant-outline"
                    label="记一餐"
                    onPress={() => router.push("/nutrition" as never)}
                  />
                  <StartAction
                    icon="scale-outline"
                    label="记体重"
                    onPress={() => router.push("/trends" as never)}
                  />
                  <StartAction
                    icon="moon-outline"
                    label="记录睡眠"
                    onPress={() => router.push("/sleep" as never)}
                  />
                </View>
              </View>
            ) : null}

            {/* 底部quiet入口：首屏只看概览，明细都在数据看板 */}
            <PressableScale
              haptic
              scaleTo={0.98}
              hitSlop={10}
              onPress={openInsights}
              style={styles.footerLink}
              accessibilityRole="button"
              accessibilityLabel="查看数据看板：习惯、领域、体重与趋势"
            >
              <Text style={styles.footerLinkText}>数据看板 · 习惯 / 领域 / 体重 / 趋势</Text>
              <ThemedIcon name="chevron-forward" size={12} color={colors.primary} />
            </PressableScale>
          </GrowthReveal>
        )}
      </Animated.ScrollView>
    </View>
  );
}

/** 概览数字格：数值 + 单位 + 标签 */
function StatCell({ label, value, unit }: { label: string; value: string; unit: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, tabularNums]} numberOfLines={1}>
        {value}
        <Text style={styles.statUnit}> {unit}</Text>
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** 冷启动起点动作（记一餐 / 记体重 / 记录睡眠） */
function StartAction({
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
      hitSlop={6}
      onPress={onPress}
      style={styles.startAction}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <ThemedIcon name={icon} size={18} color={colors.textSecondary} />
      <Text style={styles.startActionLabel}>{label}</Text>
    </PressableScale>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /** 根容器必须不透明 —— Tab 场景叠放叠滑时不透出下层 */
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },

    /* 页头 */
    head: { gap: 6, paddingHorizontal: 2 },
    eyebrow: { ...typography.eyebrow, color: colors.textFaint },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    title: { ...typography.pageTitle, color: colors.text, flexShrink: 1 },
    subtitle: { ...typography.meta, color: colors.textMuted, lineHeight: 18 },
    insightsBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      minHeight: 36,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },
    insightsBtnText: { ...typography.caption, fontWeight: "700", color: colors.primary },

    /* 错误条 */
    errorBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    errorText: { flex: 1, ...typography.caption, fontWeight: "600", color: colors.danger },

    /* 概览卡 */
    card: { overflow: "hidden" },
    ringRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, padding: spacing.lg },
    ringWrap: { width: 132, height: 132, alignItems: "center", justifyContent: "center" },
    ringCenter: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
    },
    ringValue: { ...typography.title2, color: colors.text },
    ringLabel: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    metrics: { flex: 1, minWidth: 0, gap: 10 },
    metricRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    metricDot: { width: 7, height: 7, borderRadius: 4 },
    metricLabel: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
    metricValue: { ...typography.caption, fontWeight: "700", color: colors.text, marginLeft: "auto" },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: spacing.lg },

    /* 三个概览数字 */
    stats: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md },
    statCell: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: spacing.xs },
    statValue: { ...typography.num, color: colors.text },
    statUnit: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    statLabel: { ...typography.meta, color: colors.textMuted },
    statDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: colors.border },

    /* 本周状态 */
    weekWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
    weekHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    weekTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    weekMeta: { ...typography.meta, color: colors.textMeta },
    weekCols: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
    weekCol: { flex: 1, alignItems: "center", gap: 6 },
    weekBar: { width: "100%", maxWidth: 26, height: 34, borderRadius: radius.sm },
    weekBarOn: { backgroundColor: colors.primary },
    weekBarOff: { backgroundColor: colors.chartTrack },
    weekBarToday: { backgroundColor: colors.accent },
    weekLabel: { ...typography.caption, fontWeight: "400", color: colors.textFaint },
    weekLabelToday: { color: colors.accent, fontWeight: "700" },
    weekCaption: { ...typography.meta, color: colors.textMeta, marginTop: spacing.sm },

    /* 冷启动起点动作 */
    startBlock: { gap: spacing.sm, marginTop: spacing.xs },
    startPrimary: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderRadius: radius.control,
      backgroundColor: colors.primary,
    },
    startPrimaryText: { ...typography.callout, fontWeight: "700", color: colors.canvas },
    startRow: { flexDirection: "row", gap: spacing.sm },
    startAction: {
      flex: 1,
      minHeight: 62,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 6,
      borderRadius: radius.control,
      backgroundColor: colors.surfaceMuted,
    },
    startActionLabel: { ...typography.caption, fontWeight: "600", color: colors.text, textAlign: "center" },

    /* 底部安静入口 */
    footerLink: {
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginTop: spacing.xs,
    },
    footerLinkText: { ...typography.meta, fontWeight: "600", color: colors.primary },
  });
