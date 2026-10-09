import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

export function LearningEntryCards({
  todayQuestions,
  todayGoal,
  routePercent,
  routeDone,
  routeTotal,
}: {
  todayQuestions: number;
  todayGoal: number;
  routePercent: number;
  routeDone: number;
  routeTotal: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const quizProgress = todayGoal === 0 ? 0 : Math.min(1, todayQuestions / todayGoal);
  const routeProgress = Math.max(0, Math.min(1, routePercent / 100));

  return (
    <View style={styles.grid}>
      <PressableScale
        haptic
        scaleTo={0.985}
        style={[styles.card, styles.quizCard]}
        onPress={() => router.push("/quiz" as never)}
        accessibilityRole="button"
        accessibilityLabel="进入技术题库"
      >
        <View style={[styles.iconBubble, { backgroundColor: colors.surface }]}>
          <ThemedIcon name="search" size={22} color={colors.primary} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.eyebrow}>SEARCH · PRACTICE</Text>
          <Text style={styles.title}>技术题库</Text>
          <Text style={styles.description}>先学章节知识点，再完成当天的一组练习</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaStrong}>{todayQuestions}</Text>
          <Text style={styles.metaText}> / {todayGoal} 今日</Text>
        </View>
        <Meter value={quizProgress} color={colors.primary} track={colors.surface} />
        <View style={styles.ctaRow}>
          <Text style={[styles.cta, { color: colors.primary }]}>开始刷题</Text>
          <ThemedIcon name="chevron-forward" size={15} color={colors.primary} />
        </View>
      </PressableScale>

      <PressableScale
        haptic
        scaleTo={0.985}
        style={[styles.card, styles.routeCard]}
        onPress={() => router.push("/roadmap" as never)}
        accessibilityRole="button"
        accessibilityLabel="进入阶段路线"
      >
        <View style={[styles.iconBubble, { backgroundColor: colors.surface }]}>
          <ThemedIcon name="git-branch-outline" size={22} color={colors.accent} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.eyebrow}>ROADMAP · PROGRESS</Text>
          <Text style={styles.title}>阶段路线</Text>
          <Text style={styles.description}>把长期目标拆成可完成、可验收的阶段</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaStrong}>{routeDone}</Text>
          <Text style={styles.metaText}> / {routeTotal} 主题</Text>
        </View>
        <Meter value={routeProgress} color={colors.accent} track={colors.surface} />
        <View style={styles.ctaRow}>
          <Text style={[styles.cta, { color: colors.accent }]}>查看路线</Text>
          <ThemedIcon name="chevron-forward" size={15} color={colors.accent} />
        </View>
      </PressableScale>
    </View>
  );
}

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale haptic scaleTo={0.985} onPress={onToggle} style={styles.shelfHeader}>
      <View style={[styles.shelfIcon, { backgroundColor: colors.accentSoft }]}>
        <ThemedIcon name="layers-outline" size={19} color={colors.accent} />
      </View>
      <View style={styles.shelfBody}>
        <Text style={styles.shelfTitle}>阶段路线收纳栏</Text>
        <Text style={styles.shelfSub}>{stageCount} 个阶段 · 已完成 {percent}%</Text>
      </View>
      <ThemedIcon name={open ? "chevron-up" : "chevron-down"} size={17} color={colors.textMuted} />
    </PressableScale>
  );
}

function Meter({ value, color, track }: { value: number; color: string; track: string }) {
  return (
    <View style={[meterStyles.track, { backgroundColor: track }]}>
      <View style={[meterStyles.fill, { backgroundColor: color, width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

const meterStyles = StyleSheet.create({
  track: { height: 6, borderRadius: 999, overflow: "hidden", width: "100%" },
  fill: { height: "100%", borderRadius: 999 },
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    grid: { flexDirection: "row", gap: spacing.md },
    card: {
      flex: 1,
      minHeight: 194,
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      ...shadows.card,
    },
    quizCard: { backgroundColor: colors.primarySoft, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primary + "33" },
    routeCard: { backgroundColor: colors.accentSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accent + "33" },
    iconBubble: {
      width: 42,
      height: 42,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      ...shadows.card,
    },
    cardBody: { gap: 3, flex: 1 },
    eyebrow: { ...typography.micro, letterSpacing: 0.7, color: colors.textMuted },
    title: { ...typography.title2, color: colors.text },
    description: { ...typography.caption, fontWeight: "400", color: colors.textSecondary },
    metaRow: { flexDirection: "row", alignItems: "baseline", marginTop: "auto" },
    metaStrong: { ...typography.title2, color: colors.text },
    metaText: { ...typography.caption, color: colors.textMuted },
    ctaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    cta: { ...typography.callout, fontWeight: "700" },
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
    shelfIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    shelfBody: { flex: 1, gap: 2 },
    shelfTitle: { ...typography.headline, color: colors.text },
    shelfSub: { ...typography.caption, color: colors.textMuted },
  });
