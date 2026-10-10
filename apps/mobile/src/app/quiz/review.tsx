import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Animated from "react-native-reanimated";
import { getLearningTrack } from "@learn-workbench/content";
import type { LearningReviewResponse } from "@learn-workbench/shared";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { fetchLearningReview } from "@/lib/learning-review";
import {
  loadLearningAttempts,
  wrongQuestionKeys,
  type LearningAttempt,
} from "@/lib/learning-progress";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";

interface TrackQueue {
  slug: string;
  title: string;
  accent: string;
  softAccent: string;
  count: number;
}

function groupByTrack(keys: string[], attempts: LearningAttempt[]): TrackQueue[] {
  const trackOfKey = new Map(attempts.map((attempt) => [attempt.questionKey, attempt.trackSlug]));
  const counts = new Map<string, number>();
  for (const key of keys) {
    const slug = trackOfKey.get(key);
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([slug, count]) => {
      const track = getLearningTrack(slug);
      return track ? { slug, title: track.title, accent: track.accent, softAccent: track.softAccent, count } : null;
    })
    .filter((item): item is TrackQueue => item !== null)
    .sort((a, b) => b.count - a.count);
}

export default function QuizReviewScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const header = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const [review, setReview] = useState<LearningReviewResponse | null>(null);
  const [attempts, setAttempts] = useState<LearningAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [remote, local] = await Promise.all([fetchLearningReview(), loadLearningAttempts()]);
    setReview(remote);
    setAttempts(local);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const { control: pullControl } = usePullRefresh(load);

  // 服务端到期队列（SM-2）；本地错题按"最近一次作答"口径兜底
  const dueQueues = useMemo(() => {
    if (!review) return [];
    return groupDueCards(review);
  }, [review]);
  const localWrong = useMemo(() => wrongQuestionKeys(attempts), [attempts]);
  const localQueues = useMemo(() => groupByTrack(localWrong, attempts), [localWrong, attempts]);

  const startReview = (trackSlug: string, mode: "due" | "wrong") => {
    router.push({
      pathname: "/quiz/session",
      params: { track: trackSlug, mode },
    } as never);
  };

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="复习队列" scrollY={header.scrollY} backTo="/quiz" />
      <Animated.ScrollView
        onScroll={header.onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl {...pullControl} />}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeaderLargeTitle title="复习队列" subtitle="到期复习 · 本地错题，分开统计" />

        <Animated.View entering={entrance(0)} style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <SummaryStat styles={styles} value={review ? review.dueCount : localWrong.length} label={review ? "到期复习" : "本地错题"} accent={colors.danger} />
            <SummaryStat styles={styles} value={review ? review.totalCount : attempts.length} label={review ? "累计卡片" : "本地作答"} accent={colors.text} />
            <SummaryStat styles={styles} value={review ? review.masteredCount : 0} label="已掌握" accent={colors.success} />
          </View>
          <Text style={styles.summaryHint}>
            {review
              ? "按间隔复习（SM-2）安排：答错即入列，答对逐次拉长间隔，连续掌握后自动移出。"
              : "未登录或离线：当前用本机错题兜底；登录后会自动接入服务端间隔复习队列。"}
          </Text>
        </Animated.View>

        <Animated.View entering={entrance(1)} style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>到期复习</Text>
          <Text style={styles.sectionCount}>{review ? `${review.dueCount} 题` : "需登录"}</Text>
        </Animated.View>

        <View style={styles.list}>
          {dueQueues.map((queue, index) => (
            <Animated.View key={queue.slug} entering={entrance(2 + index)}>
              <QueueCard
                queue={queue}
                colors={colors}
                styles={styles}
                cta="复习到期"
                onPress={() => startReview(queue.slug, "due")}
              />
            </Animated.View>
          ))}
          {!loading && dueQueues.length === 0 ? (
            <EmptyCard
              colors={colors}
              styles={styles}
              icon="checkmark-done"
              title="暂时没有到期复习"
              text={review ? "间隔复习队列是空的，先做一组练习把错题收进来。" : "登录后可接入服务端间隔复习队列。"}
            />
          ) : null}
        </View>

        <Animated.View entering={entrance(4)} style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>本地错题</Text>
          <Text style={styles.sectionCount}>{localWrong.length} 题</Text>
        </Animated.View>

        <View style={styles.list}>
          {localQueues.map((queue, index) => (
            <Animated.View key={queue.slug} entering={entrance(5 + index)}>
              <QueueCard
                queue={queue}
                colors={colors}
                styles={styles}
                cta="重做错题"
                onPress={() => startReview(queue.slug, "wrong")}
              />
            </Animated.View>
          ))}
          {!loading && localQueues.length === 0 ? (
            <EmptyCard
              colors={colors}
              styles={styles}
              icon="sparkles-outline"
              title="没有本机错题"
              text="继续练习，答错的题目会自动出现在这里。"
            />
          ) : null}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

/** 服务端卡片按方向归组（不依赖本地作答记录） */
function groupDueCards(review: LearningReviewResponse): TrackQueue[] {
  const counts = new Map<string, number>();
  for (const card of review.cards) counts.set(card.trackSlug, (counts.get(card.trackSlug) ?? 0) + 1);
  return [...counts.entries()]
    .map(([slug, count]) => {
      const track = getLearningTrack(slug);
      return track ? { slug, title: track.title, accent: track.accent, softAccent: track.softAccent, count } : null;
    })
    .filter((item): item is TrackQueue => item !== null)
    .sort((a, b) => b.count - a.count);
}

function SummaryStat({
  styles,
  value,
  label,
  accent,
}: {
  styles: ReturnType<typeof makeStyles>;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryValue, { color: accent }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function QueueCard({
  queue,
  colors,
  styles,
  cta,
  onPress,
}: {
  queue: TrackQueue;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  cta: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      haptic
      scaleTo={0.985}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${queue.title} ${cta}`}
      style={styles.queueCard}
    >
      <View style={[styles.queueBadge, { backgroundColor: queue.softAccent }]}>
        <Text style={[styles.queueBadgeText, { color: queue.accent }]}>{queue.count}</Text>
      </View>
      <View style={styles.queueBody}>
        <Text style={styles.queueTitle}>{queue.title}</Text>
        <Text style={styles.queueMeta}>{queue.count} 道待复习</Text>
      </View>
      <View style={[styles.queueCta, { backgroundColor: queue.accent }]}>
        <Text style={styles.queueCtaText}>{cta}</Text>
        <ThemedIcon name="arrow-forward" size={15} color="#FFFFFF" />
      </View>
    </PressableScale>
  );
}

function EmptyCard({
  colors,
  styles,
  icon,
  title,
  text,
}: {
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <ThemedIcon name={icon as never} size={22} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.md },
    summaryCard: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surfaceStrong, gap: spacing.md, ...shadows.card },
    summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
    summaryStat: { flex: 1, alignItems: "center", gap: 2 },
    summaryValue: { ...typography.title1, fontWeight: "900" },
    summaryLabel: { ...typography.caption, color: colors.textMuted },
    summaryHint: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
    sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: spacing.sm },
    sectionTitle: { ...typography.title2, color: colors.text },
    sectionCount: { ...typography.caption, color: colors.textMuted },
    list: { gap: spacing.sm },
    queueCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      ...shadows.card,
    },
    queueBadge: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    queueBadgeText: { ...typography.title2, fontWeight: "900" },
    queueBody: { flex: 1, gap: 2 },
    queueTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    queueMeta: { ...typography.caption, color: colors.textMuted },
    queueCta: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 38 },
    queueCtaText: { ...typography.caption, fontWeight: "800", color: "#FFFFFF" },
    empty: { alignItems: "center", gap: spacing.sm, borderRadius: radius.lg, padding: spacing.xl, backgroundColor: colors.surfaceMuted },
    emptyIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceStrong },
    emptyTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    emptyText: { ...typography.caption, textAlign: "center", color: colors.textMuted },
  });
