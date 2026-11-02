/* eslint-disable react-hooks/immutability -- Reanimated SharedValue 的 JS 侧复位/驱动（同 components/pressable-scale.tsx） */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { getApiUrl } from "@/config";
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
  canSubmitRating,
  cardProgress,
  enqueueRating,
  fetchCardQueue,
  fetchCardStatsBoard,
  flipActionLabel,
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
  normalizeCardQueue,
  pendingRatingCount,
  progressLabel,
  ratingDirectionOf,
  ratingVisual,
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
  type Exam408QueueFetch,
} from "@/lib/exam-408-cards";

/**
 * 408 刷卡页（v1.55 / P11 重做）。
 *
 * 与 Web 共用同一套 /api/exam/408/cards 与 FSRS 状态：
 * - 需要登录（401 → 引导去「我的」登录）；
 * - 评级先本地推进 UI，服务端确认后用返回的 doneToday/remainingDue 校正统计；
 * - 断网时评级进离线发件箱（clientId 幂等），顶部显示「N 条待同步」，回前台先补发再拉队列。
 *
 * P11 翻面修复（用户反馈「显示答案后再点收不起来」）：
 * 1) 旧实现把点击交给外层 Gesture.Tap，而背面 ScrollView 把触摸吃掉，Tap 收不到 →
 *    改成**每个面都用 Pressable 包住 ScrollView**：卷动仍归 ScrollView，静止点击归 Pressable，
 *    正/背面都挂同一个 toggle，所以「点正面→背面→点背面→正面→再点」可无限来回；
 * 2) 旧的 flip 共享值与 flipped state 双源会不同步 → 现在 flipped 是唯一事实源，
 *    共享值只由 useEffect 跟随（单向数据流），手势/按钮都只改 state。
 *
 * worklet 纪律见 apps/mobile/CLAUDE.md：手势回调只碰共享值 + runOnJS；共享值声明在其之前。
 */

const FLIP_DURATION = 220;
/** 横向滑动翻面的阈值（距离 + 速度双判，与 question-swipe 同口径） */
const SWIPE_DISTANCE = 56;
const SWIPE_VELOCITY = 420;
const ACTIVATE_X = 18;
const FAIL_Y = 14;
/** 评级后卡片滑出的横向距离 */
const SLIDE_OUT = 460;

export default function Exam408DrillScreen() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const header = useLargeTitleHeader();
  const bottomSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const token = useAppStore((s) => s.token);
  /** 从知识点页「速记卡」入口带 subject 进来：只接受四个合法科目，其余按「全部」 */
  const params = useLocalSearchParams<{ subject?: string }>();

  const [subjectKey, setSubjectKey] = useState<string>(() => {
    const incoming = (params.subject ?? "").trim();
    return EXAM_408_CARD_SUBJECTS.some((subject) => subject.key === incoming) ? incoming : "";
  });
  const [queue, setQueue] = useState<Exam408CardQueue | null>(null);
  const [board, setBoard] = useState<Exam408CardStatsBoard>(EMPTY_CARD_STATS_BOARD);
  const [stats, setStats] = useState<Exam408CardStats>(EMPTY_CARD_STATS);
  const [index, setIndex] = useState(0);
  /** 唯一事实源：是否展开答案（动画共享值只跟随它，见下方 useEffect） */
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Exam408FetchFailure | null>(null);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const [notice, setNotice] = useState("");
  /** v1.55 易错本：scope=mistake 的独立队列（只读不写缓存，避免覆盖今日队列缓存） */
  const [scope, setScope] = useState<"queue" | "mistake">("queue");
  const [mistakeQueue, setMistakeQueue] = useState<Exam408CardQueue | null>(null);
  const [mistakeLoading, setMistakeLoading] = useState(false);
  const [mistakeFailure, setMistakeFailure] = useState<Exam408FetchFailure | null>(null);

  /* ---------------- 动画共享值（必须声明在 worklet 之前） ---------------- */
  const flip = useSharedValue(0);
  const panX = useSharedValue(0);
  /** 滑出进度：1=在屏内，0=完全滑出（位移与透明度都由它插值，省一个动画点） */
  const cardSlide = useSharedValue(1);
  /** 滑出方向（-1 左 / 0 原位 / 1 右），直接写值不产生动画点 */
  const cardDir = useSharedValue(1);

  // 单向数据流：state → 动画值。任何翻面入口都只改 state，避免双源不同步（P11 根因之一）
  useEffect(() => {
    flip.value = withTiming(flipped ? 1 : 0, { duration: FLIP_DURATION });
  }, [flipped, flip]);

  const toggleFlip = useCallback(() => {
    haptics.soft();
    setFlipped((prev) => !prev);
  }, []);

  /* ---------------- 手势：横向滑动翻面（点击交给各面的 Pressable） ---------------- */
  const panGesture = Gesture.Pan()
    .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
    .failOffsetY([-FAIL_Y, FAIL_Y])
    .onUpdate((event) => {
      panX.value = event.translationX * 0.35;
    })
    .onEnd((event) => {
      const far = Math.abs(event.translationX) > SWIPE_DISTANCE;
      const fast = Math.abs(event.velocityX) > SWIPE_VELOCITY;
      if (far || fast) runOnJS(toggleFlip)();
      panX.value = withTiming(0, { duration: 180 });
    });

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
  /** 评级后整张卡滑出（左滑/淡出/右滑），动画结束再切下一张 */
  const cardSlideStyle = useAnimatedStyle(() => ({
    opacity: cardSlide.value,
    transform: [
      { translateX: interpolate(cardSlide.value, [0, 1], [cardDir.value * SLIDE_OUT, 0]) },
    ],
  }));

  /* ---------------- 数据加载 ---------------- */
  /** 已全量加载过的「登录态|科目」签名；重复聚焦时不再重置游标 */
  const loadedSignature = useRef("");
  const reload = useCallback(
    async (targetSubject: string) => {
      // 未登录由渲染层直接拦（见下方 !token 分支），这里不 setState：
      // 该函数由 focus 回调触发，同步 setState 会被 react-hooks/set-state-in-effect 判错
      if (!token) return;
      // 先补发上一轮离线评级：拿到权威计数后再拉队列，避免「今日 done」来回跳。
      // 这行 await 同时保证 loading 态在首次 await 之后才翻转。
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
          // 清掉"已加载"标记：下次回到本页（或点了重试）再全量拉一次
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
      flip.value = 0;
      cardSlide.value = 1;
      cardDir.value = 1;
      setFlipped(false);
      setLoading(false);
    },
    [token, flip, cardSlide, cardDir],
  );

  /** 易错本队列：评过错的卡（lapses>0 或上次评级 again），不受 due 限制，可立即重刷。 */
  const loadMistakes = useCallback(
    async (targetSubject: string) => {
      if (!token) return;
      const flushed = await flushRatingOutbox();
      setPending(flushed.remaining);
      setMistakeLoading(true);
      setMistakeFailure(null);
      const result = await fetchMistakeQueue(targetSubject, 20);
      if (result.queue) {
        setMistakeQueue(result.queue);
        setMistakeFailure(null);
      } else {
        setMistakeQueue(null);
        setMistakeFailure(result.failure);
      }
      setIndex(0);
      flip.value = 0;
      cardSlide.value = 1;
      cardDir.value = 1;
      setFlipped(false);
      setMistakeLoading(false);
    },
    [token, flip, cardSlide, cardDir],
  );

  // 首次进入/切回易错本、切换科目/范围时拉一次
  useFocusEffect(
    useCallback(() => {
      if (scope !== "mistake" || !token) return;
      void loadMistakes(subjectKey);
    }, [scope, subjectKey, token, loadMistakes]),
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

  // 当前渲染的队列范围：今日队列（到期+新卡）或易错本（错题重刷）
  const activeQueue = scope === "mistake" ? mistakeQueue : queue;
  const activeFailure = scope === "mistake" ? mistakeFailure : failure;
  const activeLoading = scope === "mistake" ? mistakeLoading : loading;
  const cards = activeQueue?.cards ?? [];
  const card = index < cards.length ? cards[index] : null;
  const progress = cardProgress(index, cards.length);
  const finished = cards.length > 0 && index >= cards.length;

  const changeSubject = (key: string) => {
    if (key === subjectKey) return;
    haptics.light();
    setSubjectKey(key);
  };

  /* ---------------- 评级 ---------------- */
  /** 动画结束后切下一张；同时复位动画值（新卡从正面、屏幕内开始） */
  const finishCard = useCallback(() => {
    setIndex(nextCardIndex(index, cards.length));
    setFlipped(false);
    flip.value = 0;
    cardSlide.value = 1;
    cardDir.value = 1;
    setBusy(false);
  }, [index, cards.length, flip, cardSlide, cardDir]);

  const rate = async (rating: Exam408CardRating) => {
    if (!card || busy || !canSubmitRating(flipped)) return;
    setBusy(true);
    setNotice("");
    haptics.light();
    // 先收起答案，再滑出：新卡一定从题干面开始
    setFlipped(false);
    const direction = ratingDirectionOf(rating);
    cardDir.value = direction;
    cardSlide.value = withTiming(0, { duration: 220 }, (done) => {
      // 动画回调在 UI 线程：不复位共享值（否则旧卡会闪现一帧），只转发切卡；
      // 复位由 finishCard 在 JS 侧与新卡状态同一 tick 完成。
      if (done) runOnJS(finishCard)();
    });

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

    if (scope === "mistake") {
      // 易错本不写本机缓存：只在本次会话里摘掉刚评过的卡，服务端仍是权威
      setMistakeQueue((previous) =>
        previous ? removeCardFromQueue(previous, ratedCard.key) : previous,
      );
    } else {
      // 无论成功与否都从离线缓存里摘掉这张卡：断网重启后不该再看到刚评过的卡
      const cachedQueue = await loadCachedQueue(subjectKey);
      if (cachedQueue) {
        await saveCachedQueue(subjectKey, removeCardFromQueue(cachedQueue, ratedCard.key));
      }
    }
  };

  const retry = () => {
    if (scope === "mistake") void loadMistakes(subjectKey);
    else void reload(subjectKey);
  };

  /* ---------------- 渲染 ---------------- */
  const subjectTitle =
    EXAM_408_CARD_SUBJECTS.find((item) => item.key === subjectKey)?.title ?? "";
  const dueNow = stats.dueCount;

  // 未登录优先判：登录态变化时不需要先闪一帧 loading 再跳到登录引导
  if (!token || activeFailure === "unauthorized") {
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

  if (activeLoading) {
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
        {/* 顶部：进度条 + 第 x / N 张 + 今日已刷 */}
        {cards.length > 0 ? (
          <Animated.View entering={entrance(0)} style={styles.progressBlock}>
            <View style={styles.progressHead}>
              <Text style={styles.progressText}>{progressLabel(index, cards.length, finished)}</Text>
              <Text style={styles.progressMeta}>今日已刷 {stats.doneToday} 张</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: (progress.percent + "%") as DimensionValue }]}
              />
            </View>
            <Text style={styles.statsLine}>
              待复习 {dueNow} 张 · 今日正确率{" "}
              {board.today.done > 0 ? formatAccuracy(board.today.accuracy) : "—"} · 连续 {stats.streak} 天
              {offline ? " · 离线缓存中" : ""}
            </Text>
          </Animated.View>
        ) : null}

        {/* 队列范围：今日队列 / 易错本 */}
        <Animated.View entering={entrance(1)} style={styles.scopeRow}>
          <ScopeTab
            styles={styles}
            colors={colors}
            label="今日队列"
            meta={queue ? queue.cards.length + " 张 · 到期优先" : "到期优先"}
            active={scope === "queue"}
            onPress={() => {
              haptics.light();
              setScope("queue");
              setIndex(0);
              setFlipped(false);
            }}
          />
          <ScopeTab
            styles={styles}
            colors={colors}
            label="易错本"
            meta={
              scope === "mistake" && mistakeQueue
                ? mistakeQueue.cards.length + " 张 · 错题重刷"
                : "错题重刷"
            }
            active={scope === "mistake"}
            onPress={() => {
              haptics.light();
              setScope("mistake");
              setMistakeLoading(true);
              setIndex(0);
              setFlipped(false);
            }}
          />
        </Animated.View>

        {/* 科目选择（带各科待刷数，来自 mode=stats 的四行统计） */}
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

        {/* 主体：卡片 / 空态 / 完成态 */}
        {cards.length === 0 ? (
          <View style={styles.centerBox}>
            <EmptyState
              icon={activeFailure ? "cloud-offline-outline" : "checkmark-done"}
              title={
                activeFailure
                  ? "暂时拿不到队列"
                  : scope === "mistake"
                    ? "易错本还是空的"
                    : "今天没有待刷的卡"
              }
              hint={
                activeFailure === "offline"
                  ? "网络不可用，且本机还没有这个科目的缓存队列。"
                  : scope === "mistake"
                    ? subjectTitle
                      ? subjectTitle + " 还没有评过错的卡；刷题时选「忘记/模糊」后会进入易错本。"
                      : "还没有评过错的卡；刷题时选「忘记/模糊」后会进入易错本。"
                    : subjectTitle
                      ? subjectTitle + " 的到期卡已清空，换一科或稍后再来。"
                      : "全部科目的到期卡都清空了，明天再来。"
              }
              actionLabel={activeFailure ? "重试" : "刷新"}
              onAction={retry}
              pattern="none"
            />
          </View>
        ) : finished ? (
          <ScrollView style={styles.finishedScroll} contentContainerStyle={styles.finishedBox}>
            <ThemedIcon name="checkmark-done" size={34} color={colors.success} />
            <Text style={styles.finishedTitle}>
              {scope === "mistake" ? "这一轮错题刷完了" : "这一轮刷完了"}
            </Text>
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
              <Text style={styles.primaryButtonText}>
                {scope === "mistake" ? "重刷易错本" : "再刷一轮"}
              </Text>
            </PressableScale>
            {scope === "queue" ? (
              <PressableScale
                haptic
                onPress={() => {
                  haptics.light();
                  setScope("mistake");
                  setMistakeLoading(true);
                  setIndex(0);
                  setFlipped(false);
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>去易错本重刷错题</Text>
              </PressableScale>
            ) : null}
          </ScrollView>
        ) : card ? (
          <View style={styles.cardSlot}>
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.card, cardSlideStyle]}>
                {/* 正面：题干（整面可点 → 显示答案） */}
                <Animated.View
                  style={[styles.face, frontStyle]}
                  pointerEvents={flipped ? "none" : "auto"}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"显示答案：" + toPlainText(card.question)}
                    accessibilityHint="点按任意位置翻到答题要点；左右滑动也可以翻面"
                    onPress={toggleFlip}
                    style={styles.facePress}
                  >
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
                        <ThemedIcon name="eye-outline" size={15} color={colors.primary} />
                        <Text style={[styles.faceHint, styles.faceHintActive]}>
                          {flipActionLabel(flipped)}（点卡片或左右滑）
                        </Text>
                      </View>
                    </ScrollView>
                  </Pressable>
                </Animated.View>

                {/* 背面：答案（整面可点 → 隐藏答案；底部另有显式按钮，长内容可滚） */}
                <Animated.View
                  style={[styles.face, styles.faceBack, backStyle]}
                  pointerEvents={flipped ? "auto" : "none"}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="隐藏答案，回到题干"
                    accessibilityHint="点按任意位置收起答案；上下滚动查看长答案"
                    onPress={toggleFlip}
                    style={styles.facePress}
                  >
                    <ScrollView
                      style={styles.faceScroll}
                      contentContainerStyle={styles.faceContent}
                      showsVerticalScrollIndicator={false}
                    >
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
                            <Text style={styles.answerStepText}>{highlightEmphasis(step)}</Text>
                          </View>
                        ))
                      )}
                      {card.pitfall ? (
                        <View style={styles.pitfallBox}>
                          <View style={styles.answerSectionTitleRow}>
                            <ThemedIcon name="alert-circle" size={14} color={colors.danger} />
                            <Text style={styles.pitfallTitle}>易错点</Text>
                          </View>
                          <Text style={styles.pitfallText}>{card.pitfall}</Text>
                        </View>
                      ) : null}
                      {card.mnemonic ? (
                        <View style={styles.mnemonicBox}>
                          <View style={styles.answerSectionTitleRow}>
                            <ThemedIcon name="sparkles" size={14} color={colors.accentStrong} />
                            <Text style={styles.mnemonicTitle}>口诀</Text>
                          </View>
                          <Text style={styles.mnemonicText}>{card.mnemonic}</Text>
                        </View>
                      ) : null}
                      {card.demoKey ? (
                        <Text style={styles.demoHint}>关联演示：{card.demoKey}</Text>
                      ) : null}
                      <Text style={styles.faceHint}>轻点卡片任意处隐藏答案</Text>
                      <PressableScale
                        haptic
                        onPress={toggleFlip}
                        style={styles.hideButton}
                        accessibilityRole="button"
                        accessibilityLabel="隐藏答案"
                      >
                        <ThemedIcon name="eye-off-outline" size={16} color={colors.primary} />
                        <Text style={styles.hideButtonText}>隐藏答案</Text>
                      </PressableScale>
                    </ScrollView>
                  </Pressable>
                </Animated.View>
              </Animated.View>
            </GestureDetector>
          </View>
        ) : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {/* 操作区：未翻面 → 大按钮显示答案；已翻面 → 三档大评级按钮 + 隐藏答案 */}
        {card && !finished ? (
          flipped ? (
            <View style={styles.ratingBlock}>
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
                      disabled={busy}
                      onPress={() => void rate(rating)}
                      style={[
                        styles.ratingButton,
                        { backgroundColor: soft, borderColor: accent },
                        busy && styles.ratingButtonBusy,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={"评级 " + visual.label + "，" + visual.hint}
                    >
                      <ThemedIcon name={visual.icon as never} size={22} color={accent} />
                      <Text style={[styles.ratingLabel, { color: accent }]}>{visual.label}</Text>
                      <Text style={styles.ratingHint}>{visual.hint}</Text>
                    </PressableScale>
                  );
                })}
              </View>
              <PressableScale
                haptic
                onPress={toggleFlip}
                style={styles.hideLink}
                accessibilityRole="button"
                accessibilityLabel="隐藏答案，回到题干"
              >
                <ThemedIcon name="eye-off-outline" size={14} color={colors.textMuted} />
                <Text style={styles.hideLinkText}>隐藏答案，回到题干</Text>
              </PressableScale>
            </View>
          ) : (
            <PressableScale
              haptic
              onPress={toggleFlip}
              style={styles.showButton}
              accessibilityRole="button"
              accessibilityLabel="显示答案"
            >
              <ThemedIcon name="eye-outline" size={20} color="#FFFFFF" />
              <Text style={styles.showButtonText}>显示答案</Text>
            </PressableScale>
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

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

/** 无障碍朗读用的纯文本：去掉换行与多余空白，避免 TalkBack 逐行念。 */
function toPlainText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * 答案里的「重点」强调：把【…】段首标记与 **…** 包裹收成纯文本，
 * 这里只做去符号（RN Text 里不解析 Markdown），保留原意。
 */
function highlightEmphasis(text: string): string {
  return text.replace(/\*\*/g, "").trim();
}

/** v1.55 易错本入口标签（与科目 chip 同风格，但强调范围切换） */
function ScopeTab({
  styles,
  colors,
  label,
  meta,
  active,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  label: string;
  meta: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      haptic
      onPress={onPress}
      style={[styles.scopeTab, active && styles.scopeTabActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label + "，" + meta}
    >
      <Text style={[styles.scopeTabText, active && { color: colors.primary }]}>{label}</Text>
      <Text style={[styles.scopeTabMeta, active && { color: colors.primary }]} numberOfLines={1}>
        {meta}
      </Text>
    </PressableScale>
  );
}

/**
 * 易错本队列（scope=mistake）：服务端只返回"评过错"的卡（lapses>0 或上次评级 again），
 * 不按 due 过滤、卡片状态可能含 scheduled（评过但未到期，只在易错本里出现）。
 * 不走 lib 的 fetchCardQueue 是因为 App 侧该函数暂未接 scope；这里只复用其归一化与鉴权口径。
 */
async function fetchMistakeQueue(subjectKey: string, limit = 20): Promise<Exam408QueueFetch> {
  const token = useAppStore.getState().token;
  if (!token) return { queue: null, failure: "unauthorized" };
  const query = ["mode=queue", "scope=mistake"];
  if (subjectKey.trim()) query.push("subject=" + encodeURIComponent(subjectKey.trim()));
  if (limit > 0) query.push("limit=" + Math.min(50, Math.floor(limit)));
  try {
    const response = await fetch(
      getApiUrl().replace(/\/+$/, "") + "/api/exam/408/cards?" + query.join("&"),
      { headers: { Authorization: "Bearer " + token } },
    );
    if (response.status === 401) return { queue: null, failure: "unauthorized" };
    if (!response.ok) return { queue: null, failure: "server" };
    const queue = normalizeCardQueue(await response.json());
    return queue ? { queue, failure: null } : { queue: null, failure: "server" };
  } catch {
    return { queue: null, failure: "offline" };
  }
}

function subjectLabel(subjectKey: string): string {
  return EXAM_408_CARD_SUBJECTS.find((item) => item.key === subjectKey)?.title ?? subjectKey;
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
      accessibilityLabel={label + (due > 0 ? "，待复习 " + due + " 张" : "，无到期")}
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
      gap: spacing.sm,
    },
    centerBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    centerText: { ...typography.caption, color: colors.textMuted },

    /* 顶部进度 */
    progressBlock: { gap: 4 },
    progressHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    // 大字体下两侧文案允许收缩换行：不写死宽度，避免「第 20 / 20 张」被截断
    progressText: { ...typography.headline, color: colors.text, flexShrink: 1 },
    progressMeta: { ...typography.caption, color: colors.textMuted, flexShrink: 1, textAlign: "right" },
    progressTrack: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.primary },
    statsLine: { ...typography.micro, color: colors.textFaint },

    /* 范围 + 科目 */
    scopeRow: {
      flexDirection: "row",
      gap: 4,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
      padding: 4,
    },
    scopeTab: {
      flex: 1,
      alignItems: "center",
      gap: 1,
      borderRadius: radius.md,
      paddingVertical: 7,
    },
    scopeTabActive: { backgroundColor: colors.surfaceStrong, ...shadows.card },
    scopeTabText: { ...typography.callout, fontWeight: "700", color: colors.textMuted },
    scopeTabMeta: { ...typography.micro, color: colors.textFaint },
    subjectRow: { gap: spacing.sm, paddingRight: spacing.lg },
    subjectChip: {
      gap: 1,
      borderRadius: radius.md,
      paddingVertical: 7,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "transparent",
    },
    subjectChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    subjectChipText: { ...typography.caption, fontWeight: "800", color: colors.textSecondary },
    subjectChipDue: { ...typography.micro, color: colors.textMuted },

    /* 卡片 */
    cardSlot: { flex: 1, minHeight: 220 },
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
    facePress: { flex: 1 },
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
    faceHintRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: "auto" },
    faceHint: { ...typography.micro, color: colors.textFaint },
    faceHintActive: { color: colors.primary, fontWeight: "700" },

    /* 答案面 */
    answerHeadRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    faceTitle: { ...typography.headline, color: colors.text },
    answerCount: { ...typography.micro, color: colors.textMuted },
    answerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    answerIndex: {
      width: 22,
      height: 22,
      borderRadius: 11,
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
    answerStepText: { ...typography.body, flex: 1, color: colors.text },
    answerSectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    pitfallBox: {
      gap: 4,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.dangerSoft,
    },
    pitfallTitle: { ...typography.caption, fontWeight: "800", color: colors.danger },
    pitfallText: { ...typography.callout, color: colors.text },
    mnemonicBox: {
      gap: 4,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.accentSoft,
    },
    mnemonicTitle: { ...typography.caption, fontWeight: "800", color: colors.accentStrong },
    mnemonicText: { ...typography.callout, color: colors.text },
    demoHint: { ...typography.micro, color: colors.textFaint },
    hideButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 48,
      marginTop: 4,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      backgroundColor: colors.surfaceStrong,
    },
    hideButtonText: { ...typography.callout, fontWeight: "800", color: colors.primary },

    /* 操作区 */
    notice: { ...typography.micro, color: colors.warning },
    showButton: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      ...shadows.brand,
    },
    showButtonText: { ...typography.headline, fontWeight: "800", color: "#FFFFFF" },
    ratingBlock: { gap: 6 },
    ratingRow: { flexDirection: "row", gap: spacing.sm },
    ratingButton: {
      flex: 1,
      minHeight: 76,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
    },
    ratingButtonBusy: { opacity: 0.6 },
    ratingLabel: { ...typography.headline, fontWeight: "800" },
    ratingHint: { ...typography.micro, color: colors.textMuted },
    hideLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      minHeight: 44,
    },
    hideLinkText: { ...typography.caption, color: colors.textMuted },

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

    /* 完成态 */
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
    secondaryButton: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      paddingHorizontal: spacing["2xl"],
      backgroundColor: colors.primarySoft,
    },
    secondaryButtonText: { ...typography.callout, fontWeight: "800", color: colors.primary },
  });
