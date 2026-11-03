import { useCallback, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { EmptyState } from "@/components/empty-state";
import { PressableScale } from "@/components/pressable-scale";
import { QuestionBlocks } from "@/components/question-blocks";
import { RichText } from "@/components/rich-text";
import { ScreenHeaderStickyBar } from "@/components/screen-header";
import { Skeleton, SkeletonCard } from "@/components/skeleton";
import { ThemedIcon } from "@/components/themed-icon";
import {
  cleanAnswerText,
  cleanExamStem,
  resolveExamAssetUrl,
  type Exam408Question,
} from "@/lib/exam-408";
import {
  fetchQuestionDetail,
  type Exam408QuestionFetchFailure,
} from "@/lib/exam-408-question";
import { haptics } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 408 真题详情页（P3-1）。
 *
 * 入口：408 搜索命中 / 知识点页「关联真题」列表 / 深链。参数 key。
 * 渲染口径与现有 408 页面完全一致：
 * - 题干/答案用 QuestionBlocks + RichText（沿用共享 md-lite 解析，不注入 HTML，不引新库）；
 * - 图片走 imageRefs / answerImageRefs + expo-image，点按用系统浏览器打开大图；
 * - 知识点 key 已是对外前缀，直接跳 /quiz/408-point。
 *
 * 接口公开，未登录也能看题；页面不写入任何数据，因此没有离线发件箱逻辑。
 */

export default function Exam408QuestionScreen() {
  const params = useLocalSearchParams<{ key?: string }>();
  const questionKey = (params.key ?? "").trim();
  if (!questionKey) return <MissingQuestion />;
  return <QuestionDetail key={questionKey} questionKey={questionKey} />;
}

function QuestionDetail({ questionKey }: { questionKey: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bottomSpace = useTabBarSpace();

  const [question, setQuestion] = useState<Exam408Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<Exam408QuestionFetchFailure | null>(null);
  const [revealed, setRevealed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    setRevealed(false);
    const result = await fetchQuestionDetail(questionKey);
    setQuestion(result.detail);
    setFailure(result.failure);
    setLoading(false);
  }, [questionKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeaderStickyBar title="真题详情" />
        <View style={styles.content}>
          <SkeletonCard />
          <Skeleton lines={4} />
        </View>
      </View>
    );
  }

  if (failure || !question) {
    const notFound = failure === "invalid" || failure === "not-found";
    return (
      <View style={styles.root}>
        <ScreenHeaderStickyBar title="真题详情" />
        <View style={styles.centerBox}>
          <EmptyState
            icon={notFound ? "document-text-outline" : "cloud-offline-outline"}
            title={notFound ? "没有找到这道真题" : "暂时拿不到这道题"}
            hint={
              notFound
                ? "题目可能还没发布，或者已经被删除。"
                : failure === "offline"
                  ? "网络不可用，请检查网络后重试。"
                  : "服务端暂时异常，稍后再试一次。"
            }
            actionLabel={notFound ? "返回 408 专区" : "重试"}
            onAction={() => {
              if (notFound) router.replace("/exam-408" as never);
              else void load();
            }}
            pattern="none"
          />
        </View>
      </View>
    );
  }

  const stem = cleanExamStem(question.stem || question.body);
  const answerText = cleanAnswerText(question.answerText);
  const correctLetters = new Set(
    (question.answerLetter ?? "")
      .split("")
      .map((letter) => letter.trim().toUpperCase())
      .filter(Boolean),
  );
  const typeLabel = question.type === "choice" ? "选择题" : "综合题";
  const yearLabel = question.year > 0 ? String(question.year) + " 年" : "年份未知";

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="真题详情" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaRow}>
          <Text style={styles.metaStrong}>{yearLabel}</Text>
          <Text style={styles.metaText}>第 {question.number} 题</Text>
          <Text style={styles.metaText}>{typeLabel}</Text>
          <Text style={styles.metaText}>{question.points} 分</Text>
          {question.subject.title ? (
            <Text style={styles.metaText}>{question.subject.title}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.stemHead}>
            <ThemedIcon name="document-text-outline" size={17} color={colors.primary} />
            <Text style={styles.sectionTitle}>题干</Text>
          </View>
          <QuestionBlocks text={stem} style={styles.stem} compact />
          <QuestionImages refs={question.imageRefs} label={"第 " + question.number + " 题配图"} />

          {question.options.length > 0 ? (
            <View style={styles.optionList}>
              {question.options.map((option) => {
                const correct = revealed && correctLetters.has(option.letter.toUpperCase());
                return (
                  <View key={option.letter} style={[styles.option, correct && styles.optionCorrect]}>
                    <Text style={styles.optionLetter}>{option.letter}</Text>
                    <RichText text={option.text} style={styles.optionText} />
                    {correct ? (
                      <ThemedIcon name="checkmark-circle" size={16} color={colors.success} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {question.tags.length > 0 ? (
            <View style={styles.tagWrap}>
              {question.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {revealed ? (
            <View style={styles.answerBox}>
              <View style={styles.answerHead}>
                <ThemedIcon name="checkmark-circle" size={17} color={colors.success} />
                <Text style={styles.answerTitle}>参考答案与解析</Text>
                {question.answerLetter ? (
                  <View style={styles.answerLetterBadge}>
                    <Text style={styles.answerLetterText}>{question.answerLetter}</Text>
                  </View>
                ) : null}
              </View>
              {answerText ? (
                <QuestionBlocks text={answerText} style={styles.answerText} compact />
              ) : (
                <Text style={styles.answerEmpty}>这道题暂未收录文字解析。</Text>
              )}
              <QuestionImages
                refs={question.answerImageRefs}
                label={"第 " + question.number + " 题答案图"}
              />
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

          <PressableScale
            haptic
            onPress={() => {
              haptics.light();
              setRevealed((previous) => !previous);
            }}
            style={styles.revealButton}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "收起答案" : "查看答案"}
          >
            <ThemedIcon
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.revealButtonText}>{revealed ? "收起答案" : "查看答案"}</Text>
          </PressableScale>
        </View>

        {question.knowledgePoints.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.stemHead}>
              <ThemedIcon name="book-outline" size={17} color={colors.primary} />
              <Text style={styles.sectionTitle}>关联知识点</Text>
            </View>
            {question.knowledgePoints.map((point) => (
              <PressableScale
                key={point.key}
                haptic
                onPress={() => {
                  haptics.light();
                  router.push(
                    ("/quiz/408-point?key=" + encodeURIComponent(point.key)) as never,
                  );
                }}
                style={styles.pointRow}
                accessibilityRole="button"
                accessibilityLabel={"查看知识点：" + point.title}
              >
                <Text style={styles.pointText} numberOfLines={2}>
                  {point.title}
                </Text>
                <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
              </PressableScale>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** 题目配图（题干图 / 答案图共用）：与 Exam408QuestionCard 同一渲染口径，点按打开大图。 */
function QuestionImages({ refs, label }: { refs: string[]; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (refs.length === 0) return null;
  return (
    <View style={styles.imageGrid}>
      {refs.map((url) => (
        <PressableScale
          key={url}
          haptic
          scaleTo={0.99}
          onPress={() => void Linking.openURL(resolveExamAssetUrl(url))}
          style={styles.imageFrame}
          accessibilityRole="button"
          accessibilityLabel={"查看" + label}
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

function MissingQuestion() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="真题详情" />
      <View style={styles.centerBox}>
        <EmptyState
          icon="help-circle-outline"
          title="缺少真题参数"
          hint="请从 408 专区或知识点页重新进入。"
          actionLabel="返回 408 专区"
          onAction={() => router.replace("/exam-408" as never)}
          pattern="none"
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.md },
    centerBox: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg },

    metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
    metaStrong: { ...typography.caption, fontWeight: "800", color: colors.text },
    metaText: { ...typography.caption, color: colors.textMuted },

    card: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    stemHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    sectionTitle: { ...typography.headline, color: colors.text },
    stem: { ...typography.body, color: colors.text },

    imageGrid: { gap: spacing.sm },
    imageFrame: {
      minHeight: 160,
      borderRadius: radius.md,
      overflow: "hidden",
      backgroundColor: "#FFFFFF",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    image: { width: "100%", height: 220 },

    optionList: { gap: spacing.sm },
    option: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.md,
      backgroundColor: colors.surfaceMuted,
    },
    optionCorrect: { borderColor: colors.success, backgroundColor: colors.successSoft },
    optionLetter: { ...typography.caption, fontWeight: "900", color: colors.textMuted, width: 16 },
    optionText: { flex: 1, ...typography.callout, color: colors.textSecondary },

    tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tag: {
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.surfaceMuted,
    },
    tagText: { ...typography.micro, color: colors.textSecondary },

    answerBox: {
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.success,
      backgroundColor: colors.successSoft,
      padding: spacing.md,
    },
    answerHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    answerTitle: { ...typography.callout, fontWeight: "800", color: colors.success, flex: 1 },
    answerLetterBadge: {
      minWidth: 28,
      minHeight: 28,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
      backgroundColor: colors.success,
    },
    answerLetterText: { ...typography.callout, fontWeight: "900", color: "#FFFFFF" },
    answerText: { ...typography.callout, color: colors.text },
    answerEmpty: { ...typography.callout, color: colors.textMuted },

    videoLink: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    videoText: { ...typography.callout, fontWeight: "700", color: colors.primary },

    revealButton: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    revealButtonText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },

    pointRow: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    pointText: { ...typography.callout, color: colors.textSecondary, flex: 1 },
  });
