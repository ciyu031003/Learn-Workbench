import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { getLearningTrack } from "@learn-workbench/content";
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
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const quizProgress = todayGoal === 0 ? 0 : Math.min(1, todayQuestions / todayGoal);
  const routeProgress = Math.max(0, Math.min(1, routePercent / 100));
  const examColor = dark ? "#73D4C6" : "#196B63";
  const examSurface = dark ? "#123A36" : "#E2F3EF";
  const examBorder = dark ? "#2F7F7450" : "#196B6335";
  const exam408 = getLearningTrack("ex-408-grad");
  const exam408Chapters =
    exam408?.stages.reduce((total, stage) => total + stage.topics.length, 0) ?? 0;
  const exam408Points =
    exam408?.stages.reduce(
      (total, stage) =>
        total + stage.topics.reduce((topicTotal, topic) => topicTotal + topic.concepts.length, 0),
      0
    ) ?? 0;

  return (
    <View style={styles.stack}>
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
          {/*
           * v1.45 真机反馈：「技术题库和阶段路线上面不要有那么多文字描述」。
           * 原先这里是「英文小标 + 标题 + 一句中文说明」三层，
           * 而下面已经有 进度数字 + 进度条 + CTA，说明文字纯属重复。
           * 现在只留标题，卡片更矮、信息密度更高。
           */}
          <View style={styles.cardBody}>
            <Text style={styles.title}>技术题库</Text>
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
            <Text style={styles.title}>阶段路线</Text>
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

      <PressableScale
        haptic
        scaleTo={0.985}
        style={[
          styles.examCard,
          { backgroundColor: examSurface, borderColor: examBorder },
        ]}
        onPress={() => router.push("/exam-408" as never)}
        accessibilityRole="button"
        accessibilityLabel="进入 408 考研专区"
      >
        <View style={styles.examGlow} />
        <View style={styles.examTop}>
          <View style={styles.examIcon}>
            <ThemedIcon name="school-outline" size={25} color={examColor} />
          </View>
          <View style={styles.examBody}>
            <Text style={[styles.examEyebrow, { color: examColor }]}>POSTGRADUATE · 408</Text>
            <Text style={styles.examTitle}>408 考研专区</Text>
          </View>
          <View style={styles.examBadge}>
            <Text style={styles.examBadgeText}>2009–2026</Text>
          </View>
        </View>
        {/* v1.45：与上面两张卡同样精简 —— 章节/知识点/真题套数下面已经列出来了，
            再来一句"四科完整知识体系、章节专项题与历年原卷真题"属于重复描述 */}
        <View style={styles.examFooter}>
          <Text style={[styles.examMeta, { color: examColor }]}>{exam408Chapters} 章</Text>
          <View style={styles.examDot} />
          <Text style={[styles.examMeta, { color: examColor }]}>{exam408Points} 个知识点</Text>
          <View style={styles.examDot} />
          <Text style={[styles.examMeta, { color: examColor }]}>18 套真题</Text>
          <View style={[styles.examCta, { backgroundColor: dark ? "#238D80" : examColor }]}>
            <Text style={styles.examCtaText}>进入专区</Text>
            <ThemedIcon name="chevron-forward" size={15} color="#FFFFFF" />
          </View>
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
    stack: { gap: spacing.md },
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
    cardBody: { gap: 3, flex: 1, justifyContent: "center" },
    // eyebrow / description 随 v1.45 的精简一并移除（文字描述只留标题）
    title: { ...typography.title2, color: colors.text },
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
    examCard: {
      minHeight: 158,
      overflow: "hidden",
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      ...shadows.brand,
    },
    examGlow: {
      position: "absolute",
      right: -28,
      top: -42,
      width: 132,
      height: 132,
      borderRadius: 999,
      backgroundColor: "#F7C95C33",
    },
    examTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    examIcon: {
      width: 48,
      height: 48,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    examBody: { flex: 1, gap: 2 },
    examEyebrow: { ...typography.micro, letterSpacing: 0.8 },
    examTitle: { ...typography.title1, color: colors.text },
    examBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: "#F7C95C",
    },
    examBadgeText: { ...typography.micro, fontWeight: "900", color: "#5A3B00" },
    examFooter: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: "auto" },
    examMeta: { ...typography.micro, fontWeight: "800" },
    examDot: { width: 3, height: 3, borderRadius: 999, backgroundColor: "#196B6370" },
    examCta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginLeft: "auto",
      borderRadius: radius.pill,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    examCtaText: { ...typography.micro, fontWeight: "900", color: "#FFFFFF" },
  });
