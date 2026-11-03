import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import Animated from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { CelebrationModal } from "@/components/celebration-modal";
import { BottomSheet } from "@/components/bottom-sheet";
import { QuestionSwipe } from "@/components/question-swipe";
import { QuestionBlocks } from "@/components/question-blocks";
import { RichText } from "@/components/rich-text";
import { celebrationSummary, celebrationTone, type CelebrationTone } from "@/lib/celebration-copy";
import { haptics } from "@/lib/haptics";
import { ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import {
  cleanAnswerText,
  cleanExamStem,
  getExam408Paper,
  resolveExamAssetUrl,
  type Exam408Paper,
  type Exam408Question,
} from "@/lib/exam-408";
import { setNavPendingParams, takeNavPendingParams } from "@/lib/nav-pending";
import { computePaperResult, type PaperResult } from "@/lib/paper-result";
import { submitPaperAttempt } from "@/lib/paper-history";
import { exam408PointHref } from "@/lib/exam-408-view";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

type ResultKind = "correct" | "wrong" | "reviewed";

/** P3-2B：限时模式时长（秒）：120 分钟；可选、默认关闭、仅本次会话 */
const TIME_LIMIT_SECONDS = 120 * 60;
/** 剩余时间进入警示色的阈值（秒）：10 分钟 */
const TIME_WARNING_SECONDS = 10 * 60;

export default function Exam408PaperSessionScreen() {
  const params = useLocalSearchParams<{ year?: string; start?: string }>();
  // v1.51 防参数冻结：同名路由重复 push 时实例 params 冻结在首次值（见 lib/nav-pending.ts）。
  // 跳转方（quiz/paper/[year]）push 前已登记本次参数，这里每次聚焦优先消费；params 只作深链兜底。
  const [override, setOverride] = useState<Record<string, string> | null>(null);
  useFocusEffect(
    useCallback(() => {
      const pending = takeNavPendingParams("quiz-paper-session");
      if (pending) setOverride(pending);
    }, [])
  );
  const effective = override ?? params;
  const year = Number(effective.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return <SessionMissing />;
  }
  return <PaperSession year={year} start={Number(effective.start) || 1} />;
}

function PaperSession({ year, start }: { year: number; start: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  const entrance = useScreenEntrance();
  const [paper, setPaper] = useState<Exam408Paper | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<Record<number, ResultKind>>({});
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** v1.44：做完一套真题后的庆祝弹窗 */
  const [celebrate, setCelebrate] = useState<{ title: string; subtitle: string; badge: string; tone?: CelebrationTone } | null>(null);
  /** P2-4：答题卡弹层 */
  const [answerSheetOpen, setAnswerSheetOpen] = useState(false);
  /** P2-4：整套交卷（交卷后所有题只读，可点答题卡逐题看解析） */
  const [paperSubmitted, setPaperSubmitted] = useState(false);
  /** P3-2B：可选限时模式（默认关，仅本次会话） */
  const [timedMode, setTimedMode] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(TIME_LIMIT_SECONDS);
  /** P3-2B：交卷后的成绩保存提示 */
  const [historyNotice, setHistoryNotice] = useState("");
  /** 本次作答开始时间（毫秒）；限时与用时都基于它 */
  const startedAtRef = useRef(0);
  /** 防止重复上报（手动交卷 / 限时到点只上报一次） */
  const reportedRef = useRef(false);
  /** 防止结算重复执行（按钮与定时器可能同帧触发） */
  const finishingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getExam408Paper(year);
      const target = data.questions.findIndex((question) => question.number === start);
      setPaper(data);
      setIndex(target >= 0 ? target : 0);
      // 只在首次加载时记开始时间：重新聚焦不重置本次作答的用时
      if (!startedAtRef.current) startedAtRef.current = Date.now();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "试卷加载失败");
    } finally {
      setLoading(false);
    }
  }, [start, year]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const question = paper?.questions[index];
  const result = question ? results[question.number] : undefined;
  const progress = paper ? ((index + 1) / paper.questions.length) * 100 : 0;
  // 答案正文（去掉「答案：X」前缀后仍有内容才渲染富文本块）
  const answerBody = question ? cleanAnswerText(question.answerText) : "";

  /** P2-4：整套进度统计（结果只在该题提交时写入，未提交的选项不算已答） */
  const totalQuestions = paper?.questions.length ?? 0;
  const answeredCount = Object.keys(results).length;
  const correctCount = Object.values(results).filter((value) => value === "correct").length;
  const wrongCount = Object.values(results).filter((value) => value === "wrong").length;
  const reviewedCount = Object.values(results).filter((value) => value === "reviewed").length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  /** 交卷后（或该题已提交）只读：禁止再改答案 */
  const readOnly = submitted || paperSubmitted;
  /** P3-2B：交卷归因（错题分布）与上报载荷共用同一份计算 */
  const attribution = useMemo(
    () => (paper ? computePaperResult(paper.questions, results) : null),
    [paper, results]
  );

  const select = (letter: string) => {
    if (!question || readOnly) return;
    setSelected(letter);
    setChosen((current) => ({ ...current, [question.number]: letter }));
  };

  const submit = () => {
    if (!question || readOnly) return;
    if (question.type === "choice" && !selected) return;
    const nextResult: ResultKind =
      question.type === "comprehensive"
        ? "reviewed"
        : selected === question.answerLetter
          ? "correct"
          : "wrong";
    setResults((current) => ({ ...current, [question.number]: nextResult }));
    setSubmitted(true);
  };

  /**
   * v1.44：做完一整套 408 真题后庆祝（含本次实际作答的正确率）。
   * 综合题按"已作答"计入总数，但不参与正确率分子 —— 与 FinishSession 的口径一致。
   */
  const celebrateIfAny = useCallback(
    (sourceResults: Record<number, ResultKind> = results) => {
      const choiceResults = Object.values(sourceResults);
      const answered = choiceResults.filter((value) => value === "correct" || value === "wrong").length;
      const correct = choiceResults.filter((value) => value === "correct").length;
      if (answered === 0) return;
      const percent = Math.round((correct / answered) * 100);
      setCelebrate({
        title: `${year} 年 408 真题 已完成`,
        subtitle: celebrationSummary(correct, answered),
        badge: `${percent}%`,
        tone: celebrationTone(percent),
      });
    },
    [results, year]
  );

  const next = () => {
    if (!paper) return;
    if (index >= paper.questions.length - 1) {
      setFinished(true);
      haptics.success();
      celebrateIfAny();
      return;
    }
    const nextQuestion = paper.questions[index + 1];
    setIndex((value) => value + 1);
    setSelected(nextQuestion ? chosen[nextQuestion.number] ?? "" : "");
    setSubmitted(nextQuestion ? Boolean(results[nextQuestion.number]) || paperSubmitted : paperSubmitted);
  };

  const previous = () => {
    if (!paper || index <= 0) return;
    const previousQuestion = paper.questions[index - 1];
    setIndex((value) => value - 1);
    setSelected(previousQuestion ? chosen[previousQuestion.number] ?? "" : "");
    setSubmitted(previousQuestion ? Boolean(results[previousQuestion.number]) || paperSubmitted : paperSubmitted);
    setFinished(false);
  };

  const jump = (number: number) => {
    if (!paper) return;
    const target = paper.questions.findIndex((item) => item.number === number);
    if (target < 0) return;
    setIndex(target);
    setSelected(chosen[number] ?? "");
    setSubmitted(Boolean(results[number]) || paperSubmitted);
    setFinished(false);
  };

  /**
   * P3-2B：结算本次套卷。
   *
   * 手动交卷与限时到点自动交卷共用：切只读、进总结页、庆祝，并用 paper-result 计算归因后
   * 上报（登录态）。上报结果无论成功 / 401 / 离线 / 服务端异常都会写本机缓存，
   * 见 lib/paper-history.ts；页面只在总结页给出提示。
   */
  const finishPaper = useCallback(
    (options: { auto?: boolean } = {}) => {
      if (!paper || finishingRef.current) return;
      finishingRef.current = true;
      haptics.success();
      setAnswerSheetOpen(false);
      setPaperSubmitted(true);
      setFinished(true);
      celebrateIfAny();
      if (options.auto) {
        Alert.alert("限时结束", "120 分钟已用完，已自动交卷；成绩已保存。");
      }
      if (reportedRef.current) return;
      reportedRef.current = true;
      const startedAtMs = startedAtRef.current || Date.now();
      const submittedAtMs = Date.now();
      const result = computePaperResult(paper.questions, results);
      void submitPaperAttempt({
        year,
        score: result.score,
        totalScore: result.totalScore,
        correct: result.correct,
        wrong: result.wrong,
        unanswered: result.unanswered,
        durationSeconds: Math.max(0, Math.round((submittedAtMs - startedAtMs) / 1000)),
        startedAt: new Date(startedAtMs).toISOString(),
        submittedAt: new Date(submittedAtMs).toISOString(),
        byPoint: result.byPoint,
        bySubject: result.bySubject,
      }).then((outcome) => {
        if (outcome.failure === "unauthorized") {
          setHistoryNotice("未登录：本次成绩已保存在本机，登录后可在「历史成绩」查看。");
        } else if (outcome.failure) {
          setHistoryNotice("成绩上报失败：本次成绩已保存在本机，稍后可在「历史成绩」查看。");
        } else {
          setHistoryNotice("本次成绩已保存。");
        }
      });
    },
    [celebrateIfAny, paper, results, year]
  );

  /** P3-2B：限时倒计时；到 0 自动交卷（交卷后停表） */
  useEffect(() => {
    if (!timedMode || deadlineAt <= 0 || paperSubmitted) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) finishPaper({ auto: true });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadlineAt, finishPaper, paperSubmitted, timedMode]);

  /** P3-2B：开关本次会话的限时模式（默认关，不持久化） */
  const toggleTimedMode = () => {
    if (timedMode) {
      setTimedMode(false);
      setDeadlineAt(0);
      setRemainingSeconds(TIME_LIMIT_SECONDS);
      return;
    }
    setTimedMode(true);
    setDeadlineAt(Date.now() + TIME_LIMIT_SECONDS * 1000);
    setRemainingSeconds(TIME_LIMIT_SECONDS);
  };

  /** P2-4：交卷 —— 未答完先确认；确认后整卷只读并进入总结页 */
  const submitPaper = () => {
    if (!paper || paperSubmitted) return;
    if (unansweredCount > 0) {
      Alert.alert("确认交卷？", `还有 ${unansweredCount} 题未答，确认交卷？`, [
        { text: "继续答题", style: "cancel" },
        { text: "确认交卷", style: "destructive", onPress: () => finishPaper() },
      ]);
      return;
    }
    finishPaper();
  };

  const restart = () => {
    setIndex(0);
    setSelected("");
    setSubmitted(false);
    setResults({});
    setChosen({});
    setFinished(false);
    setPaperSubmitted(false);
    setAnswerSheetOpen(false);
    setCelebrate(null);
    // P3-2B：重新计时并重置上报状态；限时模式回到默认关闭
    setTimedMode(false);
    setDeadlineAt(0);
    setRemainingSeconds(TIME_LIMIT_SECONDS);
    setHistoryNotice("");
    startedAtRef.current = Date.now();
    reportedRef.current = false;
    finishingRef.current = false;
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>正在准备 {year} 年真题…</Text>
      </View>
    );
  }

  if (error || !paper) {
    return (
      <View style={styles.centerState}>
        <ThemedIcon name="alert-circle-outline" size={26} color={colors.danger} />
        <Text style={styles.centerTitle}>试卷加载失败</Text>
        <Text style={styles.centerText}>{error || "未找到该年份试卷"}</Text>
        <PressableScale haptic onPress={() => void load()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>重试</Text>
        </PressableScale>
      </View>
    );
  }

  if (finished) {
    return (
      <>
        <FinishSession
          paper={paper}
          results={results}
          unanswered={unansweredCount}
          attribution={attribution}
          historyNotice={historyNotice}
          onRestart={restart}
          onReview={() => {
            // P2-4：优先从第一道错题开始逐题回顾，没有错题就从第 1 题开始
            const firstWrong = Object.entries(results).find(([, kind]) => kind === "wrong")?.[0];
            setFinished(false);
            jump(firstWrong ? Number(firstWrong) : paper.questions[0]?.number ?? 1);
          }}
          onJump={(number) => {
            setFinished(false);
            jump(number);
          }}
          onOpenPoint={(key) => {
            // 与 408 hub 一致：同名路由重复 push 会冻结 params，走场外通道带 key（见 lib/nav-pending.ts）
            setNavPendingParams("quiz-408-point", { key });
            router.push(exam408PointHref(key) as never);
          }}
          onOpenHistory={() => router.push("/exam-408-paper-history" as never)}
          onBack408={() => router.replace("/exam-408" as never)}
        />
        {/* v1.44：做完一整套真题的庆祝弹窗（烟花 + 彩带） */}
        <CelebrationModal
          visible={!!celebrate}
          onClose={() => setCelebrate(null)}
          title={celebrate?.title ?? ""}
          subtitle={celebrate?.subtitle}
          badge={celebrate?.badge}
          tone={celebrate?.tone}
        />
      </>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title={`${year} 年 408 真题`} scrollY={header.scrollY} backTo={`/quiz/paper/${year}`} />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={entrance(0)} style={styles.progressHead}>
          <View style={styles.progressTextRow}>
            <Text style={styles.progressText}>
              第 {question?.number ?? 0} 题 / 共 {paper.questions.length} 题
            </Text>
            <View style={styles.progressRight}>
              <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
              <PressableScale
                haptic
                onPress={() => setAnswerSheetOpen(true)}
                style={styles.sheetEntry}
                accessibilityRole="button"
                accessibilityLabel={`打开答题卡，已答 ${answeredCount} 题，共 ${totalQuestions} 题`}
              >
                <ThemedIcon name="grid-outline" size={14} color={colors.primary} />
                <Text style={styles.sheetEntryText}>答题卡</Text>
                <View style={styles.sheetEntryBadge}>
                  <Text style={styles.sheetEntryBadgeText}>
                    {answeredCount}/{totalQuestions}
                  </Text>
                </View>
              </PressableScale>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(2, progress)}%` }]} />
          </View>
          {/* P3-2B：可选限时 120 分钟（默认关、仅本次会话）；剩 10 分钟倒计时变警示色 */}
          <View style={styles.timerRow}>
            <PressableScale
              haptic
              onPress={toggleTimedMode}
              style={[styles.timerToggle, timedMode && styles.timerToggleActive]}
              accessibilityRole="switch"
              accessibilityState={{ checked: timedMode }}
              accessibilityLabel="限时 120 分钟开关"
            >
              <ThemedIcon
                name="timer-outline"
                size={14}
                color={timedMode ? "#FFFFFF" : colors.textMuted}
              />
              <Text style={[styles.timerToggleText, timedMode && styles.timerToggleTextActive]}>
                限时 120 分钟
              </Text>
            </PressableScale>
            {timedMode ? (
              <View style={styles.timerReadout}>
                <ThemedIcon
                  ios="alarm"
                  name="alarm-outline"
                  size={14}
                  color={remainingSeconds <= TIME_WARNING_SECONDS ? colors.danger : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.timerValue,
                    remainingSeconds <= TIME_WARNING_SECONDS && styles.timerValueUrgent,
                  ]}
                  accessibilityLabel={`剩余时间 ${formatClock(remainingSeconds)}`}
                >
                  {formatClock(remainingSeconds)}
                </Text>
              </View>
            ) : null}
          </View>
          {timedMode ? (
            <Text style={styles.timerHint}>到 0 自动交卷，仅本次会话生效</Text>
          ) : null}
        </Animated.View>

        {question ? (
          /* v1.50：左右滑动切题（右滑上一题 / 左滑下一题；最后一题左滑 = 查看结果，与按钮一致） */
          <QuestionSwipe
            canPrev={index > 0}
            canNext
            onPrev={previous}
            onNext={next}
          >
          <Animated.View entering={entrance(1)} style={styles.questionCard}>
            <View style={styles.meta}>
              <View style={styles.numberBadge}>
                <Text style={styles.numberBadgeText}>{question.number}</Text>
              </View>
              <View style={styles.metaBody}>
                <Text style={styles.metaTitle}>
                  {question.type === "choice" ? "单项选择题" : "综合应用题"}
                </Text>
                <Text style={styles.metaText}>
                  {question.points} 分 · {question.subject.title}
                </Text>
              </View>
              <PressableScale haptic onPress={() => jump(Math.max(1, question.number - 1))} style={styles.jumpButton}>
                <Text style={styles.jumpText}>定位</Text>
              </PressableScale>
            </View>

            <QuestionBlocks text={cleanExamStem(question.stem)} style={styles.stem} compact />

            <QuestionImages question={question} />

            {question.options.length > 0 ? (
              <View style={styles.optionList}>
                {question.options.map((option) => {
                  const active = selected === option.letter;
                  const correct = readOnly && question.answerLetter === option.letter;
                  const wrong = readOnly && active && question.answerLetter !== option.letter;
                  return (
                    <PressableScale
                      key={option.letter}
                      haptic
                      scaleTo={0.99}
                      disabled={readOnly}
                      onPress={() => select(option.letter)}
                      style={[
                        styles.option,
                        active && styles.optionActive,
                        correct && styles.optionCorrect,
                        wrong && styles.optionWrong,
                      ]}
                    >
                      <View style={styles.optionLetter}>
                        <Text style={styles.optionLetterText}>{option.letter}</Text>
                      </View>
                      <RichText text={option.text} style={styles.optionText} />
                      {correct ? <ThemedIcon name="checkmark-circle" size={19} color={colors.success} /> : null}
                      {wrong ? <ThemedIcon name="close-circle" size={19} color={colors.danger} /> : null}
                    </PressableScale>
                  );
                })}
              </View>
            ) : null}

            {index === 0 && paper.questions.length > 1 ? (
              <View style={styles.swipeHintRow}>
                <ThemedIcon name="swap-horizontal-outline" size={13} color={colors.textFaint} />
                <Text style={styles.swipeHintText}>左右滑动切换题目</Text>
              </View>
            ) : null}

            {readOnly ? (
              <View
                style={[
                  styles.answerBox,
                  result === "wrong" && styles.answerBoxWrong,
                  result === "reviewed" && styles.answerBoxReview,
                  !result && styles.answerBoxSkipped,
                ]}
              >
                <Text style={styles.answerTitle}>
                  {question.type === "comprehensive"
                    ? "参考答案"
                    : !result
                      ? "本题未作答"
                      : result === "correct"
                        ? "回答正确"
                        : "回答错误"}
                </Text>
                {question.answerLetter ? (
                  <Text selectable style={styles.answerText}>
                    {`答案：${question.answerLetter}。`}
                  </Text>
                ) : null}
                {answerBody ? (
                  <QuestionBlocks text={answerBody} style={styles.answerText} compact />
                ) : null}
                {question.answerImageRefs.map((url) => (
                  <PressableScale
                    key={url}
                    haptic
                    onPress={() => void Linking.openURL(resolveExamAssetUrl(url))}
                    style={styles.imageFrame}
                    accessibilityRole="button"
                    accessibilityLabel={`查看第 ${question.number} 题答案图`}
                  >
                    <Image
                      source={{ uri: resolveExamAssetUrl(url) }}
                      style={styles.image}
                      contentFit="contain"
                      transition={160}
                    />
                  </PressableScale>
                ))}
              </View>
            ) : null}

            {question.videoUrl ? (
              <PressableScale
                haptic
                onPress={() => void Linking.openURL(question.videoUrl as string)}
                style={styles.videoLink}
                accessibilityRole="button"
                accessibilityLabel="打开本题视频讲解"
              >
                <ThemedIcon name="play-circle-outline" size={17} color={colors.primary} />
                <Text style={styles.videoText}>打开视频讲解</Text>
              </PressableScale>
            ) : null}

            <View style={styles.actions}>
              <PressableScale
                haptic
                disabled={index === 0}
                onPress={previous}
                style={[styles.secondaryButton, index === 0 && styles.disabled]}
              >
                <ThemedIcon name="chevron-back" size={17} color={colors.textSecondary} />
                <Text style={styles.secondaryText}>上一题</Text>
              </PressableScale>
              <View style={styles.actionsRight}>
                {!readOnly ? (
                  <PressableScale
                    haptic
                    disabled={question.type === "choice" && !selected}
                    onPress={submit}
                    style={[
                      styles.primaryButton,
                      question.type === "choice" && !selected && styles.disabled,
                    ]}
                  >
                    <ThemedIcon name="eye-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>
                      {question.type === "choice" ? "提交答案" : "查看答案"}
                    </Text>
                  </PressableScale>
                ) : null}
                <PressableScale haptic onPress={next} style={styles.nextButton}>
                  <Text style={styles.nextText}>
                    {index >= paper.questions.length - 1 ? "查看结果" : "下一题"}
                  </Text>
                  <ThemedIcon name="chevron-forward" size={17} color={colors.primary} />
                </PressableScale>
              </View>
            </View>
          </Animated.View>
          </QuestionSwipe>
        ) : null}
      </Animated.ScrollView>

      {/* P2-4：固定底部操作条（答题卡 + 交卷），不遮挡内容（与滚动区同为 flex 列） */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <PressableScale
          haptic
          onPress={() => setAnswerSheetOpen(true)}
          style={styles.bottomGhost}
          accessibilityRole="button"
          accessibilityLabel={`打开答题卡，已答 ${answeredCount} 题，共 ${totalQuestions} 题，未答 ${unansweredCount} 题`}
        >
          <ThemedIcon name="grid-outline" size={17} color={colors.primary} />
          <Text style={styles.bottomGhostText}>答题卡</Text>
          <Text style={styles.bottomGhostMeta}>
            {answeredCount}/{totalQuestions}
          </Text>
        </PressableScale>
        <PressableScale
          haptic
          onPress={paperSubmitted ? () => setFinished(true) : submitPaper}
          style={styles.bottomPrimary}
          accessibilityRole="button"
          accessibilityLabel={paperSubmitted ? "查看交卷总结" : "交卷"}
        >
          <ThemedIcon name={paperSubmitted ? "stats-chart-outline" : "paper-plane-outline"} size={16} color="#FFFFFF" />
          <Text style={styles.bottomPrimaryText}>{paperSubmitted ? "查看总结" : "交卷"}</Text>
        </PressableScale>
      </View>

      {/* P2-4：答题卡（题号网格 5 列 + 状态色 + 统计 + 跳题） */}
      <BottomSheet
        visible={answerSheetOpen}
        onClose={() => setAnswerSheetOpen(false)}
        title={`${year} 年答题卡`}
        subtitle={`已答 ${answeredCount}/${totalQuestions} · 正确 ${correctCount} · 错误 ${wrongCount}${reviewedCount > 0 ? ` · 查看 ${reviewedCount}` : ""}`}
        icon="grid-outline"
        height="76%"
      >
        <View style={styles.sheetStats}>
          <SheetStat label="已答" value={`${answeredCount}/${totalQuestions}`} styles={styles} />
          <SheetStat label="正确" value={`${correctCount}`} styles={styles} tone="success" />
          <SheetStat label="错误" value={`${wrongCount}`} styles={styles} tone="danger" />
          <SheetStat label="未答" value={`${unansweredCount}`} styles={styles} />
        </View>

        <View style={styles.sheetGrid}>
          {paper.questions.map((item) => {
            const kind = results[item.number];
            const isCurrent = item.number === question?.number;
            const cellStyle =
              kind === "correct"
                ? styles.cellCorrect
                : kind === "wrong"
                  ? styles.cellWrong
                  : kind === "reviewed"
                    ? styles.cellReviewed
                    : styles.cellPending;
            const textStyle =
              kind === "correct"
                ? styles.cellTextCorrect
                : kind === "wrong"
                  ? styles.cellTextWrong
                  : kind === "reviewed"
                    ? styles.cellTextReviewed
                    : styles.cellTextPending;
            const statusLabel =
              kind === "correct" ? "已答对" : kind === "wrong" ? "已答错" : kind === "reviewed" ? "已查看" : "未作答";
            return (
              <PressableScale
                key={item.number}
                haptic
                scaleTo={0.94}
                onPress={() => {
                  setAnswerSheetOpen(false);
                  setFinished(false);
                  jump(item.number);
                }}
                style={[styles.cell, cellStyle, isCurrent && styles.cellCurrent]}
                accessibilityRole="button"
                accessibilityLabel={`第 ${item.number} 题，${statusLabel}${isCurrent ? "，当前题" : ""}`}
              >
                <Text style={[styles.cellText, textStyle]}>{item.number}</Text>
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.legend}>
          <LegendDot styles={styles} label="已答对" tone="success" />
          <LegendDot styles={styles} label="已答错" tone="danger" />
          <LegendDot styles={styles} label="已查看" tone="primary" />
          <LegendDot styles={styles} label="未作答" tone="muted" />
          <LegendDot styles={styles} label="当前题" tone="current" />
        </View>
      </BottomSheet>
    </View>
  );
}

/** 答题卡统计格（已答 / 正确 / 错误 / 未答） */
function SheetStat({
  label,
  value,
  styles,
  tone = "muted",
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
  tone?: "success" | "danger" | "muted";
}) {
  const valueStyle =
    tone === "success" ? styles.sheetStatValueSuccess : tone === "danger" ? styles.sheetStatValueDanger : styles.sheetStatValue;
  return (
    <View style={styles.sheetStat}>
      <Text style={[styles.sheetStatValueBase, valueStyle]}>{value}</Text>
      <Text style={styles.sheetStatLabel}>{label}</Text>
    </View>
  );
}

/** 答题卡图例点 */
function LegendDot({
  label,
  tone,
  styles,
}: {
  label: string;
  tone: "success" | "danger" | "primary" | "muted" | "current";
  styles: ReturnType<typeof makeStyles>;
}) {
  const dotStyle =
    tone === "success"
      ? styles.legendDotSuccess
      : tone === "danger"
        ? styles.legendDotDanger
        : tone === "primary"
          ? styles.legendDotPrimary
          : tone === "current"
            ? styles.legendDotCurrent
            : styles.legendDotMuted;
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, dotStyle]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function FinishSession({
  paper,
  results,
  unanswered,
  attribution,
  historyNotice,
  onRestart,
  onReview,
  onJump,
  onOpenPoint,
  onOpenHistory,
  onBack408,
}: {
  paper: Exam408Paper;
  results: Record<number, ResultKind>;
  /** P2-4：未答题数（交卷时仍未作答的题） */
  unanswered: number;
  /** P3-2B：交卷归因（错题分布）；试卷异常时为空 */
  attribution: PaperResult | null;
  /** P3-2B：成绩保存提示（已保存 / 仅本机 / 上报失败） */
  historyNotice: string;
  onRestart: () => void;
  onReview: () => void;
  onJump: (number: number) => void;
  /** P3-2B：点开知识点（错题分布可点进 /quiz/408-point） */
  onOpenPoint: (key: string) => void;
  /** P3-2B：进入历史成绩页 */
  onOpenHistory: () => void;
  onBack408: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const correct = Object.values(results).filter((item) => item === "correct").length;
  const wrong = Object.values(results).filter((item) => item === "wrong").length;
  const reviewed = Object.values(results).filter((item) => item === "reviewed").length;
  const answered = correct + wrong;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const score = paper.questions.reduce(
    (total, question) => total + (results[question.number] === "correct" ? question.points : 0),
    0
  );
  const wrongNumbers = Object.entries(results)
    .filter(([, result]) => result === "wrong")
    .map(([number]) => Number(number));

  return (
    <ScrollView
      style={styles.finishScroll}
      contentContainerStyle={styles.finishRoot}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.finishHero}>
        <View style={styles.finishIcon}>
          <ThemedIcon name="trophy-outline" size={34} color={colors.primary} />
        </View>
        <Text style={styles.finishTitle}>{paper.paper.year} 年真题已完成</Text>
        <Text style={styles.finishText}>
          客观题答对 {correct} 题、答错 {wrong} 题、未答 {unanswered} 题；综合题查看参考答案 {reviewed} 题。
        </Text>
        {historyNotice ? (
          <View style={styles.finishNotice}>
            <ThemedIcon name="checkmark-circle" size={15} color={colors.success} />
            <Text style={styles.finishNoticeText}>{historyNotice}</Text>
          </View>
        ) : null}
        <View style={styles.finishMetrics}>
          <FinishMetric value={`${score}`} label="客观题得分" styles={styles} />
          <FinishMetric value={`${accuracy}%`} label="正确率" styles={styles} />
          <FinishMetric value={`${correct}`} label="答对" styles={styles} />
          <FinishMetric value={`${wrong}`} label="答错" styles={styles} />
          <FinishMetric value={`${unanswered}`} label="未答" styles={styles} />
        </View>
        <PressableScale haptic scaleTo={0.98} onPress={onReview} style={styles.primaryButton}>
          <ThemedIcon name="eye-outline" size={17} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>查看解析</Text>
        </PressableScale>
        <View style={styles.finishSecondaryRow}>
          <PressableScale haptic onPress={onRestart} style={styles.finishSecondary}>
            <ThemedIcon name="refresh" size={16} color={colors.textSecondary} />
            <Text style={styles.secondaryText}>再来一遍</Text>
          </PressableScale>
          <PressableScale haptic onPress={onBack408} style={styles.finishSecondary}>
            <ThemedIcon name="arrow-back" size={16} color={colors.textSecondary} />
            <Text style={styles.secondaryText}>返回 408</Text>
          </PressableScale>
        </View>
      </View>

      {attribution ? <WrongBreakdown attribution={attribution} onOpenPoint={onOpenPoint} /> : null}

      {wrongNumbers.length > 0 ? (
        <View style={styles.wrongSection}>
          <Text style={styles.wrongTitle}>错题复盘</Text>
          <View style={styles.wrongWrap}>
            {wrongNumbers.map((number) => (
              <PressableScale
                key={number}
                haptic
                onPress={() => onJump(number)}
                style={styles.wrongChip}
              >
                <Text style={styles.wrongChipText}>第 {number} 题</Text>
              </PressableScale>
            ))}
          </View>
        </View>
      ) : null}

      <PressableScale
        haptic
        scaleTo={0.99}
        onPress={onOpenHistory}
        style={styles.finishHistory}
        accessibilityRole="button"
        accessibilityLabel="查看历史成绩"
      >
        <View style={styles.finishHistoryIcon}>
          <ThemedIcon name="time-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.finishHistoryBody}>
          <Text style={styles.finishHistoryTitle}>历史成绩</Text>
          <Text style={styles.finishHistoryText}>历年套卷得分、正确率与用时</Text>
        </View>
        <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
      </PressableScale>
    </ScrollView>
  );
}

/** P3-2B：总结页「错题分布」——top 知识点（可点进知识点页）+ 科目统计 */
function WrongBreakdown({
  attribution,
  onOpenPoint,
}: {
  attribution: PaperResult;
  onOpenPoint: (key: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const points = attribution.byPoint.filter((item) => item.wrong > 0).slice(0, 6);
  const subjects = attribution.bySubject;
  return (
    <View style={styles.breakdownSection}>
      <View style={styles.breakdownHead}>
        <Text style={styles.wrongTitle}>错题分布</Text>
        <Text style={styles.breakdownMeta}>
          错 {attribution.wrong} 题 · 已判 {attribution.correct + attribution.wrong} 题
        </Text>
      </View>
      {subjects.length > 0 ? (
        <View style={styles.subjectStatRow}>
          {subjects.map((subject) => (
            <View key={subject.key} style={styles.subjectStat}>
              <Text style={styles.subjectStatTitle} numberOfLines={1}>
                {subject.title}
              </Text>
              <Text style={styles.subjectStatValue}>
                {subject.wrong}/{subject.total}
              </Text>
              <Text style={styles.subjectStatLabel}>错 / 题</Text>
            </View>
          ))}
        </View>
      ) : null}
      {points.length > 0 ? (
        <View style={styles.pointStatList}>
          {points.map((point) => {
            const ratio = point.total > 0 ? Math.round((point.wrong / point.total) * 100) : 0;
            return (
              <PressableScale
                key={point.key}
                haptic
                scaleTo={0.99}
                onPress={() => onOpenPoint(point.key)}
                style={styles.pointStatRow}
                accessibilityRole="button"
                accessibilityLabel={`打开知识点 ${point.title}，错 ${point.wrong} 题`}
              >
                <View style={styles.pointStatBody}>
                  <Text style={styles.pointStatTitle} numberOfLines={1}>
                    {point.title}
                  </Text>
                  <View style={styles.pointStatTrack}>
                    <View style={[styles.pointStatFill, { width: `${Math.max(4, ratio)}%` }]} />
                  </View>
                </View>
                <Text style={styles.pointStatValue}>
                  {point.wrong}/{point.total}
                </Text>
                <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
              </PressableScale>
            );
          })}
        </View>
      ) : (
        <Text style={styles.breakdownEmpty}>
          {attribution.wrong === 0 ? "本套没有错题，继续保持。" : "错题缺少知识点标注，暂无分布。"}
        </Text>
      )}
    </View>
  );
}

function QuestionImages({ question }: { question: Exam408Question }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (question.imageRefs.length === 0) return null;
  return (
    <View style={styles.imageGrid}>
      {question.imageRefs.map((url) => (
        <PressableScale
          key={url}
          haptic
          onPress={() => void Linking.openURL(resolveExamAssetUrl(url))}
          style={styles.imageFrame}
          accessibilityRole="button"
          accessibilityLabel={`查看第 ${question.number} 题配图`}
        >
          <Image
            source={{ uri: resolveExamAssetUrl(url) }}
            style={styles.image}
            contentFit="contain"
            transition={160}
          />
        </PressableScale>
      ))}
    </View>
  );
}

function FinishMetric({
  value,
  label,
  styles,
}: {
  value: string;
  label: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.finishMetric}>
      <Text style={styles.finishMetricValue}>{value}</Text>
      <Text style={styles.finishMetricLabel}>{label}</Text>
    </View>
  );
}

/** P3-2B：倒计时显示 mm:ss（分钟位允许超过 99，如 120:00） */
function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function SessionMissing() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.centerState}>
      <ThemedIcon name="document-text-outline" size={26} color={colors.textMuted} />
      <Text style={styles.centerTitle}>缺少有效年份</Text>
      <PressableScale haptic onPress={() => router.replace("/exam-408" as never)} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>返回 408 专区</Text>
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
    centerTitle: { ...typography.title2, color: colors.text, textAlign: "center" },
    centerText: { ...typography.callout, color: colors.textMuted, textAlign: "center" },
    progressHead: { gap: spacing.sm },
    progressTextRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    progressRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    sheetEntry: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
    },
    sheetEntryText: { ...typography.caption, fontWeight: "800", color: colors.primary },
    sheetEntryBadge: { paddingHorizontal: 5, borderRadius: 999, backgroundColor: colors.surface },
    sheetEntryBadgeText: { ...typography.micro, fontWeight: "800", color: colors.primary },

    /* P2-4 固定底部操作条 */
    bottomBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.canvas,
    },
    bottomGhost: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 46,
      borderRadius: radius.lg,
      backgroundColor: colors.primarySoft,
    },
    bottomGhostText: { ...typography.callout, fontWeight: "700", color: colors.primary },
    bottomGhostMeta: { ...typography.caption, fontWeight: "700", color: colors.primary },
    bottomPrimary: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 46,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
    },
    bottomPrimaryText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
    progressText: { ...typography.caption, color: colors.textSecondary },
    progressPercent: { ...typography.caption, fontWeight: "800", color: colors.primary },
    progressTrack: { height: 7, borderRadius: radius.pill, overflow: "hidden", backgroundColor: colors.surfaceMuted },
    progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.primary },
    questionCard: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      ...shadows.card,
    },
    meta: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    numberBadge: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    numberBadgeText: { ...typography.headline, color: colors.primary, fontVariant: ["tabular-nums"] },
    metaBody: { flex: 1, gap: 2 },
    metaTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    metaText: { ...typography.caption, color: colors.textMuted },
    jumpButton: { padding: 8 },
    jumpText: { ...typography.caption, color: colors.primary },
    stem: { ...typography.body, color: colors.text, lineHeight: 27 },
    imageGrid: { gap: spacing.sm },
    imageFrame: {
      minHeight: 160,
      borderRadius: radius.md,
      overflow: "hidden",
      backgroundColor: "#FFFFFF",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    image: { width: "100%", height: 230 },
    optionList: { gap: spacing.sm },
    option: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.md,
      backgroundColor: colors.surfaceMuted,
    },
    optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    optionCorrect: { borderColor: colors.success, backgroundColor: colors.successSoft },
    optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
    optionLetter: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    optionLetterText: { ...typography.caption, fontWeight: "900", color: colors.textSecondary },
    optionText: { flex: 1, ...typography.callout, color: colors.textSecondary, lineHeight: 22 },
    answerBox: {
      gap: spacing.sm,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.successSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.success,
    },
    answerBoxWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
    answerBoxReview: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    answerTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    answerText: { ...typography.callout, color: colors.textSecondary, lineHeight: 22 },
    videoLink: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    videoText: { ...typography.callout, fontWeight: "700", color: colors.primary },
    swipeHintRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
    swipeHintText: { ...typography.micro, color: colors.textFaint },
    answerBoxSkipped: {
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    actionsRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    primaryButton: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.primary,
    },
    primaryButtonText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
    secondaryButton: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surfaceMuted,
    },
    secondaryText: { ...typography.callout, fontWeight: "700", color: colors.textSecondary },
    nextButton: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.primarySoft,
    },
    nextText: { ...typography.callout, fontWeight: "800", color: colors.primary },
    disabled: { opacity: 0.42 },
    finishScroll: { flex: 1, backgroundColor: colors.canvas },
    finishRoot: {
      flexGrow: 1,
      padding: spacing.lg,
      gap: spacing.lg,
      backgroundColor: colors.canvas,
    },
    finishHero: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.lg,
      borderRadius: radius.xl,
      padding: spacing.xl,
      backgroundColor: colors.surfaceStrong,
      ...shadows.card,
    },
    finishIcon: {
      width: 72,
      height: 72,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    finishTitle: { ...typography.title1, color: colors.text, textAlign: "center" },
    finishText: { ...typography.callout, color: colors.textMuted, textAlign: "center" },
    finishMetrics: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    finishSecondaryRow: { width: "100%", flexDirection: "row", gap: spacing.sm },
    finishSecondary: {
      flex: 1,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    finishMetric: {
      flex: 1,
      flexBasis: "29%",
      minWidth: 88,
      alignItems: "center",
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.surfaceMuted,
      gap: 2,
    },
    finishMetricValue: { ...typography.title2, color: colors.text, fontVariant: ["tabular-nums"] },
    finishMetricLabel: { ...typography.micro, color: colors.textMuted },
    wrongSection: { gap: spacing.sm, borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surfaceStrong },
    wrongTitle: { ...typography.headline, color: colors.text },
    wrongWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    wrongChip: { minHeight: 40, borderRadius: radius.md, paddingHorizontal: spacing.md, justifyContent: "center", backgroundColor: colors.dangerSoft },
    wrongChipText: { ...typography.caption, fontWeight: "800", color: colors.danger },

    /* P3-2B 限时模式 */
    timerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      minHeight: 32,
    },
    timerToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
    },
    timerToggleActive: { backgroundColor: colors.primary },
    timerToggleText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    timerToggleTextActive: { color: "#FFFFFF" },
    timerReadout: { flexDirection: "row", alignItems: "center", gap: 4 },
    timerValue: { ...typography.callout, fontWeight: "800", color: colors.textSecondary, fontVariant: ["tabular-nums"] },
    timerValueUrgent: { color: colors.danger },
    timerHint: { ...typography.micro, color: colors.textFaint },

    /* P3-2B 交卷总结：保存提示 / 错题分布 / 历史成绩入口 */
    finishNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      width: "100%",
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.primarySoft,
    },
    finishNoticeText: { ...typography.caption, color: colors.primary, flex: 1, lineHeight: 18 },
    breakdownSection: {
      gap: spacing.sm,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
    },
    breakdownHead: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    breakdownMeta: { ...typography.caption, color: colors.textMuted },
    subjectStatRow: { flexDirection: "row", gap: spacing.sm },
    subjectStat: {
      flex: 1,
      alignItems: "center",
      gap: 2,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    subjectStatTitle: { ...typography.micro, color: colors.textMuted },
    subjectStatValue: { ...typography.callout, fontWeight: "800", color: colors.danger, fontVariant: ["tabular-nums"] },
    subjectStatLabel: { ...typography.micro, color: colors.textFaint },
    pointStatList: { gap: spacing.sm },
    pointStatRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 46 },
    pointStatBody: { flex: 1, gap: 4 },
    pointStatTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    pointStatTrack: {
      height: 6,
      borderRadius: radius.pill,
      overflow: "hidden",
      backgroundColor: colors.surfaceMuted,
    },
    pointStatFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.danger },
    pointStatValue: { ...typography.caption, fontWeight: "800", color: colors.danger, fontVariant: ["tabular-nums"] },
    breakdownEmpty: { ...typography.caption, color: colors.textMuted },
    finishHistory: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    finishHistoryIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    finishHistoryBody: { flex: 1, gap: 2 },
    finishHistoryTitle: { ...typography.headline, color: colors.text },
    finishHistoryText: { ...typography.caption, color: colors.textMuted },

    /* P2-4 答题卡 */
    sheetStats: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
    sheetStat: {
      flex: 1,
      alignItems: "center",
      gap: 2,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    sheetStatValueBase: { ...typography.title2, fontVariant: ["tabular-nums"] },
    sheetStatValue: { color: colors.text },
    sheetStatValueSuccess: { color: colors.success },
    sheetStatValueDanger: { color: colors.danger },
    sheetStatLabel: { ...typography.micro, color: colors.textMuted },
    sheetGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
    cell: {
      width: "17.5%",
      minHeight: 46,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: "transparent",
      backgroundColor: colors.surfaceMuted,
    },
    cellPending: { backgroundColor: colors.surfaceMuted },
    cellCorrect: { backgroundColor: colors.successSoft, borderColor: colors.success },
    cellWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
    cellReviewed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    cellCurrent: { borderWidth: 2, borderColor: colors.text },
    cellText: { ...typography.callout, fontWeight: "800", fontVariant: ["tabular-nums"] },
    cellTextPending: { color: colors.textMuted },
    cellTextCorrect: { color: colors.success },
    cellTextWrong: { color: colors.danger },
    cellTextReviewed: { color: colors.primary },
    legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: "transparent" },
    legendDotSuccess: { backgroundColor: colors.successSoft, borderColor: colors.success },
    legendDotDanger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
    legendDotPrimary: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    legendDotMuted: { backgroundColor: colors.surfaceMuted },
    legendDotCurrent: { borderWidth: 2, borderColor: colors.text },
    legendLabel: { ...typography.micro, color: colors.textMuted },
  });
