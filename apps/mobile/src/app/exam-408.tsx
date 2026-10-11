import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import Animated from "react-native-reanimated";
import {
  getLearningTrack,
  type LearningStage,
  type LearningTrack,
} from "@learn-workbench/content";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import {
  ScreenHeaderLargeTitle,
  ScreenHeaderStickyBar,
  useLargeTitleHeader,
} from "@/components/screen-header";
import {
  getExam408Overview,
  type Exam408Overview,
} from "@/lib/exam-408";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import {
  radius,
  shadows,
  spacing,
  typography,
  type ThemeColors,
} from "@/theme/tokens";

type ExamTab = "knowledge" | "practice" | "papers";

const TRACK_SLUG = "ex-408-grad";

const SUBJECT_TONES: Record<string, { color: string; soft: string; icon: string }> = {
  "数据结构": {
    color: "#2563EB",
    soft: "#DBEAFE",
    icon: "git-network-outline",
  },
  "计算机组成原理": {
    color: "#7C3AED",
    soft: "#EDE9FE",
    icon: "hardware-chip-outline",
  },
  "操作系统": {
    color: "#B45309",
    soft: "#FEF3C7",
    icon: "apps-outline",
  },
  "计算机网络": {
    color: "#0F766E",
    soft: "#CCFBF1",
    icon: "share-social-outline",
  },
};

export default function Exam408Screen() {
  const track = getLearningTrack(TRACK_SLUG);
  if (!track) return <MissingExam408 />;
  return <Exam408Content track={track} />;
}

function Exam408Content({ track }: { track: LearningTrack }) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const [tab, setTab] = useState<ExamTab>("knowledge");
  const [overview, setOverview] = useState<Exam408Overview | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [subjectKey, setSubjectKey] = useState(track.stages[0]?.key ?? "");

  const loadOverview = useCallback(async () => {
    setLoadingPapers(true);
    setOverviewError("");
    try {
      setOverview(await getExam408Overview());
    } catch (reason) {
      setOverviewError(reason instanceof Error ? reason.message : "历年真题加载失败");
    } finally {
      setLoadingPapers(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOverview();
    }, [loadOverview])
  );

  const subjects = track.stages;
  const activeSubject =
    subjects.find((subject) => subject.key === subjectKey) ?? subjects[0] ?? null;
  const papers = useMemo(
    () => [...(overview?.papers ?? [])].sort((left, right) => right.year - left.year),
    [overview?.papers]
  );
  const chapterCount = subjects.reduce(
    (total, subject) => total + subject.topics.length,
    0
  );
  const pointCount = subjects.reduce(
    (total, subject) =>
      total +
      subject.topics.reduce(
        (topicTotal, topic) => topicTotal + topic.concepts.length,
        0
      ),
    0
  );
  const paperCount = overview?.stats.papers ?? 18;
  const paperQuestionCount = overview?.stats.questions ?? 846;

  const startTrackPractice = (stageKey?: string, topicKey?: string) => {
    router.push({
      pathname: "/quiz/session",
      params: {
        track: track.slug,
        mode: "stage",
        ...(stageKey ? { stage: stageKey } : {}),
        ...(topicKey ? { topic: topicKey } : {}),
        returnTo: "/exam-408",
      },
    } as never);
  };

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar
        title="408 考研"
        scrollY={header.scrollY}
        backTo="/(tabs)/learn"
      />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeaderLargeTitle
          title="408 考研专区"
          subtitle="四科知识体系 · 章节专项题 · 历年原卷真题"
        />

        <Animated.View entering={entrance(0)} style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <ThemedIcon name="school-outline" size={27} color={colors.primary} />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroEyebrow}>POSTGRADUATE EXAM</Text>
              <Text style={styles.heroTitle}>计算机学科专业基础</Text>
              <Text style={styles.heroText}>
                按章节建立知识框架，再用专项题和整卷真题逐层验收。
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <HeroStat value={String(chapterCount)} label="章" styles={styles} />
            <HeroStat value={String(pointCount)} label="知识点" styles={styles} />
            <HeroStat value={String(track.questions.length)} label="专项题" styles={styles} />
            <HeroStat value={String(paperCount)} label="套真题" styles={styles} />
          </View>
        </Animated.View>

        <Animated.View entering={entrance(1)} style={styles.tabs}>
          <TabButton
            active={tab === "knowledge"}
            icon="library-outline"
            label="知识体系"
            meta={`${chapterCount} 章`}
            onPress={() => setTab("knowledge")}
          />
          <TabButton
            active={tab === "practice"}
            icon="create-outline"
            label="章节题库"
            meta={`${track.questions.length} 题`}
            onPress={() => setTab("practice")}
          />
          <TabButton
            active={tab === "papers"}
            icon="document-text-outline"
            label="历年真题"
            meta={`${paperCount} 套`}
            onPress={() => setTab("papers")}
          />
        </Animated.View>

        {tab === "knowledge" ? (
          <KnowledgeTab
            track={track}
            subjects={subjects}
            activeSubject={activeSubject}
            subjectKey={subjectKey}
            onSubjectChange={setSubjectKey}
          />
        ) : null}

        {tab === "practice" ? (
          <PracticeTab
            track={track}
            subjects={subjects}
            activeSubject={activeSubject}
            subjectKey={subjectKey}
            onSubjectChange={setSubjectKey}
            onStart={startTrackPractice}
          />
        ) : null}

        {tab === "papers" ? (
          <PapersTab
            styles={styles}
            colors={colors}
            papers={papers}
            paperQuestionCount={paperQuestionCount}
            loading={loadingPapers}
            error={overviewError}
            onRetry={() => void loadOverview()}
          />
        ) : null}

        <View style={styles.sourceBox}>
          <Text style={styles.sourceTitle}>内容说明</Text>
          <Text style={styles.sourceText}>
            知识体系与专项题来自项目内 408 精选内容；历年原卷来自公开站点快照，仅用于个人学习。
          </Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function KnowledgeTab({
  track,
  subjects,
  activeSubject,
  subjectKey,
  onSubjectChange,
}: {
  track: LearningTrack;
  subjects: LearningStage[];
  activeSubject: LearningStage | null;
  subjectKey: string;
  onSubjectChange: (key: string) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);

  return (
    <View style={styles.sectionList}>
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionTitle}>四科知识体系</Text>
          <Text style={styles.sectionText}>先选科目，再进入章节查看完整知识点</Text>
        </View>
        <Text style={styles.sectionCount}>{subjects.length} 科</Text>
      </View>

      <SubjectRail
        subjects={subjects}
        subjectKey={subjectKey}
        onSubjectChange={onSubjectChange}
      />

      {activeSubject ? (
        <>
          <SubjectSummary
            track={track}
            subject={activeSubject}
            chapterLabel="章"
            pointLabel="个知识点"
          />
          <View style={styles.chapterList}>
            {activeSubject.topics.map((topic, index) => {
              const questionCount = track.questions.filter(
                (question) =>
                  question.stageKey === activeSubject.key &&
                  question.topicKey === topic.key
              ).length;
              return (
                <PressableScale
                  key={topic.key}
                  haptic
                  scaleTo={0.985}
                  onPress={() =>
                    router.push({
                      pathname: "/quiz/chapter",
                      params: {
                        track: track.slug,
                        stage: activeSubject.key,
                        returnTo: "/exam-408",
                      },
                    } as never)
                  }
                  style={styles.chapterCard}
                >
                  <View
                    style={[
                      styles.chapterNumber,
                      { backgroundColor: subjectTone(activeSubject, dark).soft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chapterNumberText,
                        { color: subjectTone(activeSubject, dark).color },
                      ]}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                  </View>
                  <View style={styles.chapterBody}>
                    <Text style={styles.chapterTitle}>{topic.title}</Text>
                    <Text style={styles.chapterSummary} numberOfLines={2}>
                      {topic.summary}
                    </Text>
                    <View style={styles.chapterMetaRow}>
                      <Text style={styles.chapterMeta}>
                        {topic.concepts.length} 个知识点
                      </Text>
                      <View style={styles.metaDot} />
                      <Text style={styles.chapterMeta}>{questionCount} 道题</Text>
                    </View>
                  </View>
                  <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
                </PressableScale>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

function PracticeTab({
  track,
  subjects,
  activeSubject,
  subjectKey,
  onSubjectChange,
  onStart,
}: {
  track: LearningTrack;
  subjects: LearningStage[];
  activeSubject: LearningStage | null;
  subjectKey: string;
  onSubjectChange: (key: string) => void;
  onStart: (stageKey?: string, topicKey?: string) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const activeQuestions = activeSubject
    ? track.questions.filter((question) => question.stageKey === activeSubject.key)
    : [];

  return (
    <View style={styles.sectionList}>
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionTitle}>章节题库</Text>
          <Text style={styles.sectionText}>可按科目整套练，也可精练某一章</Text>
        </View>
        <Text style={styles.sectionCount}>{track.questions.length} 题</Text>
      </View>

      <PressableScale
        haptic
        scaleTo={0.985}
        onPress={() => onStart()}
        style={styles.primaryPractice}
      >
        <View style={styles.primaryPracticeIcon}>
          <ThemedIcon name="play" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.primaryPracticeBody}>
          <Text style={styles.primaryPracticeTitle}>全科专项练习</Text>
          <Text style={styles.primaryPracticeText}>
            从四科章节题中按顺序练习
          </Text>
        </View>
        <Text style={styles.primaryPracticeMeta}>{track.questions.length} 题</Text>
      </PressableScale>

      <View style={styles.practiceModeGrid}>
        <PracticeMode
          icon="refresh"
          title="错题复习"
          text="回练薄弱知识点"
          onPress={() => router.push("/quiz/review" as never)}
        />
        <PracticeMode
          icon="repeat"
          title="复习队列"
          text="按间隔安排复习"
          onPress={() => router.push("/quiz/review" as never)}
        />
      </View>

      <SubjectRail
        subjects={subjects}
        subjectKey={subjectKey}
        onSubjectChange={onSubjectChange}
      />

      {activeSubject ? (
        <>
          <SubjectSummary
            track={track}
            subject={activeSubject}
            chapterLabel="章"
            pointLabel="知识点"
          />
          <PressableScale
            haptic
            scaleTo={0.98}
            onPress={() => onStart(activeSubject.key)}
            style={[
              styles.subjectPracticeButton,
              { backgroundColor: subjectTone(activeSubject, dark).color },
            ]}
          >
            <ThemedIcon name="play-circle-outline" size={19} color="#FFFFFF" />
            <Text style={styles.subjectPracticeText}>
              练习{activeSubject.title}全部章节
            </Text>
            <Text style={styles.subjectPracticeMeta}>{activeQuestions.length} 题</Text>
          </PressableScale>

          <View style={styles.chapterList}>
            {activeSubject.topics.map((topic, index) => {
              const questionCount = activeQuestions.filter(
                (question) => question.topicKey === topic.key
              ).length;
              return (
                <PressableScale
                  key={topic.key}
                  haptic
                  scaleTo={0.985}
                  onPress={() => onStart(activeSubject.key, topic.key)}
                  style={styles.practiceChapterRow}
                >
                  <View style={styles.practiceChapterIndex}>
                    <Text style={styles.practiceChapterIndexText}>
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                  </View>
                  <View style={styles.practiceChapterBody}>
                    <Text style={styles.practiceChapterTitle}>{topic.title}</Text>
                    <Text style={styles.practiceChapterText} numberOfLines={1}>
                      {topic.concepts.slice(0, 4).join(" · ")}
                    </Text>
                  </View>
                  <View style={styles.practiceCount}>
                    <Text style={styles.practiceCountValue}>{questionCount}</Text>
                    <Text style={styles.practiceCountLabel}>题</Text>
                  </View>
                  <ThemedIcon name="chevron-forward" size={17} color={colors.textFaint} />
                </PressableScale>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

function PapersTab({
  styles,
  colors,
  papers,
  paperQuestionCount,
  loading,
  error,
  onRetry,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  papers: Exam408Overview["papers"];
  paperQuestionCount: number;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.stateText}>正在加载历年真题…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateBox}>
        <ThemedIcon name="alert-circle-outline" size={25} color={colors.danger} />
        <Text style={styles.stateTitle}>历年真题加载失败</Text>
        <Text style={styles.stateText}>{error}</Text>
        <PressableScale haptic onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>重试</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={styles.sectionList}>
      <View style={styles.paperHero}>
        <View style={styles.paperHeroIcon}>
          <ThemedIcon name="documents-outline" size={24} color={colors.primary} />
        </View>
        <View style={styles.paperHeroBody}>
          <Text style={styles.paperHeroTitle}>2009–2026 历年真题</Text>
          <Text style={styles.paperHeroText}>
            {papers.length} 套整卷 · {paperQuestionCount} 道原题，保留题型、题号与分值
          </Text>
        </View>
      </View>

      <View style={styles.paperGrid}>
        {papers.map((paper, index) => (
          <PressableScale
            key={paper.year}
            haptic
            scaleTo={0.985}
            onPress={() => router.push(`/quiz/paper/${paper.year}` as never)}
            style={[styles.paperCard, index === 0 && styles.paperCardLatest]}
          >
            {index === 0 ? <Text style={styles.latestBadge}>最新</Text> : null}
            <Text style={styles.paperYear}>{paper.year}</Text>
            <Text style={styles.paperTitle} numberOfLines={1}>
              {paper.title}
            </Text>
            <Text style={styles.paperMeta}>
              {paper.questionCount} 题 · {paper.totalScore} 分
            </Text>
            <View style={styles.paperCta}>
              <Text style={styles.paperCtaText}>选择题型开始刷</Text>
              <ThemedIcon name="chevron-forward" size={14} color={colors.primary} />
            </View>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

function SubjectRail({
  subjects,
  subjectKey,
  onSubjectChange,
}: {
  subjects: LearningStage[];
  subjectKey: string;
  onSubjectChange: (key: string) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.subjectRail}
    >
      {subjects.map((subject) => {
        const active = subject.key === subjectKey;
        const tone = subjectTone(subject, dark);
        const pointCount = subject.topics.reduce(
          (total, topic) => total + topic.concepts.length,
          0
        );
        return (
          <PressableScale
            key={subject.key}
            haptic
            scaleTo={0.98}
            onPress={() => onSubjectChange(subject.key)}
            style={[
              styles.subjectChip,
              active && {
                backgroundColor: tone.soft,
                borderColor: tone.color,
              },
            ]}
          >
            <View style={[styles.subjectChipIcon, { backgroundColor: tone.soft }]}>
              <ThemedIcon name={tone.icon as never} size={18} color={tone.color} />
            </View>
            <View style={styles.subjectChipBody}>
              <Text style={[styles.subjectChipTitle, active && { color: tone.color }]}>
                {subject.title}
              </Text>
              <Text style={styles.subjectChipMeta}>
                {subject.topics.length} 章 · {pointCount} 点
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </Animated.ScrollView>
  );
}

function SubjectSummary({
  track,
  subject,
  chapterLabel,
  pointLabel,
}: {
  track: LearningTrack;
  subject: LearningStage;
  chapterLabel: string;
  pointLabel: string;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const pointCount = subject.topics.reduce(
    (total, topic) => total + topic.concepts.length,
    0
  );
  const questionCount = track.questions.filter(
    (question) => question.stageKey === subject.key
  ).length;
  const tone = subjectTone(subject, dark);
  return (
    <View style={styles.subjectSummary}>
      <View style={[styles.subjectSummaryIcon, { backgroundColor: tone.soft }]}>
        <ThemedIcon name={tone.icon as never} size={22} color={tone.color} />
      </View>
      <View style={styles.subjectSummaryBody}>
        <Text style={styles.subjectSummaryTitle}>{subject.title}</Text>
        <Text style={styles.subjectSummaryText} numberOfLines={2}>
          {subject.goal}
        </Text>
      </View>
      <View style={styles.subjectSummaryMeta}>
        <Text style={styles.subjectSummaryValue}>
          {subject.topics.length} {chapterLabel}
        </Text>
        <Text style={styles.subjectSummaryValue}>
          {pointCount} {pointLabel}
        </Text>
        <Text style={styles.subjectSummaryMuted}>{questionCount} 题</Text>
      </View>
    </View>
  );
}

function TabButton({
  active,
  icon,
  label,
  meta,
  onPress,
}: {
  active: boolean;
  icon: string;
  label: string;
  meta: string;
  onPress: () => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <PressableScale
      haptic
      scaleTo={0.97}
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <ThemedIcon
        name={icon as never}
        size={18}
        color={active ? colors.primary : colors.textMuted}
      />
      <Text style={[styles.tabButtonLabel, active && styles.tabButtonLabelActive]}>
        {label}
      </Text>
      <Text style={styles.tabButtonMeta}>{meta}</Text>
    </PressableScale>
  );
}

function PracticeMode({
  icon,
  title,
  text,
  onPress,
}: {
  icon: string;
  title: string;
  text: string;
  onPress: () => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <PressableScale haptic scaleTo={0.98} onPress={onPress} style={styles.practiceMode}>
      <View style={styles.practiceModeIcon}>
        <ThemedIcon name={icon as never} size={19} color={colors.primary} />
      </View>
      <Text style={styles.practiceModeTitle}>{title}</Text>
      <Text style={styles.practiceModeText}>{text}</Text>
    </PressableScale>
  );
}

function HeroStat({
  value,
  label,
  styles,
}: {
  value: string;
  label: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function MissingExam408() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <View style={styles.missing}>
      <ThemedIcon name="school-outline" size={28} color={colors.textMuted} />
      <Text style={styles.missingTitle}>408 内容暂时不可用</Text>
      <PressableScale
        haptic
        onPress={() => router.replace("/(tabs)/learn" as never)}
        style={styles.retryButton}
      >
        <Text style={styles.retryButtonText}>返回学习页</Text>
      </PressableScale>
    </View>
  );
}

function subjectTone(subject: LearningStage, dark: boolean) {
  const tone = SUBJECT_TONES[subject.title] ?? {
    color: "#0F766E",
    soft: "#CCFBF1",
    icon: "school-outline",
  };
  return dark ? { ...tone, soft: tone.color + "25" } : tone;
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.lg },
    hero: {
      overflow: "hidden",
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.lg,
      backgroundColor: dark ? "#123A36" : "#E2F3EF",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: dark ? "#2F7F7450" : "#196B6335",
      ...shadows.brand,
    },
    heroGlow: {
      position: "absolute",
      right: -44,
      top: -58,
      width: 170,
      height: 170,
      borderRadius: 999,
      backgroundColor: "#F7C95C33",
    },
    heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    heroBody: { flex: 1, gap: 3 },
    heroEyebrow: {
      ...typography.micro,
      letterSpacing: 0.8,
      color: dark ? "#73D4C6" : "#196B63",
    },
    heroTitle: { ...typography.title2, color: colors.text },
    heroText: { ...typography.caption, color: colors.textSecondary },
    heroStats: { flexDirection: "row", gap: spacing.sm },
    heroStat: { flex: 1, gap: 1 },
    heroStatValue: {
      ...typography.title2,
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    heroStatLabel: { ...typography.micro, color: colors.textMuted },
    tabs: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    tabButton: {
      flex: 1,
      minHeight: 68,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      borderRadius: radius.md,
      paddingHorizontal: 4,
    },
    tabButtonActive: {
      backgroundColor: colors.surfaceStrong,
      ...shadows.card,
    },
    tabButtonLabel: { ...typography.caption, fontWeight: "800", color: colors.textMuted },
    tabButtonLabelActive: { color: colors.primary },
    tabButtonMeta: { ...typography.micro, color: colors.textFaint },
    sectionList: { gap: spacing.md },
    sectionHead: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    sectionTitle: { ...typography.title2, color: colors.text },
    sectionText: { ...typography.caption, color: colors.textMuted },
    sectionCount: { ...typography.caption, color: colors.textMuted },
    subjectRail: { gap: spacing.sm, paddingRight: spacing.lg },
    subjectChip: {
      minWidth: 168,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    subjectChipIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    subjectChipBody: { flex: 1, gap: 2 },
    subjectChipTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    subjectChipMeta: { ...typography.micro, color: colors.textMuted },
    subjectSummary: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    subjectSummaryIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    subjectSummaryBody: { flex: 1, gap: 2 },
    subjectSummaryTitle: { ...typography.headline, color: colors.text },
    subjectSummaryText: { ...typography.caption, color: colors.textMuted },
    subjectSummaryMeta: { alignItems: "flex-end", gap: 2 },
    subjectSummaryValue: { ...typography.micro, fontWeight: "800", color: colors.textSecondary },
    subjectSummaryMuted: { ...typography.micro, color: colors.textFaint },
    chapterList: { gap: spacing.md },
    chapterCard: {
      minHeight: 112,
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
    chapterNumber: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    chapterNumberText: { ...typography.caption, fontWeight: "900" },
    chapterBody: { flex: 1, gap: 3 },
    chapterTitle: { ...typography.headline, color: colors.text },
    chapterSummary: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
    chapterMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    chapterMeta: { ...typography.micro, fontWeight: "700", color: colors.textMuted },
    metaDot: { width: 3, height: 3, borderRadius: 999, backgroundColor: colors.textFaint },
    primaryPractice: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.primary,
      ...shadows.brand,
    },
    primaryPracticeIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFFFFF22",
    },
    primaryPracticeBody: { flex: 1, gap: 2 },
    primaryPracticeTitle: { ...typography.headline, color: "#FFFFFF" },
    primaryPracticeText: { ...typography.caption, color: "#FFFFFFCC" },
    primaryPracticeMeta: { ...typography.caption, fontWeight: "900", color: "#FFFFFF" },
    practiceModeGrid: { flexDirection: "row", gap: spacing.md },
    practiceMode: {
      flex: 1,
      minHeight: 116,
      gap: 5,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    practiceModeIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    practiceModeTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    practiceModeText: { ...typography.caption, color: colors.textMuted },
    subjectPracticeButton: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
    },
    subjectPracticeText: { flex: 1, ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
    subjectPracticeMeta: { ...typography.caption, fontWeight: "800", color: "#FFFFFFCC" },
    practiceChapterRow: {
      minHeight: 78,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    practiceChapterIndex: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    practiceChapterIndexText: {
      ...typography.caption,
      fontWeight: "900",
      color: colors.textSecondary,
    },
    practiceChapterBody: { flex: 1, gap: 3 },
    practiceChapterTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    practiceChapterText: { ...typography.micro, color: colors.textMuted },
    practiceCount: { alignItems: "flex-end" },
    practiceCountValue: {
      ...typography.headline,
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
    practiceCountLabel: { ...typography.micro, color: colors.textFaint },
    paperHero: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.primarySoft,
    },
    paperHeroIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    paperHeroBody: { flex: 1, gap: 2 },
    paperHeroTitle: { ...typography.headline, color: colors.text },
    paperHeroText: { ...typography.caption, color: colors.textSecondary },
    paperGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    paperCard: {
      width: "48%",
      minHeight: 148,
      gap: 4,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    paperCardLatest: { borderColor: colors.primary + "66" },
    latestBadge: {
      alignSelf: "flex-start",
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.primary,
      color: "#FFFFFF",
      ...typography.micro,
      fontWeight: "900",
    },
    paperYear: {
      ...typography.title1,
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    paperTitle: { ...typography.caption, color: colors.textSecondary },
    paperMeta: { ...typography.micro, color: colors.textMuted },
    paperCta: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: "auto" },
    paperCtaText: { ...typography.micro, fontWeight: "800", color: colors.primary },
    stateBox: {
      minHeight: 220,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderRadius: radius.lg,
      padding: spacing.xl,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    stateTitle: { ...typography.headline, color: colors.text },
    stateText: { ...typography.callout, color: colors.textMuted, textAlign: "center" },
    retryButton: {
      minHeight: 44,
      marginTop: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.primary,
    },
    retryButtonText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
    sourceBox: {
      gap: 4,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sourceTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    sourceText: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },
    missing: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      padding: spacing.xl,
      backgroundColor: colors.canvas,
    },
    missingTitle: { ...typography.title2, color: colors.text },
  });
