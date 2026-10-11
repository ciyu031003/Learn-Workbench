import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated from "react-native-reanimated";
import {
  getLearningTrack,
  isLearnable,
  knowledgePointKeyOf,
  qualityOfTopic,
  type LearningStage,
  type LearningTrack,
} from "@learn-workbench/content";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { loadReadingStore, readStateOf, type ReadingStore } from "@/lib/reading-state";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

export default function QuizChapterScreen() {
  const params = useLocalSearchParams<{
    track?: string;
    stage?: string;
    returnTo?: string;
  }>();
  const track = getLearningTrack(params.track);
  const stage = track?.stages.find((item) => item.key === params.stage);
  if (!track || !stage) return <MissingChapter />;
  const returnTo = params.returnTo?.startsWith("/") ? params.returnTo : undefined;
  return <ChapterContent track={track} stage={stage} returnTo={returnTo} />;
}

function ChapterContent({
  track,
  stage,
  returnTo,
}: {
  track: LearningTrack;
  stage: LearningStage;
  returnTo?: string;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const trackTint = dark ? `${track.accent}24` : track.softAccent;
  const [readingStore, setReadingStore] = useState<ReadingStore | null>(null);
  const stageIndex = track.stages.findIndex((item) => item.key === stage.key);
  const learnableTopics = useMemo(
    () =>
      stage.topics.filter((topic) =>
        isLearnable(qualityOfTopic(track, stage, topic).level)
      ),
    [stage, track]
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadReadingStore().then((store) => {
        if (alive) setReadingStore(store);
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  const startPractice = () => {
    router.push({
      pathname: "/quiz/session",
      params: { track: track.slug, stage: stage.key, mode: "stage" },
    } as never);
  };

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar
        title={stage.title}
        scrollY={header.scrollY}
        backTo={returnTo ?? `/quiz/${track.slug}`}
      />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={entrance(0)} style={[styles.hero, { backgroundColor: trackTint }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroNumber}>
              <Text style={[styles.heroNumberText, { color: track.accent }]}>
                {String(stageIndex + 1).padStart(2, "0")}
              </Text>
            </View>
            <View style={styles.heroTopBody}>
              <Text style={[styles.heroEyebrow, { color: track.accent }]}>CHAPTER</Text>
              <Text style={styles.heroMeta}>
                {learnableTopics.length} 个知识点 · {stage.weeks}
              </Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{stage.title}</Text>
          <Text style={styles.heroSummary}>{stage.goal}</Text>
          <View style={styles.outcomeBox}>
            <Text style={styles.outcomeLabel}>本章验收</Text>
            <Text style={styles.outcomeText}>{stage.outcome}</Text>
          </View>
        </Animated.View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>选择知识点</Text>
            <Text style={styles.sectionText}>按顺序阅读，或直接跳到需要复习的小节。</Text>
          </View>
          <Text style={styles.sectionCount}>{learnableTopics.length} 节</Text>
        </View>

        <View style={styles.topicList}>
          {learnableTopics.map((topic, index) => {
            const pointKey = knowledgePointKeyOf({
              trackSlug: track.slug,
              stageKey: stage.key,
              topicKey: topic.key,
            });
            const readState = readingStore ? readStateOf(readingStore, pointKey) : null;
            const questionCount = track.questions.filter(
              (question) => question.stageKey === stage.key && question.topicKey === topic.key
            ).length;
            return (
              <PressableScale
                key={topic.key}
                haptic
                scaleTo={0.985}
                onPress={() =>
                  router.push({
                    pathname: "/quiz/read",
                    params: {
                      track: track.slug,
                      stage: stage.key,
                      topic: topic.key,
                      ...(returnTo ? { returnTo } : {}),
                    },
                  } as never)
                }
                style={styles.topicCard}
              >
                <View style={[styles.topicNumber, { backgroundColor: trackTint }]}>
                  <Text style={[styles.topicNumberText, { color: track.accent }]}>
                    {String(index + 1).padStart(2, "0")}
                  </Text>
                </View>
                <View style={styles.topicBody}>
                  <View style={styles.topicTitleRow}>
                    <Text style={styles.topicTitle}>{topic.title}</Text>
                    {readState?.progress ? (
                      <View style={styles.readBadge}>
                        <ThemedIcon
                          name={readState.progress >= 85 ? "checkmark-circle" : "book-outline"}
                          size={13}
                          color={readState.progress >= 85 ? colors.success : colors.textMuted}
                        />
                        <Text style={styles.readText}>
                          {readState.progress >= 85 ? "已读" : `${readState.progress}%`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.topicSummary} numberOfLines={2}>
                    {topic.summary}
                  </Text>
                  <Text style={[styles.topicMeta, { color: track.accent }]}>
                    {questionCount} 道配套题
                  </Text>
                </View>
                <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
              </PressableScale>
            );
          })}
        </View>

        <PressableScale
          haptic
          scaleTo={0.98}
          onPress={startPractice}
          style={[styles.practiceButton, { backgroundColor: track.accent }]}
        >
          <ThemedIcon name="play" size={17} color="#FFFFFF" />
          <Text style={styles.practiceText}>练习本章全部知识点</Text>
        </PressableScale>
      </Animated.ScrollView>
    </View>
  );
}

function MissingChapter() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.centerState}>
      <ThemedIcon name="book-outline" size={26} color={colors.textMuted} />
      <Text style={styles.centerTitle}>未找到本章</Text>
      <PressableScale haptic onPress={() => router.replace("/quiz" as never)} style={styles.practiceButton}>
        <Text style={styles.practiceText}>返回题库</Text>
      </PressableScale>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.lg },
    centerState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      padding: spacing.xl,
      backgroundColor: colors.canvas,
    },
    centerTitle: { ...typography.title2, color: colors.text },
    hero: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md, ...shadows.card },
    heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    heroNumber: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    heroNumberText: { ...typography.headline, fontWeight: "900", fontVariant: ["tabular-nums"] },
    heroTopBody: { flex: 1, gap: 2 },
    heroEyebrow: { ...typography.micro, letterSpacing: 0.8 },
    heroMeta: { ...typography.caption, color: colors.textMuted },
    heroTitle: { ...typography.title1, color: colors.text },
    heroSummary: { ...typography.body, color: colors.textSecondary },
    outcomeBox: { borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceStrong, gap: 3 },
    outcomeLabel: { ...typography.micro, color: colors.primary },
    outcomeText: { ...typography.callout, color: colors.textSecondary },
    sectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md },
    sectionTitle: { ...typography.title2, color: colors.text },
    sectionText: { ...typography.caption, color: colors.textMuted },
    sectionCount: { ...typography.caption, color: colors.textMuted },
    topicList: { gap: spacing.md },
    topicCard: {
      minHeight: 104,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    topicNumber: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    topicNumberText: { ...typography.caption, fontWeight: "900" },
    topicBody: { flex: 1, gap: 3 },
    topicTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    topicTitle: { flex: 1, ...typography.headline, color: colors.text },
    readBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
    readText: { ...typography.micro, color: colors.textMuted },
    topicSummary: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
    topicMeta: { ...typography.caption, fontWeight: "800" },
    practiceButton: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderRadius: radius.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.primary,
    },
    practiceText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
  });
