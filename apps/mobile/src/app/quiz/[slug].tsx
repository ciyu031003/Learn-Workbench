import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import {
  loadLearningAttempts,
  summarizeLearningAttempts,
  wrongQuestionKeys,
  type LearningAttempt,
} from "@/lib/learning-progress";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

type TabKey = "path" | "knowledge" | "bank" | "records";

const TABS: { key: TabKey; label: string }[] = [
  { key: "path", label: "学习路线" },
  { key: "knowledge", label: "知识点" },
  { key: "bank", label: "题库" },
  { key: "records", label: "练习记录" },
];

export default function QuizTrackScreen() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const track = getLearningTrack(params.slug);
  const { colors } = useTheme();

  if (!track) {
    return <MissingTrack colors={colors} />;
  }

  return <TrackContent track={track} />;
}

function TrackContent({ track }: { track: LearningTrack }) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const trackTint = dark ? `${track.accent}24` : track.softAccent;
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const [tab, setTab] = useState<TabKey>("path");
  const [attempts, setAttempts] = useState<LearningAttempt[]>([]);
  const [expandedStage, setExpandedStage] = useState(track.stages[0]?.key ?? "");
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  const load = useCallback(async () => {
    setAttempts(await loadLearningAttempts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const progress = summarizeLearningAttempts(attempts, track.questions);
  const wrongKeys = wrongQuestionKeys(attempts, track.slug);

  const startSession = (
    stageKey?: string,
    mode: "daily" | "stage" | "wrong" = "daily",
    topicKey?: string
  ) => {
    router.push({
      pathname: "/quiz/session",
      params: {
        track: track.slug,
        mode,
        ...(stageKey ? { stage: stageKey } : {}),
        ...(topicKey ? { topic: topicKey } : {}),
      },
    } as never);
  };

  const startKnowledge = (stageKey: string) => {
    router.push({
      pathname: "/quiz/read",
      params: { track: track.slug, stage: stageKey },
    } as never);
  };

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title={track.title} scrollY={header.scrollY} backTo="/quiz" />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeaderLargeTitle title={track.title} subtitle={`${track.category} · ${track.level}`} />

        <Animated.View entering={entrance(0)} style={[styles.hero, { backgroundColor: trackTint }]}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: colors.surfaceStrong }]}>
              <ThemedIcon name={track.icon as never} size={28} color={track.accent} />
            </View>
            <View style={styles.heroTags}>
              <Text style={[styles.heroCategory, { color: track.accent }]}>{track.category}</Text>
              <Text style={styles.heroMeta}>{track.estimatedHours} 小时 · {track.stages.length} 章 · {track.questions.length} 道题</Text>
            </View>
          </View>
          <Text style={styles.heroSummary}>{track.summary}</Text>
          <View style={styles.heroStats}>
            <HeroStat value={`${progress.mastery}%`} label="掌握度" color={colors.text} />
            <View style={styles.heroDivider} />
            <HeroStat value={String(progress.attempted)} label="已练习" color={colors.text} />
            <View style={styles.heroDivider} />
            <HeroStat value={String(progress.wrong)} label="待复习" color={colors.danger} />
          </View>
          <ProgressMeter value={progress.mastery / 100} color={track.accent} track={colors.surfaceStrong} />
          <PressableScale
            haptic
            scaleTo={0.97}
            onPress={() => startSession(undefined, "daily")}
            style={[styles.heroCta, { backgroundColor: track.accent }]}
          >
            <ThemedIcon name="play" size={17} color="#FFFFFF" />
            <Text style={styles.heroCtaText}>开始今日练习</Text>
          </PressableScale>
        </Animated.View>

        <Animated.View entering={entrance(1)} style={styles.segmented}>
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <PressableScale
                key={item.key}
                haptic
                scaleTo={0.97}
                onPress={() => setTab(item.key)}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item.label}</Text>
              </PressableScale>
            );
          })}
        </Animated.View>

        {tab === "path" ? (
          <View style={styles.sectionList}>
            <View style={styles.learningGuide}>
              <Text style={styles.learningGuideTitle}>学习方式</Text>
              {track.studyMethod.map((method, index) => (
                <View key={method} style={styles.guideRow}>
                  <Text style={styles.guideIndex}>{index + 1}</Text>
                  <Text style={styles.guideText}>{method}</Text>
                </View>
              ))}
            </View>

            {track.stages.map((stage, index) => (
              <StageSection
                key={stage.key}
                track={track}
                stage={stage}
                index={index}
                expanded={expandedStage === stage.key}
                expandedTopic={expandedTopic}
                onToggle={() => {
                  setExpandedStage((current) => (current === stage.key ? "" : stage.key));
                  setExpandedTopic(null);
                }}
                onTopicToggle={(topicKey) => setExpandedTopic((current) => (current === topicKey ? null : topicKey))}
                onStart={() => startSession(stage.key, "stage")}
                onTopicPractice={(topicKey) => startSession(stage.key, "stage", topicKey)}
              />
            ))}
          </View>
        ) : null}

        {tab === "knowledge" ? (
          <View style={styles.sectionList}>
            <View style={styles.knowledgeIntro}>
              <View style={[styles.knowledgeIntroIcon, { backgroundColor: trackTint }]}>
                <ThemedIcon name="book-outline" size={23} color={track.accent} />
              </View>
              <View style={styles.knowledgeIntroBody}>
                <Text style={styles.knowledgeIntroTitle}>按章节系统学习</Text>
                <Text style={styles.knowledgeIntroText}>
                  这里不是刷题。每个章节会把概念、原理、应用和方法按顺序讲清楚，读完再进入练习。
                </Text>
              </View>
            </View>
            {track.stages.map((stage, index) => (
              <KnowledgeChapterCard
                key={stage.key}
                track={track}
                stage={stage}
                index={index}
                onPress={() => startKnowledge(stage.key)}
              />
            ))}
          </View>
        ) : null}

        {tab === "bank" ? (
          <View style={styles.sectionList}>
            <View style={styles.bankSummary}>
              <Text style={styles.bankTitle}>练习方式</Text>
              <Text style={styles.bankText}>每天固定一小段练习，比一次刷很多题更容易形成长期记忆。</Text>
            </View>
            <PracticeModeCard
              icon="search"
              title="每日练习"
              desc="从全部阶段抽取 12 题"
              meta={`今日 ${progress.today} 题`}
              accent={track.accent}
              onPress={() => startSession(undefined, "daily")}
            />
            <PracticeModeCard
              icon="refresh"
              title="错题复习"
              desc="只重练最近答错的知识点"
              meta={`${wrongKeys.length} 道待复习`}
              accent={colors.danger}
              disabled={wrongKeys.length === 0}
              onPress={() => startSession(undefined, "wrong")}
            />
            <PracticeModeCard
              icon="repeat"
              title="复习队列"
              desc="到期复习（间隔复习）+ 错题，统一入口"
              meta="按间隔安排"
              accent={track.accent}
              onPress={() => router.push("/quiz/review" as never)}
            />
            <Text style={styles.stageBankLabel}>按阶段练习</Text>
            {track.stages.map((stage) => {
              const points = track.questions.filter((question) => question.stageKey === stage.key);
              const summary = summarizeLearningAttempts(attempts, points);
              return (
                <PressableScale
                  key={stage.key}
                  haptic
                  scaleTo={0.985}
                  onPress={() => startSession(stage.key, "stage")}
                  style={styles.stageBank}
                >
                  <View style={[styles.stageBankIndex, { backgroundColor: trackTint }]}>
                    <Text style={[styles.stageBankIndexText, { color: track.accent }]}>{stageIndex(track, stage.key)}</Text>
                  </View>
                  <View style={styles.stageBankBody}>
                    <Text style={styles.stageBankTitle}>{stage.title}</Text>
                    <Text style={styles.stageBankMeta}>{points.length} 题 · 掌握度 {summary.mastery}%</Text>
                  </View>
                  <ThemedIcon name="chevron-forward" size={17} color={colors.textFaint} />
                </PressableScale>
              );
            })}
          </View>
        ) : null}

        {tab === "records" ? (
          <View style={styles.sectionList}>
            <View style={styles.recordHero}>
              <Text style={styles.recordValue}>{progress.attempted}</Text>
              <Text style={styles.recordLabel}>累计练习知识点</Text>
              <View style={styles.recordGrid}>
                <RecordStat value={`${progress.mastery}%`} label="掌握度" />
                <RecordStat value={String(progress.correct)} label="最近答对" />
                <RecordStat value={String(progress.wrong)} label="需要复习" />
              </View>
              <Text style={styles.masteryBasis}>
                掌握度口径：近 5 次加权正确率 × 时间新鲜度（久未练会衰减），与到期复习分开统计。
              </Text>
            </View>
            <RecentAttempts track={track} attempts={attempts} />
          </View>
        ) : null}
      </Animated.ScrollView>
    </View>
  );
}

function KnowledgeChapterCard({
  track,
  stage,
  index,
  onPress,
}: {
  track: LearningTrack;
  stage: LearningStage;
  index: number;
  onPress: () => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const trackTint = dark ? `${track.accent}24` : track.softAccent;
  const topicTitles = stage.topics.map((topic) => topic.title).join("、");

  return (
    <PressableScale haptic scaleTo={0.985} onPress={onPress} style={styles.knowledgeCard}>
      <View style={[styles.knowledgeNumber, { backgroundColor: trackTint }]}>
        <Text style={[styles.knowledgeNumberText, { color: track.accent }]}>
          {String(index + 1).padStart(2, "0")}
        </Text>
      </View>
      <View style={styles.knowledgeBody}>
        <View style={styles.knowledgeTop}>
          <Text style={[styles.knowledgeEyebrow, { color: track.accent }]}>CHAPTER</Text>
          <Text style={styles.knowledgeMeta}>{stage.weeks} · {stage.topics.length} 个知识点</Text>
        </View>
        <Text style={styles.knowledgeTitle}>{stage.title}</Text>
        <Text style={styles.knowledgeGoal} numberOfLines={2}>{stage.goal}</Text>
        <Text style={styles.knowledgeTopics} numberOfLines={1}>{topicTitles}</Text>
        <View style={styles.knowledgeCta}>
          <Text style={[styles.knowledgeCtaText, { color: track.accent }]}>进入章节学习</Text>
          <ThemedIcon name="chevron-forward" size={15} color={track.accent} />
        </View>
      </View>
    </PressableScale>
  );
}

function StageSection({
  track,
  stage,
  index,
  expanded,
  expandedTopic,
  onToggle,
  onTopicToggle,
  onStart,
  onTopicPractice,
}: {
  track: LearningTrack;
  stage: LearningStage;
  index: number;
  expanded: boolean;
  expandedTopic: string | null;
  onToggle: () => void;
  onTopicToggle: (key: string) => void;
  onStart: () => void;
  onTopicPractice: (topicKey: string) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const trackTint = dark ? `${track.accent}24` : track.softAccent;
  return (
    <View style={[styles.stageCard, expanded && styles.stageCardOpen]}>
      <PressableScale haptic scaleTo={0.99} onPress={onToggle} style={styles.stageHead}>
        <View style={[styles.stageNumber, { backgroundColor: trackTint }]}>
          <Text style={[styles.stageNumberText, { color: track.accent }]}>{String(index + 1).padStart(2, "0")}</Text>
        </View>
        <View style={styles.stageBody}>
          <Text style={styles.stageTitle}>{stage.title}</Text>
          <Text style={styles.stageWeeks}>{stage.weeks} · {stage.topics.length} 个主题</Text>
        </View>
        <ThemedIcon name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
      </PressableScale>

      {expanded ? (
        <View style={styles.stageExpanded}>
          <View style={styles.outcomeBox}>
            <Text style={styles.outcomeLabel}>阶段目标</Text>
            <Text style={styles.outcomeText}>{stage.goal}</Text>
            <Text style={styles.outcomeResult}>验收：{stage.outcome}</Text>
          </View>
          {stage.topics.map((topic) => (
            <TopicRow
              key={topic.key}
              topic={topic}
              expanded={expandedTopic === topic.key}
              onToggle={() => onTopicToggle(topic.key)}
              onPractice={() => onTopicPractice(topic.key)}
            />
          ))}
          <PressableScale haptic scaleTo={0.97} onPress={onStart} style={[styles.stageCta, { backgroundColor: track.accent }]}>
            <ThemedIcon name="play" size={15} color="#FFFFFF" />
            <Text style={styles.stageCtaText}>练习本阶段</Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

function TopicRow({
  topic,
  expanded,
  onToggle,
  onPractice,
}: {
  topic: LearningTopic;
  expanded: boolean;
  onToggle: () => void;
  onPractice: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.topicShell}>
      <PressableScale haptic scaleTo={0.99} onPress={onToggle} style={styles.topicHead}>
        <View style={styles.topicBullet} />
        <View style={styles.topicBody}>
          <Text style={styles.topicTitle}>{topic.title}</Text>
          <Text style={styles.topicSummary} numberOfLines={expanded ? undefined : 2}>{topic.summary}</Text>
        </View>
        <ThemedIcon name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textFaint} />
      </PressableScale>
      {expanded ? (
        <View style={styles.topicDetails}>
          <DetailBlock title="核心概念" items={topic.concepts} />
          <DetailBlock title="工作原理" items={topic.principles} />
          <DetailBlock title="实际应用" items={topic.applications} />
          <DetailBlock title="常见误区" items={topic.pitfalls} warning />
          <View style={styles.methodCard}>
            <Text style={styles.methodLabel}>学习方法</Text>
            <Text style={styles.methodText}>{topic.method}</Text>
          </View>
          <View style={styles.exerciseCard}>
            <Text style={styles.exerciseLabel}>练习任务</Text>
            <Text style={styles.exerciseText}>{topic.exercise}</Text>
            <Text style={styles.checkpointText}>掌握标准：{topic.checkpoint}</Text>
            <PressableScale
              haptic
              scaleTo={0.97}
              onPress={onPractice}
              accessibilityRole="button"
              accessibilityLabel={`开始${topic.title}练习`}
              style={styles.topicPracticeButton}
            >
              <ThemedIcon name="play" size={14} color="#FFFFFF" />
              <Text style={styles.topicPracticeButtonText}>开始本知识点练习</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DetailBlock({ title, items, warning = false }: { title: string; items: string[]; warning?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.detailBlock}>
      <Text style={[styles.detailTitle, warning && { color: colors.danger }]}>{title}</Text>
      {items.map((item) => (
        <View key={item} style={styles.detailRow}>
          <View style={[styles.detailDot, warning && { backgroundColor: colors.danger }]} />
          <Text style={styles.detailText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function PracticeModeCard({
  icon,
  title,
  desc,
  meta,
  accent,
  disabled = false,
  onPress,
}: {
  icon: string;
  title: string;
  desc: string;
  meta: string;
  accent: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      haptic
      scaleTo={0.985}
      disabled={disabled}
      onPress={onPress}
      style={[styles.practiceCard, disabled && styles.practiceCardDisabled]}
    >
      <View style={[styles.practiceIcon, { backgroundColor: accent + "1F" }]}>
        <ThemedIcon name={icon as never} size={21} color={accent} />
      </View>
      <View style={styles.practiceBody}>
        <Text style={styles.practiceTitle}>{title}</Text>
        <Text style={styles.practiceDesc}>{desc}</Text>
      </View>
      <Text style={[styles.practiceMeta, { color: accent }]}>{meta}</Text>
    </PressableScale>
  );
}

function RecentAttempts({ track, attempts }: { track: LearningTrack; attempts: LearningAttempt[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const recent = attempts
    .filter((attempt) => attempt.trackSlug === track.slug)
    .slice(-8)
    .reverse();
  const questionMap = new Map(track.questions.map((question) => [question.key, question]));
  if (recent.length === 0) {
    return (
      <View style={styles.emptyRecords}>
        <ThemedIcon name="stats-chart-outline" size={24} color={colors.textMuted} />
        <Text style={styles.emptyRecordsTitle}>还没有练习记录</Text>
        <Text style={styles.emptyRecordsText}>从今日练习开始，完成后会在这里显示结果。</Text>
      </View>
    );
  }
  return (
    <View style={styles.recentList}>
      <Text style={styles.recentTitle}>最近练习</Text>
      {recent.map((attempt, index) => (
        <View key={`${attempt.questionKey}-${attempt.createdAt}-${index}`} style={styles.recentRow}>
          <View style={[styles.resultDot, { backgroundColor: attempt.isCorrect ? colors.success : colors.danger }]} />
          <Text style={styles.recentQuestion} numberOfLines={1}>
            {questionMap.get(attempt.questionKey)?.stem ?? attempt.questionKey}
          </Text>
          <Text style={[styles.recentResult, { color: attempt.isCorrect ? colors.success : colors.danger }]}>
            {attempt.isCorrect ? "正确" : "需复习"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function HeroStat({ value, label, color }: { value: string; label: string; color: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.heroStat}>
      <Text style={[styles.heroStatValue, { color }]}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function RecordStat({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.recordStat}>
      <Text style={styles.recordStatValue}>{value}</Text>
      <Text style={styles.recordStatLabel}>{label}</Text>
    </View>
  );
}

function ProgressMeter({ value, color, track }: { value: number; color: string; track: string }) {
  return (
    <View style={[meterStyles.track, { backgroundColor: track }]}>
      <View style={[meterStyles.fill, { backgroundColor: color, width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

function MissingTrack({ colors }: { colors: ThemeColors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.missing}>
      <ThemedIcon name="alert-circle" size={28} color={colors.textMuted} />
      <Text style={styles.missingTitle}>没有找到这个技术方向</Text>
      <PressableScale haptic onPress={() => router.replace("/quiz" as never)} style={styles.missingButton}>
        <Text style={styles.missingButtonText}>返回题库</Text>
      </PressableScale>
    </View>
  );
}

function stageIndex(track: LearningTrack, stageKey: string): string {
  return String(track.stages.findIndex((stage) => stage.key === stageKey) + 1).padStart(2, "0");
}

const meterStyles = StyleSheet.create({
  track: { height: 7, borderRadius: 999, overflow: "hidden", width: "100%" },
  fill: { height: "100%", borderRadius: 999 },
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.lg },
    hero: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md, ...shadows.card },
    heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    heroIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    heroTags: { flex: 1, gap: 2 },
    heroCategory: { ...typography.micro, letterSpacing: 0.5 },
    heroMeta: { ...typography.caption, color: colors.textMuted },
    heroSummary: { ...typography.body, color: colors.textSecondary },
    heroStats: { flexDirection: "row", alignItems: "center" },
    heroStat: { flex: 1, gap: 1 },
    heroStatValue: { ...typography.title2 },
    heroStatLabel: { ...typography.micro, color: colors.textMuted },
    heroDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: colors.borderStrong, marginHorizontal: spacing.sm },
    heroCta: {
      minHeight: 48,
      borderRadius: radius.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    heroCtaText: { ...typography.callout, color: "#FFFFFF", fontWeight: "700" },
    segmented: {
      flexDirection: "row",
      padding: 4,
      borderRadius: radius.md + 2,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    segment: { flex: 1, minHeight: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    segmentActive: { backgroundColor: colors.surfaceStrong, ...shadows.card },
    segmentText: { ...typography.caption, color: colors.textMuted },
    segmentTextActive: { color: colors.text, fontWeight: "700" },
    sectionList: { gap: spacing.md },
    knowledgeIntro: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      ...shadows.card,
    },
    knowledgeIntroIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    knowledgeIntroBody: { flex: 1, gap: 3 },
    knowledgeIntroTitle: { ...typography.headline, color: colors.text },
    knowledgeIntroText: { ...typography.callout, color: colors.textSecondary },
    knowledgeCard: {
      minHeight: 148,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    knowledgeNumber: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    knowledgeNumberText: { ...typography.caption, fontWeight: "800" },
    knowledgeBody: { flex: 1, gap: 4 },
    knowledgeTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    knowledgeEyebrow: { ...typography.micro, letterSpacing: 0.7 },
    knowledgeMeta: { ...typography.micro, color: colors.textMuted },
    knowledgeTitle: { ...typography.title2, color: colors.text },
    knowledgeGoal: { ...typography.callout, color: colors.textSecondary },
    knowledgeTopics: { ...typography.caption, color: colors.textMuted },
    knowledgeCta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
    knowledgeCtaText: { ...typography.callout, fontWeight: "700" },
    learningGuide: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: spacing.sm, ...shadows.card },
    learningGuideTitle: { ...typography.headline, color: colors.text },
    guideRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
    guideIndex: { ...typography.micro, color: colors.primary, width: 16, marginTop: 2 },
    guideText: { flex: 1, ...typography.callout, color: colors.textSecondary },
    stageCard: {
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    stageCardOpen: { borderColor: colors.borderStrong },
    stageHead: { minHeight: 84, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
    stageNumber: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    stageNumberText: { ...typography.caption, fontWeight: "800" },
    stageBody: { flex: 1, gap: 2 },
    stageTitle: { ...typography.headline, color: colors.text },
    stageWeeks: { ...typography.caption, color: colors.textMuted },
    stageExpanded: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    outcomeBox: { marginTop: spacing.md, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceMuted, gap: 4 },
    outcomeLabel: { ...typography.micro, color: colors.primary },
    outcomeText: { ...typography.callout, color: colors.text },
    outcomeResult: { ...typography.caption, color: colors.textMuted },
    topicShell: { borderRadius: radius.md, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    topicHead: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
    topicBullet: { width: 7, height: 7, borderRadius: 999, backgroundColor: colors.primary },
    topicBody: { flex: 1, gap: 2 },
    topicTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    topicSummary: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    topicDetails: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
    detailBlock: { gap: 5 },
    detailTitle: { ...typography.micro, color: colors.primary },
    detailRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    detailDot: { width: 4, height: 4, borderRadius: 999, backgroundColor: colors.primary, marginTop: 7 },
    detailText: { flex: 1, ...typography.caption, fontWeight: "400", color: colors.textSecondary },
    methodCard: { borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.primarySoft, gap: 4 },
    methodLabel: { ...typography.micro, color: colors.primary },
    methodText: { ...typography.caption, fontWeight: "400", color: colors.textSecondary },
    exerciseCard: { borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceStrong, gap: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    exerciseLabel: { ...typography.micro, color: colors.accent },
    exerciseText: { ...typography.caption, fontWeight: "400", color: colors.textSecondary },
    checkpointText: { ...typography.micro, color: colors.success, marginTop: 2 },
    topicPracticeButton: { minHeight: 40, marginTop: spacing.sm, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.primary },
    topicPracticeButtonText: { ...typography.caption, color: "#FFFFFF", fontWeight: "700" },
    stageCta: { minHeight: 44, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
    stageCtaText: { ...typography.callout, color: "#FFFFFF", fontWeight: "700" },
    bankSummary: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: 4, ...shadows.card },
    bankTitle: { ...typography.headline, color: colors.text },
    bankText: { ...typography.callout, color: colors.textSecondary },
    practiceCard: {
      minHeight: 84,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      ...shadows.card,
    },
    practiceCardDisabled: { opacity: 0.5 },
    practiceIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    practiceBody: { flex: 1, gap: 2 },
    practiceTitle: { ...typography.headline, color: colors.text },
    practiceDesc: { ...typography.caption, color: colors.textMuted },
    practiceMeta: { ...typography.caption, fontWeight: "700" },
    stageBankLabel: { ...typography.headline, color: colors.text, marginTop: spacing.sm },
    stageBank: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceStrong, borderRadius: radius.md, ...shadows.card },
    stageBankIndex: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    stageBankIndexText: { ...typography.caption, fontWeight: "800" },
    stageBankBody: { flex: 1, gap: 2 },
    stageBankTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    stageBankMeta: { ...typography.caption, color: colors.textMuted },
    recordHero: { borderRadius: radius.xl, padding: spacing.xl, backgroundColor: colors.surfaceStrong, gap: spacing.sm, ...shadows.card },
    recordValue: { ...typography.display, color: colors.text },
    recordLabel: { ...typography.callout, color: colors.textMuted },
    recordGrid: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    masteryBasis: { ...typography.micro, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 15 },
    recordStat: { flex: 1, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceMuted, gap: 2 },
    recordStatValue: { ...typography.title2, color: colors.text },
    recordStatLabel: { ...typography.micro, color: colors.textMuted },
    recentList: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: spacing.md, ...shadows.card },
    recentTitle: { ...typography.headline, color: colors.text },
    recentRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    resultDot: { width: 7, height: 7, borderRadius: 999 },
    recentQuestion: { flex: 1, ...typography.caption, color: colors.textSecondary },
    recentResult: { ...typography.micro },
    emptyRecords: { alignItems: "center", gap: spacing.sm, padding: 32, borderRadius: radius.lg, backgroundColor: colors.surfaceStrong, ...shadows.card },
    emptyRecordsTitle: { ...typography.headline, color: colors.text },
    emptyRecordsText: { ...typography.callout, textAlign: "center", color: colors.textMuted },
    missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
    missingTitle: { ...typography.title2, color: colors.text },
    missingButton: { minHeight: 44, paddingHorizontal: spacing.xl, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
    missingButtonText: { ...typography.callout, color: "#FFFFFF", fontWeight: "700" },
  });
