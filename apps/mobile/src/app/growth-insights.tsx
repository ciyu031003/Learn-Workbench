import { useMemo, useState } from "react";
import Animated from "react-native-reanimated";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { SectionTitle } from "@/components/v2/section-title";
import { PressableScale } from "@/components/pressable-scale";
import { GrowthHabits } from "@/components/growth/growth-habits";
import { GrowthSportsCardEntry, GrowthTrackersEntry } from "@/components/growth/growth-entries";
import { GrowthInsightsSkeleton } from "@/components/growth/growth-skeleton";
import { GrowthReveal } from "@/components/growth/growth-reveal";
import { GrowthTodayRecords } from "@/components/growth/growth-records";
import { HealthPrintShare } from "@/components/growth/health-print-share";
import { GrowthTrends } from "@/components/growth/growth-trends";
import { GrowthWeight } from "@/components/growth/growth-weight";
import { useGrowthData } from "@/components/growth/use-growth-data";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 数据看板（/growth-insights）· 成长页的二级明细页。
 *
 * 成长页重构后只留概览层，原来首屏上的五个模块整块搬到这里（数据来源与交互完全不变）：
 *   ① 今日习惯（→ 习惯页）
 *   ② 领域追踪（→ 领域健康页）
 *   ③ 体重趋势（体重卡 + → 饮食与体重页）
 *   ④ 趋势分析（本周概览四格 + 本周饮食热量柱图 + → 趋势报告页）
 *   ⑤ 运动闪光卡（→ 闪光卡页）
 *   ⑥ 今日记录（饮食 / 训练 / 饮水明细 + 快捷记录，成长页不再承载明细）
 *
 * 版式：Stack 子页，与 app/phase/[id] 等二级页同源 —— ScreenHeaderStickyBar 自己吃
 * 安全区并给返回（无栈历史时兜底回 /wellness），大标题在滚动内容里，正文是 ScrollView。
 *
 * 加载态：与成长页同一套骨架屏闸门（首轮真实请求结束才落定），骨架 → 内容走
 * GrowthReveal 的淡入 + 6px 上移；减弱动态时直接切换。
 */
export default function GrowthInsightsScreen() {
  const growth = useGrowthData();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  /** 子页盖住底栏，只留安全区（useTabBarSpace 按路由自适应） */
  const tabBarSpace = useTabBarSpace();
  const [printOpen, setPrintOpen] = useState(false);

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="数据看板" backTo="/wellness" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...growth.control} />}
      >
        <ScreenHeaderLargeTitle title="数据看板" subtitle="习惯、领域、体重与趋势，成长页的完整明细" />

        {/* 聚合接口失败：明确提示 + 一键重试（与成长页同一交互） */}
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

        {growth.showSkeleton ? (
          <GrowthInsightsSkeleton />
        ) : (
          <>
            <SectionTitle title="今日习惯" right={<Text style={styles.sectionMeta}>勾选在习惯页</Text>} />
            <GrowthReveal index={0}>
              <GrowthHabits growth={growth} />
            </GrowthReveal>

            <SectionTitle title="领域追踪" right={<Text style={styles.sectionMeta}>领域健康</Text>} />
            <GrowthReveal index={1}>
              <GrowthTrackersEntry />
            </GrowthReveal>

            <SectionTitle title="体重趋势" right={<Text style={styles.sectionMeta}>近 30 天</Text>} />
            <GrowthReveal index={2}>
              <GrowthWeight growth={growth} />
            </GrowthReveal>

            <SectionTitle title="趋势分析" right={<Text style={styles.sectionMeta}>本周概览</Text>} />
            <GrowthReveal index={3}>
              <GrowthTrends growth={growth} />
            </GrowthReveal>

            <SectionTitle title="运动闪光卡" right={<Text style={styles.sectionMeta}>闪光时刻</Text>} />
            <GrowthReveal index={4}>
              <GrowthSportsCardEntry />
            </GrowthReveal>

            <SectionTitle title="分享卡片" right={<Text style={styles.sectionMeta}>睡眠 / 饮食 / 训练 / 饮水</Text>} />
            <GrowthReveal index={5}>
              <PressableScale
                onPress={() => {
                  haptics.soft();
                  setPrintOpen(true);
                }}
                scaleTo={0.98}
                style={styles.shareCard}
                accessibilityRole="button"
                accessibilityLabel="打开健康打印分享卡"
              >
                <View style={styles.shareIcon}>
                  <ThemedIcon name="sparkles-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.shareTextBox}>
                  <Text style={styles.shareTitle}>健康打印卡</Text>
                  <Text style={styles.shareSub}>四项数据打印成一张纸 · 底部带专属条形码</Text>
                </View>
                <ThemedIcon name="chevron-forward" size={14} color={colors.textMuted} />
              </PressableScale>
            </GrowthReveal>

            <SectionTitle title="今日记录" right={<Text style={styles.sectionMeta}>最近记录</Text>} />
            <GrowthReveal index={6}>
              <GrowthTodayRecords growth={growth} />
            </GrowthReveal>

            {/* 明细看完还有下一步：回到成长页（栈已存在，返回即可） */}
            <PressableScale
              haptic
              scaleTo={0.98}
              hitSlop={10}
              onPress={() => {
                // 栈里有上一页就真 pop（保留原生返回动画）；深链直达时兜底回成长页
                if (typeof router.canGoBack === "function" && router.canGoBack()) router.back();
                else router.replace("/wellness" as never);
              }}
              style={styles.backLink}
              accessibilityRole="button"
              accessibilityLabel="返回成长页"
            >
              <ThemedIcon name="chevron-back" size={13} color={colors.primary} />
              <Text style={styles.backLinkText}>回到成长页</Text>
            </PressableScale>
          </>
        )}
      </Animated.ScrollView>

      <HealthPrintShare
        visible={printOpen}
        onClose={() => setPrintOpen(false)}
        data={{
          rangeLabel: "今日",
          dateText: todayLabel(),
          sleepHours: growth.sleepHours,
          kcal: growth.data?.fitness.nutritionKcal ?? 0,
          workoutMinutes: growth.data?.fitness.workoutMinutes ?? 0,
          waterMl: growth.waterMl,
          seed: "health-" + new Date().toISOString().slice(0, 10) + "-" + growth.waterMl + "-" + (growth.data?.fitness.nutritionKcal ?? 0),
        }}
      />
    </View>
  );
}

/** 中文日期（不依赖 Intl：Android Hermes 上 toLocaleDateString 会回落到英文） */
function todayLabel() {
  const d = new Date();
  const week = "日一二三四五六"[d.getDay()];
  return d.getMonth() + 1 + " 月 " + d.getDate() + " 日 · 周" + week;
}
const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg },
    sectionMeta: { ...typography.meta, color: colors.textMeta },
    shareCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.card,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
    },
    shareIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    shareTextBox: { flex: 1, minWidth: 0, gap: 2 },
    shareTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    shareSub: { ...typography.meta, color: colors.textMuted },
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
      marginBottom: spacing.sm,
    },
    errorText: { flex: 1, ...typography.caption, fontWeight: "600", color: colors.danger },
    backLink: {
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      marginTop: spacing.lg,
    },
    backLinkText: { ...typography.meta, fontWeight: "600", color: colors.primary },
  });
