import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import {
  TRAINING_LOAD_METRIC_META,
  fromDateKey,
  trainingLoadSeries,
  type Workout,
} from "@learn-workbench/shared";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { shadows, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 训练负荷卡（v1.45 全屏趋势页第三段）。
 *
 * 数据来自服务端 `GET /api/workouts?days=30`（`Workout[]`，与训练记录页同源）；
 * 口径完全交给 `trainingLoadSeries`：容量(kg) → 次数 → 组数 → 训练次数自动退档，
 * 所以自重训练（weightKg = null）也不会出现"全是 0 的空图"。
 *
 * 与训练记录页那版（近 7 天、纯 View 柱）的差异：这里是趋势页的 30 天窗口，
 * 柱子更密，因此横轴改为"首/中/末"三个日期刻度，而不是逐柱星期。
 */
export function TrainingLoadCard({
  workouts,
  days = 30,
  endKey,
  style,
}: {
  workouts: Workout[];
  days?: number;
  /** 窗口右端（YYYY-MM-DD，通常是今天） */
  endKey: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const series = useMemo(
    () => trainingLoadSeries(workouts, days, fromDateKey(endKey)),
    [workouts, days, endKey]
  );
  const meta = TRAINING_LOAD_METRIC_META[series.metric];
  const hasData = series.total.sessions > 0;
  const bars = series.days;
  const first = bars[0]?.key.slice(5).replace("-", "/") ?? "";
  const mid = bars[Math.floor(bars.length / 2)]?.key.slice(5).replace("-", "/") ?? "";
  const last = bars[bars.length - 1]?.key.slice(5).replace("-", "/") ?? "";

  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Text style={styles.title}>近 {days} 天训练负荷</Text>
          <Text style={styles.hint}>
            {hasData ? `柱高按每日${meta.title}计算（${meta.unit}）` : "记录一次训练后开始生成趋势"}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeValue}>{series.max}</Text>
          <Text style={styles.badgeUnit}>{meta.unit}</Text>
        </View>
      </View>

      {hasData ? (
        <>
          <View style={styles.barRow}>
            {bars.map((day) => (
              <View key={day.key} style={styles.barCell}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        // day.height 已含"当天有训练但无可量化负荷"的最小柱高
                        height: `${day.height}%`,
                        backgroundColor: day.sessions > 0 ? colors.primary : colors.surfaceMuted,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
          <View style={styles.axis}>
            <Text style={styles.axisText}>{first}</Text>
            <Text style={styles.axisText}>{mid}</Text>
            <Text style={styles.axisText}>{last}</Text>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{series.total.sessions}</Text>
              <Text style={styles.statLabel}>训练次数</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{series.total.sets}</Text>
              <Text style={styles.statLabel}>总组数</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{series.total.reps}</Text>
              <Text style={styles.statLabel}>总次数</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{series.total.volumeKg}</Text>
              <Text style={styles.statLabel}>容量 kg</Text>
            </View>
          </View>
          <Text style={styles.footHint}>
            当前口径：{meta.title}（{meta.unit}）
            {series.metric !== "volume" && series.total.volumeKg === 0 ? " · 自重训练不计容量" : ""}
          </Text>
        </>
      ) : (
        <View style={styles.empty}>
          <ThemedIcon name="barbell-outline" size={22} color={colors.textFaint} />
          <Text style={styles.emptyText}>近 {days} 天还没有训练记录，去「训练记录」记一次</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      gap: 12,
      padding: 15,
      borderRadius: 20,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    headLeft: { flex: 1, minWidth: 0, gap: 3 },
    title: { fontSize: typography.headline.fontSize, fontWeight: "800", color: colors.text },
    hint: { fontSize: typography.caption.fontSize, color: colors.textMuted },
    badge: {
      minWidth: 52,
      height: 46,
      paddingHorizontal: 10,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    badgeValue: { fontSize: typography.headline.fontSize, fontWeight: "900", color: colors.primary, ...tabularNums },
    badgeUnit: { ...typography.micro, fontWeight: "700", color: colors.primaryStrong },
    barRow: { height: 78, flexDirection: "row", alignItems: "flex-end", gap: 2 },
    barCell: { flex: 1, alignItems: "center" },
    barTrack: {
      width: "100%",
      height: 74,
      justifyContent: "flex-end",
      overflow: "hidden",
      borderRadius: 5,
      backgroundColor: colors.surfaceMuted,
    },
    barFill: { width: "100%", minHeight: 3, borderRadius: 5 },
    axis: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: -6 },
    axisText: { ...typography.micro, fontSize: 9, color: colors.textFaint, fontWeight: "600", ...tabularNums },
    stats: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    stat: { flex: 1, alignItems: "center", gap: 2 },
    statValue: { fontSize: typography.headline.fontSize, fontWeight: "900", color: colors.text, ...tabularNums },
    statLabel: { ...typography.micro, fontWeight: "600", color: colors.textMuted },
    divider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.border },
    empty: { alignItems: "center", gap: 6, paddingVertical: 22 },
    emptyText: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
    footHint: { ...typography.micro, fontSize: 9, color: colors.textFaint, fontWeight: "500" },
  });
