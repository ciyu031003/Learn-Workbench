import { useMemo } from "react";
import { View } from "react-native";

import type { MarketIntelligencePayload } from "@/lib/market";
import { useTheme } from "@/theme";

import { makeStyles } from "./market-styles";
import { KpiCard } from "./market-widgets";

/** 四张 KPI 卡（职位样本 / 7天新增 / 薪资中位 / 覆盖城市）：入场错峰留在页面层。 */
export function MarketKpiGrid({ summary }: { summary: MarketIntelligencePayload["summary"] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.kpiGrid}>
      <KpiCard styles={styles} colors={colors} icon="briefcase-outline" label="职位样本" value={summary.total} color={colors.primary} />
      <KpiCard styles={styles} colors={colors} icon="layers-outline" label="7天新增" value={summary.last7DaysJobs} color={colors.teal} />
      <KpiCard styles={styles} colors={colors} icon="cash-outline" label="薪资中位" value={summary.medianSalary != null ? `${summary.medianSalary}K` : "—"} color={colors.accent} />
      <KpiCard styles={styles} colors={colors} icon="location-outline" label="覆盖城市" value={summary.cityCount} color={colors.lavender} />
    </View>
  );
}
