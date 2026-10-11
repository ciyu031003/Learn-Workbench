import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import Animated from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import {
  cleanAnswerText,
  cleanExamStem,
  getExam408Paper,
  resolveExamAssetUrl,
  type Exam408Paper,
  type Exam408Question,
} from "@/lib/exam-408";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

type ResultKind = "correct" | "wrong" | "reviewed";

export default function Exam408PaperSessionScreen() {
  const params = useLocalSearchParams<{ year?: string; start?: string }>();
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return <SessionMissing />;
  }
  return <PaperSession year={year} start={Number(params.start) || 1} />;
}

function PaperSession({ year, start }: { year: number; start: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getExam408Paper(year);
      const target = data.questions.findIndex((question) => question.number === start);
      setPaper(data);
      setIndex(target >= 0 ? target : 0);
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

  const select = (letter: string) => {
    if (!question || submitted) return;
    setSelected(letter);
    setChosen((current) => ({ ...current, [question.number]: letter }));
  };

  const submit = () => {
    if (!question || submitted) return;
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

  const next = () => {
    if (!paper) return;
    if (index >= paper.questions.length - 1) {
      setFinished(true);
      return;
    }
    const nextQuestion = paper.questions[index + 1];
    setIndex((value) => value + 1);
    setSelected(nextQuestion ? chosen[nextQuestion.number] ?? "" : "");
    setSubmitted(nextQuestion ? Boolean(results[nextQuestion.number]) : false);
  };

  const previous = () => {
    if (!paper || index <= 0) return;
    const previousQuestion = paper.questions[index - 1];
    setIndex((value) => value - 1);
    setSelected(previousQuestion ? chosen[previousQuestion.number] ?? "" : "");
    setSubmitted(previousQuestion ? Boolean(results[previousQuestion.number]) : false);
    setFinished(false);
  };

  const jump = (number: number) => {
    if (!paper) return;
    const target = paper.questions.findIndex((item) => item.number === number);
    if (target < 0) return;
    setIndex(target);
    setSelected(chosen[number] ?? "");
    setSubmitted(Boolean(results[number]));
    setFinished(false);
  };

  const restart = () => {
    setIndex(0);
    setSelected("");
    setSubmitted(false);
    setResults({});
    setChosen({});
    setFinished(false);
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
      <FinishSession
        paper={paper}
        results={results}
        onRestart={restart}
        onJump={(number) => {
          setFinished(false);
          jump(number);
        }}
      />
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
            <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(2, progress)}%` }]} />
          </View>
        </Animated.View>

        {question ? (
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

            <Text selectable style={styles.stem}>
              {cleanExamStem(question.stem)}
            </Text>

            <QuestionImages question={question} />

            {question.options.length > 0 ? (
              <View style={styles.optionList}>
                {question.options.map((option) => {
                  const active = selected === option.letter;
                  const correct = submitted && question.answerLetter === option.letter;
                  const wrong = submitted && active && question.answerLetter !== option.letter;
                  return (
                    <PressableScale
                      key={option.letter}
                      haptic
                      scaleTo={0.99}
                      disabled={submitted}
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
                      <Text style={styles.optionText}>{option.text}</Text>
                      {correct ? <ThemedIcon name="checkmark-circle" size={19} color={colors.success} /> : null}
                      {wrong ? <ThemedIcon name="close-circle" size={19} color={colors.danger} /> : null}
                    </PressableScale>
                  );
                })}
              </View>
            ) : null}

            {submitted ? (
              <View
                style={[
                  styles.answerBox,
                  result === "wrong" && styles.answerBoxWrong,
                  result === "reviewed" && styles.answerBoxReview,
                ]}
              >
                <Text style={styles.answerTitle}>
                  {question.type === "comprehensive"
                    ? "参考答案"
                    : result === "correct"
                      ? "回答正确"
                      : "回答错误"}
                </Text>
                <Text selectable style={styles.answerText}>
                  {question.answerLetter ? `答案：${question.answerLetter}。` : ""}
                  {cleanAnswerText(question.answerText)}
                </Text>
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
                {!submitted ? (
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
        ) : null}
      </Animated.ScrollView>
    </View>
  );
}

function FinishSession({
  paper,
  results,
  onRestart,
  onJump,
}: {
  paper: Exam408Paper;
  results: Record<number, ResultKind>;
  onRestart: () => void;
  onJump: (number: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const correct = Object.values(results).filter((item) => item === "correct").length;
  const wrong = Object.values(results).filter((item) => item === "wrong").length;
  const reviewed = Object.values(results).filter((item) => item === "reviewed").length;
  const score = paper.questions.reduce(
    (total, question) => total + (results[question.number] === "correct" ? question.points : 0),
    0
  );
  const wrongNumbers = Object.entries(results)
    .filter(([, result]) => result === "wrong")
    .map(([number]) => Number(number));

  return (
    <View style={styles.finishRoot}>
      <View style={styles.finishHero}>
        <View style={styles.finishIcon}>
          <ThemedIcon name="trophy-outline" size={34} color={colors.primary} />
        </View>
        <Text style={styles.finishTitle}>{paper.paper.year} 年真题刷题完成</Text>
        <Text style={styles.finishText}>
          选择题答对 {correct} 题、答错 {wrong} 题；综合题已查看参考答案 {reviewed} 题。
        </Text>
        <View style={styles.finishMetrics}>
          <FinishMetric value={`${score}`} label="客观题得分" styles={styles} />
          <FinishMetric value={`${correct}`} label="答对" styles={styles} />
          <FinishMetric value={`${wrong}`} label="需复盘" styles={styles} />
        </View>
        <PressableScale haptic scaleTo={0.98} onPress={onRestart} style={styles.primaryButton}>
          <ThemedIcon name="refresh" size={17} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>重新刷一遍</Text>
        </PressableScale>
      </View>

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

      <PressableScale haptic onPress={() => router.replace(`/quiz/paper/${paper.paper.year}` as never)} style={styles.secondaryButton}>
        <ThemedIcon name="arrow-back" size={17} color={colors.textSecondary} />
        <Text style={styles.secondaryText}>返回试卷首页</Text>
      </PressableScale>
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

function SessionMissing() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.centerState}>
      <ThemedIcon name="document-text-outline" size={26} color={colors.textMuted} />
      <Text style={styles.centerTitle}>缺少有效年份</Text>
      <PressableScale haptic onPress={() => router.replace("/quiz/408" as never)} style={styles.primaryButton}>
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
    progressTextRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
    finishRoot: { flex: 1, padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.canvas },
    finishHero: {
      flex: 1,
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
    finishMetrics: { width: "100%", flexDirection: "row", gap: spacing.sm },
    finishMetric: {
      flex: 1,
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
  });
