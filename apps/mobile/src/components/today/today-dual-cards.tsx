import { useMemo } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/theme";
import { MiniStatCard } from "./today-widgets";
import { makeStyles } from "./today-styles";

/** ⑥ 双列小卡：本周专注 / 今日饮水。 */
export function TodayDualCards({
  weekFocusPercent,
  weekFocusHint,
  waterPercent,
  waterHint,
}: {
  weekFocusPercent: number;
  weekFocusHint: string;
  waterPercent: number | null;
  waterHint: string;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <>
    {/* ⑥ 双列小卡：本周专注 / 今日饮水 */}
    <View style={styles.dualRow}>
      <MiniStatCard
        label="本周专注"
        percent={weekFocusPercent}
        hint={weekFocusHint}
        icon="book-outline"
        onPress={() => router.push("/learn" as never)}
        accessibilityLabel="本周专注，打开学习页"
      />
      <MiniStatCard
        label="今日饮水"
        percent={waterPercent}
        hint={waterHint}
        icon="water-outline"
        tone="accent"
        onPress={() => router.push("/wellness" as never)}
        accessibilityLabel="今日饮水，打开健康页"
      />
    </View>
    </>
  );
}
