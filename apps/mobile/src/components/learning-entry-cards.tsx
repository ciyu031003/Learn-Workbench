import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 学习页「阶段路线收纳栏」折叠头（v1.62 P0-3）。
 *
 * v1.62 起学习页首屏改为「继续学习 Hero + 4 卡入口 + 408 卡」，旧的
 * LearningEntryCards（技术题库/阶段路线 2 卡 + 408 卡）已被 EntryCard 取代并退役；
 * 本文件只保留收起/展开学习架的头条，默认收起。
 */
export function LearningShelfHeader({
  open,
  onToggle,
  percent,
  stageCount,
}: {
  open: boolean;
  onToggle: () => void;
  percent: number;
  stageCount: number;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <PressableScale haptic scaleTo={0.985} onPress={onToggle} style={styles.shelfHeader}>
      <View style={[styles.shelfIcon, { backgroundColor: colors.accentSoft }]}>
        <ThemedIcon name="layers-outline" size={19} color={colors.accent} />
      </View>
      <View style={styles.shelfBody}>
        <Text style={styles.shelfTitle}>阶段路线</Text>
        <Text style={styles.shelfSub}>{stageCount} 个阶段 · 已完成 {percent}%</Text>
      </View>
      <ThemedIcon name={open ? "chevron-up" : "chevron-down"} size={17} color={colors.textMuted} />
    </PressableScale>
  );
}

const makeStyles = (colors: ThemeColors, _dark: boolean) =>
  StyleSheet.create({
    shelfHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    shelfIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    shelfBody: { flex: 1, gap: 2 },
    shelfTitle: { ...typography.headline, color: colors.text },
    shelfSub: { ...typography.caption, color: colors.textMuted },
  });
