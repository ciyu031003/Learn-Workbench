import { useMemo, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 分组标题（见 docs/APP端优化方案-v2 §8.3②）
 * 标题 17·800 + 右侧「更多 ›」；分组间距 24。
 * 用于「重点 / 更多」收纳：首屏只留重点块，次级进「更多」。
 */
export function SectionHeader({
  title,
  actionLabel = "更多",
  onAction,
  subtitle,
  style,
  /** 左侧色条颜色（默认主色）—— 「今日饮食」那套语言：色条 + 标题 + 右侧说明 */
  accentColor,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  accentColor?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.accentBar, { backgroundColor: accentColor ?? colors.primary }]} />
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <ThemedIcon name="chevron-forward" size={13} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 屏幕内主区块标题（比 SectionHeader 轻一档，用于屏内小节） */
export function BlockTitle({
  title,
  right,
  style,
  accentColor,
}: {
  title: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accentColor?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.blockRow, style]}>
      <View style={[styles.accentBar, { backgroundColor: accentColor ?? colors.primary }]} />
      <Text style={[styles.blockTitle, styles.blockTitleFlex]}>{title}</Text>
      {right}
    </View>
  );
}

export type SectionIcon = keyof typeof Ionicons.glyphMap;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 12,
    },
    // 左侧色条：深浅色都由主色/自定义色驱动（与档案页、饮食页统一）
    accentBar: { width: 3, height: 18, borderRadius: 2 },
    textWrap: { flex: 1, minWidth: 0, gap: 2 },
    title: { ...typography.title2, fontWeight: "800", color: colors.text },
    subtitle: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    action: { flexDirection: "row", alignItems: "center", gap: 2 },
    actionText: { ...typography.caption, fontWeight: "700", color: colors.primary },
    blockRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    blockTitle: { ...typography.headline, fontWeight: "800", color: colors.text },
    blockTitleFlex: { flex: 1, minWidth: 0 },
  });
