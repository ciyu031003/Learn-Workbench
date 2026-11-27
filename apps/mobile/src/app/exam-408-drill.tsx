/* eslint-disable react-hooks/immutability -- Reanimated SharedValue 的 JS 侧复位/驱动（同 components/pressable-scale.tsx） */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useBlurTarget } from "@/components/blur-target";
import { EmptyState } from "@/components/empty-state";
import { PressableScale } from "@/components/pressable-scale";
import { RichText } from "@/components/rich-text";
import { ScreenHeaderStickyBar } from "@/components/screen-header";
import { ThemedIcon } from "@/components/themed-icon";
import { getApiUrl } from "@/config";
import {
  DAILY_CARD_PLAN,
  drillBucketKey,
  filterUnseen,
  localDateKey,
  pickRoundOrder,
  resolveDrillResumeIndex,
  roundOrderPosition,
} from "@/lib/drill-progress-core";
import { clearDrillPointer, loadDrillPointer, saveDrillPointer } from "@/lib/drill-position";
import { loadRoundPlan, saveRoundPlan } from "@/lib/drill-round";
import { StudyTimerChip } from "@/components/study-timer-chip";
import { CelebrationModal } from "@/components/celebration-modal";
import { useCelebration } from "@/lib/use-celebration";
import { loadSeen, markSeen, resetSeen } from "@/lib/drill-progress";
import { useStudyTimer } from "@/lib/use-study-timer";
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
  resolveDrillLayout,
  saveCachedQueue,
  saveCachedStatsBoard,
  saveRatingOutbox,
  subjectChipDisplay,
  submitCardRating,
  type Exam408CardRating,
  type Exam408CardStats,
  type Exam408CardStatsBoard,
  type Exam408CardQueue,
  type Exam408DrillCard,
  type Exam408FetchFailure,
  type Exam408QueueFetch,
} from "@/lib/exam-408-cards";

/**
 * 408 刷卡页（v2.6.12 交互与续播重构）。
 *
 * 交互口径：
 * - 轻点卡片任意位置 = 题干 ↔ 答案；左右滑动 = 上一张 / 下一张；
 * - 翻到答案才写「已看」，滑动本身只移动游标；
 * - 退出 / 切页 / 换科目 / 切易错本后再进来，按持久化指针恢复上次位置，
 *   并静默刷新服务端队列（服务端插卡、删卡、当天已评级都不影响落点）。
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
/** 左右滑切换卡片的阈值（距离 + 速度双判，与 question-swipe 同口径） */
const SWIPE_DISTANCE = 56;
const SWIPE_VELOCITY = 420;
const ACTIVATE_X = 18;
const FAIL_Y = 14;
/** 评级后卡片滑出的横向距离 */
const SLIDE_OUT = 460;
/** 左右滑切换卡片时：旧卡滑出距离 / 新卡滑入的起始偏移 */
const SWITCH_OUT = 320;

export default function Exam408DrillScreen() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const blurTarget = useBlurTarget();
  const bottomSpace = useTabBarSpace();
  const entrance = useScreenEntrance();
  const token = useAppStore((s) => s.token);
  /** 从知识点页「速记卡」入口带 subject 进来：只接受四个合法科目，其余按「全部」 */
  const params = useLocalSearchParams<{ subject?: string }>();
  /**
   * P13 布局：卡片要占屏幕主体，所以先用纯函数定档位（紧凑/常规）。
   * 用 screen 高度而不是 window：键盘弹起时 window 会变矮，档位不该跟着抖（与 BottomSheet 同口径）。
   */
  const insets = useSafeAreaInsets();
  const usableScreen = Math.max(
    240,
    Dimensions.get("screen").height - insets.top - insets.bottom,
  );
  const layout = useMemo(() => resolveDrillLayout(usableScreen), [usableScreen]);

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
  /** 左右滑到头时的轻提示：1.8s 自动消失，不占常驻版面 */
  const [navHint, setNavHint] = useState("");
  useEffect(() => {
    if (!navHint) return;
    const timer = setTimeout(() => setNavHint(""), 1800);
    return () => clearTimeout(timer);
  }, [navHint]);
  /** 轻提示入口：不碰 ref，可安全地交给 runOnJS */
  const showNavHint = useCallback((message: string) => setNavHint(message), []);
  /** 今日计划已全部看完（队列里的卡都被过滤掉） */
  const [dailyCleared, setDailyCleared] = useState(false);
  /** 本轮总张数：服务端当天已清空时用当天快照兜底，空态文案不再写死 20 */
  const [clearedTotal, setClearedTotal] = useState(0);
  /**
   * 整轮顺序（含已看卡）：服务端当天只返回剩余 10 张时，仍按当天 20 张的顺序显示
   * 「第 11 / 20 张」，而不是重新从「第 1 / 10 张」开始。今日队列与易错本各存一份，
   * 来回切换范围时互不覆盖。
   */
  const [queueOrder, setQueueOrder] = useState<Exam408DrillCard[]>([]);
  const [mistakeOrder, setMistakeOrder] = useState<Exam408DrillCard[]>([]);
  /** 本会话已经刷完：切到易错本再切回来时保持完成态，不闪回第 1 张 */
  const queueCompleted = useRef(false);
  const mistakeCompleted = useRef(false);
  /** rate 的 220ms 滑出动画结束后用它确认用户没有切换范围 */
  const scopeRef = useRef<"queue" | "mistake">("queue");
  /** v2.6.11：每日 20 张完成庆祝（同一天同一科目只弹一次） */
  const { request: celebrationRequest, celebrateOnce, close: closeCelebration } = useCelebration();
  /**
   * 本会话内的续播位置（按 scope|subject 分桶）。
   * 持久化在 lib/drill-position.ts；内存这份用来在切换范围/科目时立刻恢复，
   * 不必等 AsyncStorage 往返。
   */
  const positionMemory = useRef<Record<string, { date: string; cardKey: string; index: number }>>({});
  /** v1.55 易错本：scope=mistake 的独立队列（只读不写缓存，避免覆盖今日队列缓存） */
  const [scope, setScope] = useState<"queue" | "mistake">("queue");
  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);
  const [mistakeQueue, setMistakeQueue] = useState<Exam408CardQueue | null>(null);
  const [mistakeLoading, setMistakeLoading] = useState(false);
  const [mistakeFailure, setMistakeFailure] = useState<Exam408FetchFailure | null>(null);
  /** 学习计时：刷卡停留时长计入今日专注（v2.6.10） */
  const { seconds } = useStudyTimer(subjectKey ? subjectLabel(subjectKey) + " · 408 刷卡" : "408 刷卡");

  // 当前渲染的队列范围：今日队列（到期+新卡）或易错本（错题重刷）
  const activeQueue = scope === "mistake" ? mistakeQueue : queue;
  const activeFailure = scope === "mistake" ? mistakeFailure : failure;
  const activeLoading = scope === "mistake" ? mistakeLoading : loading;
  const cards = activeQueue?.cards ?? [];
  const card = index < cards.length ? cards[index] : null;
  const finished = cards.length > 0 && index >= cards.length;
  const activeOrder = scope === "mistake" ? mistakeOrder : queueOrder;
  const progressTotal = Math.max(activeOrder.length, cards.length);
  const progressIndex = finished
    ? progressTotal
    : roundOrderPosition(activeOrder, card?.key ?? "", index);
  const progress = cardProgress(progressIndex, progressTotal);

  /* ---------------- 动画共享值（必须声明在 worklet 之前） ---------------- */
  const flip = useSharedValue(0);
  const panX = useSharedValue(0);
  /** 换卡遮罩：只在「旧卡已滑出」到「新卡落位」之间为 1，避免新旧文字交叉 */
  const swapBlur = useSharedValue(0);
  /** 滑出进度：1=在屏内，0=完全滑出（位移与透明度都由它插值，省一个动画点） */
  const cardSlide = useSharedValue(1);
  /** 滑出方向（-1 左 / 0 原位 / 1 右），直接写值不产生动画点 */
  const cardDir = useSharedValue(1);
  /** 正在滑出、等待落位的目标下标；-1 = 没有挂起切换（防连滑吞卡） */
  const pendingSwitch = useSharedValue(-1);

  // 单向数据流：state → 动画值。任何翻面入口都只改 state，避免双源不同步（P11 根因之一）
  useEffect(() => {
    flip.value = withTiming(flipped ? 1 : 0, { duration: FLIP_DURATION });
  }, [flipped, flip]);

  const toggleFlip = useCallback(() => {
    if (busy) return;
    haptics.soft();
    setFlipped((prev) => !prev);
  }, [busy]);

  /** 模糊退场：新卡已经在遮罩下渲染完成，这时才慢慢显影 */
  const fadeSwapBlur = useCallback(() => {
    // 先保持整卡模糊 70ms：等 React 把新卡 index 提交到原生层，再从模糊里显影。
    // 若和 setIndex 同一帧立刻降透明度，Android 磨砂回退层会透出下一张的文字，形成闪字。
    swapBlur.value = withDelay(70, withTiming(0, { duration: 200 }));
  }, [swapBlur]);

  /* ---------------- 手势：轻点翻面 / 左右滑切换卡片 ---------------- */
  /**
   * 交互口径（v2.6.12 用户确认）：
   * - 轻点卡片：题干 ↔ 答案（翻面）；
   * - 左滑：下一张；右滑：上一张；
   * - 滑动只移动游标，不写「已看」（只有翻到答案面才算看过）；
   * - 第一张右滑、最后一张左滑：回弹 + 轻提示，不误判为完成。
   */
  /**
   * 真正换卡只改 React 状态（不碰共享值），这样手势 worklet 里 runOnJS 的
   * 目标函数不访问 ref；卡片滑出/滑入动画全部留在 UI 线程完成。
   */
  const switchCard = useCallback((target: number) => {
    haptics.light();
    setIndex(target);
    setFlipped(false);
  }, []);

  const panGesture = Gesture.Pan()
    .enabled(!busy)
    .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
    .failOffsetY([-FAIL_Y, FAIL_Y])
    .onBegin(() => {
      // 上一笔滑出的落位回调被新手势打断时先补提交，避免快速连滑吞卡
      if (pendingSwitch.value >= 0) {
        const pending = pendingSwitch.value;
        pendingSwitch.value = -1;
        panX.value = 0;
        flip.value = 0;
        runOnJS(switchCard)(pending);
      }
    })
    .onUpdate((event) => {
      // 卡片跟手；横向位移同时驱动轻微倾斜，形成「翻卡牌」的手感
      panX.value = event.translationX;
    })
    .onEnd((event) => {
      const far = Math.abs(event.translationX) > SWIPE_DISTANCE;
      const fast = Math.abs(event.velocityX) > SWIPE_VELOCITY;
      // 速度参与判定：快速轻扫即使位移不大也切卡
      const projected = event.translationX + event.velocityX * 0.08;
      const swiped = (far || fast) && Math.abs(projected) > SWIPE_DISTANCE * 0.6;
      const delta = projected < 0 ? 1 : -1;
      const target = index + delta;
      if (!swiped || target < 0 || target >= cards.length) {
        // 未过阈值 / 第一张右滑 / 最后一张左滑：橡皮筋回弹
        panX.value = withTiming(0, { duration: 180 });
        if (swiped) {
          runOnJS(showNavHint)(target < 0 ? "已经是第一张了" : "已经是最后一张了");
        }
        return;
      }
      pendingSwitch.value = target;
      panX.value = withTiming(-delta * SWITCH_OUT, { duration: 170 }, (done) => {
        if (!done) return;
        pendingSwitch.value = -1;
        // 旧卡已经滑出画面：此刻把模糊拉满，卡片直接回正中；
        // 换字发生在完全不可辨认的一帧，新卡再从模糊里显影，不会闪。
        swapBlur.value = 1;
        panX.value = 0;
        flip.value = 0;
        runOnJS(switchCard)(target);
        runOnJS(fadeSwapBlur)();
      });
    });

  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [
      { perspective: 1100 },
      { scale: interpolate(Math.abs(panX.value), [0, SWITCH_OUT], [1, 0.97], "clamp") },
      { translateX: panX.value },
      { rotateZ: interpolate(panX.value, [-SWITCH_OUT, 0, SWITCH_OUT], [-7, 0, 7], "clamp") + "deg" },
      { rotateY: interpolate(flip.value, [0, 1], [0, 180]) + "deg" },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 0 : 1,
    transform: [
      { perspective: 1100 },
      { scale: interpolate(Math.abs(panX.value), [0, SWITCH_OUT], [1, 0.97], "clamp") },
      { translateX: panX.value },
      { rotateZ: interpolate(panX.value, [-SWITCH_OUT, 0, SWITCH_OUT], [-7, 0, 7], "clamp") + "deg" },
      { rotateY: interpolate(flip.value, [0, 1], [180, 360]) + "deg" },
    ],
  }));
  // 换卡遮罩只跟 swapBlur 走；拖动本身不产生模糊，避免手势过程中整卡忽明忽暗。
  const blurStyle = useAnimatedStyle(() => ({ opacity: swapBlur.value }));
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
  /**
   * 加载代次：换科目 / 切易错本 / 连续重试时只让最后一次请求改 UI。
   * 否则慢请求晚到会把 index 和队列覆盖成上一个科目的，用户会看到「跳卡」。
   */
  const loadSeq = useRef(0);
  const reload = useCallback(
    async (targetSubject: string, options?: { silent?: boolean }) => {
      // 未登录由渲染层直接拦（见下方 !token 分支），这里不 setState：
      // 该函数由 focus 回调触发，同步 setState 会被 react-hooks/set-state-in-effect 判错
      if (!token) return;
      const seq = ++loadSeq.current;
      // 先补发上一轮离线评级：拿到权威计数后再拉队列，避免「今日 done」来回跳。
      // 这行 await 同时保证 loading 态在首次 await 之后才翻转。
      const flushed = await flushRatingOutbox();
      if (seq !== loadSeq.current) return;
      setPending(flushed.remaining);
      if (!options?.silent) setLoading(true);
      setNotice("");

      const [queueResult, boardResult] = await Promise.all([
        fetchCardQueue(targetSubject, DAILY_CARD_PLAN),
        fetchCardStatsBoard(targetSubject),
      ]);
      if (seq !== loadSeq.current) return;

      const todayKey = localDateKey();
      /** 本次加载后要停在哪张：优先内存指针 → 持久化指针 → 第一张 */
      let resumeIndex = 0;
      const applyResume = async (cards: { key: string }[], fullOrder: { key: string }[]) => {
        const pointer =
          positionMemory.current[drillBucketKey(targetSubject, "queue")] ??
          (await loadDrillPointer(targetSubject, "queue", todayKey));
        return resolveDrillResumeIndex(cards, pointer, todayKey, fullOrder);
      };
      if (queueResult.queue) {
        const seen = await loadSeen(targetSubject, todayKey);
        const remaining = filterUnseen(queueResult.queue.cards, seen);
        // 整轮快照（通常 20 张）用于恢复「第 11 / 20 张」的服务端口径；
        // 优先用更长的快照，服务端新插的卡由 pickRoundOrder 接在后面。
        const todayPlan = await loadRoundPlan(targetSubject, todayKey, "queue");
        const roundOrder = pickRoundOrder(queueResult.queue.cards, todayPlan?.cards);
        resumeIndex = await applyResume(remaining, roundOrder);
        if (seq !== loadSeq.current) return;
        // 服务端当天已把评过级的卡移出队列时，用快照与服务端 doneToday 共同兜底；
        // 重装 App 没有本地快照时，也不会把「今天已完成 10 张」误判成「今天没有卡」。
        const todayTotal = Math.max(
          queueResult.queue.cards.length,
          todayPlan?.cards.length ?? 0,
          queueResult.queue.stats.doneToday,
        );
        setQueueOrder(roundOrder);
        setClearedTotal(todayTotal);
        setQueue({ ...queueResult.queue, cards: remaining });
        setDailyCleared(remaining.length === 0 && todayTotal > 0);
        queueCompleted.current = remaining.length === 0 && todayTotal > 0;
        setStats(mergeCardStatsWithPending(queueResult.queue.stats, flushed.remaining));
        setOffline(false);
        setFailure(null);
        await saveCachedQueue(targetSubject, queueResult.queue);
        // 当天第一次拿到队列时留一份「整轮快照」，供「再刷一轮」真正重来
        await saveRoundPlan(targetSubject, todayKey, queueResult.queue);
      } else {
        // 服务端不可用（离线/5xx）：回落缓存队列，绝不能用空列表覆盖
        const cached = await loadCachedQueue(targetSubject);
        if (seq !== loadSeq.current) return;
        setFailure(queueResult.failure);
        setOffline(queueResult.failure === "offline");
        if (cached) {
          const seen = await loadSeen(targetSubject, todayKey);
          const remaining = filterUnseen(cached.cards, seen);
          const todayPlan = await loadRoundPlan(targetSubject, todayKey, "queue");
          const roundOrder = pickRoundOrder(cached.cards, todayPlan?.cards);
          resumeIndex = await applyResume(remaining, roundOrder);
          if (seq !== loadSeq.current) return;
          const todayTotal = Math.max(
            cached.cards.length,
            todayPlan?.cards.length ?? 0,
            cached.stats.doneToday,
          );
          setQueueOrder(roundOrder);
          setClearedTotal(todayTotal);
          setQueue({ ...cached, cards: remaining });
          setDailyCleared(remaining.length === 0 && todayTotal > 0);
          queueCompleted.current = remaining.length === 0 && todayTotal > 0;
          setStats(mergeCardStatsWithPending(cached.stats, flushed.remaining));
          await saveRoundPlan(targetSubject, todayKey, cached);
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

      if (seq !== loadSeq.current) return;
      setIndex(resumeIndex);
      flip.value = 0;
      cardSlide.value = 1;
      cardDir.value = 1;
      setFlipped(false);
      if (!options?.silent) setLoading(false);
    },
    [token, flip, cardSlide, cardDir],
  );

  /** 易错本队列：评过错的卡（lapses>0 或上次评级 again），不受 due 限制，可立即重刷。 */
  const loadMistakes = useCallback(
    async (targetSubject: string) => {
      if (!token) return;
      const seq = ++loadSeq.current;
      const flushed = await flushRatingOutbox();
      if (seq !== loadSeq.current) return;
      setPending(flushed.remaining);
      setMistakeLoading(true);
      setMistakeFailure(null);
      const result = await fetchMistakeQueue(targetSubject, DAILY_CARD_PLAN);
      if (seq !== loadSeq.current) return;
      let resumeIndex = 0;
      if (result.queue) {
        const todayKey = localDateKey();
        const pointer =
          positionMemory.current[drillBucketKey(targetSubject, "mistake")] ??
          (await loadDrillPointer(targetSubject, "mistake", todayKey));
        if (seq !== loadSeq.current) return;
        const todayPlan = await loadRoundPlan(targetSubject, todayKey, "mistake");
        const roundOrder = pickRoundOrder(result.queue.cards, todayPlan?.cards);
        resumeIndex = resolveDrillResumeIndex(result.queue.cards, pointer, todayKey, roundOrder);
        setMistakeOrder(roundOrder);
        setMistakeQueue(result.queue);
        setMistakeFailure(null);
        if (result.queue.cards.length > 0) mistakeCompleted.current = false;
        // 易错本也留一份整轮快照，供「重刷易错本」使用（服务端重算后可能不再返回同一批）
        await saveRoundPlan(targetSubject, todayKey, result.queue, "mistake");
      } else {
        setMistakeQueue(null);
        setMistakeFailure(result.failure);
      }
      if (seq !== loadSeq.current) return;
      setIndex(resumeIndex);
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
      // 易错本有自己的队列与续播指针，由上面的 loadMistakes 负责；
      // 这里再跑 rebase 会把 index 改成今日队列的位置，造成两个范围互相跳。
      if (scope === "mistake") return;
      const signature = (token ?? "") + "|" + subjectKey;
      const fresh = loadedSignature.current !== signature;
      loadedSignature.current = signature;
      /**
       * 进页 / 换科目：完整加载（显示 loading）。
       * 只是从别的页面回来：静默刷新队列与统计，再按续播指针停回原来那张 ——
       * 既拿到服务端最新卡片，又不会回到第 1 张。静默模式不闪 loading 屏。
       */
      void reload(subjectKey, { silent: !fresh });
    }, [reload, subjectKey, token, scope]),
  );

  /**
   * 回前台刷新（v2.6.12）：用户锁屏/切到别的 App 很久后再回来，页面仍然 focus，
   * useFocusEffect 不会重跑。这里在 AppState 变 active 时静默刷新服务端队列：
   * 先补发离线评级（reload 内部），再按续播指针停回上次那张；跨天时 pointer 的
   * date 不匹配会自动回到新一轮第一张。
   */
  const drillFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      drillFocused.current = true;
      return () => {
        drillFocused.current = false;
      };
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" || !drillFocused.current || busy) return;
      if (scope === "mistake") void loadMistakes(subjectKey);
      else void reload(subjectKey, { silent: true });
    });
    return () => subscription.remove();
  }, [busy, loadMistakes, reload, scope, subjectKey]);

  /**
   * 每日 20 张计划完成 → 全屏庆祝。
   * 口径用「今日已完成张数」而不是本轮队列长度：中途退出再进时队列可能只剩 10 张，
   * 但累计到 20 张同样算完成计划。去重按 科目 + 当天，只弹一次。
   */
  useEffect(() => {
    if (scope !== "queue") return;
    if (stats.doneToday < DAILY_CARD_PLAN) return;
    void celebrateOnce("drill-daily-20", subjectKey || "all");
  }, [scope, stats.doneToday, subjectKey, celebrateOnce]);

  /**
   * 记住「停在哪一张」：卡片 / 序号一变就写内存 + 持久化。
   * 加载中不写，避免换科目 / 换范围时把旧卡错记到新桶里；
   * 卡片所属科目与当前筛选不一致时也不写，避免 reload 窗口期串桶。
   */
  const pointerKey = card?.key ?? "";
  const pointerSubject = card?.subjectKey ?? "";
  useEffect(() => {
    if (!pointerKey || activeLoading) return;
    if (subjectKey && pointerSubject && pointerSubject !== subjectKey) return;
    const todayKey = localDateKey();
    const bucket = drillBucketKey(subjectKey, scope);
    positionMemory.current[bucket] = { date: todayKey, cardKey: pointerKey, index };
    void saveDrillPointer(subjectKey, scope, todayKey, pointerKey, index);
  }, [pointerKey, pointerSubject, index, subjectKey, scope, activeLoading]);

  /**
   * 翻到答案面即算「已看」：下次进入自动从下一张继续（跨天重置）。
   * v2.6.10 修正：此前在「卡片成为当前卡」时就标记，只看到题干也算看完；
   * 现在严格按产品口径，只有 flipped=true 才写入进度。
   */
  useEffect(() => {
    if (scope !== "queue" || !flipped) return;
    const key = card?.key;
    if (!key) return;
    void markSeen(subjectKey, localDateKey(), key);
  }, [card?.key, flipped, scope, subjectKey]);

  const changeSubject = (key: string) => {
    if (key === subjectKey) return;
    haptics.light();
    // 同步进入 loading，避免「科目 chip 已换、下面还留着上一个科目的卡」的闪帧；
    // loadSeq 会保证快速连点时只有最后一次请求落盘。
    if (scope === "mistake") setMistakeLoading(true);
    else setLoading(true);
    setIndex(0);
    setFlipped(false);
    flip.value = 0;
    cardSlide.value = 1;
    cardDir.value = 1;
    setSubjectKey(key);
  };

  /* ---------------- 评级 ---------------- */
  /**
   * 评级动画结束后的收尾：游标推进到下一张并复位动画。
   *
   * v2.6.12 起今日队列 / 易错本都**不在这里删卡**：本轮卡片保持原长度，
   * 进度始终是「第 i / N 张」，不会边评边缩短；服务端刷新时自然不再返回已评卡，
   * 重刷则走当天的整轮快照。
   */
  const finishRatedCard = useCallback(
    (targetIndex: number, total: number, ratedScope: "queue" | "mistake") => {
      // 用户评级后 220ms 内切到另一个范围：不要把新范围的游标改成旧队列的终点
      if (scopeRef.current !== ratedScope) {
        setBusy(false);
        return;
      }
      if (targetIndex >= total) {
        if (ratedScope === "queue") queueCompleted.current = true;
        else mistakeCompleted.current = true;
      }
      setIndex(targetIndex);
      setFlipped(false);
      flip.value = 0;
      cardSlide.value = 1;
      cardDir.value = 1;
      fadeSwapBlur();
      setBusy(false);
    },
    [flip, cardSlide, cardDir, fadeSwapBlur],
  );

  const rate = async (rating: Exam408CardRating) => {
    if (!card || busy || !canSubmitRating(flipped)) return;
    setBusy(true);
    setNotice("");
    haptics.light();
    const ratedCard = card;
    // 先收起答案，再滑出：新卡一定从题干面开始
    setFlipped(false);
    const direction = ratingDirectionOf(rating);
    const targetIndex = nextCardIndex(index, cards.length);
    /**
     * 提前把续播指针推到下一张：评级滑出动画有 220ms，用户可能在动画结束前就退出。
     * 若指针仍停在「刚评过的卡」上，重进时服务端已删掉它，单靠旧 index 可能跳过
     * 中间多张卡。这里在评级一开始就写入下一张，退出/杀进程都不会丢位置。
     */
    const todayKey = localDateKey();
    const nextCard = targetIndex < cards.length ? cards[targetIndex] : null;
    const bucket = drillBucketKey(subjectKey, scope);
    if (nextCard) {
      positionMemory.current[bucket] = { date: todayKey, cardKey: nextCard.key, index: targetIndex };
      void saveDrillPointer(subjectKey, scope, todayKey, nextCard.key, targetIndex);
    } else {
      delete positionMemory.current[bucket];
      void clearDrillPointer(subjectKey, scope);
    }
    cardDir.value = direction;
    cardSlide.value = withTiming(0, { duration: 220 }, (done) => {
      // 卡片已完整滑出：先拉满模糊，再让 JS 换 index；新卡落位后再显影
      if (done) {
        swapBlur.value = 1;
        runOnJS(finishRatedCard)(targetIndex, cards.length, scope);
      }
    });

    const clientId = makeClientId();
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

    if (scope !== "mistake") {
      // 无论成功与否都从离线缓存里摘掉这张卡：断网重启后不该再看到刚评过的卡
      // （易错本没有缓存队列，刷新时以服务端为准）
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

  /**
   * 真正「再刷一轮」：
   * - 今日队列：清已看 + 清续播指针，用当天原始整轮快照从第 1 张重来；
   * - 易错本：清续播指针，用本轮快照从第 1 张重来。
   *
   * 不能用 reload 代替：评级过的卡服务端当天往往不再返回，重新拉会拿到空队列，
   * 表现就是「点了再刷一轮却没卡」。
   */
  const restartRound = async () => {
    haptics.light();
    const todayKey = localDateKey();
    delete positionMemory.current[drillBucketKey(subjectKey, scope)];
    await clearDrillPointer(subjectKey, scope);
    if (scope === "mistake") {
      const plan = await loadRoundPlan(subjectKey, todayKey, "mistake");
      if (!plan) {
        await loadMistakes(subjectKey);
        return;
      }
      setMistakeQueue({ ...plan, cards: plan.cards });
      setMistakeOrder(plan.cards);
      setMistakeFailure(null);
      mistakeCompleted.current = false;
    } else {
      const plan = await loadRoundPlan(subjectKey, todayKey, "queue");
      await resetSeen(subjectKey, todayKey);
      if (!plan) {
        await reload(subjectKey);
        return;
      }
      setDailyCleared(false);
      setQueue({ ...plan, cards: plan.cards });
      setQueueOrder(plan.cards);
      setClearedTotal(plan.cards.length);
      queueCompleted.current = false;
    }
    setIndex(0);
    setFlipped(false);
    setNotice("");
    flip.value = 0;
    cardSlide.value = 1;
    cardDir.value = 1;
  };

  /* ---------------- 渲染 ---------------- */
  const subjectTitle =
    EXAM_408_CARD_SUBJECTS.find((item) => item.key === subjectKey)?.title ?? "";
  const dueNow = stats.dueCount;
  // 空数据态不显示裸 0：用「还没开始 / 暂无 / 从今天起步」替代
  const todayLine = stats.doneToday > 0 ? "今日已刷 " + stats.doneToday + " 张" : "今天还没开始";
  const dueLine = dueNow > 0 ? "待复习 " + dueNow + " 张" : "暂无待复习";
  const streakLine = stats.streak > 0 ? "连续 " + stats.streak + " 天" : "从今天起步";
  // 范围切换里的数量写「共 N 张」而不是「剩 N 张」：本轮评级后卡片保留在会话里，
  // 用 index 算剩余数会在切范围时失真；完成态则明确写「本轮已完成」。
  const queueMeta = queue
    ? (scope === "queue" && finished) || dailyCleared
      ? "本轮已完成"
      : queue.cards.length > 0
        ? "共 " + queue.cards.length + " 张"
        : "已清空"
    : "到期优先";
  const mistakeMeta =
    scope === "mistake" && mistakeQueue
      ? finished
        ? "本轮已完成"
        : mistakeQueue.cards.length > 0
          ? "共 " + mistakeQueue.cards.length + " 张"
          : "已清空"
      : "错题重刷";

  // 未登录优先判：登录态变化时不需要先闪一帧 loading 再跳到登录引导
  if (!token || activeFailure === "unauthorized") {
    return (
      <View style={styles.root}>
        {/* 本页内容区没有大标题：吸顶栏标题必须常显，不能跟随滚动淡出 */}
        <ScreenHeaderStickyBar title="408 刷卡" backTo="/exam-408" />
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
        <ScreenHeaderStickyBar title="408 刷卡" backTo="/exam-408" />
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.centerText}>正在准备刷卡队列…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="408 刷卡" backTo="/exam-408" />

      <View
        style={[
          styles.content,
          { paddingBottom: Math.max(12, bottomSpace) + spacing.md, gap: layout.gap },
        ]}
      >
        {/* 顶部（P13 压缩）：一行进度文案 + 4pt 进度条；完成态不再占高度，给居中留空间 */}
        {cards.length > 0 && !finished ? (
          <Animated.View entering={entrance(0)} style={styles.progressBlock}>
            <View style={styles.progressHead}>
              <Text style={styles.progressText} numberOfLines={1}>
                {progressLabel(progressIndex, progressTotal, finished)}
              </Text>
              <Text style={styles.progressMeta} numberOfLines={1}>
                {todayLine}
                {offline ? " · 离线" : ""}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: (progress.percent + "%") as DimensionValue }]}
              />
            </View>
            {layout.showStatsLine ? (
              <Text style={styles.statsLine} numberOfLines={1}>
                {dueLine} · 今日正确率{" "}
                {board.today.done > 0 ? formatAccuracy(board.today.accuracy) : "—"} · {streakLine}
              </Text>
            ) : null}
            <StudyTimerChip seconds={seconds} style={styles.timerChip} />
          </Animated.View>
        ) : null}

        {/* 队列范围：今日队列 / 易错本 */}
        <Animated.View entering={entrance(1)} style={styles.scopeRow}>
          <ScopeTab
            styles={styles}
            colors={colors}
            label="今日队列"
            meta={queueMeta}
            active={scope === "queue"}
            onPress={() => {
              haptics.light();
              // 切回今日队列：恢复上次停下的那张（内存指针优先，避免回到第 1 张）
              const memory = positionMemory.current[drillBucketKey(subjectKey, "queue")];
              const cardsNow = queue?.cards ?? [];
              scopeRef.current = "queue";
              setScope("queue");
              setFlipped(false);
              // 本轮已刷完时保持完成态；否则按内存指针恢复上次位置
              setIndex(
                queueCompleted.current
                  ? cardsNow.length
                  : memory
                    ? resolveDrillResumeIndex(cardsNow, memory, localDateKey(), cardsNow)
                    : 0,
              );
            }}
          />
          <ScopeTab
            styles={styles}
            colors={colors}
            label="易错本"
            meta={mistakeMeta}
            active={scope === "mistake"}
            onPress={() => {
              haptics.light();
              scopeRef.current = "mistake";
              setScope("mistake");
              setMistakeLoading(true);
              setFlipped(false);
              if (mistakeCompleted.current && mistakeQueue) setIndex(mistakeQueue.cards.length);
              // index 交给 loadMistakes：它会按易错本自己的指针恢复
            }}
          />
        </Animated.View>

        {/* 科目选择（带各科待刷数，来自 mode=stats 的四行统计） */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.subjectScroll}
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
                    : dailyCleared
                      ? clearedTotal > 0
                        ? "今日 " + clearedTotal + " 张已完成"
                        : "今日计划已完成"
                      : "今天没有待刷的卡"
              }
              hint={
                activeFailure === "offline"
                  ? "网络不可用，且本机还没有这个科目的缓存队列。"
                  : scope === "mistake"
                    ? subjectTitle
                      ? subjectTitle + " 还没有评过错的卡；刷题时选「忘记/模糊」后会进入易错本。"
                      : "还没有评过错的卡；刷题时选「忘记/模糊」后会进入易错本。"
                    : dailyCleared
                      ? "已看过 " + (clearedTotal > 0 ? clearedTotal : DAILY_CARD_PLAN) + " 张。明天会按记忆曲线安排新的卡片；想再过一遍可以点「再刷一轮」。"
                      : subjectTitle
                        ? subjectTitle + " 的到期卡已清空，换一科或稍后再来。"
                        : "全部科目的到期卡都清空了，明天再来。"
              }
              actionLabel={activeFailure ? "重试" : dailyCleared ? "再刷一轮" : "刷新"}
              onAction={dailyCleared && !activeFailure ? () => void restartRound() : retry}
              pattern="none"
            />
          </View>
        ) : finished ? (
          <ScrollView style={styles.finishedScroll} contentContainerStyle={styles.finishedBox} showsVerticalScrollIndicator={false}>
            <View style={styles.finishedInner}>
              <ThemedIcon name="checkmark-done" size={34} color={colors.success} />
              <Text style={styles.finishedTitle}>
                {scope === "mistake" ? "这一轮错题刷完了" : "这一轮刷完了"}
              </Text>
              <Text style={styles.finishedText}>
                {stats.doneToday > 0 ? "今日已刷 " + stats.doneToday + " 张" : "今天还没有新的评级"}
                {" · "}
                {stats.dueCount > 0 ? "待复习 " + stats.dueCount + " 张" : "待复习已清空"}
                {" · "}
                {stats.streak > 0 ? "连续 " + stats.streak + " 天" : "从今天起步"}
              </Text>
              {pending > 0 ? (
                <Text style={styles.finishedPending}>{pending} 条评级待同步，联网后自动补发。</Text>
              ) : null}
              <View style={styles.subjectStatsList}>
                {board.subjects.map((item) => (
                  <View key={item.subjectKey} style={styles.subjectStatRow}>
                    <Text style={styles.subjectStatTitle}>{item.title}</Text>
                    <Text style={styles.subjectStatMeta}>
                      {item.dueCount > 0 ? "待复习 " + item.dueCount : "待复习已清空"}
                      {" · "}
                      {item.doneToday > 0 ? "今日 " + item.doneToday : "今日未刷"}
                      {item.accuracy === null ? "" : " · 正确率 " + formatAccuracy(item.accuracy)}
                    </Text>
                  </View>
                ))}
              </View>
              <PressableScale haptic onPress={() => void restartRound()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  {scope === "mistake" ? "重刷易错本" : "再刷一轮"}
                </Text>
              </PressableScale>
              {scope === "queue" ? (
                <PressableScale
                  haptic
                  onPress={() => {
                    haptics.light();
                    scopeRef.current = "mistake";
                    setScope("mistake");
                    setMistakeLoading(true);
                    setFlipped(false);
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>去易错本重刷错题</Text>
                </PressableScale>
              ) : null}
            </View>
          </ScrollView>
        ) : card ? (
          <View style={[styles.cardSlot, { minHeight: layout.cardMinHeight }]}>
            <View pointerEvents="none" style={[styles.stackBack, styles.stackBackFar]} />
            <View pointerEvents="none" style={[styles.stackBack, styles.stackBackNear]} />
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.card, cardSlideStyle]}>
                {/* 正面：题干（整面可点 → 显示答案） */}
                <Animated.View
                  style={[styles.face, styles.faceFront, frontStyle]}
                  pointerEvents={flipped ? "none" : "auto"}
                >
                  <View pointerEvents="none" style={styles.frontGlow} />
                  <View pointerEvents="none" style={styles.frontRing} />
                  <View pointerEvents="none" style={styles.frontBottomGlow} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"显示答案：" + toPlainText(card.question)}
                    accessibilityHint="点按任意位置查看答案；左右滑动切换上一张或下一张"
                    onPress={toggleFlip}
                    style={styles.facePress}
                  >
                    <ScrollView
                      key={card.key + "-front"}
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
                      <RichText text={card.question} style={styles.questionText} />
                      <View style={styles.faceHintRow}>
                        <ThemedIcon name="eye-outline" size={15} color="#9FD2F4" />
                        <Text style={[styles.faceHint, styles.faceHintActive]}>
                          {flipActionLabel(flipped)} · 左右滑切换卡片
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
                  <View pointerEvents="none" style={styles.backWash} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="隐藏答案，回到题干"
                    accessibilityHint="点按任意位置收起答案；上下滚动查看长答案；左右滑动切换卡片"
                    onPress={toggleFlip}
                    style={styles.facePress}
                  >
                    <ScrollView
                      key={card.key + "-back"}
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
                            <RichText text={step} style={styles.answerStepText} />
                          </View>
                        ))
                      )}
                      {card.pitfall ? (
                        <View style={styles.pitfallBox}>
                          <View style={styles.answerSectionTitleRow}>
                            <ThemedIcon name="alert-circle" size={14} color={colors.danger} />
                            <Text style={styles.pitfallTitle}>易错点</Text>
                          </View>
                          <RichText text={card.pitfall} style={styles.pitfallText} />
                        </View>
                      ) : null}
                      {card.mnemonic ? (
                        <View style={styles.mnemonicBox}>
                          <View style={styles.answerSectionTitleRow}>
                            <ThemedIcon name="sparkles" size={14} color={colors.accentStrong} />
                            <Text style={styles.mnemonicTitle}>口诀</Text>
                          </View>
                          <RichText text={card.mnemonic} style={styles.mnemonicText} />
                        </View>
                      ) : null}
                      {card.demoKey ? (
                        <Text style={styles.demoHint}>关联演示：{card.demoKey}</Text>
                      ) : null}
                      <Text style={styles.faceHintBack}>轻点收起答案 · 左右滑切换卡片</Text>
                    </ScrollView>
                  </Pressable>

                  {/* P13：收起按钮固定悬浮在答案面右上角（不在滚动内容里，长答案滚到哪都点得到） */}
                  <PressableScale
                    haptic
                    onPress={toggleFlip}
                    style={styles.collapseChip}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="收起答案，回到题干"
                  >
                    <ThemedIcon name="eye-off-outline" size={15} color={colors.primary} />
                    <Text style={styles.collapseChipText}>收起</Text>
                  </PressableScale>
                </Animated.View>

                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.blurLayer, blurStyle]}>
                  {Platform.OS !== "android" || blurTarget ? (
                    <BlurView
                      intensity={40}
                      tint={dark ? "dark" : "light"}
                      blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
                      blurTarget={blurTarget ?? undefined}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        styles.blurFallback,
                        { backgroundColor: flipped ? colors.surfaceStrong : "#17364E" },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.blurVeil,
                      { backgroundColor: flipped ? colors.surfaceStrong : "#17364E" },
                    ]}
                  />
                </Animated.View>
              </Animated.View>
            </GestureDetector>
            {navHint ? (
              <View style={styles.navHintPill} pointerEvents="none">
                <View style={styles.navHintBubble}>
                  <Text style={styles.navHintText}>{navHint}</Text>
                </View>
              </View>
            ) : null}
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
                        { backgroundColor: soft, borderColor: accent, minHeight: layout.ratingMinHeight },
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
      <CelebrationModal
        visible={!!celebrationRequest}
        onClose={closeCelebration}
        title={celebrationRequest?.title ?? ""}
        subtitle={celebrationRequest?.subtitle}
        badge={celebrationRequest?.badge}
        kicker={celebrationRequest?.kicker}
        buttonText={celebrationRequest?.buttonText}
        tone={celebrationRequest?.tone}
        award={celebrationRequest ? {
          title: celebrationRequest.title,
          subtitle: celebrationRequest.subtitle,
          dateText: todayShortLabel(),
          accuracy: board.today.accuracy,
          reviewed: board.today.done,
          serial: "LW-" + new Date().toISOString().slice(5, 10).replace("-", ""),
        } : undefined}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

/** 中文短日期（不依赖 Intl：Android Hermes 上 toLocaleDateString 会回落到英文） */
function todayShortLabel() {
  const d = new Date();
  return d.getMonth() + 1 + " 月 " + d.getDate() + " 日";
}
/** 无障碍朗读用的纯文本：去掉换行与多余空白，避免 TalkBack 逐行念。 */
function toPlainText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
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
      hitSlop={5}
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
  // P13：chip 缩到「文字宽度 + 内边距」，单行显示；有待复习数时右侧跟一个数字
  const display = subjectChipDisplay(label, due);
  return (
    <PressableScale
      haptic
      hitSlop={4}
      onPress={onPress}
      style={[styles.subjectChip, active && styles.subjectChipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={display.label + (display.hasDue ? "，待复习 " + display.dueText + " 张" : "，无到期")}
    >
      <Text style={[styles.subjectChipText, active && { color: colors.primary }]} numberOfLines={1}>
        {display.label}
      </Text>
      {display.hasDue ? (
        <Text style={[styles.subjectChipDue, active && { color: colors.primary }]}>{display.dueText}</Text>
      ) : null}
    </PressableScale>
  );
}

const makeStyles = (colors: ThemeColors) =>
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
    timerChip: { marginTop: 2 },
    statsLine: { ...typography.micro, color: colors.textFaint },

    /* 范围 + 科目 */
    // P13：范围切换压成单行（label + 数量），高度约 30pt
    scopeRow: {
      flexDirection: "row",
      gap: 3,
      borderRadius: radius.panel,
      backgroundColor: colors.surfaceMuted,
      padding: 3,
    },
    scopeTab: {
      flex: 1,
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      borderRadius: radius.control,
      paddingVertical: 8,
    },
    scopeTabActive: { backgroundColor: colors.surfaceStrong, ...shadows.card },
    scopeTabText: { ...typography.caption, fontWeight: "800", color: colors.textMuted },
    scopeTabMeta: { ...typography.micro, color: colors.textFaint, flexShrink: 1 },
    /** horizontal ScrollView 默认 flexGrow:1，会抢走完成态/卡片区的剩余高度；这里只占内容高度 */
    subjectScroll: { flexGrow: 0, flexShrink: 0 },
    subjectRow: { gap: 6, paddingRight: spacing.lg, paddingVertical: 1 },
    // P13：chip 只占「文字 + 内边距」的宽度（不再 minWidth/等分）；v2 统一 radius.control
    subjectChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
      minHeight: 38,
      borderRadius: radius.control,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "transparent",
    },
    subjectChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    subjectChipText: { ...typography.caption, fontWeight: "800", color: colors.textSecondary },
    subjectChipDue: {
      ...typography.micro,
      fontWeight: "800",
      color: colors.textMuted,
      fontVariant: ["tabular-nums"],
    },

    /* 卡片：flex:1 吃掉顶部腾出的全部高度，minHeight 由 resolveDrillLayout 按屏高给 */
    cardSlot: { flex: 1 },
    stackBack: {
      position: "absolute",
      borderRadius: radius.panel,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    stackBackNear: { left: 12, right: 12, top: 8, bottom: -8, opacity: 0.72 },
    stackBackFar: { left: 24, right: 24, top: 16, bottom: -16, opacity: 0.38 },
    blurLayer: { borderRadius: radius.panel, overflow: "hidden" },
    blurFallback: { opacity: 0.45 },
    blurVeil: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.28,
    },
    card: {
      flex: 1,
      borderRadius: radius.panel,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.floating,
      overflow: "hidden",
    },
    face: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" },
    /** 正面：整块深海军蓝，边缘与内容同材质（对齐 V12 .memory-front） */
    faceFront: { backgroundColor: "#17364E" },
    frontGlow: {
      position: "absolute",
      top: -96,
      right: -70,
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: "rgba(114,185,239,0.18)",
    },
    frontRing: {
      position: "absolute",
      top: -128,
      right: -112,
      width: 270,
      height: 270,
      borderRadius: 135,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.10)",
    },
    frontBottomGlow: {
      position: "absolute",
      bottom: -82,
      left: -56,
      width: 190,
      height: 190,
      borderRadius: 95,
      backgroundColor: "rgba(244,175,117,0.10)",
    },
    /** 背面：整卡浅色玻璃，浅色主题用 surfaceStrong 打底 + 主色 6% wash */
    faceBack: { backgroundColor: colors.surfaceStrong },
    /**
     * 答案面同样不能只在上半张铺色：旧实现 height: 58% 会在卡面中间留下
     * 一条材质分界，看起来像文字区贴了一块白矩形。现在改为全卡同材质 wash。
     */
    backWash: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.primarySoft,
      opacity: 0.32,
    },
    facePress: { flex: 1 },
    faceScroll: { flex: 1 },
    faceContent: { padding: spacing.lg, gap: spacing.sm },
    cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    chapterBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    chapterBadgeText: { ...typography.micro, color: "rgba(255,255,255,0.76)" },
    starBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: "rgba(244,175,117,0.16)",
    },
    starBadgeText: { ...typography.micro, color: "#F7C9A0" },
    stateBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: "rgba(114,185,239,0.18)",
    },
    stateBadgeText: { ...typography.micro, color: "#CFE8FA" },
    questionText: {
      ...typography.title2,
      color: "#F4F9FC",
      lineHeight: 32,
      marginTop: spacing.sm,
    },
    faceHintRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: "auto" },
    faceHint: { ...typography.micro, color: "rgba(255,255,255,0.46)" },
    faceHintActive: { color: "#9FD2F4", fontWeight: "700" },
    /** 答案面是浅色材质，提示字必须回到主题 token，不能沿用正面的白字 */
    faceHintBack: { ...typography.micro, color: colors.textFaint },

    /* 答案面 */
    answerHeadRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
      // 给右上角固定的「收起」胶囊留位置，避免标题/步数被压到按钮下面
      paddingRight: 64,
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
      borderRadius: radius.control,
      padding: spacing.md,
      backgroundColor: colors.dangerSoft,
    },
    pitfallTitle: { ...typography.caption, fontWeight: "800", color: colors.danger },
    pitfallText: { ...typography.callout, color: colors.text },
    mnemonicBox: {
      gap: 4,
      borderRadius: radius.control,
      padding: spacing.md,
      backgroundColor: colors.accentSoft,
    },
    mnemonicTitle: { ...typography.caption, fontWeight: "800", color: colors.accentStrong },
    mnemonicText: { ...typography.callout, color: colors.text },
    demoHint: { ...typography.micro, color: colors.textFaint },
    /* P13：收起答案固定在答案面右上角（不随长答案滚走） */
    collapseChip: {
      position: "absolute",
      top: 10,
      right: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      backgroundColor: colors.surfaceStrong,
    },
    collapseChipText: { ...typography.micro, fontWeight: "800", color: colors.primary },

    /* 操作区 */
    notice: { ...typography.micro, color: colors.warning },
    /** 滑到头的轻提示：悬浮在卡片底部，不参与布局，避免卡片高度跳动 */
    navHintPill: { position: "absolute", left: 0, right: 0, bottom: 12, alignItems: "center" },
    navHintBubble: {
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      ...shadows.card,
    },
    navHintText: { ...typography.micro, fontWeight: "800", color: colors.primary },
    showButton: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      ...shadows.brand,
    },
    showButtonText: { ...typography.headline, fontWeight: "800", color: "#FFFFFF" },
    ratingBlock: { gap: 6 },
    ratingRow: { flexDirection: "row", gap: spacing.sm },
    ratingButton: {
      flex: 1,
      // 高度由 resolveDrillLayout 按屏高给（紧凑 64 / 常规 76），这里只兜底
      minHeight: 64,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      borderRadius: radius.control,
      borderWidth: StyleSheet.hairlineWidth * 2,
    },
    ratingButtonBusy: { opacity: 0.6 },
    ratingLabel: { ...typography.headline, fontWeight: "800" },
    ratingHint: { ...typography.micro, color: colors.textMuted },

    pendingBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.control,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      backgroundColor: colors.warningSoft,
    },
    pendingText: { ...typography.micro, flex: 1, color: colors.textSecondary },

    /* 完成态 */
    finishedScroll: { flex: 1, minHeight: 0 },
    finishedBox: {
      flexGrow: 1,
      alignItems: "stretch",
      justifyContent: "center",
      paddingVertical: spacing.lg,
    },
    finishedInner: { width: "100%", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xs },
    finishedTitle: { ...typography.title2, color: colors.text },
    finishedText: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
    finishedPending: { ...typography.micro, color: colors.warning },
    subjectStatsList: {
      alignSelf: "stretch",
      gap: 6,
      marginTop: spacing.sm,
      borderRadius: radius.card,
      padding: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    subjectStatRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
    subjectStatTitle: { ...typography.caption, fontWeight: "700", color: colors.text },
    subjectStatMeta: { ...typography.micro, flex: 1, textAlign: "right", color: colors.textMuted },
    primaryButton: {
      minHeight: 48,
      marginTop: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      paddingHorizontal: spacing["2xl"],
      backgroundColor: colors.primary,
    },
    primaryButtonText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
    secondaryButton: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      paddingHorizontal: spacing["2xl"],
      backgroundColor: colors.primarySoft,
    },
    secondaryButtonText: { ...typography.callout, fontWeight: "800", color: colors.primary },
  });
