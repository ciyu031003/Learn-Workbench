import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import Animated from "react-native-reanimated";
import type { LearningTrack } from "@learn-workbench/content/types";
import { useLearningTrack } from "@/lib/content-store";
import { BottomSheet } from "@/components/bottom-sheet";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import {
  ScreenHeaderLargeTitle,
  ScreenHeaderStickyBar,
  useLargeTitleHeader,
} from "@/components/screen-header";
import {
  getExam408Overview,
  type Exam408ChapterSummary,
  type Exam408Overview,
  type Exam408PointSummary,
  type Exam408SubjectSummary,
} from "@/lib/exam-408";
import {
  exam408ChapterPreview,
  exam408DisplayTags,
  exam408OverviewStats,
  resolveExam408Subject,
} from "@/lib/exam-408-view";
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
type BrowserMode = "knowledge" | "practice";

type ChapterSheetSnapshot = {
  subject: Exam408SubjectSummary;
  chapter: Exam408ChapterSummary;
};

const TRACK_SLUG = "ex-408-grad";

const SUBJECT_TONES: Record<
  string,
  { color: string; soft: string; icon: string }
> = {
  数据结构: {
    color: "#2563EB",
    soft: "#DBEAFE",
    icon: "git-network-outline",
  },
  计算机组成原理: {
    color: "#7C3AED",
    soft: "#EDE9FE",
    icon: "hardware-chip-outline",
  },
  操作系统: {
    color: "#B45309",
    soft: "#FEF3C7",
    icon: "apps-outline",
  },
  计算机网络: {
    color: "#0F766E",
    soft: "#CCFBF1",
    icon: "share-social-outline",
  },
};

export default function Exam408Screen() {
  const track = useLearningTrack(TRACK_SLUG);
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
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [subjectKey, setSubjectKey] = useState("");
  const [chapterSheetOpen, setChapterSheetOpen] = useState(false);
  const [chapterSheetSnapshot, setChapterSheetSnapshot] =
    useState<ChapterSheetSnapshot | null>(null);
  const [pendingPointKey, setPendingPointKey] = useState("");

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setOverviewError("");
    try {
      setOverview(await getExam408Overview());
    } catch (reason) {
      setOverviewError(
        reason instanceof Error ? reason.message : "408 权威数据加载失败",
      );
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOverview();
    }, [loadOverview]),
  );

  const stats = exam408OverviewStats(overview);
  const activeSubject = resolveExam408Subject(overview, subjectKey);
  const papers = useMemo(
    () =>
      [...(overview?.papers ?? [])].sort(
        (left, right) => right.year - left.year,
      ),
    [overview?.papers],
  );

  const openChapter = (
    subject: Exam408SubjectSummary,
    chapter: Exam408ChapterSummary,
  ) => {
    setPendingPointKey("");
    setChapterSheetSnapshot({ subject, chapter });
    setChapterSheetOpen(true);
  };

  const changeSubject = (key: string) => {
    setSubjectKey(key);
    setChapterSheetOpen(false);
    setPendingPointKey("");
  };

  const openPoint = (key: string) => {
    setPendingPointKey(key);
    setChapterSheetOpen(false);
  };

  const handleSheetClosed = useCallback(() => {
    const pointKey = pendingPointKey;
    setChapterSheetSnapshot(null);
    setPendingPointKey("");
    if (!pointKey) return;
    router.push({
      pathname: "/quiz/408-point",
      params: { key: pointKey },
    } as never);
  }, [pendingPointKey]);

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
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarSpace + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeaderLargeTitle
          title="408 考研专区"
          subtitle="四科完整知识体系 · 章节真题 · 2009-2026 历年试卷"
        />

        <Animated.View entering={entrance(0)} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <ThemedIcon
                name="school-outline"
                size={27}
                color={colors.primary}
              />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroEyebrow}>POSTGRADUATE EXAM</Text>
              <Text style={styles.heroTitle}>计算机学科专业基础</Text>
              <Text style={styles.heroText}>
                按科目、章节和知识点逐层进入，直接阅读关联真题或切换历年整卷。
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <HeroStat value={String(stats.subjects)} label="科目" styles={styles} />
            <HeroStat value={String(stats.chapters)} label="章节" styles={styles} />
            <HeroStat value={String(stats.points)} label="知识点" styles={styles} />
            <HeroStat value={String(stats.papers)} label="套真题" styles={styles} />
          </View>
        </Animated.View>

        <Animated.View entering={entrance(1)} style={styles.tabs}>
          <TabButton
            active={tab === "knowledge"}
            icon="library-outline"
            label="知识体系"
            meta={`${stats.chapters} 章`}
            onPress={() => setTab("knowledge")}
          />
          <TabButton
            active={tab === "practice"}
            icon="create-outline"
            label="章节题库"
            meta={`${stats.questions} 题`}
            onPress={() => setTab("practice")}
          />
          <TabButton
            active={tab === "papers"}
            icon="document-text-outline"
            label="历年真题"
            meta={`${stats.papers} 套`}
            onPress={() => setTab("papers")}
          />
        </Animated.View>

        {tab === "knowledge" ? (
          <KnowledgeTab
            overview={overview}
            loading={loadingOverview}
            error={overviewError}
            activeSubject={activeSubject}
            subjectKey={subjectKey}
            onRetry={() => void loadOverview()}
            onSubjectChange={changeSubject}
            onOpenChapter={openChapter}
          />
        ) : null}

        {tab === "practice" ? (
          <PracticeTab
            track={track}
            overview={overview}
            loading={loadingOverview}
            error={overviewError}
            activeSubject={activeSubject}
            subjectKey={subjectKey}
            onRetry={() => void loadOverview()}
            onSubjectChange={changeSubject}
            onOpenChapter={openChapter}
            onStartTrackPractice={startTrackPractice}
            onOpenPapers={() => setTab("papers")}
          />
        ) : null}

        {tab === "papers" ? (
          <PapersTab
            styles={styles}
            colors={colors}
            papers={papers}
            paperQuestionCount={stats.questions}
            loading={loadingOverview}
            error={overviewError}
            onRetry={() => void loadOverview()}
          />
        ) : null}

        <View style={styles.sourceBox}>
          <Text style={styles.sourceTitle}>内容说明</Text>
          <Text style={styles.sourceText}>
            四科章节、知识点和关联真题来自个人学习快照；历年原卷保留题号、题型和分值，仅用于个人学习。
          </Text>
        </View>
      </Animated.ScrollView>

      <BottomSheet
        visible={chapterSheetOpen}
        onClose={() => setChapterSheetOpen(false)}
        onClosed={handleSheetClosed}
        title={
          chapterSheetSnapshot
            ? `${chapterSheetSnapshot.subject.title} · ${chapterSheetSnapshot.chapter.title}`
            : "章节知识点"
        }
        subtitle={
          chapterSheetSnapshot
            ? `${chapterSheetSnapshot.chapter.points.length} 个知识点 · ${chapterSheetSnapshot.chapter.questionCount} 道关联真题`
            : undefined
        }
        icon="library-outline"
        height="72%"
        expandable
      >
        {chapterSheetSnapshot ? (
          <View style={styles.sheetContent}>
            <View style={styles.sheetLead}>
              <View
                style={[
                  styles.sheetLeadIcon,
                  {
                    backgroundColor: subjectTone(
                      chapterSheetSnapshot.subject,
                      dark,
                    ).soft,
                  },
                ]}
              >
                <ThemedIcon
                  name={
                    subjectTone(chapterSheetSnapshot.subject, dark)
                      .icon as never
                  }
                  size={19}
                  color={subjectTone(chapterSheetSnapshot.subject, dark).color}
                />
              </View>
              <View style={styles.sheetLeadBody}>
                <Text style={styles.sheetLeadTitle}>
                  第 {chapterSheetSnapshot.chapter.chapterNumber} 章
                </Text>
                <Text style={styles.sheetLeadText}>
                  选择一个知识点，查看它的考试标签与关联真题。
                </Text>
              </View>
            </View>

            <View style={styles.pointList}>
              {chapterSheetSnapshot.chapter.points.map((point) => (
                <PointRow
                  key={point.key}
                  point={point}
                  accent={subjectTone(chapterSheetSnapshot.subject, dark).color}
                  onPress={() => openPoint(point.key)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

function KnowledgeTab({
  overview,
  loading,
  error,
  activeSubject,
  subjectKey,
  onRetry,
  onSubjectChange,
  onOpenChapter,
}: {
  overview: Exam408Overview | null;
  loading: boolean;
  error: string;
  activeSubject: Exam408SubjectSummary | null;
  subjectKey: string;
  onRetry: () => void;
  onSubjectChange: (key: string) => void;
  onOpenChapter: (
    subject: Exam408SubjectSummary,
    chapter: Exam408ChapterSummary,
  ) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <View style={styles.sectionList}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionHeadBody}>
          <Text style={styles.sectionTitle}>四科知识体系</Text>
          <Text style={styles.sectionText}>
            先选科目，再打开章节查看完整知识点清单。
          </Text>
        </View>
        <Text style={styles.sectionCount}>
          {overview?.subjects.length ?? 0} 科
        </Text>
      </View>
      <SubjectBrowser
        mode="knowledge"
        overview={overview}
        loading={loading}
        error={error}
        activeSubject={activeSubject}
        subjectKey={subjectKey}
        onRetry={onRetry}
        onSubjectChange={onSubjectChange}
        onOpenChapter={onOpenChapter}
      />
    </View>
  );
}

function PracticeTab({
  track,
  overview,
  loading,
  error,
  activeSubject,
  subjectKey,
  onRetry,
  onSubjectChange,
  onOpenChapter,
  onStartTrackPractice,
  onOpenPapers,
}: {
  track: LearningTrack;
  overview: Exam408Overview | null;
  loading: boolean;
  error: string;
  activeSubject: Exam408SubjectSummary | null;
  subjectKey: string;
  onRetry: () => void;
  onSubjectChange: (key: string) => void;
  onOpenChapter: (
    subject: Exam408SubjectSummary,
    chapter: Exam408ChapterSummary,
  ) => void;
  onStartTrackPractice: (stageKey?: string, topicKey?: string) => void;
  onOpenPapers: () => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <View style={styles.sectionList}>
      <PressableScale
        haptic
        scaleTo={0.985}
        onPress={() => onStartTrackPractice()}
        style={styles.primaryPractice}
      >
        <View style={styles.primaryPracticeIcon}>
          <ThemedIcon name="play" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.primaryPracticeBody}>
          <Text style={styles.primaryPracticeTitle}>408 专项强化</Text>
          <Text style={styles.primaryPracticeText}>
            进入课程配套题库，按技术专题连续练习
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
          icon="document-text-outline"
          title="整卷训练"
          text="按年份完成真题"
          onPress={onOpenPapers}
        />
      </View>

      <View style={styles.sectionHead}>
        <View style={styles.sectionHeadBody}>
          <Text style={styles.sectionTitle}>按章节刷真题</Text>
          <Text style={styles.sectionText}>
            打开章节后，可在知识点层级查看关联原题。
          </Text>
        </View>
        <Text style={styles.sectionCount}>
          {exam408OverviewStats(overview).questions} 题
        </Text>
      </View>
      <SubjectBrowser
        mode="practice"
        overview={overview}
        loading={loading}
        error={error}
        activeSubject={activeSubject}
        subjectKey={subjectKey}
        onRetry={onRetry}
        onSubjectChange={onSubjectChange}
        onOpenChapter={onOpenChapter}
      />
    </View>
  );
}

function SubjectBrowser({
  mode,
  overview,
  loading,
  error,
  activeSubject,
  subjectKey,
  onRetry,
  onSubjectChange,
  onOpenChapter,
}: {
  mode: BrowserMode;
  overview: Exam408Overview | null;
  loading: boolean;
  error: string;
  activeSubject: Exam408SubjectSummary | null;
  subjectKey: string;
  onRetry: () => void;
  onSubjectChange: (key: string) => void;
  onOpenChapter: (
    subject: Exam408SubjectSummary,
    chapter: Exam408ChapterSummary,
  ) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);

  if (loading && !overview) {
    return (
      <StateBox
        styles={styles}
        colors={colors}
        icon="cloud-download-outline"
        title="正在加载 408 知识体系"
        text="同步科目、章节、知识点和真题索引。"
        loading
      />
    );
  }

  if (error && !overview) {
    return (
      <StateBox
        styles={styles}
        colors={colors}
        icon="alert-circle-outline"
        title="408 内容加载失败"
        text={error}
        onRetry={onRetry}
      />
    );
  }

  if (!activeSubject) {
    return (
      <StateBox
        styles={styles}
        colors={colors}
        icon="file-tray-outline"
        title="暂无章节数据"
        text="数据库当前没有可用的 408 科目。"
        onRetry={onRetry}
      />
    );
  }

  return (
    <>
      <SubjectRail
        subjects={overview?.subjects ?? []}
        subjectKey={activeSubject.key}
        onSubjectChange={onSubjectChange}
      />
      <SubjectSummary subject={activeSubject} mode={mode} />
      {activeSubject.chapters.length > 0 ? (
        <View style={styles.chapterList}>
          {activeSubject.chapters.map((chapter) => {
            const tone = subjectTone(activeSubject, dark);
            const preview = exam408ChapterPreview(chapter);
            return (
              <PressableScale
                key={chapter.key}
                haptic
                scaleTo={0.985}
                onPress={() => onOpenChapter(activeSubject, chapter)}
                style={styles.chapterCard}
                accessibilityRole="button"
                accessibilityLabel={`打开第 ${chapter.chapterNumber} 章 ${chapter.title}`}
              >
                <View
                  style={[
                    styles.chapterNumber,
                    { backgroundColor: tone.soft },
                  ]}
                >
                  <Text
                    style={[styles.chapterNumberText, { color: tone.color }]}
                  >
                    {String(chapter.chapterNumber).padStart(2, "0")}
                  </Text>
                </View>
                <View style={styles.chapterBody}>
                  <Text style={styles.chapterTitle}>{chapter.title}</Text>
                  <Text style={styles.chapterSummary} numberOfLines={2}>
                    {preview || "打开章节查看知识点"}
                  </Text>
                  <View style={styles.chapterMetaRow}>
                    <Text style={styles.chapterMeta}>
                      {chapter.points.length} 个知识点
                    </Text>
                    <View style={styles.metaDot} />
                    <Text style={styles.chapterMeta}>
                      {chapter.questionCount} 道关联真题
                    </Text>
                  </View>
                </View>
                <ThemedIcon
                  name="chevron-forward"
                  size={18}
                  color={colors.textFaint}
                />
              </PressableScale>
            );
          })}
        </View>
      ) : (
        <StateBox
          styles={styles}
          colors={colors}
          icon="file-tray-outline"
          title="本章暂无知识点"
          text="可以切换到其他章节继续查看。"
        />
      )}
    </>
  );
}

function SubjectRail({
  subjects,
  subjectKey,
  onSubjectChange,
}: {
  subjects: Exam408SubjectSummary[];
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
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <View
              style={[
                styles.subjectChipIcon,
                { backgroundColor: tone.soft },
              ]}
            >
              <ThemedIcon
                name={tone.icon as never}
                size={18}
                color={tone.color}
              />
            </View>
            <View style={styles.subjectChipBody}>
              <Text
                style={[
                  styles.subjectChipTitle,
                  active && { color: tone.color },
                ]}
              >
                {subject.title}
              </Text>
              <Text style={styles.subjectChipMeta}>
                {subject.chapterCount} 章 · {subject.pointCount} 点
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </Animated.ScrollView>
  );
}

function SubjectSummary({
  subject,
  mode,
}: {
  subject: Exam408SubjectSummary;
  mode: BrowserMode;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const tone = subjectTone(subject, dark);
  return (
    <View style={styles.subjectSummary}>
      <View style={[styles.subjectSummaryIcon, { backgroundColor: tone.soft }]}>
        <ThemedIcon name={tone.icon as never} size={22} color={tone.color} />
      </View>
      <View style={styles.subjectSummaryBody}>
        <Text style={styles.subjectSummaryTitle}>{subject.title}</Text>
        <Text style={styles.subjectSummaryText} numberOfLines={2}>
          {mode === "knowledge"
            ? "按章节浏览知识点，进入后可查看关联真题。"
            : "按章节定位知识点，再用原题检查掌握情况。"}
        </Text>
      </View>
      <View style={styles.subjectSummaryMeta}>
        <Text style={styles.subjectSummaryValue}>
          {subject.chapterCount} 章
        </Text>
        <Text style={styles.subjectSummaryValue}>
          {subject.pointCount} 点
        </Text>
        <Text style={styles.subjectSummaryMuted}>
          {subject.questionCount} 题
        </Text>
      </View>
    </View>
  );
}

function PointRow({
  point,
  accent,
  onPress,
}: {
  point: Exam408PointSummary;
  accent: string;
  onPress: () => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const tags = exam408DisplayTags(point.tags, 2);
  return (
    <PressableScale
      haptic
      scaleTo={0.99}
      onPress={onPress}
      style={styles.pointRow}
      accessibilityRole="button"
      accessibilityLabel={`打开知识点 ${point.title}`}
    >
      <View style={[styles.pointNumber, { backgroundColor: accent + "18" }]}>
        <Text style={[styles.pointNumberText, { color: accent }]}>
          {point.pointNumber}
        </Text>
      </View>
      <View style={styles.pointBody}>
        <Text style={styles.pointTitle}>{point.title}</Text>
        <View style={styles.pointMetaRow}>
          <Text style={styles.pointMeta}>{point.questionCount} 道关联真题</Text>
          {tags.map((tag) => (
            <View key={tag} style={styles.pointTag}>
              <Text style={styles.pointTagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
      <ThemedIcon name="chevron-forward" size={17} color={colors.textFaint} />
    </PressableScale>
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
  if (loading && papers.length === 0) {
    return (
      <StateBox
        styles={styles}
        colors={colors}
        icon="document-text-outline"
        title="正在加载历年真题"
        text="按年份整理原卷、题型、题号和分值。"
        loading
      />
    );
  }

  if (error && papers.length === 0) {
    return (
      <StateBox
        styles={styles}
        colors={colors}
        icon="alert-circle-outline"
        title="历年真题加载失败"
        text={error}
        onRetry={onRetry}
      />
    );
  }

  return (
    <View style={styles.sectionList}>
      <View style={styles.paperHero}>
        <View style={styles.paperHeroIcon}>
          <ThemedIcon
            name="documents-outline"
            size={24}
            color={colors.primary}
          />
        </View>
        <View style={styles.paperHeroBody}>
          <Text style={styles.paperHeroTitle}>2009-2026 历年真题</Text>
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
            accessibilityRole="button"
            accessibilityLabel={`打开 ${paper.year} 年 408 真题`}
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
              <ThemedIcon
                name="chevron-forward"
                size={14}
                color={colors.primary}
              />
            </View>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

function StateBox({
  styles,
  colors,
  icon,
  title,
  text,
  loading = false,
  onRetry,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  icon: string;
  title: string;
  text: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.stateBox}>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <ThemedIcon name={icon as never} size={25} color={colors.textMuted} />
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
      {onRetry ? (
        <PressableScale haptic onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>重试</Text>
        </PressableScale>
      ) : null}
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
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <ThemedIcon
        name={icon as never}
        size={18}
        color={active ? colors.primary : colors.textMuted}
      />
      <Text
        style={[styles.tabButtonLabel, active && styles.tabButtonLabelActive]}
      >
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
    <PressableScale
      haptic
      scaleTo={0.98}
      onPress={onPress}
      style={styles.practiceMode}
    >
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

function subjectTone(subject: Exam408SubjectSummary, dark: boolean) {
  const tone = SUBJECT_TONES[subject.shortName] ??
    SUBJECT_TONES[subject.title] ?? {
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
    tabButtonLabel: {
      ...typography.caption,
      fontWeight: "800",
      color: colors.textMuted,
    },
    tabButtonLabelActive: { color: colors.primary },
    tabButtonMeta: { ...typography.micro, color: colors.textFaint },
    sectionList: { gap: spacing.md },
    sectionHead: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    sectionHeadBody: { flex: 1, gap: 2 },
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
    subjectChipTitle: {
      ...typography.callout,
      fontWeight: "800",
      color: colors.text,
    },
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
    subjectSummaryValue: {
      ...typography.micro,
      fontWeight: "800",
      color: colors.textSecondary,
    },
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
    chapterSummary: {
      ...typography.caption,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    chapterMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    chapterMeta: {
      ...typography.micro,
      fontWeight: "700",
      color: colors.textMuted,
    },
    metaDot: {
      width: 3,
      height: 3,
      borderRadius: 999,
      backgroundColor: colors.textFaint,
    },
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
    primaryPracticeText: {
      ...typography.caption,
      color: "#FFFFFFCC",
    },
    primaryPracticeMeta: {
      ...typography.caption,
      fontWeight: "900",
      color: "#FFFFFF",
    },
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
    practiceModeTitle: {
      ...typography.callout,
      fontWeight: "800",
      color: colors.text,
    },
    practiceModeText: { ...typography.caption, color: colors.textMuted },
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
    paperCta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      marginTop: "auto",
    },
    paperCtaText: {
      ...typography.micro,
      fontWeight: "800",
      color: colors.primary,
    },
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
    stateText: {
      ...typography.callout,
      color: colors.textMuted,
      textAlign: "center",
    },
    retryButton: {
      minHeight: 44,
      marginTop: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.primary,
    },
    retryButtonText: {
      ...typography.callout,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    sourceBox: {
      gap: 4,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sourceTitle: {
      ...typography.callout,
      fontWeight: "800",
      color: colors.text,
    },
    sourceText: {
      ...typography.caption,
      color: colors.textMuted,
      lineHeight: 19,
    },
    sheetContent: { gap: spacing.md },
    sheetLead: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.surfaceMuted,
    },
    sheetLeadIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetLeadBody: { flex: 1, gap: 2 },
    sheetLeadTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    sheetLeadText: {
      ...typography.caption,
      color: colors.textMuted,
      lineHeight: 18,
    },
    pointList: { gap: spacing.sm },
    pointRow: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    pointNumber: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    pointNumberText: {
      ...typography.caption,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
    },
    pointBody: { flex: 1, gap: 5 },
    pointTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    pointMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },
    pointMeta: { ...typography.micro, color: colors.textMuted },
    pointTag: {
      borderRadius: radius.pill,
      paddingHorizontal: 7,
      paddingVertical: 3,
      backgroundColor: colors.surfaceMuted,
    },
    pointTagText: { ...typography.micro, color: colors.textSecondary },
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
