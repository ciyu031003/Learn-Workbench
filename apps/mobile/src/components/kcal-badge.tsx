import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
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
  bare = false,
  textStyle,
}: {
  kcal: number;
  over?: boolean;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
  /**
   * 无底色的"裸数字"（v4 P4-b）：饮食时间线里贴在食物贴纸右下角，
   * 用纯橙色粗体数字（借「吃一点」的 kcal 呈现）。默认关闭，既有胶囊用法不变。
   */
  bare?: boolean;
  /** bare 模式下的文本样式（胶囊模式的 `style` 是 ViewStyle，两者分开避免类型强转） */
  textStyle?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const n = Math.round(Number.isFinite(kcal) ? kcal : 0);
  if (bare) {
    return (
      <Text style={[styles.bare, size === "sm" && styles.bareSm, over ? styles.textOver : styles.textNormal, textStyle]}>
        {n} kcal
      </Text>
    );
  }
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
    /** 裸数字（无胶囊底）：贴纸角上的橙色 kcal */
    bare: { ...typography.micro, fontSize: 13, fontWeight: "900", ...tabularNums },
    bareSm: { fontSize: 11 },
  });
