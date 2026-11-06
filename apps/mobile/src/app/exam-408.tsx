import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { recordCrumb } from "@/lib/crash-capture";
import { BottomSheet } from "@/components/bottom-sheet";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import {
  BarList,
  StatTileRow,
  StepsBar,
  type StatTileProps,
  type StatTone,
} from "@/components/v2/charts";
import { SectionTitle } from "@/components/v2/section-title";
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
  exam408GradStageForSubject,
  exam408OverviewStats,
  exam408PointHref,
} from "@/lib/exam-408-view";
import { chapterSheetVisibleWithoutSnapshot } from "@/lib/exam-408-study";
import {
  fetchCardStatsBoard,
  loadCachedStatsBoard,
  type Exam408CardStatsBoard,
  type Exam408FetchFailure,
} from "@/lib/exam-408-cards";
import {
  fetchPaperAttempts,
  loadPaperHistory,
  type PaperAttemptFailure,
  type PaperAttemptRecord,
} from "@/lib/paper-history";
import {
  exam408DashStats,
  paperScoreBars,
  paperScoreRanking,
  type Exam408AttemptsSource,
  type Exam408Stat,
} from "@/lib/exam-408-dashboard";
import { setNavPendingParams } from "@/lib/nav-pending";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import {
  radius,
  shadows,
  spacing,
  tabularNums,
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

/**
 * 四科点缀色（v2）：不再写死十六进制，统一从主题调色板的领域色取。
 * 软底由同一 token 派生半透明（浅色 18 / 深色 2B），夜间不会出现"浅色档专用的粉彩"。
 */
type SubjectToneColor = Extract<
  keyof ThemeColors,
  "primary" | "lavender" | "accent" | "teal"
>;

const SUBJECT_TONES: Record<string, { color: SubjectToneColor; icon: string }> = {
  数据结构: { color: "primary", icon: "git-network-outline" },
  计算机组成原理: { color: "lavender", icon: "hardware-chip-outline" },
  操作系统: { color: "accent", icon: "apps-outline" },
  计算机网络: { color: "teal", icon: "share-social-outline" },
};

const DEFAULT_SUBJECT_TONE: { color: SubjectToneColor; icon: string } = {
  color: "teal",
  icon: "school-outline",
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
  /**
   * v2.2「我的 408 学习统计」：刷卡 board 与套卷成绩各自独立降级。
   * - board 服务端失败时回落到上次缓存（离线也能看到刷到哪），绝不用空板覆盖；
   * - 套卷未登录 / 401 / 离线 / 5xx 一律用本机缓存（lib/paper-history），不新增接口；
   * - 两者都失败只影响本区块，408 知识体系 / 历年真题照常显示。
   */
  const [board, setBoard] = useState<Exam408CardStatsBoard | null>(null);
  const [boardCached, setBoardCached] = useState(false);
  const [boardFailure, setBoardFailure] = useState<Exam408FetchFailure | null>(null);
  const [attempts, setAttempts] = useState<PaperAttemptRecord[]>([]);
  const [attemptsSource, setAttemptsSource] = useState<Exam408AttemptsSource>("remote");
  const [attemptsFailure, setAttemptsFailure] = useState<PaperAttemptFailure | null>(null);
  const [attemptsTotal, setAttemptsTotal] = useState(0);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  /**
   * 知识体系 / 刷题两个 Tab 各自记住「展开的科目」；默认都收起（只显示科目卡）。
   * 切 Tab 不重置；从知识点页返回（页面重新 focus）时重置回科目卡视图。
   */
  const [expandedSubjects, setExpandedSubjects] = useState<{
    knowledge: string;
    practice: string;
  }>({ knowledge: "", practice: "" });
  const [chapterSheetOpen, setChapterSheetOpen] = useState(false);
  const [chapterSheetSnapshot, setChapterSheetSnapshot] =
    useState<ChapterSheetSnapshot | null>(null);
  /**
   * P13：章节 → 知识点导航的「待跳转 key」。
   * 用 ref 而非 state 是为了让 onClosed 回调与超时兜底共享同一个已消费标记：
   * 崩溃/转场中断时 BottomSheet 的 onClosed 可能永远不触发，导致再点章节无反应。
   */
  const pendingPointRef = useRef("");
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [navNotice, setNavNotice] = useState("");

  /** 首次数据是否已经拿到过（v2.2.2：区分"首屏加载"与"后台刷新"，见下面的 load*） */
  const hasOverviewRef = useRef(false);
  const hasDashboardRef = useRef(false);

  const loadOverview = useCallback(async () => {
    /**
     * v2.2.2：只有「还没有任何 408 数据」时才进入加载态。
     * 从章节/知识点页返回会重新聚焦本页，若每次都把 loading 置回 true，
     * 慢网/5xx 时已有知识体系会被加载占位顶掉（真机 = 切回来闪一下）。
     */
    if (!hasOverviewRef.current) setLoadingOverview(true);
    setOverviewError("");
    try {
      const next = await getExam408Overview();
      hasOverviewRef.current = true;
      setOverview(next);
    } catch (reason) {
      setOverviewError(
        reason instanceof Error ? reason.message : "408 权威数据加载失败",
      );
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    // v2.2.2：同上，已有统计板/套卷记录时只做后台刷新，不再回到加载态
    if (!hasDashboardRef.current) setDashboardLoading(true);
    // 三路并行、各自兜底：任何一路失败都不阻塞 408 页其它内容
    const [boardRes, paperRes, localAttempts] = await Promise.all([
      fetchCardStatsBoard().catch(() => ({ board: null, failure: "server" as const })),
      fetchPaperAttempts().catch(() => ({
        attempts: [] as PaperAttemptRecord[],
        total: 0,
        failure: "server" as const,
      })),
      loadPaperHistory().catch(() => [] as PaperAttemptRecord[]),
    ]);
    if (boardRes.board) {
      setBoard(boardRes.board);
      setBoardCached(false);
    } else {
      // board 拿不到时回落本机缓存：显示"上次刷到哪"比空白更有用
      const cached = await loadCachedStatsBoard().catch(() => null);
      setBoard(cached);
      setBoardCached(Boolean(cached));
    }
    setBoardFailure(boardRes.failure);
    // 套卷：服务端成功优先，其余情况一律回落本机缓存（同一份记录，口径一致）
    const remote = paperRes.failure === null;
    const list = remote ? paperRes.attempts : localAttempts;
    setAttempts(list);
    setAttemptsSource(remote ? "remote" : "local");
    setAttemptsFailure(paperRes.failure);
    setAttemptsTotal(remote ? Math.max(paperRes.total, list.length) : list.length);
    hasDashboardRef.current = true;
    setDashboardLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // 从 408 返回再进入：默认回到「四张科目卡」视图（旧行为是直接展开上次科目）
      setExpandedSubjects({ knowledge: "", practice: "" });
      void loadOverview();
      void loadDashboard();
    }, [loadOverview, loadDashboard]),
  );

  // P13：闪退/热更新恢复后，BottomSheet 可能残留 visible=true 但内容已空 → 整屏被 Modal 挡住，
  // 表现为「知识体系里点章节无反应」。回到 hub 时统一收敛弹层状态与待跳转 key。
  useFocusEffect(
    useCallback(() => {
      pendingPointRef.current = "";
      setChapterSheetOpen(false);
      setChapterSheetSnapshot(null);
      setNavNotice("");
    }, []),
  );

  useEffect(() => {
    if (!chapterSheetVisibleWithoutSnapshot(chapterSheetOpen, Boolean(chapterSheetSnapshot))) return;
    // 异步收敛：直接同步 setState 会被 react-hooks/set-state-in-effect 判错
    const timer = setTimeout(() => setChapterSheetOpen(false), 0);
    return () => clearTimeout(timer);
  }, [chapterSheetOpen, chapterSheetSnapshot]);

  useEffect(() => {
    if (!navNotice) return;
    const timer = setTimeout(() => setNavNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [navNotice]);

  const stats = exam408OverviewStats(overview);
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
    if (!subject || !chapter || !Array.isArray(chapter.points)) {
      setNavNotice("章节数据异常，请重新加载后再试");
      return;
    }
    recordCrumb("408-chapter-open", { subject: subject.key, chapter: chapter.key });
    pendingPointRef.current = "";
    setNavNotice("");
    setChapterSheetSnapshot({ subject, chapter });
    setChapterSheetOpen(true);
  };

  const toggleSubject = (mode: BrowserMode, key: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [mode]: prev[mode] === key ? "" : key,
    }));
    setChapterSheetOpen(false);
    pendingPointRef.current = "";
  };

  const openPoint = (key: string) => {
    recordCrumb("408-point-tap", { key });
    pendingPointRef.current = key;
    setChapterSheetOpen(false);
    // 兜底：BottomSheet 的 onClosed 依赖退场动画；若异常路径没回调，1.2s 后强制消费一次
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      handleSheetClosedRef.current?.();
    }, 1200);
  };

  /** handleSheetClosed 的 ref 版本（openPoint 的超时兜底要在定义前引用它） */
  const handleSheetClosedRef = useRef<() => void>(() => {});
  const handleSheetClosed = useCallback(() => {
    const pointKey = pendingPointRef.current;
    pendingPointRef.current = "";
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    setChapterSheetSnapshot(null);
    if (!pointKey) return;
    recordCrumb("408-point-close", { key: pointKey });
    // 字符串 href（而非 {pathname, params} 对象形式）：对象形式在 native-stack 重复
    // 推入同名路由时 params 会冻结在首次值 → 点开任何章节都显示第一次的知识点（v1.50 修复）
    // v1.51 勘误：两种 href 经 resolveHref 归一后是同一个 URL，params 冻结依旧
    // （真机取证 2026-11-01）。真正的修复是场外通道：push 前把 key 写入
    // nav-pending，知识点页聚焦时优先消费它（见 quiz/408-point.tsx）。
    try {
      setNavPendingParams("quiz-408-point", { key: pointKey });
      router.push(exam408PointHref(pointKey) as never);
    } catch (error) {
      recordCrumb("408-point-push-fail", {
        message: error instanceof Error ? error.message : String(error),
      });
      setNavNotice("打开知识点失败，请再点一次");
    }
  }, []);

  // onClosed 与兜底超时共享同一个实现；组件卸载时清掉未触发的定时器
  useEffect(() => {
    handleSheetClosedRef.current = handleSheetClosed;
    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [handleSheetClosed]);

  const startTrackPractice = (stageKey?: string, topicKey?: string) => {
    // 同上：字符串 href 防同名路由 params 冻结（stage/topic 是动态值）；
    // 目标参数同时登记入场外通道（v1.51，见 lib/nav-pending.ts）
    const query = [`track=${encodeURIComponent(track.slug)}`, "mode=stage", `returnTo=${encodeURIComponent("/exam-408")}`];
    const pending: Record<string, string> = { track: track.slug, mode: "stage" };
    if (stageKey) {
      query.push(`stage=${encodeURIComponent(stageKey)}`);
      pending.stage = stageKey;
    }
    if (topicKey) {
      query.push(`topic=${encodeURIComponent(topicKey)}`);
      pending.topic = topicKey;
    }
    setNavPendingParams("quiz-session", pending);
    router.push(`/quiz/session?${query.join("&")}` as never);
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
            <ThemedIcon name="school-outline" size={27} color={colors.primary} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroTitle}>408 考研专区</Text>
            <Text style={styles.heroText}>四科知识体系 · 章节真题 · 历年整卷，一处进入。</Text>
          </View>
          <PressableScale
            hitSlop={8}
            scaleTo={0.92}
            style={styles.heroSearch}
            onPress={() => router.push("/search" as never)}
            accessibilityRole="button"
            accessibilityLabel="搜索 408 精读与知识点"
          >
            <ThemedIcon name="search" size={18} color={colors.primary} />
          </PressableScale>
        </View>
        <View style={styles.heroStats}>
          <HeroStat value={String(stats.points)} label="知识点" styles={styles} />
          <HeroStat value={String(stats.chapters)} label="章节" styles={styles} />
          <HeroStat value={String(stats.papers)} label="套卷" styles={styles} />
        </View>
      </Animated.View>

        {/* P11：统一「学习方式」三入口（精读 / 演示 / 刷卡）。放在 Tab 之外，学习与刷题视角都能看到；
            精读入口不再依赖当前科目——目录页自带科目切换。 */}
        <Animated.View entering={entrance(1)}>
          <LearningModes styles={styles} colors={colors} />
        </Animated.View>

        {/* v2.2：我的 408 学习统计（刷卡进度 + 套卷成绩），放在入口之后、Tab 列表之前；
            任一路接口失败只降级本区块，下面的知识体系 / 题库存取不受影响 */}
        <Animated.View entering={entrance(1)}>
          <StudyDashboard
            board={board}
            boardCached={boardCached}
            boardFailure={boardFailure}
            attempts={attempts}
            attemptsSource={attemptsSource}
            attemptsFailure={attemptsFailure}
            attemptsTotal={attemptsTotal}
            loading={dashboardLoading}
          />
        </Animated.View>

        {navNotice ? (
          <View style={styles.navNotice}>
            <ThemedIcon name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.navNoticeText}>{navNotice}</Text>
          </View>
        ) : null}

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
            expandedSubjectKey={expandedSubjects.knowledge}
            onRetry={() => void loadOverview()}
            onSubjectToggle={(key) => toggleSubject("knowledge", key)}
            onOpenChapter={openChapter}
          />
        ) : null}

        {tab === "practice" ? (
          <PracticeTab
            track={track}
            overview={overview}
            loading={loadingOverview}
            error={overviewError}
            expandedSubjectKey={expandedSubjects.practice}
            onRetry={() => void loadOverview()}
            onSubjectToggle={(key) => toggleSubject("practice", key)}
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
                      colors,
                      dark,
                    ).soft,
                  },
                ]}
              >
                <ThemedIcon
                  name={
                    subjectTone(chapterSheetSnapshot.subject, colors, dark)
                      .icon as never
                  }
                  size={19}
                  color={subjectTone(chapterSheetSnapshot.subject, colors, dark).color}
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
                  accent={subjectTone(chapterSheetSnapshot.subject, colors, dark).color}
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

/** lib 只给展示串；图标与语义色调由页面决定（避免 lib 依赖 @expo/vector-icons） */
function dashTile(
  stat: Exam408Stat,
  icon: StatTileProps["icon"],
  tone: StatTone,
): StatTileProps {
  return {
    label: stat.label,
    value: stat.value,
    unit: stat.unit,
    hint: stat.hint,
    icon,
    tone,
  };
}

/**
 * v2.2「我的 408 学习统计」：两行指标卡 + 最近套卷得分柱图 + 最佳套卷排行。
 *
 * 视图模型全部来自 lib/exam-408-dashboard（纯函数已单测），这里只负责布局与取色：
 * 指标卡直接铺在画布上（避免卡中卡），两个图表合成一张 Card 共用一条分隔线。
 * 没有任何交卷记录时走空态，不画一条全 0 的图。
 */
function StudyDashboard({
  board,
  boardCached,
  boardFailure,
  attempts,
  attemptsSource,
  attemptsFailure,
  attemptsTotal,
  loading,
}: {
  board: Exam408CardStatsBoard | null;
  boardCached: boolean;
  boardFailure: Exam408FetchFailure | null;
  attempts: PaperAttemptRecord[];
  attemptsSource: Exam408AttemptsSource;
  attemptsFailure: PaperAttemptFailure | null;
  attemptsTotal: number;
  loading: boolean;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const stats = exam408DashStats({
    board,
    boardCached,
    boardFailure,
    attempts,
    attemptsSource,
    attemptsFailure,
    attemptsTotal,
    pending: loading,
  });
  const bars = useMemo(() => paperScoreBars(attempts), [attempts]);
  const ranking = useMemo(() => paperScoreRanking(attempts), [attempts]);

  return (
    <View style={styles.sectionList}>
      <SectionHead
        title="我的 408 学习统计"
        meta={board ? `${stats.cards.value} 张卡` : undefined}
        hint="刷卡进度与最近套卷成绩；未登录时只显示本机记录。"
      />
      <View style={styles.tileGrid}>
        <StatTileRow
          items={[
            dashTile(stats.cards, "albums-outline", "primary"),
            dashTile(stats.reviewed, "checkmark-done-outline", "success"),
          ]}
        />
        <StatTileRow
          items={[
            dashTile(stats.papers, "documents-outline", "accent"),
            dashTile(stats.best, "trophy-outline", "warning"),
          ]}
        />
      </View>

      {stats.notice ? (
        <View style={styles.dashNotice}>
          <ThemedIcon name="information-circle-outline" size={15} color={colors.primary} />
          <Text style={styles.dashNoticeText}>{stats.notice}</Text>
        </View>
      ) : null}

      {bars.length > 0 ? (
        <Card style={styles.dashCard}>
          <StepsBar
            title="最近套卷得分"
            rangeLabel={`近 ${bars.length} 次`}
            items={bars}
          />
          <View style={styles.dashRule} />
          <BarList title="最佳套卷排行" showRank items={ranking} />
        </Card>
      ) : (
        <Card style={styles.dashCard}>
          <Text style={styles.dashEmpty}>
            {loading ? "正在读取套卷成绩…" : (stats.emptyHint ?? "还没有套卷成绩。")}
          </Text>
        </Card>
      )}
    </View>
  );
}

function KnowledgeTab({
  overview,
  loading,
  error,
  expandedSubjectKey,
  onRetry,
  onSubjectToggle,
  onOpenChapter,
}: {
  overview: Exam408Overview | null;
  loading: boolean;
  error: string;
  expandedSubjectKey: string;
  onRetry: () => void;
  onSubjectToggle: (key: string) => void;
  onOpenChapter: (
    subject: Exam408SubjectSummary,
    chapter: Exam408ChapterSummary,
  ) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <View style={styles.sectionList}>
      <SectionHead
        title="四科知识体系"
        meta={`${overview?.subjects.length ?? 0} 科`}
        hint="先选科目，再打开章节查看完整知识点清单。"
      />
      <SubjectBrowser
        mode="knowledge"
        overview={overview}
        loading={loading}
        error={error}
        expandedSubjectKey={expandedSubjectKey}
        onRetry={onRetry}
        onSubjectToggle={onSubjectToggle}
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
  expandedSubjectKey,
  onRetry,
  onSubjectToggle,
  onOpenChapter,
  onStartTrackPractice,
  onOpenPapers,
}: {
  track: LearningTrack;
  overview: Exam408Overview | null;
  loading: boolean;
  error: string;
  expandedSubjectKey: string;
  onRetry: () => void;
  onSubjectToggle: (key: string) => void;
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

      <SectionHead
        title="按章节刷真题"
        meta={`${exam408OverviewStats(overview).questions} 题`}
        hint="打开章节后，可在知识点层级查看关联原题。"
      />
      <SubjectBrowser
        mode="practice"
        overview={overview}
        loading={loading}
        error={error}
        expandedSubjectKey={expandedSubjectKey}
        onRetry={onRetry}
        onSubjectToggle={onSubjectToggle}
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
  expandedSubjectKey,
  onRetry,
  onSubjectToggle,
  onOpenChapter,
}: {
  mode: BrowserMode;
  overview: Exam408Overview | null;
  loading: boolean;
  error: string;
  expandedSubjectKey: string;
  onRetry: () => void;
  onSubjectToggle: (key: string) => void;
  onOpenChapter: (
    subject: Exam408SubjectSummary,
    chapter: Exam408ChapterSummary,
  ) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);

  if (loading && !overview) {
    return (
      <LoadingBox
        title="正在加载 408 知识体系"
        text="同步科目、章节、知识点和真题索引。"
      />
    );
  }

  if (error && !overview) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="408 内容加载失败"
        hint={error}
        actionLabel="重试"
        onAction={onRetry}
        pattern="none"
      />
    );
  }

  const subjects = overview?.subjects ?? [];
  const selectedSubject =
    subjects.find((subject) => subject.key === expandedSubjectKey) ?? null;

  if (subjects.length === 0) {
    return (
      <EmptyState
        icon="file-tray-outline"
        title="暂无科目数据"
        hint="数据库当前没有可用的 408 科目。"
        actionLabel="重试"
        onAction={onRetry}
        pattern="none"
      />
    );
  }

  // P1-1：默认只显示 4 张科目卡；点某科后才展开该科章节列表（原章节 → 知识点 Sheet 行为不变）
  if (!selectedSubject) {
    return <SubjectGrid subjects={subjects} mode={mode} onSelect={onSubjectToggle} />;
  }

  return (
    <>
      <PressableScale
        haptic
        scaleTo={0.985}
        onPress={() => onSubjectToggle(selectedSubject.key)}
        style={styles.subjectBackRow}
        accessibilityRole="button"
        accessibilityLabel="收起章节，返回科目列表"
      >
        <ThemedIcon name="chevron-back" size={15} color={colors.textMuted} />
        <Text style={styles.subjectBackText}>全部科目</Text>
        <Text style={styles.subjectBackTitle} numberOfLines={1}>
          {selectedSubject.title}
        </Text>
      </PressableScale>
      <SubjectSummary subject={selectedSubject} mode={mode} />
      <GradLessonEntry subject={selectedSubject} />
      {selectedSubject.chapters.length > 0 ? (
        <View style={styles.chapterList}>
          {selectedSubject.chapters.map((chapter) => {
            const tone = subjectTone(selectedSubject, colors, dark);
            const preview = exam408ChapterPreview(chapter);
            return (
              <PressableScale
                key={chapter.key}
                haptic
                scaleTo={0.985}
                onPress={() => onOpenChapter(selectedSubject, chapter)}
                style={styles.chapterCard}
                accessibilityRole="button"
                accessibilityLabel={`打开第 ${chapter.chapterNumber} 章 ${chapter.title}`}
              >
                <View style={[styles.chapterNumber, { backgroundColor: tone.soft }]}>
                  <Text style={[styles.chapterNumberText, { color: tone.color }]}>
                    {String(chapter.chapterNumber).padStart(2, "0")}
                  </Text>
                </View>
                <View style={styles.chapterBody}>
                  <Text style={styles.chapterTitle}>{chapter.title}</Text>
                  <Text style={styles.chapterSummary} numberOfLines={2}>
                    {preview || "打开章节查看知识点"}
                  </Text>
                  <View style={styles.chapterMetaRow}>
                    <Text style={styles.chapterMeta}>{chapter.points.length} 个知识点</Text>
                    <View style={styles.metaDot} />
                    <Text style={styles.chapterMeta}>{chapter.questionCount} 道关联真题</Text>
                  </View>
                </View>
                <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
              </PressableScale>
            );
          })}
        </View>
      ) : (
        <EmptyState
          icon="file-tray-outline"
          title="本章暂无知识点"
          hint="可以切换到其他章节继续查看。"
          pattern="none"
        />
      )}
    </>
  );
}

/**
 * 408 四科科目卡（P1-1）：默认视图。只展示科目名 / 章节数 / 知识点数，点击展开该科章节，
 * 不再一进来就铺开全部章节。
 */
function SubjectGrid({
  subjects,
  mode,
  onSelect,
}: {
  subjects: Exam408SubjectSummary[];
  mode: BrowserMode;
  onSelect: (key: string) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <View style={styles.subjectGrid}>
      {subjects.map((subject) => {
        const tone = subjectTone(subject, colors, dark);
        return (
          <PressableScale
            key={subject.key}
            haptic
            scaleTo={0.985}
            onPress={() => onSelect(subject.key)}
            style={styles.subjectCard}
            accessibilityRole="button"
            accessibilityLabel={`${subject.title}，${subject.chapterCount} 章，${subject.pointCount} 个知识点`}
          >
            <View style={styles.subjectCardHead}>
              <View style={[styles.subjectCardIcon, { backgroundColor: tone.soft }]}>
                <ThemedIcon name={tone.icon as never} size={18} color={tone.color} />
              </View>
              <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
            </View>
            <Text style={styles.subjectCardTitle} numberOfLines={2}>
              {subject.title}
            </Text>
            <Text style={styles.subjectCardMeta} numberOfLines={2}>
              {subject.chapterCount} 章 · {subject.pointCount} 知识点
            </Text>
            <Text style={styles.subjectCardHint} numberOfLines={1}>
              {mode === "knowledge" ? "查看章节与知识点" : "按章节刷真题"}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * 「讲义阅读」入口（v1.52）：专区里的知识点是真题索引（无正文），带正文的讲义在
 * ex-408-grad 轨道（25 章级知识点，来自"计算机考研杂货铺"）。按当前科目跳到该科
 * 讲义的章节清单（quiz/chapter → quiz/read）。参数走 nav-pending（同名路由防冻结，
 * 见 lib/nav-pending.ts）；无对应阶段（未知科目/内容未加载）时隐藏。
 */
function GradLessonEntry({ subject }: { subject: Exam408SubjectSummary }) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const gradTrack = useLearningTrack("ex-408-grad");
  const gradStageKey = exam408GradStageForSubject(subject.key);
  const gradStage = gradTrack?.stages.find((stage) => stage.key === gradStageKey);
  useEffect(() => {
    recordCrumb("408-lesson-entry", {
      subject: subject.key,
      gradStageKey: gradStageKey ?? "(null)",
      gradStageFound: Boolean(gradStage),
      topics: gradStage?.topics.length ?? 0,
      rendered: Boolean(gradStage && gradStage.topics.length > 0),
    });
  }, [subject.key, gradStageKey, gradStage?.topics.length, gradStage]);
  if (!gradStage || gradStage.topics.length === 0) return null;
  const tone = subjectTone(subject, colors, dark);

  const openLesson = () => {
    if (!gradTrack) return;
    setNavPendingParams("quiz-chapter", {
      track: gradTrack.slug,
      stage: gradStage.key,
    });
    router.push(
      `/quiz/chapter?track=${encodeURIComponent(gradTrack.slug)}&stage=${encodeURIComponent(gradStage.key)}` as never,
    );
  };

  return (
    <PressableScale
      haptic
      scaleTo={0.985}
      onPress={openLesson}
      style={[styles.lessonEntry, { borderColor: `${tone.color}35` }]}
      accessibilityRole="button"
      accessibilityLabel={`阅读${subject.title}讲义，共 ${gradStage.topics.length} 章正文`}
    >
      <View style={[styles.lessonEntryIcon, { backgroundColor: tone.soft }]}>
        <ThemedIcon name="book-outline" size={20} color={tone.color} />
      </View>
      <View style={styles.lessonEntryBody}>
        <Text style={styles.lessonEntryTitle}>{subject.title} · 讲义阅读</Text>
        <Text style={styles.lessonEntryMeta} numberOfLines={1}>
          {gradStage.topics.length} 章正文讲解 · 概念 / 机制 / 易错点
        </Text>
      </View>
      <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
    </PressableScale>
  );
}

/**
 * 「学习方式」三入口（v1.55 / P11）：知识精读 / 交互演示 / 刷卡背诵。
 *
 * 为什么放在 Tab 之外：这三个能力不是「某一科」或「某一 Tab」的附属——用户可能只想看动图、
 * 只想背卡，或按科目读长文；入口必须一进专区就能看到，且在学习与刷题视角下都不重复渲染。
 * 精读入口不带 subject 参数：目录页（exam-408-study）自带科目切换，未选科目也能进。
 */
function LearningModes({
  styles,
  colors,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  const entries = [
    {
      key: "study",
      icon: "library-outline" as const,
      ios: "book",
      title: "知识精读",
      meta: "原文长读 · 一屏一节",
      tint: colors.primary,
      soft: colors.primarySoft,
      href: "/exam-408-study" as const,
      accessibilityLabel: "打开知识精读目录",
    },
    {
      key: "viz",
      icon: "play-circle-outline" as const,
      ios: "play.rectangle",
      title: "交互演示",
      meta: "逐帧动画 · 可单步",
      tint: colors.accentStrong,
      soft: colors.accentSoft,
      href: "/exam-408-viz" as const,
      accessibilityLabel: "打开 408 交互演示目录",
    },
    {
      key: "drill",
      icon: "layers-outline" as const,
      ios: "rectangle.stack",
      title: "刷卡背诵",
      meta: "FSRS 记忆 · 三档自评",
      tint: colors.success,
      soft: colors.successSoft,
      href: "/exam-408-drill" as const,
      accessibilityLabel: "打开 408 刷卡背诵",
    },
  ];
  return (
    <View style={styles.learningModes}>
      <SectionHead title="学习方式" meta="长读 / 看动图 / 刷记忆" />
      <View style={styles.learningModesRow}>
        {entries.map((entry) => (
          <PressableScale
            key={entry.key}
            haptic
            scaleTo={0.97}
            onPress={() => router.push(entry.href as never)}
            style={styles.learningModeCard}
            accessibilityRole="button"
            accessibilityLabel={entry.accessibilityLabel}
          >
            <View style={[styles.learningModeIcon, { backgroundColor: entry.soft }]}>
              <ThemedIcon ios={entry.ios} name={entry.icon} size={19} color={entry.tint} />
            </View>
            <Text style={styles.learningModeTitle} numberOfLines={1}>
              {entry.title}
            </Text>
            <Text style={styles.learningModeMeta} numberOfLines={2}>
              {entry.meta}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
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
  const tone = subjectTone(subject, colors, dark);
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
      <LoadingBox
        title="正在加载历年真题"
        text="按年份整理原卷、题型、题号和分值。"
      />
    );
  }

  if (error && papers.length === 0) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="历年真题加载失败"
        hint={error}
        actionLabel="重试"
        onAction={onRetry}
        pattern="none"
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

      {/* P3-2B：历史成绩入口一行（本地 + 服务端） */}
      <PressableScale
        haptic
        scaleTo={0.985}
        onPress={() => router.push("/exam-408-paper-history" as never)}
        style={styles.paperHistoryRow}
        accessibilityRole="button"
        accessibilityLabel="查看套卷历史成绩"
      >
        <View style={styles.paperHistoryIcon}>
          <ThemedIcon name="time-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.paperHistoryBody}>
          <Text style={styles.paperHistoryTitle}>历史成绩</Text>
          <Text style={styles.paperHistoryText}>年份 · 得分 · 正确率 · 用时 · 交卷时间</Text>
        </View>
        <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
      </PressableScale>

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

/**
 * v2 区块标题：SectionTitle（14/700）+ 右侧计数 + 一行说明。
 * 替代旧的 sectionHead / BlockTitle 组合，字号与间距全部走 token。
 */
function SectionHead({
  title,
  meta,
  hint,
}: {
  title: string;
  meta?: string;
  hint?: string;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <View style={styles.sectionHead}>
      <SectionTitle
        title={title}
        right={meta ? <Text style={styles.sectionCount}>{meta}</Text> : undefined}
        style={styles.sectionTitleRow}
      />
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

/** 加载占位：只在本页首次拉数据时出现，不抢内容卡片的视觉层级 */
function LoadingBox({ title, text }: { title: string; text: string }) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <View style={styles.loadingBox}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingTitle}>{title}</Text>
      <Text style={styles.loadingText}>{text}</Text>
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

function subjectTone(
  subject: Exam408SubjectSummary,
  colors: ThemeColors,
  dark: boolean,
) {
  const tone =
    SUBJECT_TONES[subject.shortName] ?? SUBJECT_TONES[subject.title] ?? DEFAULT_SUBJECT_TONE;
  const color = colors[tone.color];
  return { color, soft: color + (dark ? "2B" : "18"), icon: tone.icon };
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.lg },
    /* 页首 Hero：v2 大面板（radius.panel + 1px 描边 + 轻投影），底色由主题领域色派生 */
    hero: {
      overflow: "hidden",
      borderRadius: radius.panel,
      padding: spacing.lg,
      gap: spacing.lg,
      backgroundColor: dark ? colors.teal + "24" : colors.teal + "14",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: dark ? colors.teal + "3D" : colors.teal + "33",
      ...shadows.card,
    },
    heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: radius.card,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    heroBody: { flex: 1, gap: 3 },
    heroSearch: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },
    heroTitle: { ...typography.hero, color: colors.text },
    heroText: { ...typography.meta, color: colors.textSecondary },
    heroStats: { flexDirection: "row", gap: spacing.sm },
    heroStat: { flex: 1, gap: 1 },
    heroStatValue: {
      ...typography.num,
      ...tabularNums,
      color: colors.text,
    },
    heroStatLabel: { ...typography.meta, color: colors.textMuted },
    tabs: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: radius.panel,
      backgroundColor: colors.surfaceMuted,
    },
    tabButton: {
      flex: 1,
      minHeight: 68,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      borderRadius: radius.control,
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
    /** 指标卡 2×2（两行两列）：130% 字号下四格并排会挤，见 study-stats 同口径 */
    tileGrid: { gap: spacing.sm },
    /* v2.2：我的 408 学习统计 */
    dashCard: { gap: spacing.md },
    dashRule: {
      height: StyleSheet.hairlineWidth * 2,
      borderRadius: 1,
      backgroundColor: colors.border,
    },
    dashEmpty: { ...typography.meta, color: colors.textMuted, lineHeight: 19 },
    dashNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.control,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.primarySoft,
    },
    dashNoticeText: {
      ...typography.caption,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },
    /** SectionHead：SectionTitle 自带 margin，这里清零交给外层 gap */
    sectionHead: { gap: 2 },
    sectionTitleRow: { marginTop: 0, marginBottom: 0 },
    sectionCount: { ...typography.meta, color: colors.textMuted },
    sectionHint: { ...typography.meta, color: colors.textMuted },
    subjectSummary: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.card,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
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
    subjectGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: spacing.md,
    },
    subjectCard: {
      width: "48%",
      minHeight: 132,
      gap: 4,
      borderRadius: radius.card,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    subjectCardHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    subjectCardIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    subjectCardTitle: { ...typography.callout, fontWeight: "800", color: colors.text, marginTop: 2 },
    subjectCardMeta: { ...typography.micro, color: colors.textMuted, lineHeight: 16 },
    subjectCardHint: { ...typography.micro, color: colors.primary, fontWeight: "700", marginTop: "auto" },
    subjectBackRow: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    subjectBackText: { ...typography.caption, fontWeight: "700", color: colors.primary },
    subjectBackTitle: { ...typography.caption, color: colors.textMuted, marginLeft: "auto", maxWidth: "70%" },
    navNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderRadius: radius.control,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.dangerSoft,
    },
    navNoticeText: { ...typography.caption, color: colors.danger, flex: 1, lineHeight: 18 },
    learningModes: { gap: spacing.sm },
    learningModesRow: { flexDirection: "row", gap: spacing.sm },
    learningModeCard: {
      flex: 1,
      minHeight: 112,
      gap: 6,
      borderRadius: radius.card,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    learningModeIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    learningModeTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    learningModeMeta: { ...typography.micro, color: colors.textMuted, lineHeight: 15 },
    lessonEntry: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.card,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      ...shadows.card,
    },
    lessonEntryIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    lessonEntryBody: { flex: 1, gap: 2 },
    lessonEntryTitle: { ...typography.headline, color: colors.text },
    lessonEntryMeta: { ...typography.caption, color: colors.textMuted },
    chapterList: { gap: spacing.md },
    chapterCard: {
      minHeight: 112,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.card,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
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
      borderRadius: radius.card,
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
      borderRadius: radius.card,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
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
      borderRadius: radius.card,
      padding: spacing.lg,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
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
    paperHistoryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.card,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    paperHistoryIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    paperHistoryBody: { flex: 1, gap: 2 },
    paperHistoryTitle: { ...typography.headline, color: colors.text },
    paperHistoryText: { ...typography.caption, color: colors.textMuted },
    paperGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    paperCard: {
      width: "48%",
      minHeight: 148,
      gap: 4,
      borderRadius: radius.card,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
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
    loadingBox: {
      minHeight: 200,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      padding: spacing.xl,
    },
    loadingTitle: { ...typography.headline, color: colors.text },
    loadingText: {
      ...typography.callout,
      color: colors.textMuted,
      textAlign: "center",
    },
    /* 兜底主 CTA（408 内容不可用）：primary pill */
    retryButton: {
      minHeight: 48,
      marginTop: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
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
      borderRadius: radius.card,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    sourceTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    sourceText: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },
    sheetContent: { gap: spacing.md },
    sheetLead: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.control,
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
    sheetLeadText: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
    pointList: { gap: spacing.sm },
    pointRow: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.control,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
    },
    pointNumber: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    pointNumberText: { ...typography.caption, fontWeight: "900" },
    pointBody: { flex: 1, gap: 3 },
    pointTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    pointMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    pointMeta: { ...typography.micro, color: colors.textMuted },
    pointTag: {
      borderRadius: radius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: colors.surfaceMuted,
    },
    pointTagText: { ...typography.micro, color: colors.textFaint },
    missing: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      padding: spacing.xl,
    },
    missingTitle: { ...typography.title2, color: colors.text },
  });