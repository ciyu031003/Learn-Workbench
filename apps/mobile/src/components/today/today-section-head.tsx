import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { haptics } from "@/lib/haptics";
import { TEXT_SCALE_POLICY } from "@/lib/text-scale";
import { useTheme } from "@/theme";
import { spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 一级页区块头（对齐 demo .section-head）：
 *
 *   今天只做三件事                    3 / 5 已完成  全部 5 项 →
 *
 * 左侧是 16/22 的区块标题，右侧是弱化 meta + 主色链接。
 * v7 的「01/02/03」等宽序号在 demo v12 已经去掉（序号像模板，且会把标题往右推），
 * 这里保留 index 入参只为兼容旧调用点，不再渲染。
 */
export function TodaySectionHead({
  title,
  meta,
  action,
}: {
  index?: string;
  title: string;
  meta?: string;
  action?: { label: string; accessibilityLabel: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>
        {meta ? (
          <Text style={styles.meta} {...TEXT_SCALE_POLICY.chrome} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
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
            <Text style={styles.actionText} numberOfLines={1}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
    title: { ...typography.section, color: colors.text, flexShrink: 1 },
    right: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, flexShrink: 0 },
    meta: { ...typography.meta, color: colors.textMuted },
    action: { paddingVertical: 2 },
    actionText: { ...typography.meta, fontWeight: "700", color: colors.primary },
  });

