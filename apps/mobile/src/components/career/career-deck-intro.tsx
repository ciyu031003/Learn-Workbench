import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { PressableScale } from "@/components/pressable-scale";
import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 滑动选岗入口（对齐 demo .career-deck-intro）：
 * 左侧三张叠放的卡片缩略 + 「岗位卡组」+ 右侧 chevron，整卡点进 /job-deck。
 */
export function CareerDeckIntro() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      haptic
      hitSlop={4}
      scaleTo={0.99}
      onPress={() => router.push("/job-deck" as never)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel="打开岗位卡组，滑动选岗"
    >
      <View style={styles.stack} pointerEvents="none">
        <View style={[styles.stackCard, styles.stackBack2]} />
        <View style={[styles.stackCard, styles.stackBack1]} />
        <View style={[styles.stackCard, styles.stackFront]}>
          <Icon name="career" size={20} weight="fill" color={colors.primary} />
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>岗位卡组</Text>
        <Text style={styles.sub} numberOfLines={1}>
          左右滑动 · 快速标记感兴趣
        </Text>
      </View>
      <Icon name="chevron" size={16} weight="bold" color={colors.textMuted} />
    </PressableScale>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.panel,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    stack: { width: 58, height: 46, justifyContent: "center" },
    stackCard: { position: "absolute", width: 38, height: 46, borderRadius: radius.control, borderWidth: 1 },
    stackBack2: { left: 0, top: 0, backgroundColor: colors.surfaceMuted, borderColor: colors.border, transform: [{ rotate: "-7deg" }] },
    stackBack1: { left: 8, top: 0, backgroundColor: colors.surface, borderColor: colors.border, transform: [{ rotate: "-3deg" }] },
    stackFront: {
      left: 16,
      top: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary + "33",
    },
    copy: { flex: 1, minWidth: 0 },
    title: { ...typography.callout, fontWeight: "700", color: colors.text },
    sub: { ...typography.meta, color: colors.textMuted, marginTop: 3 },
  });