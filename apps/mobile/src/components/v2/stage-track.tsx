import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";

/** v2 五阶段轨道（求职进度）：已完成=实心 ok、当前=主色+光晕、未到=描边灰 */
export function StageTrack({
  stages,
  current,
}: {
  stages: string[];
  current: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={styles.line} />
      {stages.map((stage, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <View key={stage + index} style={styles.step}>
            <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]} />
            <Text style={[styles.label, done && styles.labelDone, active && styles.labelActive]} numberOfLines={1}>{stage}</Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { flexDirection: "row", alignItems: "flex-start", paddingTop: 2, position: "relative" },
    line: { position: "absolute", left: "9%", right: "9%", top: 7, height: 2, backgroundColor: colors.border },
    step: { flex: 1, alignItems: "center", gap: 5, zIndex: 1 },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.surfaceStrong, borderWidth: 2, borderColor: colors.borderStrong },
    dotDone: { backgroundColor: colors.success, borderColor: colors.success },
    dotActive: { backgroundColor: colors.primary, borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
    label: { ...typography.caption, fontWeight: "400", color: colors.textFaint },
    labelDone: { color: colors.success },
    labelActive: { color: colors.primary, fontWeight: "700" },
  });
