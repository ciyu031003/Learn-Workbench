import { useMemo } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { ModePill } from "./today-widgets";
import { useTheme } from "@/theme";
import { makeStyles } from "./today-styles";

/** ④ 保留刷题 / 阅读 / 训练三个既有入口（demo 未含，但功能不丢）。 */
export function TodayQuickEntries({ onOpenSportSheet }: { onOpenSportSheet: () => void }) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <>
    {/* 保留刷题 / 阅读 / 训练三个既有入口（demo 未含，但功能不丢） */}
    <View style={styles.pillRow}>
      <ModePill icon="layers-outline" label="刷题" accessibilityLabel="刷题，去题库" onPress={() => router.push("/quiz" as never)} />
      <ModePill icon="book-outline" label="阅读" accessibilityLabel="阅读，去学习页" onPress={() => router.push("/learn" as never)} />
      <ModePill icon="barbell-outline" label="训练" accessibilityLabel="训练，记录运动" onPress={onOpenSportSheet} />
    </View>
    </>
  );
}
