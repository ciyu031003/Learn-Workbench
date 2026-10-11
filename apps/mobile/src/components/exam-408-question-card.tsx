import { useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { cleanAnswerText, cleanExamStem, resolveExamAssetUrl, type Exam408Question } from "@/lib/exam-408";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

export function Exam408QuestionCard({
  question,
  compact = false,
}: {
  question: Exam408Question;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [revealed, setRevealed] = useState(false);
  const answerText = cleanAnswerText(question.answerText);
  const correctLetters = new Set(
    (question.answerLetter ?? "")
      .split("")
      .map((letter) => letter.trim())
      .filter(Boolean),
  );

  return (
    <View style={styles.card}>
      <View style={styles.meta}>
        <Text style={styles.questionNumber}>第 {question.number} 题</Text>
        <Text style={styles.metaText}>{question.type === "choice" ? "选择题" : "综合应用题"}</Text>
        <Text style={styles.metaText}>{question.points} 分</Text>
        <Text style={styles.metaText}>{question.subject.title}</Text>
      </View>

      <Text selectable style={[styles.stem, compact && styles.stemCompact]}>
        {cleanExamStem(question.stem)}
      </Text>

      {question.imageRefs.length > 0 ? (
        <View style={styles.imageGrid}>
          {question.imageRefs.map((url) => (
            <PressableScale
              key={url}
              haptic
              scaleTo={0.99}
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
      ) : null}

      {question.options.length > 0 ? (
        <View style={styles.optionList}>
          {question.options.map((option) => {
            const correct = revealed && correctLetters.has(option.letter);
            return (
              <View key={option.letter} style={[styles.option, correct && styles.optionCorrect]}>
                <Text style={styles.optionLetter}>{option.letter}</Text>
                <Text style={styles.optionText}>{option.text}</Text>
                {correct ? <ThemedIcon name="checkmark-circle" size={16} color={colors.success} /> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {revealed ? (
        <View style={styles.answer}>
          <Text style={styles.answerTitle}>
            参考答案：{question.answerLetter ?? answerText}
          </Text>
          {answerText && answerText !== question.answerLetter ? (
            <Text selectable style={styles.answerText}>
              {answerText}
            </Text>
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

      <View style={styles.footer}>
        <PressableScale
          haptic
          onPress={() => setRevealed((value) => !value)}
          style={styles.revealButton}
          accessibilityRole="button"
          accessibilityLabel={revealed ? "收起答案" : "显示答案"}
        >
          <ThemedIcon name={revealed ? "eye-off-outline" : "eye-outline"} size={15} color={colors.primary} />
          <Text style={styles.revealText}>{revealed ? "收起答案" : "显示答案"}</Text>
        </PressableScale>
        {question.tags.length > 0 ? (
          <Text style={styles.tagText} numberOfLines={1}>
            {question.tags.slice(0, 3).join(" · ")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.md,
      ...shadows.card,
    },
    meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
    questionNumber: { ...typography.caption, fontWeight: "800", color: colors.text },
    metaText: { ...typography.caption, color: colors.textMuted },
    stem: { ...typography.body, color: colors.text, lineHeight: 26 },
    stemCompact: { ...typography.callout, lineHeight: 23 },
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
    optionText: { flex: 1, ...typography.callout, color: colors.textSecondary, lineHeight: 21 },
    answer: {
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.success,
      backgroundColor: colors.successSoft,
      padding: spacing.md,
    },
    answerTitle: { ...typography.callout, fontWeight: "800", color: colors.success },
    answerText: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
    videoLink: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    videoText: { ...typography.callout, fontWeight: "700", color: colors.primary },
    footer: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    revealButton: {
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.primarySoft,
    },
    revealText: { ...typography.caption, fontWeight: "800", color: colors.primary },
    tagText: { flex: 1, ...typography.micro, color: colors.textFaint, textAlign: "right" },
  });
