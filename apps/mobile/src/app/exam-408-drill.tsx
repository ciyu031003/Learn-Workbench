import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { EmptyState } from "@/components/empty-state";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";
import {
  EMPTY_CARD_STATS,
  EMPTY_CARD_STATS_BOARD,
  EXAM_408_CARD_RATINGS,
  EXAM_408_CARD_SUBJECTS,
  applyLocalRatingStats,
  cardProgress,
  enqueueRating,
  fetchCardQueue,
  fetchCardStatsBoard,
  flushRatingOutbox,
  formatAccuracy,
  loadCachedQueue,
  loadCachedStatsBoard,
  loadRatingOutbox,
  makeClientId,
  makeRatingOp,
  mergeCardStatsWithPending,
  mergeRatingResultStats,
  nextCardIndex,
  pendingRatingCount,
  ratingHint,
  ratingLabel,
  removeCardFromQueue,
  saveCachedQueue,
  saveCachedStatsBoard,
  saveRatingOutbox,
  submitCardRating,
  type Exam408CardRating,
  type Exam408CardStats,
  type Exam408CardStatsBoard,
  type Exam408CardQueue,
  type Exam408FetchFailure,
} from "@/lib/exam-408-cards";

/**
 * 408 刷卡页（v1.55）：题库/科目选择 → 点击翻卡 → 三档评级 → 今日统计。
 *
 * 与 Web 共用同一套 /api/exam/408/cards 与 FSRS 状态，所以：
 * - 需要登录（未登录 401 → 引导去「我的」登录）；
 * - 评级先本地推进 UI，服务端确认后用它返回的 doneToday/remainingDue 校正统计；
 * - 网络失败时把评级写进离线发件箱（clientId 幂等），顶部显示「N 条待同步」，
 *   回前台/下次进页先补发，再拉队列。
 *
 * 布局是**定高**的：页面不自带纵向滚动（卡片内部各自滚动），这样手势翻卡不会和
 * 页面滚动抢手势；worklet 纪律见 apps/mobile/CLAUDE.md「手势与 worklet」。
 */

const FLIP_DURATION = 220;
/** 横向滑动翻卡的阈值（与 question-swipe 同口径：距离 + 速度双判） */
const SWIPE_DISTANCE = 56;
const SWIPE_VELOCITY = 420;
const ACTIVATE_X = 18;
const FAIL_Y = 14;

export default function Exam408DrillScreen() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const header = useLargeTitleHeader();
  const bottomSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const token = useAppStore((s) => s.token);

  const [subjectKey, setSubjectKey] = useState<string>("");
  const [queue, setQueue] = useState<Exam408CardQueue | null>(null);
  const [board, setBoard] = useState<Exam408CardStatsBoard>(EMPTY_CARD_STATS_BOARD);
  const [stats, setStats] = useState<Exam408CardStats>(EMPTY_CARD_STATS);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Exam408FetchFailure | null>(null);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const [notice, setNotice] = useState("");

  /* ---------------- 手势（worklet 只碰共享值 + runOnJS） ---------------- */
  const flip = useSharedValue(0);
  const panX = useSharedValue(0);

  const toggleFlip = useCallback(() => {
    haptics.soft();
    setFlipped((prev) => !prev);
  }, []);

  const tapGesture = Gesture.Tap()
    .maxDuration(260)
    .onEnd(() => {
      // worklet：只写共享值 + 转发 JS 回调
      flip.value = withTiming(flip.value > 0.5 ? 0 : 1, { duration: FLIP_DURATION });
      runOnJS(toggleFlip)();
    });

  const panGesture = Gesture.Pan()
    .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
    .failOffsetY([-FAIL_Y, FAIL_Y])
    .onUpdate((event) => {
      panX.value = event.translationX * 0.35;
    })
    .onEnd((event) => {
      const horizontal = event.translationX;
      const fast = Math.abs(event.velocityX) > SWIPE_VELOCITY;
      if (Math.abs(horizontal) > SWIPE_DISTANCE || fast) {
        flip.value = withTiming(flip.value > 0.5 ? 0 : 1, { duration: FLIP_DURATION });
        runOnJS(toggleFlip)();
      }
      panX.value = withTiming(0, { duration: 180 });
    });

  const cardGesture = Gesture.Simultaneous(tapGesture, panGesture);

  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [
      { perspective: 1100 },
      { translateX: panX.value },
      { rotateY: interpolate(flip.value, [0, 1], [0, 180]) + "deg" },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 0 : 1,
    transform: [
      { perspective: 1100 },
      { translateX: panX.value },
      { rotateY: interpolate(flip.value, [0, 1], [180, 360]) + "deg" },
    ],
  }));

  /* ---------------- 数据加载 ---------------- */
  /** 已全量加载过的「登录态|科目」签名；重复聚焦时不再重置游标 */
  const loadedSignature = useRef("");
  const reload = useCallback(
    async (targetSubject: string) => {
      // 未登录由渲染层直接拦（见下方 !token 分支），这里不 setState：
      // 该函数由 useEffect 触发，同步 setState 会被 react-hooks/set-state-in-effect 判错
      if (!token) return;
      // 先补发上一轮离线评级：拿到权威计数后再拉队列，避免「今日 done」来回跳。
      // 这行 await 同时保证 loading 态在首次 await 之后才翻转（不在 effect 里同步改状态）。
      const flushed = await flushRatingOutbox();
      setPending(flushed.remaining);
      setLoading(true);
      setNotice("");

      const [queueResult, boardResult] = await Promise.all([
        fetchCardQueue(targetSubject, 20),
        fetchCardStatsBoard(targetSubject),
      ]);

      if (queueResult.queue) {
        setQueue(queueResult.queue);
        setStats(mergeCardStatsWithPending(queueResult.queue.stats, flushed.remaining));
        setOffline(false);
        setFailure(null);
        await saveCachedQueue(targetSubject, queueResult.queue);
      } else {
        // 服务端不可用（离线/5xx）：回落缓存队列，绝不能用空列表覆盖
        const cached = await loadCachedQueue(targetSubject);
        setFailure(queueResult.failure);
        setOffline(queueResult.failure === "offline");
        if (cached) {
          setQueue(cached);
          setStats(mergeCardStatsWithPending(cached.stats, flushed.remaining));
        } else {
          setQueue(null);
          setStats(mergeCardStatsWithPending(EMPTY_CARD_STATS, flushed.remaining));
          // 清掉"已加载"标记：下次回到本页（或点了重试）再全量拉一次，
          // 否则一次开机离线就会被判成"已加载过"，只能靠手动切换科目才重试
          loadedSignature.current = "";
        }
      }

      if (boardResult.board) {
        setBoard(boardResult.board);
        await saveCachedStatsBoard(boardResult.board);
      } else {
        const cachedBoard = await loadCachedStatsBoard();
        setBoard(cachedBoard ?? EMPTY_CARD_STATS_BOARD);
      }

      setIndex(0);
      // eslint-disable-next-line react-hooks/immutability -- SharedValue 的 JS 侧复位（同 pressable-scale）
      flip.value = 0;
      setFlipped(false);
      setLoading(false);
    },
    [token, flip],
  );

  /**
   * 进页/换科目/登录态变化才全量拉队列；单纯"切走再回来"只补发离线评级 + 刷新科目统计，
   * 否则每次聚焦都会把游标重置回第 1 张（刷到一半去查个资料就丢进度）。
   */
  useFocusEffect(
    useCallback(() => {
      const signature = (token ?? "") + "|" + subjectKey;
      let cancelled = false;
      if (loadedSignature.current !== signature) {
        loadedSignature.current = signature;
        void reload(subjectKey);
        return () => {
          cancelled = true;
        };
      }
      void (async () => {
        const flushed = await flushRatingOutbox();
        if (!cancelled) setPending(flushed.remaining);
        const boardResult = await fetchCardStatsBoard(subjectKey);
        if (!cancelled && boardResult.board) setBoard(boardResult.board);
      })();
      return () => {
        cancelled = true;
      };
    }, [reload, subjectKey, token]),
  );

  const cards = queue?.cards ?? [];
  const card = index < cards.length ? cards[index] : null;
  const progress = cardProgress(index, cards.length);
  const finished = cards.length > 0 && index >= cards.length;

  const changeSubject = (key: string) => {
    if (key === subjectKey) return;
    haptics.light();
    setSubjectKey(key);
  };

  /* ---------------- 评级 ---------------- */
  const advance = () => {
    const next = nextCardIndex(index, cards.length);
    setIndex(next);
    // eslint-disable-next-line react-hooks/immutability -- SharedValue 的 JS 侧复位（同 pressable-scale）
    flip.value = 0;
    setFlipped(false);
  };

  const rate = async (rating: Exam408CardRating) => {
    if (!card || busy) return;
    haptics.light();
    setBusy(true);
    setNotice("");
    const clientId = makeClientId();
    const ratedCard = card;
    const outcome = await submitCardRating({ cardKey: ratedCard.key, rating, clientId });

    const result = outcome.result;
    if (outcome.ok && result) {
      setStats((prev) => mergeRatingResultStats(prev, result, ratedCard.state));
      if (result.streak > 1) haptics.success();
    } else {
      // 离线 / 未登录 / 5xx：入队等补发；4xx 语义错误也先留着（下一次拉队列会自然消失）
      const outbox = enqueueRating(await loadRatingOutbox(), makeRatingOp(ratedCard.key, rating, { clientId }));
      await saveRatingOutbox(outbox);
      setPending(pendingRatingCount(outbox));
      setStats((prev) => applyLocalRatingStats(prev, rating));
      setNotice(
        outcome.retryable
          ? "网络不可用：评级已排队，联网后自动同步。"
          : "这次评级没被服务端接受，已暂存待补发。",
      );
    }

    // 无论成功与否都从离线缓存里摘掉这张卡：断网重启后不该再看到刚评过的卡
    // （服务端是权威，联网加载时会用新队列覆盖缓存）
    const cachedQueue = await loadCachedQueue(subjectKey);
    if (cachedQueue) {
      await saveCachedQueue(subjectKey, removeCardFromQueue(cachedQueue, ratedCard.key));
    }

    advance();
    setBusy(false);
  };

  const retry = () => {
    void reload(subjectKey);
  };

  /* ---------------- 渲染 ---------------- */
  const subjectTitle =
    EXAM_408_CARD_SUBJECTS.find((item) => item.key === subjectKey)?.title ?? "";
  const dueNow = stats.dueCount;

  // 未登录优先判：登录态变化时不需要先闪一帧 loading 再跳到登录引导
  if (!token || failure === "unauthorized") {
    return (
      <View style={styles.root}>
        <ScreenHeaderStickyBar title="408 刷卡" scrollY={header.scrollY} backTo="/exam-408" />
        <View style={styles.centerBox}>
          <EmptyState
            icon="lock-closed-outline"
            title="登录后才能刷卡"
            hint="刷卡进度与 FSRS 记忆状态和 Web 共用，需要登录同一账号。"
            actionLabel="去登录"
            onAction={() => router.push("/settings" as never)}
            pattern="none"
          />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeaderStickyBar title="408 刷卡" scrollY={header.scrollY} backTo="/exam-408" />
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.centerText}>正在准备刷卡队列…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="408 刷卡" scrollY={header.scrollY} backTo="/exam-408" />

      <View style={[styles.content, { paddingBottom: Math.max(12, bottomSpace) + spacing.md }]}>
        {/* 今日统计 */}
        <Animated.View entering={entrance(0)} style={styles.statsCard}>
          <View style={styles.statsRow}>
            <StatCell styles={styles} value={String(stats.doneToday)} label="今日已刷" accent={colors.primary} />
            <StatCell styles={styles} value={String(dueNow)} label="待复习" accent={dueNow > 0 ? colors.warning : colors.success} />
            <StatCell
              styles={styles}
              value={board.today.done > 0 ? formatAccuracy(board.today.accuracy) : "—"}
              label="今日正确率"
              accent={colors.text}
            />
            <StatCell styles={styles} value={String(stats.streak)} label="连续天数" accent={colors.accent} />
          </View>
          <Text style={styles.statsHint}>
            {offline
              ? "当前离线：使用本机缓存队列，评级会在联网后补发。"
              : subjectTitle
                ? "当前科目：" + subjectTitle + " · 与 Web 端同一套记忆状态"
                : "全部科目 · 与 Web 端同一套记忆状态"}
          </Text>
        </Animated.View>

        {/* 科目选择（带各科待刷数，来自 mode=stats 的四行统计） */}
        <Animated.View entering={entrance(1)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subjectRow}
          >
            <SubjectChip
              styles={styles}
              colors={colors}
              label="全部"
              due={board.subjects.reduce((sum, item) => sum + item.dueCount, 0)}
              active={subjectKey === ""}
              onPress={() => changeSubject("")}
            />
            {EXAM_408_CARD_SUBJECTS.map((subject) => (
              <SubjectChip
                key={subject.key}
                styles={styles}
                colors={colors}
                label={subject.title}
                due={board.subjects.find((item) => item.subjectKey === subject.key)?.dueCount ?? 0}
                active={subjectKey === subject.key}
                onPress={() => changeSubject(subject.key)}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {/* 进度 */}
        {cards.length > 0 ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressHead}>
              <Text style={styles.progressText}>
                {finished ? "本轮已完成" : "第 " + Math.min(index + 1, cards.length) + " / " + cards.length + " 张"}
              </Text>
              <Text style={styles.progressPercent}>{progress.percent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: (progress.percent + "%") as DimensionValue }]}
              />
            </View>
          </View>
        ) : null}

        {/* 主体：卡片 / 空态 / 完成态 */}
        {cards.length === 0 ? (
          <View style={styles.centerBox}>
            <EmptyState
              icon={failure ? "cloud-offline-outline" : "checkmark-done"}
              title={failure ? "暂时拿不到队列" : "今天没有待刷的卡"}
              hint={
                failure === "offline"
                  ? "网络不可用，且本机还没有这个科目的缓存队列。"
                  : subjectTitle
                    ? subjectTitle + " 的到期卡已清空，换一科或稍后再来。"
                    : "全部科目的到期卡都清空了。"
              }
              actionLabel={failure ? "重试" : "刷新"}
              onAction={retry}
              pattern="none"
            />
          </View>
        ) : finished ? (
          <ScrollView style={styles.finishedScroll} contentContainerStyle={styles.finishedBox}>
            <ThemedIcon name="checkmark-done" size={34} color={colors.success} />
            <Text style={styles.finishedTitle}>这一轮刷完了</Text>
            <Text style={styles.finishedText}>
              今日已刷 {stats.doneToday} 张 · 待复习 {stats.dueCount} 张 · 连续 {stats.streak} 天
            </Text>
            {pending > 0 ? (
              <Text style={styles.finishedPending}>{pending} 条评级待同步，联网后自动补发。</Text>
            ) : null}
            <View style={styles.subjectStatsList}>
              {board.subjects.map((item) => (
                <View key={item.subjectKey} style={styles.subjectStatRow}>
                  <Text style={styles.subjectStatTitle}>{item.title}</Text>
                  <Text style={styles.subjectStatMeta}>
                    待复习 {item.dueCount} · 今日 {item.doneToday}
                    {item.accuracy === null ? "" : " · 正确率 " + formatAccuracy(item.accuracy)}
                  </Text>
                </View>
              ))}
            </View>
            <PressableScale haptic onPress={retry} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>再刷一轮</Text>
            </PressableScale>
          </ScrollView>
        ) : card ? (
          <View style={styles.cardSlot}>
            <GestureDetector gesture={cardGesture}>
              <View style={styles.card}>
                {/* 正面：题干 */}
                <Animated.View style={[styles.face, frontStyle]} pointerEvents={flipped ? "none" : "auto"}>
                  <ScrollView
                    style={styles.faceScroll}
                    contentContainerStyle={styles.faceContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.cardMetaRow}>
                      <View style={styles.chapterBadge}>
                        <Text style={styles.chapterBadgeText}>
                          {card.subjectKey ? subjectLabel(card.subjectKey) + " · " : ""}
                          第 {card.chapter} 章
                        </Text>
                      </View>
                      {card.star ? (
                        <View style={styles.starBadge}>
                          <Text style={styles.starBadgeText}>重点</Text>
                        </View>
                      ) : null}
                      <View style={styles.stateBadge}>
                        <Text style={styles.stateBadgeText}>
                          {card.state === "due"
                            ? "待复习"
                            : card.state === "scheduled"
                              ? "未到期"
                              : "新卡"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.questionText}>{card.question}</Text>
                    <View style={styles.faceHintRow}>
                      <ThemedIcon name="refresh" size={14} color={colors.textFaint} />
                      <Text style={styles.faceHint}>轻点或左右滑动，翻面看答题要点</Text>
                    </View>
                  </ScrollView>
                </Animated.View>

                {/* 背面：要点 / 易错点 / 口诀 */}
                <Animated.View style={[styles.face, styles.faceBack, backStyle]} pointerEvents={flipped ? "auto" : "none"}>
                  <ScrollView
                    style={styles.faceScroll}
                    contentContainerStyle={styles.faceContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.faceTitle}>答题要点</Text>
                    {card.answerSteps.length === 0 ? (
                      <Text style={styles.answerStepText}>这张卡没有分步要点，直接凭记忆复述一遍。</Text>
                    ) : (
                      card.answerSteps.map((step, stepIndex) => (
                        <View key={stepIndex} style={styles.answerRow}>
                          <View style={styles.answerIndex}>
                            <Text style={styles.answerIndexText}>{stepIndex + 1}</Text>
                          </View>
                          <Text style={styles.answerStepText}>{step}</Text>
                        </View>
                      ))
                    )}
                    {card.pitfall ? (
                      <View style={styles.pitfallBox}>
                        <Text style={styles.pitfallTitle}>易错点</Text>
                        <Text style={styles.pitfallText}>{card.pitfall}</Text>
                      </View>
                    ) : null}
                    {card.mnemonic ? (
                      <View style={styles.mnemonicBox}>
                        <Text style={styles.mnemonicTitle}>口诀</Text>
                        <Text style={styles.mnemonicText}>{card.mnemonic}</Text>
                      </View>
                    ) : null}
                    {card.demoKey ? (
                      <Text style={styles.demoHint}>演示：{card.demoKey}</Text>
                    ) : null}
                    <Text style={styles.faceHint}>轻点返回题干</Text>
                  </ScrollView>
                </Animated.View>
              </View>
            </GestureDetector>
          </View>
        ) : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {/* 评级按钮：翻面后才出现（避免没看答案就随手打分） */}
        {card && !finished ? (
          flipped ? (
            <View style={styles.ratingRow}>
              {EXAM_408_CARD_RATINGS.map((rating) => (
                <PressableScale
                  key={rating}
                  haptic
                  disabled={busy}
                  onPress={() => void rate(rating)}
                  style={[
                    styles.ratingButton,
                    rating === "again" && { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
                    rating === "hard" && { backgroundColor: colors.warningSoft, borderColor: colors.warning },
                    rating === "good" && { backgroundColor: colors.successSoft, borderColor: colors.success },
                    busy && styles.ratingButtonBusy,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={"评级 " + ratingLabel(rating)}
                >
                  <Text
                    style={[
                      styles.ratingLabel,
                      rating === "again" && { color: colors.danger },
                      rating === "hard" && { color: colors.warning },
                      rating === "good" && { color: colors.success },
                    ]}
                  >
                    {ratingLabel(rating)}
                  </Text>
                  <Text style={styles.ratingHint}>{ratingHint(rating)}</Text>
                </PressableScale>
              ))}
            </View>
          ) : (
            <View style={styles.flipRow}>
              <PressableScale haptic onPress={toggleFlip} style={styles.flipButton}>
                <ThemedIcon name="refresh" size={17} color={colors.primary} />
                <Text style={styles.flipButtonText}>翻面看答案</Text>
              </PressableScale>
              <Text style={styles.flipHint}>先自己想一遍，再翻面自评</Text>
            </View>
          )
        ) : null}

        {/* 待同步状态条（离线发件箱） */}
        {pending > 0 ? (
          <View style={styles.pendingBar}>
            <ThemedIcon name="cloud-offline-outline" size={15} color={colors.warning} />
            <Text style={styles.pendingText}>{pending} 条评级待同步 · 联网后自动补发</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function subjectLabel(subjectKey: string): string {
  return (
    EXAM_408_CARD_SUBJECTS.find((item) => item.key === subjectKey)?.title ?? subjectKey
  );
}

function StatCell({
  styles,
  value,
  label,
  accent,
}: {
  styles: ReturnType<typeof makeStyles>;
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SubjectChip({
  styles,
  colors,
  label,
  due,
  active,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  label: string;
  due: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      haptic
      onPress={onPress}
      style={[styles.subjectChip, active && styles.subjectChipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.subjectChipText, active && { color: colors.primary }]}>{label}</Text>
      <Text style={[styles.subjectChipDue, active && { color: colors.primary }]}>
        {due > 0 ? due + " 待复习" : "无到期"}
      </Text>
    </PressableScale>
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      gap: spacing.md,
    },
    centerBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    centerText: { ...typography.caption, color: colors.textMuted },
    statsCard: {
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    statsRow: { flexDirection: "row", gap: spacing.sm },
    statCell: { flex: 1, alignItems: "center", gap: 1 },
    statValue: {
      ...typography.title2,
      fontVariant: ["tabular-nums"],
    },
    statLabel: { ...typography.micro, color: colors.textMuted },
    statsHint: { ...typography.micro, color: colors.textFaint },
    subjectRow: { gap: spacing.sm, paddingRight: spacing.lg },
    subjectChip: {
      minWidth: 96,
      gap: 2,
      borderRadius: radius.md,
      paddingVertical: 8,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "transparent",
    },
    subjectChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    subjectChipText: { ...typography.caption, fontWeight: "800", color: colors.textSecondary },
    subjectChipDue: { ...typography.micro, color: colors.textMuted },
    progressBlock: { gap: 5 },
    progressHead: { flexDirection: "row", justifyContent: "space-between" },
    progressText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
    progressPercent: {
      ...typography.caption,
      color: colors.textMuted,
      fontVariant: ["tabular-nums"],
    },
    progressTrack: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
    },
    cardSlot: { flex: 1, minHeight: 240 },
    card: {
      flex: 1,
      borderRadius: radius.xl,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.floating,
      overflow: "hidden",
    },
    face: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    faceBack: { backgroundColor: dark ? "#1F2530" : "#F4F8FF" },
    faceScroll: { flex: 1 },
    faceContent: { padding: spacing.lg, gap: spacing.sm },
    cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    chapterBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: colors.surfaceMuted,
    },
    chapterBadgeText: { ...typography.micro, color: colors.textSecondary },
    starBadge: {
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
    questionText: {
      ...typography.title2,
      color: colors.text,
      lineHeight: 32,
      marginTop: spacing.sm,
    },
    faceHintRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: "auto" },
    faceHint: { ...typography.micro, color: colors.textFaint },
    faceTitle: { ...typography.headline, color: colors.text },
    answerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    answerIndex: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
      marginTop: 2,
    },
    answerIndexText: {
      ...typography.micro,
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
    answerStepText: { ...typography.body, flex: 1, color: colors.textSecondary },
    pitfallBox: {
      gap: 2,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.dangerSoft,
    },
    pitfallTitle: { ...typography.caption, fontWeight: "800", color: colors.danger },
    pitfallText: { ...typography.callout, color: colors.textSecondary },
    mnemonicBox: {
      gap: 2,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.accentSoft,
    },
    mnemonicTitle: { ...typography.caption, fontWeight: "800", color: colors.accentStrong },
    mnemonicText: { ...typography.callout, color: colors.textSecondary },
    demoHint: { ...typography.micro, color: colors.textFaint },
    notice: { ...typography.micro, color: colors.warning },
    ratingRow: { flexDirection: "row", gap: spacing.sm },
    ratingButton: {
      flex: 1,
      minHeight: 62,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
    },
    ratingButtonBusy: { opacity: 0.6 },
    ratingLabel: { ...typography.headline, fontWeight: "800" },
    ratingHint: { ...typography.micro, color: colors.textMuted },
    flipRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    flipButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 48,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.primarySoft,
    },
    flipButtonText: { ...typography.callout, fontWeight: "800", color: colors.primary },
    flipHint: { ...typography.micro, flex: 1, color: colors.textMuted },
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
    finishedScroll: { flex: 1 },
    finishedBox: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    finishedTitle: { ...typography.title2, color: colors.text },
    finishedText: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
    finishedPending: { ...typography.micro, color: colors.warning },
    subjectStatsList: {
      alignSelf: "stretch",
      gap: 6,
      marginTop: spacing.sm,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    subjectStatRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
    subjectStatTitle: { ...typography.caption, fontWeight: "700", color: colors.text },
    subjectStatMeta: { ...typography.micro, flex: 1, textAlign: "right", color: colors.textMuted },
    primaryButton: {
      minHeight: 48,
      marginTop: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      paddingHorizontal: spacing["2xl"],
      backgroundColor: colors.primary,
    },
    primaryButtonText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
  });
