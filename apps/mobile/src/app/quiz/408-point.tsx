import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { Exam408QuestionCard } from "@/components/exam-408-question-card";
import { ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { getExam408Point, type Exam408PointDetail } from "@/lib/exam-408";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

export default function Exam408PointScreen() {
  const params = useLocalSearchParams<{ key?: string }>();
  const pointKey = params.key?.trim() ?? "";
  if (!pointKey) return <MissingPoint />;
  return <PointContent pointKey={pointKey} />;
}

function PointContent({ pointKey }: { pointKey: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const [detail, setDetail] = useState<Exam408PointDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDetail(await getExam408Point(pointKey));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "知识点加载失败");
    } finally {
      setLoading(false);
    }
  }, [pointKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>正在加载知识点…</Text>
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.centerState}>
        <ThemedIcon name="alert-circle-outline" size={26} color={colors.danger} />
        <Text style={styles.centerTitle}>知识点加载失败</Text>
        <Text style={styles.centerText}>{error || "未找到该知识点"}</Text>
        <PressableScale haptic onPress={() => void load()} style={styles.retry}>
          <Text style={styles.retryText}>重试</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title={detail.point.title} scrollY={header.scrollY} backTo="/quiz/408" />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={entrance(0)} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <ThemedIcon name="book-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroSubject}>{detail.point.subject.title}</Text>
              <Text style={styles.heroChapter}>
                第 {detail.point.chapter.chapterNumber} 章 · {detail.point.chapter.title}
              </Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{detail.point.title}</Text>
          <Text style={styles.heroSummary}>{detail.point.summary}</Text>
          <View style={styles.heroStats}>
            <View style={styles.countBox}>
              <Text style={styles.countValue}>{detail.point.questionCount}</Text>
              <Text style={styles.countLabel}>关联真题</Text>
            </View>
            <View style={styles.tagWrap}>
              {detail.point.tags.slice(0, 6).map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>关联真题</Text>
          <PressableScale haptic onPress={() => router.back()} style={styles.backButton}>
            <ThemedIcon name="arrow-back" size={15} color={colors.textMuted} />
            <Text style={styles.backText}>返回章节</Text>
          </PressableScale>
        </View>

        <View style={styles.questionList}>
          {detail.questions.map((question) => (
            <Animated.View key={question.key} entering={entrance(1)}>
              <Exam408QuestionCard question={question} />
            </Animated.View>
          ))}
        </View>

        <View style={styles.sourceBox}>
          <Text style={styles.sourceTitle}>来源</Text>
          <Text style={styles.sourceText}>
            {detail.source.name}（{detail.source.baseUrl}）。{detail.source.licenseNote}
          </Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function MissingPoint() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.centerState}>
      <ThemedIcon name="book-outline" size={26} color={colors.textMuted} />
      <Text style={styles.centerTitle}>缺少知识点参数</Text>
      <PressableScale haptic onPress={() => router.replace("/quiz/408" as never)} style={styles.retry}>
        <Text style={styles.retryText}>返回 408 专区</Text>
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
    centerText: { ...typography.callout, color: colors.textMuted, textAlign: "center" },
    retry: {
      minHeight: 44,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    retryText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
    hero: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: colors.primarySoft,
      ...shadows.card,
    },
    heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    heroBody: { flex: 1, gap: 2 },
    heroSubject: { ...typography.callout, fontWeight: "800", color: colors.primary },
    heroChapter: { ...typography.caption, color: colors.textMuted },
    heroTitle: { ...typography.title1, color: colors.text },
    heroSummary: { ...typography.body, color: colors.textSecondary },
    heroStats: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    countBox: {
      minWidth: 72,
      alignItems: "center",
      borderRadius: radius.md,
      padding: spacing.sm,
      backgroundColor: colors.surfaceStrong,
    },
    countValue: { ...typography.title2, color: colors.text, fontVariant: ["tabular-nums"] },
    countLabel: { ...typography.micro, color: colors.textMuted },
    tagWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tag: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.surfaceMuted },
    tagText: { ...typography.micro, color: colors.textSecondary },
    sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionTitle: { ...typography.title2, color: colors.text },
    backButton: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6 },
    backText: { ...typography.caption, color: colors.textMuted },
    questionList: { gap: spacing.md },
    sourceBox: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: 4 },
    sourceTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    sourceText: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },
  });
