import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AreaChart } from "@/components/v2/charts";
import { EntryCard } from "@/components/entry-card";
import { ListGroup } from "@/components/list-row";
import { Surface } from "@/components/surface";
import { useTheme } from "@/theme";
import { radius, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { NO_RECORD, monthDayLabel } from "./growth-format";
import type { GrowthScreenData } from "./use-growth-data";

/**
 * 模块 ③：体重趋势（体重 / 身体数据趋势）。
 *
 * 从成长页整块搬过来：今晨（或最近一次）体重 + 本周变化 + 近七日 sparkline，
 * 外加一条「体重趋势」入口（→ 饮食与体重页，与重构前同一个跳转）。
 * 数据来源不变：/api/wellbeing/weight?days=30。
 */
export function GrowthWeight({ growth }: { growth: GrowthScreenData }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const value = growth.weightValue;
  const delta = growth.weekWeightDelta;

  return (
    <View style={styles.wrap}>
      <Surface tier="surface" corner={radius.card} padded={false} style={styles.card}>
        <View style={styles.body}>
          <Text style={styles.kicker}>{growth.weightKicker}</Text>
          <Text style={[styles.value, tabularNums]} numberOfLines={1}>
            {value ? value.weightKg.toFixed(1) : NO_RECORD}
            <Text style={styles.unit}> kg</Text>
          </Text>
          <Text
            style={[
              styles.delta,
              delta === null
                ? styles.deltaMuted
                : delta < 0
                  ? styles.deltaDown
                  : delta > 0
                    ? styles.deltaUp
                    : styles.deltaMuted,
            ]}
            numberOfLines={1}
          >
            {delta === null
              ? "本周变化 " + NO_RECORD
              : delta === 0
                ? "本周持平"
                : "本周 " + (delta > 0 ? "+" : "−") + Math.abs(delta) + " kg"}
          </Text>
          <Text style={styles.hint} numberOfLines={1}>
            {value ? "记录于 " + monthDayLabel(value.date) : "记录第一次体重，之后能看趋势"}
          </Text>
        </View>
        <View
          style={styles.spark}
          accessible
          accessibilityLabel={
            "近七日体重 " + (growth.weightSpark.length > 0 ? growth.weightSpark.join("、") : NO_RECORD)
          }
        >
          {growth.weightSpark.length >= 2 ? (
            <AreaChart
              series={[{ values: growth.weightSpark }]}
              height={56}
              min={growth.weightSparkMin}
              max={growth.weightSparkMax}
              showEndDot
              legend={false}
            />
          ) : (
            <Text style={styles.sparkEmpty}>{NO_RECORD}</Text>
          )}
        </View>
      </Surface>

      <ListGroup>
        <EntryCard
          size="row"
          icon="body-outline"
          tone="success"
          title="体重趋势"
          meta={growth.weightMeta}
          last
          onPress={() => router.push("/nutrition" as never)}
          accessibilityLabel="体重趋势，打开饮食与体重页"
        />
      </ListGroup>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    card: { flexDirection: "row", alignItems: "center", gap: spacing.lg, padding: spacing.lg },
    body: { flex: 1, minWidth: 0, gap: 3 },
    kicker: { ...typography.meta, color: colors.textMuted },
    value: { ...typography.title2, color: colors.text },
    unit: { ...typography.caption, fontWeight: "500", color: colors.textMuted },
    delta: { ...typography.micro, fontWeight: "600" },
    deltaDown: { color: colors.success },
    deltaUp: { color: colors.accentStrong },
    deltaMuted: { color: colors.textMuted },
    hint: { ...typography.meta, color: colors.textMeta },
    spark: { width: 118, height: 56, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    sparkEmpty: { ...typography.hero, color: colors.textFaint },
  });
