import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { getExam408Paper, type Exam408Paper } from "@/lib/exam-408";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

export default function Exam408PaperScreen() {
  const params = useLocalSearchParams<{ year?: string }>();
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return <MissingPaper />;
  }
  return <PaperContent year={year} />;
}

function PaperContent({ year }: { year: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const [paper, setPaper] = useState<Exam408Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPaper(await getExam408Paper(year));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "试卷加载失败");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>正在加载 {year} 年真题…</Text>
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

  const choiceCount = paper.questions.filter((item) => item.type === "choice").length;
  const comprehensiveCount = paper.questions.length - choiceCount;
  const start = (number?: number) =>
    router.push({
      pathname: "/quiz/paper-session",
      params: { year: String(year), ...(number ? { start: String(number) } : {}) },
    } as never);

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title={`${year} 年 408 真题`} scrollY={header.scrollY} backTo="/quiz/408" />
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
              <ThemedIcon name="document-text-outline" size={25} color={colors.primary} />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroYear}>{year}</Text>
              <Text style={styles.heroTitle}>{paper.paper.title}</Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <Metric value={`${choiceCount}`} label="选择题" styles={styles} />
            <Metric value={`${comprehensiveCount}`} label="综合题" styles={styles} />
            <Metric value={`${paper.paper.totalScore}`} label="满分" styles={styles} />
            <Metric value={`${paper.questions.length}`} label="原题数" styles={styles} />
          </View>
          <PressableScale haptic scaleTo={0.98} onPress={() => start()} style={styles.primaryButton}>
            <ThemedIcon name="play" size={17} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>从第 1 题开始刷</Text>
          </PressableScale>
        </Animated.View>

        <View style={styles.sectionList}>
          <Text style={styles.sectionTitle}>试卷结构</Text>
          {paper.sections.map((section) => (
            <PressableScale
              key={`${section.type}-${section.from}`}
              haptic
              scaleTo={0.985}
              onPress={() => start(section.from)}
              style={styles.sectionCard}
            >
              <View
                style={[
                  styles.sectionIcon,
                  {
                    backgroundColor:
                      section.type === "choice" ? colors.primarySoft : colors.accentSoft,
                  },
                ]}
              >
                <ThemedIcon
                  name={section.type === "choice" ? "list-outline" : "create-outline"}
                  size={20}
                  color={section.type === "choice" ? colors.primary : colors.accent}
                />
              </View>
              <View style={styles.sectionBody}>
                <Text style={styles.sectionCardTitle}>{section.title}</Text>
                <Text style={styles.sectionMeta}>
                  第 {section.from}–{section.to} 题 · {section.totalScore} 分
                </Text>
              </View>
              <ThemedIcon name="play-circle-outline" size={22} color={colors.primary} />
            </PressableScale>
          ))}
        </View>

        <View style={styles.sectionList}>
          <View style={styles.gridHead}>
            <Text style={styles.sectionTitle}>按题号开始</Text>
            <Text style={styles.gridHint}>点击任意题号</Text>
          </View>
          <View style={styles.questionGrid}>
            {paper.questions.map((question) => (
              <PressableScale
                key={question.key}
                haptic
                scaleTo={0.94}
                onPress={() => start(question.number)}
                style={[
                  styles.questionChip,
                  question.type === "comprehensive" && styles.questionChipComprehensive,
                ]}
              >
                <Text
                  style={[
                    styles.questionChipText,
                    question.type === "comprehensive" && { color: colors.accent },
                  ]}
                >
                  {question.number}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>

        <View style={styles.sourceBox}>
          <Text style={styles.sourceTitle}>来源</Text>
          <Text style={styles.sourceText}>
            {paper.source.name}（{paper.source.baseUrl}）。{paper.source.licenseNote}
          </Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function Metric({
  value,
  label,
  styles,
}: {
  value: string;
  label: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function MissingPaper() {
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
    hero: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.lg,
      backgroundColor: colors.primarySoft,
      ...shadows.brand,
    },
    heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    heroIcon: {
      width: 50,
      height: 50,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    heroBody: { flex: 1, gap: 2 },
    heroYear: { ...typography.title1, color: colors.primary, fontVariant: ["tabular-nums"] },
    heroTitle: { ...typography.callout, color: colors.textSecondary },
    metricRow: { flexDirection: "row", gap: spacing.sm },
    metric: { flex: 1, alignItems: "center", gap: 1 },
    metricValue: { ...typography.headline, color: colors.text, fontVariant: ["tabular-nums"] },
    metricLabel: { ...typography.micro, color: colors.textMuted },
    primaryButton: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      borderRadius: radius.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.primary,
    },
    primaryButtonText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
    sectionList: { gap: spacing.md },
    sectionTitle: { ...typography.title2, color: colors.text },
    sectionCard: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      ...shadows.card,
    },
    sectionIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    sectionBody: { flex: 1, gap: 2 },
    sectionCardTitle: { ...typography.headline, color: colors.text },
    sectionMeta: { ...typography.caption, color: colors.textMuted },
    gridHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    gridHint: { ...typography.caption, color: colors.textMuted },
    questionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    questionChip: {
      width: "17.8%",
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      backgroundColor: colors.primarySoft,
    },
    questionChipComprehensive: { backgroundColor: colors.accentSoft },
    questionChipText: { ...typography.callout, fontWeight: "800", color: colors.primary, fontVariant: ["tabular-nums"] },
    sourceBox: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: 4 },
    sourceTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    sourceText: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },
  });
