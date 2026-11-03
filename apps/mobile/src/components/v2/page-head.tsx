import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";

/**
 * v2 页头：eyebrow 小标签 + 27px 主标题 + 说明。
 * 原型 V3 的页头范式；五个 Tab 首屏统一用它，二级页按需复用。
 */
export function PageHead({
  eyebrow,
  title,
  subtitle,
  style,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.wrap, style]}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { marginTop: 5, marginBottom: 17, paddingHorizontal: 2 },
    eyebrow: { ...typography.eyebrow, color: colors.textFaint, marginBottom: 8 },
    title: { ...typography.pageTitle, color: colors.text },
    subtitle: { ...typography.meta, color: colors.textMuted, marginTop: 6, lineHeight: 18 },
  });
