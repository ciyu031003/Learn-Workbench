import { useMemo } from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 分组小标题（v7 P1，参考设置类 App 的分组范式）：
 * 12·700·textMuted，放在每张 ListGroup 之前，用来切分「账号 / 学习与数据 / 外观与体验 / 支持 / 关于」。
 */
export function GroupLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={[styles.label, style]} accessibilityRole="header">{children}</Text>;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
