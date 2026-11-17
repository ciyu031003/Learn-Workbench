import { useMemo } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { ThemedIcon } from "@/components/themed-icon";
import { Surface } from "@/components/surface";
import { SectionTitle } from "@/components/v2/section-title";
import { AreaChart } from "@/components/v2/charts";
import { useTheme } from "@/theme";
import { tabularNums } from "@/theme/tokens";
import { formatDuration } from "@learn-workbench/shared/dates";

import { compactDuration } from "./learn-widgets";
import { makeStyles } from "./learn-styles";

/**
 * ④ 数据洞察卡（提案 .chart-card）：近 7 天总时长 + 较前 7 天对比 + 面积图 + 三格 KPI。
 * 口径全部来自 focus-stats（与今日页同一份 last14），本组件不做任何再计算。
 */
export function LearnInsight({
  weekTotal,
  todayMinutes,
  insightDeltaText,
  focusDelta,
  focusDeltaPercent,
  last7Minutes,
  last7Labels,
  avgDailyMinutes,
  routeSummary,
  streak,
}: {
  weekTotal: number;
  todayMinutes: number;
  insightDeltaText: string;
  focusDelta: number;
  focusDeltaPercent: number | null;
  last7Minutes: number[];
  last7Labels: string[];
  avgDailyMinutes: number;
  routeSummary: { done: number; total: number; percent: number };
  streak: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <>
        <SectionTitle
          title="数据洞察"
          actionLabel="学习统计"
          onAction={() => router.push("/study-stats" as never)}
          style={styles.sectionTitle}
        />
        <Surface tier="surface" style={styles.insightCard}>
          <View
            style={styles.insightTop}
            accessible
            accessibilityLabel={
              "近 7 天专注总时长 " + formatDuration(weekTotal) + "，今日 " + formatDuration(todayMinutes) + "，" + insightDeltaText
            }
          >
            <View style={styles.insightTopText}>
              <Text style={styles.insightLab}>专注总时长</Text>
              <Text style={[styles.insightBig, tabularNums]}>{weekTotal > 0 ? compactDuration(weekTotal) : "—"}</Text>
              <Text style={styles.insightDelta}>{insightDeltaText}</Text>
            </View>
            {focusDeltaPercent !== null && focusDelta !== 0 ? (
              <View
                style={[
                  styles.deltaPill,
                  { backgroundColor: focusDelta > 0 ? colors.successSoft : colors.dangerSoft },
                ]}
              >
                <ThemedIcon
                  name={focusDelta > 0 ? "chevron-up" : "chevron-down"}
                  size={12}
                  color={focusDelta > 0 ? colors.success : colors.danger}
                />
                <Text
                  style={[
                    styles.deltaPillText,
                    { color: focusDelta > 0 ? colors.success : colors.danger },
                  ]}
                >
                  {Math.abs(focusDeltaPercent) + "%"}
                </Text>
              </View>
            ) : null}
          </View>

          {weekTotal > 0 ? (
            <AreaChart
              series={[{ values: last7Minutes }]}
              labels={last7Labels}
              height={92}
              showEndDot={false}
              legend={false}
              style={styles.insightChart}
            />
          ) : (
            <View style={styles.insightEmpty}>
              <ThemedIcon name="stats-chart-outline" size={18} color={colors.textMuted} />
              <Text style={styles.insightEmptyText}>完成一次专注后这里会出现趋势</Text>
            </View>
          )}

          <View
            style={styles.kpis}
            accessible
            accessibilityLabel={
              "日均专注 " + compactDuration(avgDailyMinutes) + "，计划完成率 " +
              (routeSummary.total > 0 ? routeSummary.percent + "%" : "暂无数据") +
              "，连续学习 " + streak + " 天"
            }
          >
            <View style={[styles.kpi, styles.kpiFirst]}>
              <Text style={[styles.kpiValue, tabularNums]}>{weekTotal > 0 ? compactDuration(avgDailyMinutes) : "—"}</Text>
              <Text style={styles.kpiLabel}>日均专注</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={[styles.kpiValue, tabularNums]}>
                {routeSummary.total > 0 && routeSummary.percent > 0 ? routeSummary.percent + "%" : routeSummary.total > 0 ? "尚未开始" : "—"}
              </Text>
              <Text style={styles.kpiLabel}>计划完成率</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={[styles.kpiValue, tabularNums]}>{streak > 0 ? streak + " 天" : "—"}</Text>
              <Text style={styles.kpiLabel}>连续学习</Text>
            </View>
          </View>

          <View style={styles.insightFoot}>
            <Text style={styles.insightFootText}>近 7 天 · 单位分钟</Text>
            <Text style={styles.insightFootText}>{"今日 " + formatDuration(todayMinutes)}</Text>
          </View>
        </Surface>
    </>
  );
}
