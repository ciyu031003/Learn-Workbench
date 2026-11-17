import { useMemo } from "react";
import { Text, View } from "react-native";

import { Card } from "@/components/card";
import type { MarketIntelligencePayload, MarketRankItem } from "@/lib/market";
import { useTheme } from "@/theme";

import { makeStyles } from "./market-styles";
import { BarRow, Chip, maxOf } from "./market-widgets";

/** 需求分布卡：城市 TOP5（动画条）+ 职能需求（chip）+ 薪资区间（动画条）。 */
export function MarketDistributionCard({ dist }: { dist: MarketIntelligencePayload["distributions"] | undefined }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Card title="需求分布" subtitle="城市、职能、行业、资历和薪资">
      <Text style={styles.groupTitle}>城市机会 TOP</Text>
      {(dist?.byCity ?? []).slice(0, 5).map((item: MarketRankItem) => (
        <BarRow
          key={item.key}
          styles={styles}
          label={item.label}
          value={item.count}
          max={maxOf((dist?.byCity ?? []).map((x) => x.count))}
          color={colors.primary}
        />
      ))}
      <Text style={styles.groupTitle}>职能需求</Text>
      <View style={styles.chipGrid}>
        {(dist?.byFunction ?? []).slice(0, 8).map((item) => (
          <Chip key={item.key} styles={styles} label={`${item.label} ${item.count}`} />
        ))}
      </View>
      <Text style={styles.groupTitle}>薪资区间</Text>
      {(dist?.bySalary ?? []).slice(0, 4).map((item) => (
        <BarRow
          key={item.label}
          styles={styles}
          label={item.label}
          value={item.count}
          max={maxOf((dist?.bySalary ?? []).map((x) => x.count))}
          color={colors.accent}
        />
      ))}
    </Card>
  );
}
