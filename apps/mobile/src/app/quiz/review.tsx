import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Animated from "react-native-reanimated";
import { getLearningTrack } from "@learn-workbench/content";
import type { LearningReviewCard, LearningReviewResponse, LearningWeakTopic } from "@learn-workbench/shared";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import {
  applyLearningReviewAction,
  fetchLearningReview,
  flushLearningReviewActions,
} from "@/lib/learning-review";
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
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    await flushLearningReviewActions();
    const [remote, local] = await Promise.all([fetchLearningReview("all"), loadLearningAttempts()]);
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
    return groupDueCards({
      ...review,
      cards: review.cards.filter(
        (card) =>
          card.status !== "mastered" &&
          card.status !== "suspended" &&
          Date.parse(card.dueAt) <= Date.parse(review.generatedAt)
      ),
    });
  }, [review]);
  const localWrong = useMemo(() => wrongQuestionKeys(attempts), [attempts]);
  const localQueues = useMemo(() => groupByTrack(localWrong, attempts), [localWrong, attempts]);

  const startReview = (trackSlug: string, mode: "due" | "wrong") => {
    router.push({
      pathname: "/quiz/session",
      params: { track: trackSlug, mode },
    } as never);
  };

  const startWeakTopic = (topic: LearningWeakTopic) => {
    router.push({
      pathname: "/quiz/session",
      params: {
        track: topic.trackSlug,
        mode: "due",
        stage: topic.stageKey,
        topic: topic.topicKey,
      },
    } as never);
  };

  const runAction = async (
    card: LearningReviewCard,
    action: "snooze" | "pause" | "resume" | "complete"
  ) => {
    setBusyKey(`${card.questionKey}:${action}`);
    setNotice("");
    const result = await applyLearningReviewAction({
      action,
      questionKeys: [card.questionKey],
      ...(action === "snooze" ? { snoozeDays: 1 } : {}),
    });
    if (result.review) setReview(result.review);
    if (result.queued) setNotice("当前离线，操作已保存，联网后会自动同步。");
    setBusyKey(null);
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
              ? "按间隔复习（SM-2）安排：答错即入列，答对逐次拉长间隔，连续掌握后自动移出；可延后、暂停或手动完成。"
              : "未登录或离线：当前用本机错题兜底；登录后会自动接入服务端间隔复习队列。"}
          </Text>
        </Animated.View>

        {review && review.weakTopics.length > 0 ? (
          <>
            <Animated.View entering={entrance(1)} style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>薄弱知识点</Text>
              <Text style={styles.sectionCount}>{review.weakTopics.length} 个</Text>
            </Animated.View>
            <View style={styles.list}>
              {review.weakTopics.slice(0, 6).map((topic, index) => (
                <Animated.View key={`${topic.trackSlug}:${topic.topicKey}`} entering={entrance(2 + index)}>
                  <WeakTopicCard
                    topic={topic}
                    styles={styles}
                    colors={colors}
                    onPress={() => startWeakTopic(topic)}
                  />
                </Animated.View>
              ))}
            </View>
          </>
        ) : null}

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

        {review && review.cards.length > 0 ? (
          <>
            <Animated.View entering={entrance(4)} style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>复习计划</Text>
              <Text style={styles.sectionCount}>{review.totalCount} 张卡</Text>
            </Animated.View>
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <View style={styles.list}>
              {review.cards.slice(0, 30).map((card) => (
                <PlanCard
                  key={card.questionKey}
                  card={card}
                  colors={colors}
                  styles={styles}
                  busyKey={busyKey}
                  onAction={runAction}
                />
              ))}
            </View>
          </>
        ) : null}

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

function WeakTopicCard({
  topic,
  styles,
  colors,
  onPress,
}: {
  topic: LearningWeakTopic;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <PressableScale
      haptic
      scaleTo={0.985}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`复习薄弱知识点 ${topic.title}`}
      style={styles.weakCard}
    >
      <View style={styles.weakIcon}>
        <ThemedIcon name="alert-circle-outline" size={20} color={colors.danger} />
      </View>
      <View style={styles.weakBody}>
        <Text style={styles.weakTitle} numberOfLines={1}>{topic.title}</Text>
        <Text style={styles.weakMeta}>
          到期 {topic.dueCount} 题 · 错题 {topic.wrongCount} 题
        </Text>
      </View>
      <ThemedIcon name="arrow-forward" size={17} color={colors.textMuted} />
    </PressableScale>
  );
}

const REVIEW_STATUS_LABEL: Record<LearningReviewCard["status"], string> = {
  learning: "学习中",
  review: "待复习",
  mastered: "已掌握",
  suspended: "已暂停",
};

function PlanCard({
  card,
  styles,
  colors,
  busyKey,
  onAction,
}: {
  card: LearningReviewCard;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  busyKey: string | null;
  onAction: (
    card: LearningReviewCard,
    action: "snooze" | "pause" | "resume" | "complete"
  ) => Promise<void>;
}) {
  const question = getLearningTrack(card.trackSlug)?.questions.find((item) => item.key === card.questionKey);
  const due = new Date(card.dueAt);
  const statusColor =
    card.status === "mastered"
      ? colors.success
      : card.status === "suspended"
        ? colors.textMuted
        : card.status === "learning"
          ? colors.warning
          : colors.primary;
  return (
    <View style={styles.planCard}>
      <View style={styles.planTop}>
        <View style={styles.planTitleWrap}>
          <Text style={styles.planTitle} numberOfLines={2}>
            {question?.stem ?? card.questionKey}
          </Text>
          <Text style={styles.planMeta}>
            {REVIEW_STATUS_LABEL[card.status]} · 下次 {Number.isNaN(due.getTime()) ? "未知" : due.toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.planStatus, { backgroundColor: statusColor + "18" }]}>
          <Text style={[styles.planStatusText, { color: statusColor }]}>{REVIEW_STATUS_LABEL[card.status]}</Text>
        </View>
      </View>
      <View style={styles.planActions}>
        {card.status === "suspended" ? (
          <PlanAction
            label={busyKey === `${card.questionKey}:resume` ? "处理中" : "恢复"}
            styles={styles}
            colors={colors}
            onPress={() => void onAction(card, "resume")}
          />
        ) : (
          <>
            {card.status !== "mastered" ? (
              <>
                <PlanAction
                  label={busyKey === `${card.questionKey}:snooze` ? "处理中" : "延后 1 天"}
                  styles={styles}
                  colors={colors}
                  onPress={() => void onAction(card, "snooze")}
                />
                <PlanAction
                  label={busyKey === `${card.questionKey}:pause` ? "处理中" : "暂停"}
                  styles={styles}
                  colors={colors}
                  onPress={() => void onAction(card, "pause")}
                />
              </>
            ) : null}
            {card.status !== "mastered" ? (
              <PlanAction
                label={busyKey === `${card.questionKey}:complete` ? "处理中" : "完成"}
                styles={styles}
                colors={colors}
                strong
                onPress={() => void onAction(card, "complete")}
              />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function PlanAction({
  label,
  styles,
  colors,
  strong = false,
  onPress,
}: {
  label: string;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  strong?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      haptic
      scaleTo={0.96}
      onPress={onPress}
      style={[
        styles.planAction,
        strong ? { backgroundColor: colors.primary, borderColor: colors.primary } : null,
      ]}
    >
      <Text style={[styles.planActionText, strong && { color: "#FFFFFF" }]}>{label}</Text>
    </PressableScale>
  );
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
    notice: { ...typography.caption, color: colors.warning, paddingHorizontal: spacing.xs },
    list: { gap: spacing.sm },
    weakCard: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      ...shadows.card,
    },
    weakIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.dangerSoft,
    },
    weakBody: { flex: 1, gap: 2 },
    weakTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    weakMeta: { ...typography.caption, color: colors.textMuted },
    planCard: {
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      gap: spacing.md,
      ...shadows.card,
    },
    planTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    planTitleWrap: { flex: 1, gap: 3 },
    planTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    planMeta: { ...typography.micro, color: colors.textMuted },
    planStatus: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
    planStatusText: { ...typography.micro, fontWeight: "800" },
    planActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    planAction: {
      minHeight: 36,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    planActionText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
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
