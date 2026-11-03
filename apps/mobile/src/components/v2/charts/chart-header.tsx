import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";
import { spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 图表标题行（组件库内部复用）：左标题/副标题 + 右操作区（周切换、小图例…）。
 *
 * 刻意**不画卡片底**：这些图表默认作为面板内容嵌进页面已有的 <Surface>/卡片里，
 * 再套一层卡片会出现"双层白卡"；唯一自带卡片质感的是 StatTile（指标卡本身就是卡）。
 */
export function ChartHeader({
  title,
  caption,
  right,
  style,
}: {
  title?: string | null;
  caption?: string | null;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!title && !caption && !right) return null;
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        {title ? (
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {caption ? (
          <Text style={styles.caption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      minHeight: 24,
      marginBottom: spacing.md,
    },
    left: { flexShrink: 1, gap: 2 },
    title: { ...typography.section, color: colors.text },
    caption: { ...typography.meta, color: colors.textMuted },
    right: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  });
