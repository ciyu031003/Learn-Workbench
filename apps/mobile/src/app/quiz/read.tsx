import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Animated from "react-native-reanimated";
import {
  getLearningTrack,
  type LearningStage,
  type LearningTopic,
  type LearningTrack,
} from "@learn-workbench/content";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

export default function KnowledgeReaderScreen() {
  const params = useLocalSearchParams<{ track?: string; stage?: string }>();
  const track = getLearningTrack(params.track);
  const { colors } = useTheme();

  if (!track) {
    return <MissingChapter colors={colors} />;
  }

  const stageIndex = track.stages.findIndex((item) => item.key === params.stage);
  const stage = stageIndex >= 0 ? track.stages[stageIndex] : track.stages[0];
  if (!stage) {
    return <MissingChapter colors={colors} />;
  }

  return <KnowledgeReader track={track} stage={stage} stageIndex={stageIndex < 0 ? 0 : stageIndex} />;
}

function KnowledgeReader({
  track,
  stage,
  stageIndex,
}: {
  track: LearningTrack;
  stage: LearningStage;
  stageIndex: number;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const entrance = useScreenEntrance();
  const tabBarSpace = useTabBarSpace();
  const trackTint = dark ? `${track.accent}24` : track.softAccent;
  const previous = stageIndex > 0 ? track.stages[stageIndex - 1] : null;
  const next = stageIndex + 1 < track.stages.length ? track.stages[stageIndex + 1] : null;

  const openChapter = (chapterKey: string) => {
    router.replace({
      pathname: "/quiz/read",
      params: { track: track.slug, stage: chapterKey },
    } as never);
  };

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar
        title={stage.title}
        scrollY={header.scrollY}
        backTo={`/quiz/${track.slug}`}
      />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 36 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeaderLargeTitle
          title={track.title}
          subtitle={`第 ${stageIndex + 1} 章 · ${stage.title}`}
        />

        <Animated.View entering={entrance(0)} style={[styles.hero, { backgroundColor: trackTint }]}>
          <View style={styles.heroTop}>
            <View style={styles.chapterBadge}>
              <Text style={[styles.chapterBadgeText, { color: track.accent }]}>
                CHAPTER {String(stageIndex + 1).padStart(2, "0")}
              </Text>
            </View>
            <Text style={styles.heroWeeks}>{stage.weeks}</Text>
          </View>
          <Text style={styles.heroTitle}>{stage.title}</Text>
          <Text style={styles.heroSummary}>{stage.goal}</Text>
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <ThemedIcon name="book-outline" size={17} color={track.accent} />
              <Text style={styles.heroMetaText}>{stage.topics.length} 个知识点</Text>
            </View>
            <View style={styles.heroMetaItem}>
              <ThemedIcon name="checkmark-circle" size={17} color={track.accent} />
              <Text style={styles.heroMetaText}>读完后完成练习</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={entrance(1)} style={styles.outcome}>
          <Text style={styles.outcomeLabel}>本章验收</Text>
          <Text style={styles.outcomeText}>{stage.outcome}</Text>
        </Animated.View>

        <View style={styles.articleList}>
          {stage.topics.map((topic, index) => (
            <Animated.View key={topic.key} entering={entrance(index + 2)}>
              <TopicArticle track={track} topic={topic} index={index} />
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={entrance(7)} style={styles.finishCard}>
          <View style={[styles.finishIcon, { backgroundColor: trackTint }]}>
            <ThemedIcon name="checkmark-done" size={24} color={track.accent} />
          </View>
          <Text style={styles.finishTitle}>这一章读完了</Text>
          <Text style={styles.finishText}>
            用自己的话复述一次核心概念，再去题库完成对应阶段练习，学习效果最好。
          </Text>
          <PressableScale
            haptic
            onPress={() =>
              router.push({
                pathname: "/quiz/session",
                params: { track: track.slug, stage: stage.key, mode: "stage" },
              } as never)
            }
            style={[styles.finishPrimary, { backgroundColor: track.accent }]}
          >
            <ThemedIcon name="play" size={17} color="#FFFFFF" />
            <Text style={styles.finishPrimaryText}>练习本章题库</Text>
          </PressableScale>
        </Animated.View>

        <View style={styles.chapterNav}>
          {previous ? (
            <PressableScale
              haptic
              onPress={() => openChapter(previous.key)}
              style={styles.chapterNavButton}
            >
              <ThemedIcon name="chevron-back" size={17} color={colors.textSecondary} />
              <View style={styles.chapterNavBody}>
                <Text style={styles.chapterNavLabel}>上一章</Text>
                <Text style={styles.chapterNavTitle} numberOfLines={1}>{previous.title}</Text>
              </View>
            </PressableScale>
          ) : (
            <View style={styles.chapterNavSpacer} />
          )}
          {next ? (
            <PressableScale
              haptic
              onPress={() => openChapter(next.key)}
              style={[styles.chapterNavButton, styles.chapterNavNext]}
            >
              <View style={[styles.chapterNavBody, styles.chapterNavBodyNext]}>
                <Text style={styles.chapterNavLabel}>下一章</Text>
                <Text style={styles.chapterNavTitle} numberOfLines={1}>{next.title}</Text>
              </View>
              <ThemedIcon name="chevron-forward" size={17} color={colors.textSecondary} />
            </PressableScale>
          ) : null}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function TopicArticle({
  track,
  topic,
  index,
}: {
  track: LearningTrack;
  topic: LearningTopic;
  index: number;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const trackTint = dark ? `${track.accent}24` : track.softAccent;

  return (
    <View style={styles.article}>
      <View style={styles.articleHead}>
        <View style={[styles.articleNumber, { backgroundColor: trackTint }]}>
          <Text style={[styles.articleNumberText, { color: track.accent }]}>
            {String(index + 1).padStart(2, "0")}
          </Text>
        </View>
        <View style={styles.articleHeadBody}>
          <Text style={styles.articleTitle}>{topic.title}</Text>
          <Text style={styles.articleSummary}>{topic.summary}</Text>
        </View>
      </View>

      <KnowledgeBlock title="先建立概念" icon="bulb-outline" accent={track.accent}>
        <View style={styles.chipWrap}>
          {topic.concepts.map((concept) => (
            <View key={concept} style={[styles.conceptChip, { backgroundColor: trackTint }]}>
              <Text style={[styles.conceptChipText, { color: track.accent }]}>{concept}</Text>
            </View>
          ))}
        </View>
      </KnowledgeBlock>

      <KnowledgeBlock title="为什么这样工作" icon="git-branch-outline" accent={track.accent}>
        <ParagraphList items={topic.principles} />
      </KnowledgeBlock>

      <KnowledgeBlock title="它可以解决什么" icon="apps-outline" accent={track.accent}>
        <ParagraphList items={topic.applications} />
      </KnowledgeBlock>

      <KnowledgeBlock title="常见误区" icon="alert-circle" accent={colors.danger} danger>
        <ParagraphList items={topic.pitfalls} danger />
      </KnowledgeBlock>

      <View style={styles.method}>
        <Text style={styles.methodLabel}>怎么学</Text>
        <Text style={styles.methodText}>{topic.method}</Text>
      </View>

      <View style={styles.practice}>
        <View style={styles.practiceHead}>
          <ThemedIcon name="create-outline" size={18} color={track.accent} />
          <Text style={styles.practiceTitle}>动手练习</Text>
        </View>
        <Text style={styles.practiceText}>{topic.exercise}</Text>
        <View style={styles.checkpoint}>
          <ThemedIcon name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.checkpointText}>掌握检查：{topic.checkpoint}</Text>
        </View>
      </View>
    </View>
  );
}

function KnowledgeBlock({
  title,
  icon,
  accent,
  danger = false,
  children,
}: {
  title: string;
  icon: string;
  accent: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <ThemedIcon name={icon as never} size={17} color={danger ? colors.danger : accent} />
        <Text style={[styles.blockTitle, danger && { color: colors.danger }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ParagraphList({ items, danger = false }: { items: string[]; danger?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.paragraphList}>
      {items.map((item) => (
        <View key={item} style={styles.paragraphRow}>
          <View style={[styles.paragraphDot, danger && { backgroundColor: colors.danger }]} />
          <Text style={styles.paragraphText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function MissingChapter({ colors }: { colors: ThemeColors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.missing}>
      <View style={styles.missingIcon}>
        <ThemedIcon name="book-outline" size={26} color={colors.textMuted} />
      </View>
      <Text style={styles.missingTitle}>没有找到这个学习章节</Text>
      <PressableScale haptic onPress={() => router.replace("/quiz" as never)} style={styles.missingButton}>
        <Text style={styles.missingButtonText}>返回题库</Text>
      </PressableScale>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.lg },
    hero: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md, ...shadows.card },
    heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    chapterBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceStrong },
    chapterBadgeText: { ...typography.micro, letterSpacing: 0.8, fontWeight: "800" },
    heroWeeks: { ...typography.caption, color: colors.textMuted },
    heroTitle: { ...typography.title1, color: colors.text },
    heroSummary: { ...typography.body, color: colors.textSecondary },
    heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xs },
    heroMetaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    heroMetaText: { ...typography.caption, color: colors.textSecondary },
    outcome: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: 5, ...shadows.card },
    outcomeLabel: { ...typography.micro, color: colors.primary },
    outcomeText: { ...typography.callout, color: colors.text },
    articleList: { gap: spacing.lg },
    article: { gap: spacing.lg, paddingVertical: spacing.sm },
    articleHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    articleNumber: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    articleNumberText: { ...typography.caption, fontWeight: "800" },
    articleHeadBody: { flex: 1, gap: 3 },
    articleTitle: { ...typography.title1, color: colors.text },
    articleSummary: { ...typography.body, color: colors.textSecondary },
    block: { gap: spacing.sm },
    blockHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    blockTitle: { ...typography.headline, color: colors.text },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    conceptChip: { maxWidth: "100%", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 9 },
    conceptChipText: { ...typography.caption, fontWeight: "700" },
    paragraphList: { gap: spacing.sm },
    paragraphRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    paragraphDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: colors.primary, marginTop: 8 },
    paragraphText: { flex: 1, ...typography.callout, color: colors.textSecondary },
    method: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.primarySoft, gap: 5 },
    methodLabel: { ...typography.micro, color: colors.primary },
    methodText: { ...typography.callout, color: colors.text },
    practice: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: spacing.sm, ...shadows.card },
    practiceHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    practiceTitle: { ...typography.headline, color: colors.text },
    practiceText: { ...typography.callout, color: colors.textSecondary },
    checkpoint: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    checkpointText: { flex: 1, ...typography.caption, color: colors.textMuted },
    finishCard: { alignItems: "center", borderRadius: radius.xl, padding: spacing.xl, backgroundColor: colors.surfaceStrong, gap: spacing.sm, ...shadows.card },
    finishIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    finishTitle: { ...typography.title2, color: colors.text },
    finishText: { ...typography.body, textAlign: "center", color: colors.textSecondary },
    finishPrimary: { width: "100%", minHeight: 50, marginTop: spacing.sm, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
    finishPrimaryText: { ...typography.callout, color: "#FFFFFF", fontWeight: "700" },
    chapterNav: { flexDirection: "row", gap: spacing.md },
    chapterNavSpacer: { flex: 1 },
    chapterNavButton: { flex: 1, minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
    chapterNavNext: { justifyContent: "flex-end" },
    chapterNavBody: { flex: 1, gap: 2 },
    chapterNavBodyNext: { alignItems: "flex-end" },
    chapterNavLabel: { ...typography.micro, color: colors.textMuted },
    chapterNavTitle: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
    missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
    missingIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
    missingTitle: { ...typography.title2, color: colors.text },
    missingButton: { minHeight: 44, paddingHorizontal: spacing.xl, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
    missingButtonText: { ...typography.callout, color: "#FFFFFF", fontWeight: "700" },
  });
