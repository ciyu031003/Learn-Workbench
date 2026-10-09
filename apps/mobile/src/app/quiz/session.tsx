import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getLearningTrack, type LearningQuestion, type LearningTrack } from "@learn-workbench/content";
import { getApiUrl } from "@/config";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { haptics } from "@/lib/haptics";
import { localKey } from "@/lib/focus-series";
import { quizFooterPaddingBottom, quizTopBarPaddingTop } from "@/lib/quiz-layout";
import {
  isLearningAnswerCorrect,
  loadLearningAttempts,
  pickLearningQuestions,
  recordLearningAttempt,
  wrongQuestionKeys,
  type LearningAttempt,
} from "@/lib/learning-progress";
import { useAppStore } from "@/store/app-store";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

type SessionMode = "daily" | "stage" | "wrong";

export default function QuizSessionScreen() {
  const params = useLocalSearchParams<{ track?: string; stage?: string; mode?: string; seed?: string }>();
  const track = getLearningTrack(params.track);
  const { colors } = useTheme();
  if (!track) return <SessionMissing colors={colors} />;
  return (
    <SessionContent
      track={track}
      stageKey={params.stage}
      mode={(params.mode as SessionMode | undefined) ?? "daily"}
      seed={params.seed ?? ""}
    />
  );
}

function SessionContent({
  track,
  stageKey,
  mode,
  seed,
}: {
  track: LearningTrack;
  stageKey?: string;
  mode: SessionMode;
  seed: string;
}) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const trackTint = dark ? `${track.accent}24` : track.softAccent;
  const reduced = useReducedMotion();
  const token = useAppStore((state) => state.token);
  const [questions, setQuestions] = useState<LearningQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const loadSession = useCallback(async () => {
    const attempts = await loadLearningAttempts();
    const wrong = mode === "wrong" ? wrongQuestionKeys(attempts, track.slug) : [];
    return pickLearningQuestions(track, {
      stageKey: mode === "wrong" ? null : stageKey,
      count: mode === "daily" ? 12 : 8,
      seed: seed || localKey(new Date()),
      wrongKeys: wrong,
    });
  }, [mode, seed, stageKey, track]);

  useEffect(() => {
    let active = true;
    void loadSession().then((picked) => {
      if (!active) return;
      setQuestions(picked);
      setIndex(0);
      setSelected([]);
      setSubmitted(false);
      setCorrectCount(0);
      setFinished(picked.length === 0);
    });
    return () => {
      active = false;
    };
  }, [loadSession]);

  const question = questions[index];
  const isCorrect = question ? isLearningAnswerCorrect(question, selected) : false;
  const source = question ? track.sources.find((item) => item.key === question.sourceKey) : null;

  const toggleAnswer = (key: string) => {
    if (submitted) return;
    haptics.light();
    setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [key]));
  };

  const submit = async () => {
    if (!question || selected.length === 0 || submitted) return;
    const correct = isLearningAnswerCorrect(question, selected);
    setSubmitted(true);
    if (correct) {
      setCorrectCount((value) => value + 1);
      haptics.success();
    } else {
      haptics.error();
    }
    const attempt: LearningAttempt = {
      questionKey: question.key,
      trackSlug: track.slug,
      stageKey: question.stageKey,
      chosenAnswer: selected,
      isCorrect: correct,
      createdAt: new Date().toISOString(),
    };
    await recordLearningAttempt(attempt);
    if (token) {
      fetch(getApiUrl() + "/api/learning/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          questionKey: question.key,
          trackSlug: track.slug,
          stageKey: question.stageKey,
          chosenAnswer: selected,
        }),
      }).catch(() => {});
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      haptics.success();
      return;
    }
    haptics.soft();
    setIndex((value) => value + 1);
    setSelected([]);
    setSubmitted(false);
  };

  const restart = () => {
    router.replace({
      pathname: "/quiz/session",
      params: {
        track: track.slug,
        mode,
        ...(stageKey ? { stage: stageKey } : {}),
        seed: String(Date.now()),
      },
    } as never);
  };

  if (finished) {
    const total = questions.length;
    const percent = total === 0 ? 0 : Math.round((correctCount / total) * 100);
    return (
      <View style={styles.root}>
        <SessionTopBar title={track.title} progress={1} onClose={() => router.back()} />
        <Animated.View entering={reduced ? undefined : FadeIn.duration(240)} style={styles.finishWrap}>
          <View style={[styles.finishIcon, { backgroundColor: trackTint }]}>
            <ThemedIcon name={percent >= 80 ? "trophy" : "checkmark-circle"} size={34} color={track.accent} />
          </View>
          <Text style={styles.finishTitle}>{total === 0 ? "暂时没有可练习的题目" : "本组练习完成"}</Text>
          <Text style={styles.finishScore}>{percent}%</Text>
          <Text style={styles.finishHint}>
            {total === 0 ? "先去学习路线完成内容，再回来练习。" : `答对 ${correctCount} / ${total} 题，错题会自动进入复习队列。`}
          </Text>
          {total > 0 ? (
            <PressableScale haptic onPress={restart} style={[styles.finishPrimary, { backgroundColor: track.accent }]}>
              <Text style={styles.finishPrimaryText}>再来一组</Text>
            </PressableScale>
          ) : null}
          <PressableScale haptic onPress={() => router.back()} style={styles.finishSecondary}>
            <Text style={styles.finishSecondaryText}>返回题库</Text>
          </PressableScale>
        </Animated.View>
      </View>
    );
  }

  if (!question) {
    return (
      <View style={styles.root}>
        <SessionTopBar title={track.title} progress={0} onClose={() => router.back()} />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>正在准备题目…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SessionTopBar title={track.title} progress={index / questions.length} onClose={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={question.key} entering={reduced ? undefined : FadeIn.duration(220)} exiting={reduced ? undefined : FadeOut.duration(120)} style={styles.questionCard}>
          <View style={styles.questionTop}>
            <Text style={[styles.questionStage, { color: track.accent }]}>
              {track.stages.find((stage) => stage.key === question.stageKey)?.title ?? track.title}
            </Text>
            <Text style={styles.questionCount}>{index + 1} / {questions.length}</Text>
          </View>
          <Text style={styles.questionStem}>{question.stem}</Text>
          <View style={styles.optionList}>
            {question.options.map((option) => {
              const chosen = selected.includes(option.key);
              const isAnswer = question.answer.includes(option.key);
              const state = submitted ? (isAnswer ? "correct" : chosen ? "wrong" : "idle") : chosen ? "selected" : "idle";
              return (
                <Pressable
                  key={option.key}
                  onPress={() => toggleAnswer(option.key)}
                  disabled={submitted}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen, disabled: submitted }}
                  style={[
                    styles.option,
                    state === "selected" && styles.optionSelected,
                    state === "correct" && styles.optionCorrect,
                    state === "wrong" && styles.optionWrong,
                  ]}
                >
                  <View
                    style={[
                      styles.optionKey,
                      state === "selected" && { backgroundColor: track.accent, borderColor: track.accent },
                      state === "correct" && { backgroundColor: colors.success, borderColor: colors.success },
                      state === "wrong" && { backgroundColor: colors.danger, borderColor: colors.danger },
                    ]}
                  >
                    <Text style={[styles.optionKeyText, state !== "idle" && styles.optionKeyTextActive]}>{option.key}</Text>
                  </View>
                  <Text style={styles.optionText}>{option.text}</Text>
                  {state === "correct" ? <ThemedIcon name="checkmark" size={18} color={colors.success} /> : null}
                  {state === "wrong" ? <ThemedIcon name="close" size={18} color={colors.danger} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {submitted ? (
          <Animated.View entering={reduced ? undefined : FadeIn.duration(180)} style={styles.feedbackCard}>
            <View style={styles.feedbackHead}>
              <View style={[styles.feedbackIcon, { backgroundColor: isCorrect ? colors.successSoft : colors.dangerSoft }]}>
                <ThemedIcon name={isCorrect ? "checkmark" : "close"} size={18} color={isCorrect ? colors.success : colors.danger} />
              </View>
              <Text style={[styles.feedbackTitle, { color: isCorrect ? colors.success : colors.danger }]}>
                {isCorrect ? "回答正确" : "需要复习"}
              </Text>
            </View>
            <Text style={styles.answerLine}>
              正确答案：{question.answer.join("、")}
            </Text>
            <Text style={styles.explanation}>{question.explanation}</Text>
            {source ? (
              <View style={styles.sourceRow}>
                <ThemedIcon name="document-text-outline" size={14} color={colors.textMuted} />
                <Text style={styles.sourceText} numberOfLines={2}>
                  来源：{source.name} · {source.license}
                </Text>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: quizFooterPaddingBottom(insets.bottom) }]}>
        {!submitted ? (
          <PressableScale
            haptic
            onPress={submit}
            disabled={selected.length === 0}
            style={[styles.primaryButton, { backgroundColor: selected.length ? track.accent : colors.textFaint }]}
          >
            <Text style={styles.primaryButtonText}>提交答案</Text>
          </PressableScale>
        ) : (
          <PressableScale haptic onPress={next} style={[styles.primaryButton, { backgroundColor: track.accent }]}>
            <Text style={styles.primaryButtonText}>{index + 1 >= questions.length ? "完成练习" : "下一题"}</Text>
            <ThemedIcon name="chevron-forward" size={17} color="#FFFFFF" />
          </PressableScale>
        )}
      </View>
    </View>
  );
}

function SessionTopBar({ title, progress, onClose }: { title: string; progress: number; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.topBar, { paddingTop: quizTopBarPaddingTop(insets.top) }]}>
      <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="退出练习" style={styles.closeButton}>
        <ThemedIcon name="close" size={21} color={colors.text} />
      </Pressable>
      <View style={styles.topBody}>
        <Text style={styles.topLabel}>练习中 · {title}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }]} />
        </View>
      </View>
    </View>
  );
}

function SessionMissing({ colors }: { colors: ThemeColors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.root}>
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>题目不存在或已下线</Text>
        <PressableScale haptic onPress={() => router.replace("/quiz" as never)} style={styles.finishSecondary}>
          <Text style={styles.finishSecondaryText}>返回题库</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    topBar: {
      minHeight: 66,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.canvas,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
    topBody: { flex: 1, gap: 6 },
    topLabel: { ...typography.micro, color: colors.textMuted },
    progressTrack: { height: 5, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.primary },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
    questionCard: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.xl, backgroundColor: colors.surfaceStrong, ...shadows.floating },
    questionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    questionStage: { ...typography.micro, flex: 1 },
    questionCount: { ...typography.micro, color: colors.textMuted },
    questionStem: { ...typography.title2, color: colors.text },
    optionList: { gap: spacing.sm },
    option: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    optionCorrect: { borderColor: colors.success, backgroundColor: colors.successSoft },
    optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
    optionKey: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    optionKeyText: { ...typography.caption, color: colors.textSecondary },
    optionKeyTextActive: { color: "#FFFFFF", fontWeight: "800" },
    optionText: { flex: 1, ...typography.callout, color: colors.text },
    feedbackCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surfaceStrong, ...shadows.card },
    feedbackHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    feedbackIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    feedbackTitle: { ...typography.headline },
    answerLine: { ...typography.callout, color: colors.text },
    explanation: { ...typography.body, color: colors.textSecondary },
    sourceRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
    sourceText: { flex: 1, ...typography.caption, color: colors.textMuted },
    footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    primaryButton: { minHeight: 52, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
    primaryButtonText: { ...typography.headline, color: "#FFFFFF" },
    finishWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
    finishIcon: { width: 80, height: 80, borderRadius: 28, alignItems: "center", justifyContent: "center" },
    finishTitle: { ...typography.title2, color: colors.text },
    finishScore: { ...typography.display, color: colors.primary },
    finishHint: { ...typography.body, textAlign: "center", color: colors.textSecondary },
    finishPrimary: { width: "100%", minHeight: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
    finishPrimaryText: { ...typography.headline, color: "#FFFFFF" },
    finishSecondary: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
    finishSecondaryText: { ...typography.callout, color: colors.textMuted },
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
    loadingText: { ...typography.callout, color: colors.textMuted },
  });
