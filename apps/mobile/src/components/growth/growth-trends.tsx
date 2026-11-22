import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { BarChart } from "@/components/v2/bar-chart";
import { StatTileRow } from "@/components/v2/charts";
import { EmptyState } from "@/components/empty-state";
import { EntryCard } from "@/components/entry-card";
import { ListGroup } from "@/components/list-row";
import { Surface } from "@/components/surface";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { weekTile } from "./growth-format";
import type { GrowthScreenData } from "./use-growth-data";

/**
 * 模块 ④：趋势分析（本周概览 / 趋势报告）。
 *
 * 成长页原来的「本周概览」四格 + 「本周饮食热量」7 天柱图整块搬到这里，
 * 末尾保留「趋势分析」入口（→ /trends，与重构前同一个跳转）。
 * 数据来源不变：周报来自 lib/wellness-week（饮水逐日 / 训练次数 / 本机睡眠 / 饮食逐日），
 * 柱图来自 /api/nutrition/summary?days=7 —— 缺项一律「—」，接口失败给重试而不是假空。
 */
export function GrowthTrends({ growth }: { growth: GrowthScreenData }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const report = growth.weekReport;
  const hasDietTrend = growth.recordDays > 0;

  return (
    <View style={styles.wrap}>
      {/* 本周概览：四格周指标（饮水 / 训练 / 睡眠 / 热量） */}
      <View style={styles.tileGrid}>
        <StatTileRow
          items={[
            weekTile(report.water, "water-outline", "teal"),
            weekTile(report.workout, "barbell-outline", "primary"),
          ]}
        />
        <StatTileRow
          items={[
            weekTile(report.sleep, "moon-outline", "success"),
            weekTile(report.kcal, "restaurant-outline", "accent"),
          ]}
        />
      </View>
      <Text style={styles.caption}>{report.caption}</Text>
      {report.empty ? (
        <Text style={styles.emptyHint}>本周还没有记录——先记一条饮水、训练或睡眠，周报就会亮起来。</Text>
      ) : null}

      {/* 本周饮食热量：7 天柱图（今日高亮）；空态 / 失败态各自给出下一步 */}
      <Surface tier="surface" corner={radius.card} padded={false} style={styles.trendCard}>
        {hasDietTrend ? (
          <>
            <View style={styles.trendHead}>
              <View style={styles.trendHeadText}>
                <Text style={[styles.trendValue, tabularNums]}>{growth.avgKcal}</Text>
                <Text style={styles.trendCaption}>近 7 天日均 kcal</Text>
              </View>
              <Text style={styles.trendMeta}>{growth.recordDays + "/7 天有记录"}</Text>
            </View>
            <BarChart items={growth.trendItems} height={96} />
            <Text style={styles.trendFoot}>{"柱高按每日目标 " + growth.dietTarget + " kcal 计"}</Text>
          </>
        ) : growth.summaryFailed ? (
          <EmptyState
            pattern="none"
            icon="cloud-offline-outline"
            title="本周趋势没加载出来"
            hint="网络似乎不太顺，点一下重试；其他数据照常显示。"
            actionLabel="重试"
            onAction={() => void growth.load()}
          />
        ) : (
          <EmptyState
            pattern="none"
            icon="stats-chart-outline"
            title="本周还没有饮食记录"
            hint="记一餐之后，这里会按天画出热量柱图，今天会高亮显示。"
            actionLabel="去记一餐"
            onAction={() => router.push("/nutrition" as never)}
          />
        )}
      </Surface>

      <ListGroup>
        <EntryCard
          size="row"
          icon="stats-chart-outline"
          tone="teal"
          title="趋势分析"
          meta={
            hasDietTrend
              ? "近 7 天饮食记录 " + growth.recordDays + " 天 · 均 " + growth.avgKcal + " kcal · 训练负荷一屏看"
              : "饮食热量 · 运动时长 · 训练负荷，全屏一起看"
          }
          last
          onPress={() => router.push("/trends" as never)}
          accessibilityLabel="趋势分析，打开趋势报告页"
        />
      </ListGroup>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    tileGrid: { gap: spacing.sm },
    caption: { ...typography.meta, color: colors.textMeta, textAlign: "center", marginTop: 2 },
    emptyHint: { ...typography.meta, color: colors.textMuted, lineHeight: 19 },
    trendCard: { padding: spacing.lg, gap: spacing.md, marginTop: spacing.sm },
    trendHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.sm },
    trendHeadText: { flex: 1, minWidth: 0 },
    trendValue: { ...typography.hero, color: colors.text },
    trendCaption: { ...typography.meta, color: colors.textMuted },
    trendMeta: { ...typography.meta, color: colors.textMeta },
    trendFoot: { ...typography.meta, color: colors.textMeta },
  });
