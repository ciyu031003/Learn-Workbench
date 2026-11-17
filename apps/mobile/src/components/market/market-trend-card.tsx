import { useMemo } from "react";
import { Text } from "react-native";

import { Card } from "@/components/card";
import type { MarketIntelligencePayload } from "@/lib/market";
import { useTheme } from "@/theme";

import { makeStyles } from "./market-styles";
import { TrendChart } from "./market-widgets";

/** 市场时间趋势卡：柱状图按时间间隔聚合（纯函数在 lib/market-series）+ 最近节点补充说明。 */
export function MarketTrendCard({ timeSeries }: { timeSeries: MarketIntelligencePayload["timeSeries"] | undefined }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Card title="市场时间趋势" subtitle="新增岗位数，7/30/90 天切换">
      <TrendChart styles={styles} series={timeSeries ?? []} />
      <Text style={styles.mutedText}>
        最近节点：{timeSeries?.at(-1)?.newJobs ?? 0} 个新岗位
      </Text>
    </Card>
  );
}
