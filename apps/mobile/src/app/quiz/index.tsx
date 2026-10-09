import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Animated from "react-native-reanimated";
import { learningCategories, learningTracks, type LearningTrack } from "@learn-workbench/content";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { loadLearningAttempts, summarizeLearningAttempts, type LearningAttempt } from "@/lib/learning-progress";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

type CategoryFilter = "全部" | string;

export default function QuizLibraryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("全部");
  const [attempts, setAttempts] = useState<LearningAttempt[]>([]);

  const load = useCallback(async () => {
    setAttempts(await loadLearningAttempts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const { control: pullControl } = usePullRefresh(load);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return learningTracks.filter((track) => {
      const categoryMatch = category === "全部" || track.category === category;
      if (!categoryMatch) return false;
      if (!q) return true;
      const searchText = [
        track.title,
        track.category,
        track.summary,
        track.whyLearn,
        ...track.stages.flatMap((stage) => [stage.title, stage.goal, ...stage.topics.map((topic) => topic.title)]),
      ]
        .join(" ")
        .toLowerCase();
      return searchText.includes(q);
    });
  }, [category, query]);

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="技术题库" scrollY={header.scrollY} backTo="/(tabs)/learn" />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl {...pullControl} />}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeaderLargeTitle title="技术题库" subtitle="搜索技术 · 学习路线 · 每日练习" />

        <Animated.View entering={entrance(0)} style={styles.searchShell}>
          <ThemedIcon name="search" size={19} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索 Python、Java、数据分析、Power BI"
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="搜索技术题库"
          />
          {query ? (
            <PressableScale
              onPress={() => setQuery("")}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="清空搜索"
            >
              <ThemedIcon name="close" size={16} color={colors.textMuted} />
            </PressableScale>
          ) : null}
        </Animated.View>

        <Animated.View entering={entrance(1)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {["全部", ...learningCategories].map((item) => {
              const active = item === category;
              return (
                <PressableScale
                  key={item}
                  haptic
                  scaleTo={0.96}
                  onPress={() => setCategory(item)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={entrance(2)} style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{query || category !== "全部" ? "搜索结果" : "正在学习"}</Text>
          <Text style={styles.sectionCount}>{visible.length} 个技术方向</Text>
        </Animated.View>

        <View style={styles.list}>
          {visible.map((track, index) => (
            <Animated.View key={track.slug} entering={entrance(3 + index)}>
              <TrackCard
                track={track}
                progress={summarizeLearningAttempts(attempts, track.questions)}
              />
            </Animated.View>
          ))}
          {visible.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <ThemedIcon name="search" size={24} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>没有匹配的技术</Text>
              <Text style={styles.emptyText}>试试 Python、Java、SQL 或 Power BI</Text>
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function TrackCard({ track, progress }: { track: LearningTrack; progress: ReturnType<typeof summarizeLearningAttempts> }) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const trackTint = dark ? `${track.accent}24` : track.softAccent;
  return (
    <PressableScale
      haptic
      scaleTo={0.985}
      style={styles.trackCard}
      onPress={() => router.push(`/quiz/${track.slug}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`打开 ${track.title} 题库`}
    >
      <View style={[styles.trackAccent, { backgroundColor: track.accent }]} />
      <View style={[styles.trackIcon, { backgroundColor: trackTint }]}>
        <ThemedIcon name={track.icon as never} size={24} color={track.accent} />
      </View>
      <View style={styles.trackBody}>
        <View style={styles.trackTop}>
          <Text style={[styles.trackCategory, { color: track.accent }]}>{track.category}</Text>
          <Text style={styles.trackLevel}>{track.level}</Text>
        </View>
        <Text style={styles.trackTitle}>{track.title}</Text>
        <Text style={styles.trackSummary} numberOfLines={2}>
          {track.summary}
        </Text>
        <View style={styles.trackMeta}>
          <Text style={styles.trackMetaText}>{track.stages.length} 个阶段</Text>
          <View style={styles.dot} />
          <Text style={styles.trackMetaText}>{track.questions.length} 道题</Text>
          <View style={styles.dot} />
          <Text style={styles.trackMetaText}>{progress.mastery}% 掌握度</Text>
        </View>
      </View>
      <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
    </PressableScale>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.lg },
    searchShell: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderRadius: radius.md + 2,
      backgroundColor: colors.surfaceStrong,
      paddingHorizontal: spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    searchInput: { flex: 1, minHeight: 48, ...typography.body, color: colors.text, paddingVertical: 0 },
    clearButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    chips: { gap: spacing.sm, paddingVertical: 2 },
    chip: {
      minHeight: 38,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.text, borderColor: colors.text },
    chipText: { ...typography.callout, color: colors.textSecondary },
    chipTextActive: { color: colors.canvas },
    sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    sectionTitle: { ...typography.title2, color: colors.text },
    sectionCount: { ...typography.caption, color: colors.textMuted },
    list: { gap: spacing.md },
    trackCard: {
      minHeight: 132,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      paddingLeft: spacing.lg + 4,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      overflow: "hidden",
      ...shadows.card,
    },
    trackAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
    trackIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    trackBody: { flex: 1, minWidth: 0, gap: 3 },
    trackTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    trackCategory: { ...typography.micro, letterSpacing: 0.4 },
    trackLevel: { ...typography.micro, color: colors.textMuted },
    trackTitle: { ...typography.title2, color: colors.text },
    trackSummary: { ...typography.caption, fontWeight: "400", color: colors.textSecondary },
    trackMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
    trackMetaText: { ...typography.micro, color: colors.textMuted },
    dot: { width: 3, height: 3, borderRadius: 999, backgroundColor: colors.textFaint },
    empty: { alignItems: "center", gap: spacing.sm, padding: 40 },
    emptyIcon: { width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
    emptyTitle: { ...typography.headline, color: colors.text },
    emptyText: { ...typography.callout, color: colors.textMuted },
  });
