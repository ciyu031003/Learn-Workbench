import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Animated from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { BottomSheet } from "@/components/bottom-sheet";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { getExam408Overview, type Exam408ChapterSummary, type Exam408Overview } from "@/lib/exam-408";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

type HubTab = "knowledge" | "papers";

const SUBJECT_STYLE: Record<string, { color: string; soft: string; icon: string }> = {
  "data-structure": { color: "#2563EB", soft: "#DBEAFE", icon: "git-network-outline" },
  "computer-organization": { color: "#7C3AED", soft: "#EDE9FE", icon: "hardware-chip-outline" },
  "operating-system": { color: "#B45309", soft: "#FEF3C7", icon: "apps-outline" },
  "computer-network": { color: "#0F766E", soft: "#CCFBF1", icon: "share-social-outline" },
};

export default function Exam408HubScreen() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const [tab, setTab] = useState<HubTab>("knowledge");
  const [overview, setOverview] = useState<Exam408Overview | null>(null);
  const [subjectKey, setSubjectKey] = useState("");
  const [chapter, setChapter] = useState<Exam408ChapterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getExam408Overview();
      setOverview(data);
      setSubjectKey((current) => current || data.subjects[0]?.key || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "408 题库加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const subject =
    overview?.subjects.find((item) => item.key === subjectKey) ?? overview?.subjects[0] ?? null;
  const papers = useMemo(
    () => [...(overview?.papers ?? [])].sort((a, b) => b.year - a.year),
    [overview?.papers]
  );

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="408 考研专项" scrollY={header.scrollY} backTo="/quiz" />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeaderLargeTitle title="408 考研专项" subtitle="四科知识体系 · 2009–2026 原卷真题" />

        <Animated.View entering={entrance(0)} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <ThemedIcon name="school-outline" size={26} color={colors.primary} />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroTitle}>计算机学科专业基础</Text>
              <Text style={styles.heroText}>先按章节建立知识索引，再按年份保留原题号整套刷题。</Text>
            </View>
          </View>
          {overview ? (
            <View style={styles.statRow}>
              <Stat value={overview.stats.subjects} label="科目" styles={styles} />
              <Stat value={overview.stats.points} label="知识点" styles={styles} />
              <Stat value={overview.stats.papers} label="年份" styles={styles} />
              <Stat value={overview.stats.questions} label="题目" styles={styles} />
            </View>
          ) : null}
        </Animated.View>

        <View style={styles.segmented}>
          <Segment active={tab === "knowledge"} onPress={() => setTab("knowledge")} label="四科知识体系" />
          <Segment active={tab === "papers"} onPress={() => setTab("papers")} label="历年真题" />
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>正在加载 408 题库…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <ThemedIcon name="alert-circle-outline" size={24} color={colors.danger} />
            <Text style={styles.stateTitle}>加载失败</Text>
            <Text style={styles.stateText}>{error}</Text>
            <PressableScale haptic onPress={() => void load()} style={styles.retryButton}>
              <Text style={styles.retryText}>重试</Text>
            </PressableScale>
          </View>
        ) : tab === "knowledge" && overview ? (
          <View style={styles.sectionList}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subjectRail}
            >
              {overview.subjects.map((item) => {
                const active = subject?.key === item.key;
                const tone = subjectTone(item.key, dark);
                return (
                  <PressableScale
                    key={item.key}
                    haptic
                    scaleTo={0.98}
                    onPress={() => setSubjectKey(item.key)}
                    style={[
                      styles.subjectChip,
                      active && { backgroundColor: tone.soft, borderColor: tone.color },
                    ]}
                  >
                    <Text style={[styles.subjectName, active && { color: tone.color }]}>{item.shortName}</Text>
                    <Text style={styles.subjectMeta}>
                      {item.chapterCount} 章 · {item.pointCount} 点
                    </Text>
                  </PressableScale>
                );
              })}
            </ScrollView>

            {subject ? (
              <View style={styles.sectionList}>
                <View style={styles.subjectHead}>
                  <View style={[styles.subjectIcon, { backgroundColor: subjectTone(subject.key, dark).soft }]}>
                    <ThemedIcon
                      name={subjectTone(subject.key, dark).icon as never}
                      size={21}
                      color={subjectTone(subject.key, dark).color}
                    />
                  </View>
                  <View style={styles.subjectHeadBody}>
                    <Text style={styles.subjectTitle}>{subject.title}</Text>
                    <Text style={styles.subjectHeadMeta}>
                      {subject.chapterCount} 章 · {subject.pointCount} 个知识点 · {subject.questionCount} 题
                    </Text>
                  </View>
                </View>

                {subject.chapters.map((item) => (
                  <PressableScale
                    key={item.key}
                    haptic
                    scaleTo={0.985}
                    onPress={() => setChapter(item)}
                    style={styles.chapterCard}
                  >
                    <View
                      style={[
                        styles.chapterNumber,
                        { backgroundColor: subjectTone(subject.key, dark).soft },
                      ]}
                    >
                      <Text style={[styles.chapterNumberText, { color: subjectTone(subject.key, dark).color }]}>
                        {String(item.chapterNumber).padStart(2, "0")}
                      </Text>
                    </View>
                    <View style={styles.chapterBody}>
                      <Text style={styles.chapterTitle}>{item.title}</Text>
                      <Text style={styles.chapterMeta}>
                        {item.points.length} 个知识点 · {item.questionCount} 道题
                      </Text>
                      <Text style={styles.chapterPreview} numberOfLines={2}>
                        {item.points.slice(0, 4).map((point) => point.title).join("、")}
                      </Text>
                    </View>
                    <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
                  </PressableScale>
                ))}
              </View>
            ) : null}
          </View>
        ) : tab === "papers" ? (
          <View style={styles.sectionList}>
            <View style={styles.paperIntro}>
              <Text style={styles.paperIntroTitle}>历年真题</Text>
              <Text style={styles.paperIntroText}>按年份打开试卷，保留选择题、综合题、原题号和分值。</Text>
            </View>
            <View style={styles.paperGrid}>
              {papers.map((paper) => (
                <PressableScale
                  key={paper.year}
                  haptic
                  scaleTo={0.985}
                  onPress={() => router.push(`/quiz/paper/${paper.year}` as never)}
                  style={styles.paperCard}
                >
                  <Text style={styles.paperYear}>{paper.year}</Text>
                  <Text style={styles.paperMeta}>
                    {paper.questionCount} 题 · {paper.totalScore} 分
                  </Text>
                  <View style={styles.paperCta}>
                    <Text style={styles.paperCtaText}>打开原卷</Text>
                    <ThemedIcon name="chevron-forward" size={14} color={colors.primary} />
                  </View>
                </PressableScale>
              ))}
            </View>
          </View>
        ) : null}

        {overview ? (
          <View style={styles.sourceBox}>
            <Text style={styles.sourceTitle}>内容来源与使用边界</Text>
            <Text style={styles.sourceText}>
              {overview.source.name}（{overview.source.baseUrl}）。{overview.source.licenseNote}
            </Text>
            <Text style={styles.sourceText}>题目图片已本地化到工作台，视频讲解仍打开原站。</Text>
          </View>
        ) : null}
      </Animated.ScrollView>

      <BottomSheet
        visible={chapter !== null}
        onClose={() => setChapter(null)}
        title={chapter ? chapter.title : "章节知识点"}
        subtitle={chapter ? `${chapter.points.length} 个知识点 · ${chapter.questionCount} 道题` : undefined}
        icon="list-outline"
        height="82%"
      >
        {chapter ? (
          <View style={styles.pointList}>
            {chapter.points.map((point) => (
              <PressableScale
                key={point.key}
                haptic
                scaleTo={0.985}
                onPress={() => {
                  setChapter(null);
                  router.push({
                    pathname: "/quiz/408-point",
                    params: { key: point.key },
                  } as never);
                }}
                style={styles.pointRow}
              >
                <View style={styles.pointNumber}>
                  <Text style={styles.pointNumberText}>{point.pointNumber}</Text>
                </View>
                <View style={styles.pointBody}>
                  <Text style={styles.pointTitle}>{point.title}</Text>
                  <Text style={styles.pointTags} numberOfLines={1}>
                    {point.tags
                      .filter((tag) => tag !== "408" && tag !== "四〇八档案室")
                      .slice(0, 4)
                      .join(" · ")}
                  </Text>
                </View>
                <Text style={styles.pointCount}>{point.questionCount} 题</Text>
                <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
              </PressableScale>
            ))}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

function Segment({
  active,
  onPress,
  label,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      haptic
      scaleTo={0.98}
      onPress={onPress}
      style={[styles.segment, active && styles.segmentActive]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </PressableScale>
  );
}

function Stat({
  value,
  label,
  styles,
}: {
  value: number;
  label: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function subjectTone(key: string, dark: boolean) {
  const suffix = key.split("/").at(-1) ?? "data-structure";
  const tone = SUBJECT_STYLE[suffix] ?? SUBJECT_STYLE["data-structure"];
  return dark
    ? { ...tone, soft: tone.color + "25" }
    : tone;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.lg },
    hero: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.lg,
      backgroundColor: colors.primarySoft,
      ...shadows.card,
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
    heroBody: { flex: 1, gap: 3 },
    heroTitle: { ...typography.title2, color: colors.text },
    heroText: { ...typography.callout, color: colors.textSecondary },
    statRow: { flexDirection: "row", gap: spacing.sm },
    stat: { flex: 1, alignItems: "center", gap: 1 },
    statValue: { ...typography.headline, color: colors.text, fontVariant: ["tabular-nums"] },
    statLabel: { ...typography.micro, color: colors.textMuted },
    segmented: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: radius.md + 2,
      backgroundColor: colors.surfaceMuted,
    },
    segment: { flex: 1, minHeight: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    segmentActive: { backgroundColor: colors.surfaceStrong, ...shadows.card },
    segmentText: { ...typography.callout, color: colors.textMuted },
    segmentTextActive: { color: colors.text, fontWeight: "800" },
    stateBox: { alignItems: "center", gap: spacing.sm, padding: 40 },
    stateTitle: { ...typography.headline, color: colors.text },
    stateText: { ...typography.callout, color: colors.textMuted, textAlign: "center" },
    retryButton: {
      minHeight: 42,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    retryText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
    sectionList: { gap: spacing.md },
    subjectRail: { gap: spacing.sm, paddingVertical: 2 },
    subjectChip: {
      minWidth: 124,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      padding: spacing.md,
      gap: 2,
    },
    subjectName: { ...typography.headline, color: colors.text },
    subjectMeta: { ...typography.caption, color: colors.textMuted },
    subjectHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    subjectIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    subjectHeadBody: { flex: 1, gap: 2 },
    subjectTitle: { ...typography.title2, color: colors.text },
    subjectHeadMeta: { ...typography.caption, color: colors.textMuted },
    chapterCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    chapterNumber: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    chapterNumberText: { ...typography.caption, fontWeight: "900" },
    chapterBody: { flex: 1, gap: 3 },
    chapterTitle: { ...typography.headline, color: colors.text },
    chapterMeta: { ...typography.caption, color: colors.textMuted },
    chapterPreview: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
    paperIntro: { gap: 3 },
    paperIntroTitle: { ...typography.title2, color: colors.text },
    paperIntroText: { ...typography.callout, color: colors.textSecondary },
    paperGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    paperCard: {
      width: "47.8%",
      minHeight: 112,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 3,
      ...shadows.card,
    },
    paperYear: { ...typography.title2, color: colors.text, fontVariant: ["tabular-nums"] },
    paperMeta: { ...typography.caption, color: colors.textMuted },
    paperCta: { marginTop: "auto", flexDirection: "row", alignItems: "center", gap: 2 },
    paperCtaText: { ...typography.caption, fontWeight: "800", color: colors.primary },
    sourceBox: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: 5 },
    sourceTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    sourceText: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },
    pointList: { gap: spacing.sm },
    pointRow: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.surfaceMuted,
    },
    pointNumber: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
    pointNumberText: { ...typography.caption, fontWeight: "900", color: colors.primary },
    pointBody: { flex: 1, gap: 2 },
    pointTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    pointTags: { ...typography.caption, color: colors.textMuted },
    pointCount: { ...typography.caption, color: colors.textMuted },
  });
