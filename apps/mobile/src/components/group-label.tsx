import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 分组小标题（v7 P1，参考设置类 App 的分组范式）：
 * 12·700·textMuted，放在每张 ListGroup 之前，用来切分「账号 / 学习与数据 / 外观与体验 / 支持 / 关于」。
 *
 * v12 P1-3：补一条**主色小竖条**，与健康/饮食页的区块标题同一套语言，
 * 这样设置/习惯/档案这些页面的分组也能一起提质（改一处，全站生效）。
 */
export function GroupLabel({
  children,
  style,
  accentColor,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
  accentColor?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <View style={[styles.bar, { backgroundColor: accentColor ?? colors.primary }]} />
      <Text style={[styles.label, style]} accessibilityRole="header">{children}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 6 },
    bar: { width: 3, height: 12, borderRadius: 2 },
    label: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textMuted,
      letterSpacing: 0.4,
      paddingTop: 6,
      paddingBottom: 2,
      paddingLeft: 2,
    },
  });
