import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { EmptyState } from "@/components/empty-state";
import { PressableScale } from "@/components/pressable-scale";
import { RichText } from "@/components/rich-text";
import { ScreenHeaderStickyBar } from "@/components/screen-header";
import { Skeleton, SkeletonCard } from "@/components/skeleton";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";
import {
  EXAM_408_CARD_RATINGS,
  EXAM_408_CARD_SUBJECTS,
  canSubmitRating,
  enqueueRating,
  fetchCardDetail,
  flipActionLabel,
  flipPhaseOf,
  loadRatingOutbox,
  makeClientId,
  makeRatingOp,
  nextFlipState,
  pendingRatingCount,
  ratingHint,
  ratingLabel,
  ratingVisual,
  saveRatingOutbox,
  submitCardRating,
  type Exam408CardDetail,
  type Exam408CardDetailFailure,
  type Exam408CardRating,
} from "@/lib/exam-408-cards";

/**
 * 408 速记卡详情页（P3-1）。
 *
 * 入口：408 搜索命中 / 知识点页「速记卡」列表 / 深链。参数 key。
 * 与刷卡页共用同一套契约与纯函数：
 * - 卡片内容公开（未登录也能读），登录后服务端额外返回个人 schedule；
 * - 翻面复用 flipPhaseOf / nextFlipState / flipActionLabel，不另起一套状态机；
 * - 评级只允许在答案面、且必须登录；复用 submitCardRating + makeClientId，
 *   离线/5xx 入 lwb.exam408.cards.outbox.v1 发件箱并提示「已加入待同步」。
 *
 * 动效纪律：本页不加任何入场/翻面动画（motion 预算已满），翻面用纯 state 切换；
 * 字阶一律走 typography token（fontscale 棘轮按文件计新增）。
 */

export default function Exam408CardScreen() {
  const params = useLocalSearchParams<{ key?: string }>();
  const cardKey = (params.key ?? "").trim();
  if (!cardKey) return <MissingCard />;
  return <CardDetail key={cardKey} cardKey={cardKey} />;
}

function CardDetail({ cardKey }: { cardKey: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bottomSpace = useTabBarSpace();
  const token = useAppStore((state) => state.token);

  const [detail, setDetail] = useState<Exam408CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<Exam408CardDetailFailure | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  /** 本次进页已提交成功的评级（成功后锁定按钮，避免同一张卡重复评分） */
  const [rated, setRated] = useState<Exam408CardRating | null>(null);
  const [pending, setPending] = useState(0);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    setNotice("");
    setFlipped(false);
    setRated(null);
    const [result, outbox] = await Promise.all([fetchCardDetail(cardKey), loadRatingOutbox()]);
    setDetail(result.detail);
    setFailure(result.failure);
    setPending(pendingRatingCount(outbox));
    setLoading(false);
  }, [cardKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggle = useCallback(() => {
    haptics.soft();
    setFlipped((previous) => nextFlipState(previous));
  }, []);

  const rate = async (rating: Exam408CardRating) => {
    if (!detail || busy || rated !== null || !canSubmitRating(flipped)) return;
    setBusy(true);
    setNotice("");
    haptics.light();
    const clientId = makeClientId();
    const outcome = await submitCardRating({ cardKey: detail.card.key, rating, clientId });
    if (outcome.ok && outcome.result) {
      setRated(rating);
      setNotice("已记录：" + ratingLabel(rating) + "。");
      if (outcome.result.streak > 1) haptics.success();
    } else if (outcome.retryable) {
      // 离线 / 401 / 5xx：与刷卡页一致入发件箱，等联网补发（clientId 幂等）
      const outbox = enqueueRating(
        await loadRatingOutbox(),
        makeRatingOp(detail.card.key, rating, { clientId }),
      );
      await saveRatingOutbox(outbox);
      setPending(pendingRatingCount(outbox));
      setNotice("已加入待同步：联网后自动补发。");
    } else {
      setNotice("这次评级没被服务端接受，请稍后重试。");
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeaderStickyBar title="速记卡" />
        <View style={styles.content}>
          <SkeletonCard />
          <Skeleton lines={4} />
        </View>
      </View>
    );
  }

  if (failure || !detail) {
    const notFound = failure === "invalid" || failure === "not-found";
    return (
      <View style={styles.root}>
        <ScreenHeaderStickyBar title="速记卡" />
        <View style={styles.centerBox}>
          <EmptyState
            icon={notFound ? "document-outline" : "cloud-offline-outline"}
            title={notFound ? "没有找到这张速记卡" : "暂时拿不到这张卡"}
            hint={
              notFound
                ? "它可能还没发布，或者已经被删除。"
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

  const card = detail.card;
  const face = flipPhaseOf(flipped);
  const subjectTitle =
    EXAM_408_CARD_SUBJECTS.find((subject) => subject.key === card.subjectKey)?.title ?? card.subjectKey;
  const schedule = detail.schedule;
  const scheduleText =
    schedule === null
      ? ""
      : schedule.state === "due"
        ? "待复习"
        : schedule.state === "scheduled"
          ? "未到期"
          : "新卡";

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="速记卡" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 卡片本体：正面题干 / 背面答案，点按任意面都能来回翻 */}
        <PressableScale
          onPress={toggle}
          style={styles.card}
          accessibilityRole="button"
          accessibilityLabel={flipped ? "隐藏答案，查看题干" : "显示答案：" + card.question.slice(0, 60)}
          accessibilityHint="点按任意位置翻面"
        >
          <View style={styles.metaRow}>
            <View style={styles.chapterBadge}>
              <Text style={styles.chapterBadgeText}>
                {subjectTitle ? subjectTitle + " · " : ""}第 {card.chapter} 章
              </Text>
            </View>
            {card.star ? (
              <View style={styles.starBadge}>
                <ThemedIcon name="star" size={12} color={colors.accentStrong} />
                <Text style={styles.starBadgeText}>重点</Text>
              </View>
            ) : null}
            {scheduleText ? (
              <View style={styles.stateBadge}>
                <Text style={styles.stateBadgeText}>{scheduleText}</Text>
              </View>
            ) : null}
          </View>

          {face === "question" ? (
            <>
              <RichText text={card.question} style={styles.questionText} />
              <View style={styles.faceHintRow}>
                <ThemedIcon name="eye-outline" size={15} color={colors.primary} />
                <Text style={styles.faceHintActive}>{flipActionLabel(flipped)}（点卡片）</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.answerHeadRow}>
                <Text style={styles.faceTitle}>答案要点</Text>
                <Text style={styles.answerCount}>
                  {card.answerSteps.length > 0 ? card.answerSteps.length + " 步" : "凭记忆复述"}
                </Text>
              </View>
              {card.answerSteps.length === 0 ? (
                <Text style={styles.answerStepText}>
                  这张卡没有分步要点，直接凭记忆把结论复述一遍，再按三档自评。
                </Text>
              ) : (
                card.answerSteps.map((step, stepIndex) => (
                  <View key={stepIndex} style={styles.answerRow}>
                    <View style={styles.answerIndex}>
                      <Text style={styles.answerIndexText}>{stepIndex + 1}</Text>
                    </View>
                    <RichText text={step} style={styles.answerStepText} />
                  </View>
                ))
              )}
              {card.pitfall ? (
                <View style={styles.pitfallBox}>
                  <View style={styles.sectionTitleRow}>
                    <ThemedIcon name="alert-circle" size={14} color={colors.danger} />
                    <Text style={styles.pitfallTitle}>易错点</Text>
                  </View>
                  <RichText text={card.pitfall} style={styles.pitfallText} />
                </View>
              ) : null}
              {card.mnemonic ? (
                <View style={styles.mnemonicBox}>
                  <View style={styles.sectionTitleRow}>
                    <ThemedIcon name="sparkles" size={14} color={colors.accentStrong} />
                    <Text style={styles.mnemonicTitle}>口诀</Text>
                  </View>
                  <RichText text={card.mnemonic} style={styles.mnemonicText} />
                </View>
              ) : null}
              {card.knowledgePointKey ? (
                <PressableScale
                  haptic
                  onPress={() => {
                    haptics.light();
                    router.push(
                      ("/quiz/408-point?key=" + encodeURIComponent(card.knowledgePointKey)) as never,
                    );
                  }}
                  style={styles.pointLink}
                  accessibilityRole="button"
                  accessibilityLabel="查看关联知识点"
                >
                  <ThemedIcon name="book-outline" size={16} color={colors.primary} />
                  <Text style={styles.pointLinkText}>关联知识点</Text>
                  <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
                </PressableScale>
              ) : null}
              <Text style={styles.faceHint}>{flipActionLabel(flipped)}（点卡片）</Text>
            </>
          )}
        </PressableScale>

        {/* 显式翻面按钮：与刷卡页一致，正反面都能切换 */}
        <PressableScale
          haptic
          onPress={toggle}
          style={styles.flipButton}
          accessibilityRole="button"
          accessibilityLabel={flipActionLabel(flipped)}
        >
          <ThemedIcon
            name={flipped ? "eye-off-outline" : "eye-outline"}
            size={18}
            color={colors.primary}
          />
          <Text style={styles.flipButtonText}>{flipActionLabel(flipped)}</Text>
        </PressableScale>

        {/* 评级区：只有答案面才可评级；未登录时给出登录引导 */}
        {flipped ? (
          token ? (
            <View style={styles.ratingBlock}>
              <View style={styles.ratingHead}>
                <Text style={styles.ratingTitle}>这张卡记得怎么样？</Text>
                {rated !== null ? (
                  <Text style={styles.ratedText}>已评 {ratingLabel(rated)}</Text>
                ) : null}
              </View>
              <View style={styles.ratingRow}>
                {EXAM_408_CARD_RATINGS.map((rating) => {
                  const visual = ratingVisual(rating);
                  const accent =
                    visual.tone === "danger"
                      ? colors.danger
                      : visual.tone === "warning"
                        ? colors.warning
                        : colors.success;
                  const soft =
                    visual.tone === "danger"
                      ? colors.dangerSoft
                      : visual.tone === "warning"
                        ? colors.warningSoft
                        : colors.successSoft;
                  return (
                    <PressableScale
                      key={rating}
                      haptic
                      disabled={busy || rated !== null}
                      onPress={() => void rate(rating)}
                      style={[
                        styles.ratingButton,
                        { backgroundColor: soft, borderColor: accent },
                        (busy || rated !== null) && styles.ratingButtonBusy,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={"评级 " + visual.label + "，" + visual.hint}
                    >
                      <ThemedIcon name={visual.icon as never} size={22} color={accent} />
                      <Text style={[styles.ratingLabel, { color: accent }]}>{visual.label}</Text>
                      <Text style={styles.ratingHint}>{ratingHint(rating)}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.loginGate}>
              <View style={styles.loginGateText}>
                <ThemedIcon name="lock-closed-outline" size={16} color={colors.textMuted} />
                <Text style={styles.loginGateLabel}>登录后可评级</Text>
              </View>
              <PressableScale
                haptic
                onPress={() => router.push("/settings" as never)}
                style={styles.loginButton}
                accessibilityRole="button"
                accessibilityLabel="去登录"
              >
                <Text style={styles.loginButtonText}>去登录</Text>
              </PressableScale>
            </View>
          )
        ) : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {pending > 0 ? (
          <View style={styles.pendingBar}>
            <ThemedIcon name="cloud-offline-outline" size={15} color={colors.warning} />
            <Text style={styles.pendingText}>{pending} 条评级待同步 · 联网后自动补发</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function MissingCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="速记卡" />
      <View style={styles.centerBox}>
        <EmptyState
          icon="albums-outline"
          title="缺少卡片参数"
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

    card: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.floating,
    },
    metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
    chapterBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: colors.surfaceMuted,
    },
    chapterBadgeText: { ...typography.micro, color: colors.textSecondary },
    starBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: colors.accentSoft,
    },
    starBadgeText: { ...typography.micro, color: colors.accentStrong },
    stateBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: colors.primarySoft,
    },
    stateBadgeText: { ...typography.micro, color: colors.primary },

    questionText: { ...typography.title2, color: colors.text, marginTop: spacing.sm },
    faceHintRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.md },
    faceHint: { ...typography.micro, color: colors.textFaint, marginTop: spacing.md },
    faceHintActive: { ...typography.micro, fontWeight: "700", color: colors.primary },

    answerHeadRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    faceTitle: { ...typography.headline, color: colors.text },
    answerCount: { ...typography.micro, color: colors.textMuted },
    answerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.xs },
    answerIndex: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
      marginTop: 2,
    },
    answerIndexText: { ...typography.micro, color: colors.primary, fontVariant: ["tabular-nums"] },
    answerStepText: { ...typography.body, flex: 1, color: colors.text },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    pitfallBox: {
      gap: 4,
      marginTop: spacing.sm,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.dangerSoft,
    },
    pitfallTitle: { ...typography.caption, fontWeight: "800", color: colors.danger },
    pitfallText: { ...typography.callout, color: colors.text },
    mnemonicBox: {
      gap: 4,
      marginTop: spacing.sm,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.accentSoft,
    },
    mnemonicTitle: { ...typography.caption, fontWeight: "800", color: colors.accentStrong },
    mnemonicText: { ...typography.callout, color: colors.text },
    pointLink: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.primarySoft,
    },
    pointLinkText: { ...typography.callout, fontWeight: "700", color: colors.primary, flex: 1 },

    flipButton: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: radius.md,
      backgroundColor: colors.primarySoft,
    },
    flipButtonText: { ...typography.callout, fontWeight: "800", color: colors.primary },

    ratingBlock: { gap: spacing.sm },
    ratingHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
    ratingTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    ratedText: { ...typography.micro, color: colors.success },
    ratingRow: { flexDirection: "row", gap: spacing.sm },
    ratingButton: {
      flex: 1,
      minHeight: 64,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
    },
    ratingButtonBusy: { opacity: 0.6 },
    ratingLabel: { ...typography.headline, fontWeight: "800" },
    ratingHint: { ...typography.micro, color: colors.textMuted },

    loginGate: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.surfaceMuted,
    },
    loginGateText: { flexDirection: "row", alignItems: "center", gap: 6 },
    loginGateLabel: { ...typography.callout, color: colors.textSecondary },
    loginButton: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    loginButtonText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },

    notice: { ...typography.micro, color: colors.warning },
    pendingBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      backgroundColor: colors.warningSoft,
    },
    pendingText: { ...typography.micro, flex: 1, color: colors.textSecondary },
  });
