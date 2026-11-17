import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { AreaChart } from "@/components/v2/charts";
import { useTheme } from "@/theme";
import { makeStyles } from "./today-styles";

/** ⑧ 洞察：本周专注对比 + 近 7 天曲线。 */
export function TodayInsightSection({
  insightLead,
  focusDeltaPercent,
  weekFocusMinutes,
  last7Minutes,
  last7Labels,
  onStartFocus,
}: {
  insightLead: string;
  focusDeltaPercent: number | null;
  weekFocusMinutes: number;
  last7Minutes: number[];
  last7Labels: string[];
  onStartFocus: () => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <>
    {/* ⑧ 洞察：本周专注对比 + 近 7 天曲线 */}
    <View style={styles.v3Insight}>
      <View style={styles.v3InsightTop}>
        <Text style={styles.v3InsightLead}>{insightLead}</Text>
        {focusDeltaPercent === null ? null : (
          <Text style={styles.v3InsightDelta}>
            {(focusDeltaPercent >= 0 ? "+" : "") + focusDeltaPercent + "%"}
          </Text>
        )}
      </View>
      {weekFocusMinutes > 0 ? (
        <>
          <AreaChart
            series={[{ values: last7Minutes }]}
            labels={last7Labels}
            height={62}
            showEndDot={false}
            legend={false}
            style={styles.v3Spark}
          />
          <View style={styles.v3InsightFoot}>
            <Text style={styles.v3InsightFootText}>近 7 天 · 单位分钟</Text>
            <Pressable
              hitSlop={10}
              onPress={() => router.push("/study-stats" as never)}
              style={styles.v3InsightGo}
              accessibilityRole="button"
              accessibilityLabel="看完整洞察"
            >
              <Text style={styles.v3InsightGoText}>看完整洞察</Text>
              <ThemedIcon name="chevron-forward" size={12} color={colors.primary} />
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.v3InsightEmpty}>
          <ThemedIcon name="stats-chart-outline" size={17} color={colors.textMuted} />
          <Text style={styles.v3InsightEmptyText}>完成一次专注后，这里会出现你的节律。</Text>
          <Pressable
            hitSlop={10}
            onPress={onStartFocus}
            style={styles.v3InsightGo}
            accessibilityRole="button"
            accessibilityLabel="开始一次专注"
          >
            <Text style={styles.v3InsightGoText}>去专注</Text>
            <ThemedIcon name="chevron-forward" size={12} color={colors.primary} />
          </Pressable>
        </View>
      )}
    </View>
    </>
  );
}
