import { useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { spacing, typography, type ThemeColors } from "@/theme/tokens";

/** v2 区块标题：14/700 + 右侧「查看全部」；替代旧 SectionHeader 的色条写法（旧组件保留兼容） */
export function SectionTitle({
  title,
  actionLabel,
  onAction,
  right,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.row, style]}>
      <View style={styles.accent} />
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {right ?? null}
      {onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={actionLabel ?? "查看全部"}
          style={styles.action}
        >
          <Text style={styles.actionText}>{actionLabel ?? "查看全部"}</Text>
          <ThemedIcon name="chevron-forward" size={12} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 21,
      marginBottom: 11,
      paddingHorizontal: 2,
      minHeight: 24,
      gap: 8,
    },
    /* v2.0.1 视觉深化：区块标题前加一枚主色竖条，统一节奏、减少"平淡感" */
    accent: { width: 3, height: 14, borderRadius: 2, backgroundColor: colors.primary },
    /** flex:1 而非 flexShrink：右侧有 right/action 时 space-between 会把标题挤到行中间（真机/Web 均可见） */
    title: { ...typography.section, color: colors.text, flex: 1 },
    action: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44, paddingLeft: spacing.sm },
    actionText: { ...typography.meta, fontWeight: "700", color: colors.primary },
  });
