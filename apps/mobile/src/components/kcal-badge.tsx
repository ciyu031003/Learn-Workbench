import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 热量徽标（v3 M3）：`520 kcal` 胶囊。
 * 常规 = accentSoft/accentStrong（能量橙）；超标 = dangerSoft/danger。
 */
export function KcalBadge({
  kcal,
  over = false,
  size = "md",
  style,
}: {
  kcal: number;
  over?: boolean;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const n = Math.round(Number.isFinite(kcal) ? kcal : 0);
  return (
    <View style={[styles.badge, size === "sm" && styles.badgeSm, over ? styles.over : styles.normal, style]}>
      <Text style={[styles.text, size === "sm" && styles.textSm, over ? styles.textOver : styles.textNormal]}>
        {n} kcal
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    badge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: "flex-start",
    },
    badgeSm: { paddingHorizontal: 8, paddingVertical: 2 },
    normal: { backgroundColor: colors.accentSoft },
    over: { backgroundColor: colors.dangerSoft },
    text: { ...typography.micro, fontWeight: "800", ...tabularNums },
    textSm: { fontSize: 10 },
    textNormal: { color: colors.accentStrong },
    textOver: { color: colors.danger },
  });
