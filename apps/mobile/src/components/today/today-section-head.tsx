import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { haptics } from "@/lib/haptics";
import { TEXT_SCALE_POLICY } from "@/lib/text-scale";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * Day Sheet 的区块头：「01 今天只做三件事」这种带等宽序号的小标题。
 * 01/02/03 三块共用，序号是装饰性编号（纯展示），右侧动作是真实入口（必须带热区与无障碍标签）。
 */
export function TodaySectionHead({
  index,
  title,
  action,
}: {
  index: string;
  title: string;
  action?: { label: string; accessibilityLabel: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Text style={styles.index} {...TEXT_SCALE_POLICY.chrome}>
        {index}
      </Text>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Pressable
          hitSlop={10}
          onPress={() => {
            haptics.light();
            action.onPress();
          }}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
    index: {
      ...typography.eyebrow,
      letterSpacing: 1,
      color: colors.textMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.xs,
      paddingVertical: 1,
      overflow: "hidden",
    },
    title: { ...typography.section, color: colors.text, flex: 1 },
    action: { paddingVertical: 2 },
    actionText: { ...typography.meta, fontWeight: "600", color: colors.primary },
  });
