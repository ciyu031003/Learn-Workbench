/* eslint-disable react-hooks/immutability */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHeaderTopInset } from "@/components/screen-header";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { EntryCard } from "@/components/entry-card";
import { GroupLabel } from "@/components/group-label";
import { ListGroup, ListRow } from "@/components/list-row";
import { Surface } from "@/components/surface";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { LearningShelfHeader } from "@/components/learning-entry-cards";
import { PageHead } from "@/components/v2/page-head";
import { SectionTitle } from "@/components/v2/section-title";
import { ActionCard } from "@/components/v2/action-card";
import { BarChart } from "@/components/v2/bar-chart";
import { ProgressBar } from "@/components/v2/progress-bar";

import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  cancelAnimation,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useAppStore } from "@/store/app-store";
import { router, useFocusEffect } from "expo-router";
import type { Phase } from "@learn-workbench/shared/schemas";
import { formatDuration, pct } from "@learn-workbench/shared/dates";
import { mainPhases } from "@learn-workbench/content/roadmap";
import { getLearningTrackNow, useLearningTrack, useLearningTracks } from "@/lib/content-store";
import { setNavPendingParams } from "@/lib/nav-pending";
import { computeFocusStats } from "@/lib/focus-stats";
import { radius, shadows, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import {
  fetchRoadmapOrNull,
  importRoadmapMarkdown,
  createPhase,
  reorderPhases,
  readCachedRoadmap,
  deletePhase,
  updatePhase,
  type MdImportResult,
} from "@/lib/roadmap";
import { SheetSection, SheetStickyCta } from "@/components/sheet";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useReducedMotion } from "@/lib/motion";
import { isMotionActive } from "@/theme/motion";
import {
  loadLearningAttempts,
  summarizeLearningAttempts,
  wrongQuestionKeys,
  type LearningAttempt,
} from "@/lib/learning-progress";
import { fetchLearningReview } from "@/lib/learning-review";
import {
  continueReading,
  loadReadingStore,
  syncReadingState,
  type ReadingStore,
} from "@/lib/reading-state";


const STAGE_GRADS: [string, string][] = [
  ["#2F74C0", "#78C2E8"],
  ["#F28C28", "#FF8F6B"],
  ["#8D7BD8", "#B39AD9"],
  ["#2FB3A6", "#57C7B2"],
  ["#F26B5E", "#FFB77A"],
  ["#4F8CD6", "#78C2E8"],
  ["#3DA35D", "#7AC06E"],
];
/** 阶段卡之间的间距，必须与 `styles.content` 的 gap 一致（实时让位的位移量按"实测高度 + 这个值"算） */
const STAGE_CARD_GAP = 12;
const DAILY_QUESTION_GOAL = 20;
/** ⑤ 周柱状图列标签（getDay() 下标：0 = 周日），今天单独高亮 */
const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** 阅读卡片用的标题查表（找不到就退回 key，界面不会出现空白行） */
function readingTitle(trackSlug: string, stageKey: string, topicKey: string): string {
  const track = getLearningTrackNow(trackSlug);
  const stage = track?.stages.find((entry) => entry.key === stageKey);
  const topic = stage?.topics.find((entry) => entry.key === topicKey);
  return topic?.title ?? topicKey;
}

/**
 * 选中阶段卡的「流云呼吸」光效（v1.33.0，替换旧的白斜线扫光）。
 *
 * 三条动线同时跑，但**只在选中的那张卡上**（同一时刻最多一张；非选中直接不渲染 → 零开销）：
 *  1. 呼吸：光晕透明度 + 缩放缓慢起伏（5.2s 往返）；
 *  2. 变色：两层光晕各自 interpolateColor 在色环上往返 —— 颜色一直缓慢流转，不是七彩乱闪；
 *  3. 流转：底部一条"云带"左右来回漂移（7.6s，与呼吸错拍），像流云在卡底游走。
 *
 * 为什么不用模糊/渐变：Android 的 View 没有 blur，低透明度叠层圆角块 + 缓慢运动才是这个
 * 平台上的"柔光"通用做法；也没走 react-native-svg 的渐变（要动就得 animatedProps，踩坑 55）。
 * ⚠️ worklet 快照约束（踩坑 71）：下面 useAnimatedStyle 用到的量必须全部声明在它们之前。
 */
const AURA_HUES = ["#9BD7FF", "#B9A6FF", "#FFAFD2", "#FFE0A3", "#9FF0DC"];

function StageAura({
  active,
  seed,
  motionActive,
}: {
  active: boolean;
  seed: number;
  motionActive: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const auraSize = Math.max(220, width * 0.88);
  // 每张卡取相邻两个色相：同一张卡内缓慢变色，不同卡颜色不同（与阶段渐变呼应）
  const hueA = AURA_HUES[seed % AURA_HUES.length];
  const hueB = AURA_HUES[(seed + 1) % AURA_HUES.length];
  const hueC = AURA_HUES[(seed + 3) % AURA_HUES.length];

  const t = useSharedValue(0);
  const drift = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      if (!active || !motionActive) {
        cancelAnimation(t);
        cancelAnimation(drift);
        t.value = 0;
        drift.value = 0;
        return;
      }
      t.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }), -1, true);
      drift.value = withRepeat(withTiming(1, { duration: 7600, easing: Easing.inOut(Easing.quad) }), -1, true);
      return () => {
        cancelAnimation(t);
        cancelAnimation(drift);
      };
    }, [active, drift, motionActive, t])
  );

  const haloTop = useAnimatedStyle(() => ({
    opacity: 0.16 + t.value * 0.2,
    transform: [{ scale: 0.92 + t.value * 0.16 }],
    backgroundColor: interpolateColor(t.value, [0, 1], [hueA, hueB]),
  }));

  const haloBottom = useAnimatedStyle(() => ({
    opacity: 0.1 + drift.value * 0.16,
    transform: [{ scale: 1.04 - drift.value * 0.12 }],
    backgroundColor: interpolateColor(drift.value, [0, 1], [hueC, hueA]),
  }));

  const cloud = useAnimatedStyle(() => ({
    opacity: 0.16 + drift.value * 0.18,
    transform: [
      { translateX: -auraSize * 0.2 + drift.value * auraSize * 0.4 },
      { scaleX: 1 + t.value * 0.1 },
    ],
  }));

  if (!active || !motionActive) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.auraHaloTop, { width: auraSize, height: auraSize * 0.72 }, haloTop]} />
      <Animated.View style={[styles.auraHaloBottom, { width: auraSize * 0.78, height: auraSize * 0.6 }, haloBottom]} />
      <Animated.View style={[styles.auraCloud, { width: auraSize * 1.15 }, cloud]} />
    </View>
  );
}

function StageCard({
  phase,
  index,
  total,
  active,
  progressInfo,
  onSelect,
  onMove,
  onDelete,
  onEdit,
  dragIndex,
  dragTarget,
  dragY,
  heights,
  onMeasure,
  onDragChange,
  motionActive,
}: {
  phase: Phase;
  index: number;
  total: number;
  active: boolean;
  progressInfo: { done: number; total: number };
  onSelect: () => void;
  onMove: (from: number, to: number) => void;
  onDelete: () => void;
  onEdit: () => void;
  /** 拖拽状态全部用共享值在 UI 线程流转（禁止每帧 runOnJS(setState)，否则必掉帧） */
  dragIndex: SharedValue<number>;
  dragTarget: SharedValue<number>;
  dragY: SharedValue<number>;
  /** 各卡片实测高度（下标对齐 roadmap），onLayout 时写入 */
  heights: SharedValue<number[]>;
  onMeasure: (index: number, height: number) => void;
  onDragChange: (index: number | null) => void;
  motionActive: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(260)
        .onStart(() => {
          dragIndex.value = index;
          dragTarget.value = index;
          dragY.value = 0;
          runOnJS(onDragChange)(index);
        })
        .onUpdate((e) => {
          dragY.value = e.translationY;
          // 目标下标：把"被拖卡片的中心"换算成落在哪张卡的中线上。
          // 用**实测高度**累加（不再用固定步长 108 —— 实际行距是 104+12=116，且长标题会更高），
          // 这样"拖到某张卡中间就换位"才准。
          const hs = heights.value;
          let above = 0;
          for (let i = 0; i < index; i++) above += (hs[i] ?? 0) + STAGE_CARD_GAP;
          const center = above + (hs[index] ?? 0) / 2 + e.translationY;
          let acc = 0;
          let target = 0;
          for (let i = 0; i < total; i++) {
            if (center > acc + (hs[i] ?? 0) / 2) target = i;
            acc += (hs[i] ?? 0) + STAGE_CARD_GAP;
          }
          dragTarget.value = target;
        })
        .onEnd(() => {
          const target = dragTarget.value;
          dragIndex.value = -1;
          dragTarget.value = -1;
          dragY.value = 0;
          runOnJS(onDragChange)(null);
          if (target !== index) runOnJS(onMove)(index, target);
        })
        .onFinalize(() => {
          dragIndex.value = -1;
          dragTarget.value = -1;
          dragY.value = 0;
          runOnJS(onDragChange)(null);
        }),
    [dragIndex, dragTarget, dragY, heights, index, onDragChange, onMove, total]
  );

  /**
   * 拖拽表现（全部在 UI 线程）：
   * - 被拖的卡片：跟手 + 轻微放大 + **浮到所有兄弟卡片之上**。Android 上同 elevation 的兄弟
   *   仍按子视图顺序绘制，所以必须**同时**抬 `zIndex` 与 `elevation`（只加 zIndex 看不出效果）；
   *   阴影也一起加重，去掉旧的 `opacity: 0.88`（半透明正是"沉到下面"观感的放大器）。
   * - 其它卡片：在被拖卡片越过的区间里上移/下移一格，形成实时让位。
   */
  const cardStyle = useAnimatedStyle(() => {
    const from = dragIndex.value;
    const to = dragTarget.value;
    const isDragged = from === index;
    let shift = 0;
    if (from >= 0 && !isDragged) {
      const draggedStep = (heights.value[from] ?? 0) + STAGE_CARD_GAP;
      if (from < to && index > from && index <= to) shift = -draggedStep;
      else if (from > to && index >= to && index < from) shift = draggedStep;
    }
    return {
      zIndex: isDragged ? 30 : 0,
      elevation: isDragged ? 18 : 4,
      shadowOpacity: isDragged ? 0.34 : active ? 0.28 : 0.22,
      shadowRadius: isDragged ? 22 : 14,
      shadowOffset: { width: 0, height: isDragged ? 14 : 7 },
      transform: [
        {
          translateY: isDragged
            ? dragY.value
            : withTiming(shift, { duration: 160, easing: Easing.out(Easing.quad) }),
        },
        { scale: isDragged ? 1.02 : 1 },
      ],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.stageCard, active && styles.stageCardActive, cardStyle]}
        onLayout={(e) => onMeasure(index, e.nativeEvent.layout.height)}
      >
        <PressableScale style={styles.stageCardBody} haptic onPress={onSelect}>
          <View style={[styles.stageBlob, { backgroundColor: STAGE_GRADS[index % STAGE_GRADS.length][1] }]} />
          <View style={styles.stageTopLight} />
          <StageAura active={active} seed={index} motionActive={motionActive} />
          <View style={styles.stageTop}>
            <Text style={styles.stageTag}>阶段 {index + 1}</Text>
            <Text style={styles.stageName} numberOfLines={1}>{phase.title}</Text>
            <View style={styles.stageActions}>
              <Pressable accessibilityLabel="编辑"
                hitSlop={6}
                style={styles.stageActionBtn}
                onPress={onEdit}
              >
                <ThemedIcon name="create-outline" size={14} color="rgba(255,255,255,0.92)" />
              </Pressable>
              <Pressable accessibilityLabel="删除"
                hitSlop={6}
                style={styles.stageActionBtn}
                onPress={onDelete}
              >
                <ThemedIcon name="trash-outline" size={14} color="rgba(255,255,255,0.92)" />
              </Pressable>
            </View>
          </View>
          <Text style={styles.stageDesc} numberOfLines={1}>
            {phase.summary || phase.weeks || ""}
          </Text>
          <View style={styles.stageBar}>
            <View style={[styles.stageBarFill, { width: `${pct(progressInfo.done, progressInfo.total)}%`, backgroundColor: STAGE_GRADS[index % STAGE_GRADS.length][1] }]} />
          </View>
        </PressableScale>
      </Animated.View>
    </GestureDetector>
  );
}


export default function LearnScreen() {
  /** 内容来自数据库（content-store）：改库即生效，无需发版 */
  const learningTracks = useLearningTracks();
  const allLearningQuestions = useMemo(() => learningTracks.flatMap((track) => track.questions), [learningTracks]);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerTop = useHeaderTopInset("hero");
  const tabBarSpace = useTabBarSpace();
  const reduced = useReducedMotion();
  const motionActive = isMotionActive(reduced);
  /** v19-M1：首屏入场错峰（Tab scene 常驻，只在首次挂载播放） */
  const entrance = useScreenEntrance();
  /** v19-M8：TabBar 双击回顶 */
  const learnScrollRef = useRef<ScrollView>(null);
  useScrollToTopHandler("/learn", learnScrollRef);
  const progress = useAppStore((s) => s.progress);
  const sessions = useAppStore((s) => s.sessions);
  const token = useAppStore((s) => s.token);
  const customTopics = useAppStore((s) => s.customTopics);
  const addCustomTopic = useAppStore((s) => s.addCustomTopic);
  const removeCustomTopic = useAppStore((s) => s.removeCustomTopic);
  const [, setStageSheet] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [learningAttempts, setLearningAttempts] = useState<LearningAttempt[]>([]);
  const [roadmap, setRoadmap] = useState<Phase[]>(mainPhases.filter((p) => p.track === "main"));
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(mainPhases[0]?.id ?? null);
  const [contentTopic, setContentTopic] = useState<{ topicId: number; phaseId: number } | null>(null);
  const [customTopicSheet, setCustomTopicSheet] = useState(false);
  const [customTopicTitle, setCustomTopicTitle] = useState("");
  const [customTopicSummary, setCustomTopicSummary] = useState("");
  const [customPhaseSheet, setCustomPhaseSheet] = useState(false);
  const [customPhaseTitle, setCustomPhaseTitle] = useState("");
  const [customPhaseSummary, setCustomPhaseSummary] = useState("");
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  // v6 P3-2：Markdown 导入（粘贴 → 服务端解析预览 → 确认导入）
  const [mdSheet, setMdSheet] = useState(false);
  const [mdText, setMdText] = useState("");
  const [mdPreview, setMdPreview] = useState<MdImportResult | null>(null);
  const [mdBusy, setMdBusy] = useState(false);
  const [mdMsg, setMdMsg] = useState<string | null>(null);
  /**
   * 阶段卡拖拽排序（v4 P1）：状态全部用共享值，拖动过程中**不触发任何 React 重渲染**，
   * 位移与让位动画都在 UI 线程完成；`stageDragging` 只用于拖动期间锁住 ScrollView。
   */
  const stageDragIndex = useSharedValue(-1);
  const stageDragTarget = useSharedValue(-1);
  const stageDragY = useSharedValue(0);
  const stageHeights = useSharedValue<number[]>([]);
  const [stageDragging, setStageDragging] = useState(false);

  const measureStage = useCallback(
    (i: number, h: number) => {
      const next = [...stageHeights.value];
      if (next[i] === h) return;
      next[i] = h;
      stageHeights.value = next;
    },
    [stageHeights]
  );

  const onStageDragChange = useCallback((i: number | null) => {
    setStageDragging(i !== null);
  }, []);

  /**
   * 重新拉取当前领域的路线图（v6 P3-1：走 fetchRoadmapOrNull，
   * 返回 null = 没拿到权威答案 → 保留现状，不把页面清空）。
   */
  const reloadRoadmap = useCallback(async () => {
    const remote = await fetchRoadmapOrNull();
    if (remote === null) return;
    setRoadmap(
      remote
        .filter((p) => p.track === "main")
        .map((p) => ({ ...p, topics: p.topics ?? [] })) as unknown as Phase[]
    );
  }, []);

  /**
   * v17/v18 收尾：下拉刷新复用既有的 reloadRoadmap（本页唯一的权威网络数据源）。
   * fetchRoadmapOrNull 返回 null 表示离线/失败 → 保留现状，不把页面清空（既有语义未改）。
   * 学习页是自绘 hero 的 hub 页、没有吸顶紧凑栏 → stickyHeader: false。
   */
  const { control: learnRefresh } = usePullRefresh(reloadRoadmap, { stickyHeader: false });

  /** v6 P3-2：先让服务端解析 MD 出预览树（不写库） */
  const previewMd = async () => {
    const md = mdText.trim();
    if (!md) {
      Alert.alert("请粘贴 Markdown 内容");
      return;
    }
    setMdBusy(true);
    setMdMsg(null);
    try {
      const r = await importRoadmapMarkdown(md, { dryRun: true });
      setMdPreview(r);
    } catch (e) {
      setMdPreview(null);
      setMdMsg(e instanceof Error ? e.message : "解析失败");
    } finally {
      setMdBusy(false);
    }
  };

  /** v6 P3-2：确认导入（服务端在事务里写阶段/主题/学习内容） */
  const confirmMd = async () => {
    const md = mdText.trim();
    if (!md) return;
    setMdBusy(true);
    setMdMsg(null);
    try {
      const r = await importRoadmapMarkdown(md);
      const created = r.created ?? { phases: 0, topics: 0, items: 0 };
      Alert.alert(
        "导入完成",
        `新增 ${created.phases} 个阶段 · ${created.topics} 个主题 · ${created.items} 条学习内容`
      );
      setMdSheet(false);
      setMdPreview(null);
      setMdText("");
      await reloadRoadmap();
    } catch (e) {
      setMdMsg(e instanceof Error ? e.message : "导入失败");
    } finally {
      setMdBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setRoadmapLoading(true);
      const cached = await readCachedRoadmap();
      const cachedMain = cached
        .filter((p) => p.track === "main")
        .map((p) => ({ ...p, topics: p.topics ?? [] })) as unknown as Phase[];
      if (alive && cachedMain.length > 0) setRoadmap(cachedMain);
      if (token) {
        const remote = await fetchRoadmapOrNull();
        // null = 离线/出错：保留现有内容；[] = 该领域确实没有阶段 → 交给空态引导
        if (alive && remote !== null) {
          setRoadmap(
            remote
              .filter((p) => p.track === "main")
              .map((p) => ({ ...p, topics: p.topics ?? [] })) as unknown as Phase[]
          );
        }
      }
      if (alive) setRoadmapLoading(false);
    };
    void load();
    return () => {
      alive = false;
    };
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadLearningAttempts().then(setLearningAttempts);
    }, [])
  );

  /**
   * 阅读进度（组二 · 阶段 8）：先读本地（离线也有），再尽力与服务端同步（跨设备）。
   * 拿不到远端时 syncReadingState 返回本地状态，不会把卡片清空。
   */
  const [readingStore, setReadingStore] = useState<ReadingStore | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadReadingStore().then((store) => {
        if (alive) setReadingStore(store);
      });
      void syncReadingState().then((store) => {
        if (alive) setReadingStore(store);
      });
      return () => {
        alive = false;
      };
    }, [])
  );
  const [reviewStats, setReviewStats] = useState<{ due: number; wrong: number } | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const [remote, attempts] = await Promise.all([
          fetchLearningReview("all"),
          loadLearningAttempts(),
        ]);
        if (!alive) return;
        setReviewStats({
          due: remote?.dueCount ?? 0,
          wrong: wrongQuestionKeys(attempts).length,
        });
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const resume = readingStore ? continueReading(readingStore) : null;
  const readingCards = useMemo(() => {
    if (!readingStore) return [] as { key: string; label: string; title: string; trackSlug: string; stageKey: string; topicKey: string; favorite: boolean }[];
    const favoriteKeys = Object.keys(readingStore.favorites);
    const items = favoriteKeys.slice(0, 3).map((key) => {
      const item = readingStore.favorites[key];
      const track = getLearningTrackNow(item.trackSlug);
      const topic = track?.stages.find((stage) => stage.key === item.stageKey)?.topics.find((entry) => entry.key === item.topicKey);
      return {
        key,
        label: "收藏",
        title: topic?.title ?? item.topicKey,
        trackSlug: item.trackSlug,
        stageKey: item.stageKey,
        topicKey: item.topicKey,
        favorite: true,
      };
    });
    return items;
  }, [readingStore]);

  /** ③ 继续学习卡「还剩 N 节」：当前阶段总节数 − 已读完（progress=100）的节数 */
  const resumeStage = useMemo(() => {
    if (!resume) return null;
    const track = getLearningTrackNow(resume.trackSlug);
    return track?.stages.find((stage) => stage.key === resume.stageKey) ?? null;
  }, [resume]);
  const resumeRemaining = useMemo(() => {
    if (!resume || !readingStore || !resumeStage) return null;
    const finished = Object.values(readingStore.read).filter(
      (item) =>
        item.trackSlug === resume.trackSlug &&
        item.stageKey === resume.stageKey &&
        item.progress >= 100
    ).length;
    return Math.max(0, resumeStage.topics.length - finished);
  }, [resume, readingStore, resumeStage]);

  /** 入口卡只用这几个数；统计明细全部搬到 /study-stats 全屏页（v1.33.0） */
  const stats = useMemo(() => computeFocusStats(sessions), [sessions]);
  /** ⑤ 本周学习时长：last14 的后 7 天（含今天）；柱高按「30 分钟封顶基准」归一，避免 5 分钟就顶满 */
  const weekChart = useMemo(() => {
    const days = stats.last14.slice(7);
    const peak = Math.max(30, ...days.map((day) => day.minutes));
    return {
      total: days.reduce((sum, day) => sum + day.minutes, 0),
      bars: days.map((day) => {
        const highlight = day.date === stats.date;
        return {
          label: highlight ? "今天" : WEEKDAY_LABELS[new Date(`${day.date}T00:00:00`).getDay()],
          value: day.minutes / peak,
          highlight,
        };
      }),
    };
  }, [stats.date, stats.last14]);
  const learningSummary = useMemo(
    () => summarizeLearningAttempts(learningAttempts, allLearningQuestions),
    [learningAttempts, allLearningQuestions]
  );
  const exam408 = useLearningTrack("ex-408-grad");
  const exam408ChapterCount = useMemo(
    () => exam408?.stages.reduce((total, stage) => total + stage.topics.length, 0) ?? 0,
    [exam408]
  );
  const exam408PointCount = useMemo(
    () =>
      exam408?.stages.reduce(
        (total, stage) =>
          total + stage.topics.reduce((topicTotal, topic) => topicTotal + topic.concepts.length, 0),
        0
      ) ?? 0,
    [exam408]
  );
  const routeSummary = useMemo(() => {
    const topics = roadmap.flatMap((phase) => phase.topics);
    const done = topics.filter((topic) => progress[topic.id]?.done).length;
    return {
      done,
      total: topics.length,
      percent: topics.length === 0 ? 0 : Math.round((done / topics.length) * 100),
    };
  }, [progress, roadmap]);
  const firstPhase = roadmap[0];
  const phaseDone = (phase: Phase) => {
    const doneTopics = phase.topics.filter((t) => progress[t.id]?.done).length;
    return { done: doneTopics, total: phase.topics.length };
  };

  const todayMinutes = stats.todayMinutes;

  const selectedPhase = roadmap.find((p) => p.id === selectedPhaseId) ?? firstPhase;
  const selectedCustomTopics = useMemo(
    () => customTopics.filter((t) => t.phaseId === selectedPhase?.id),
    [customTopics, selectedPhase?.id]
  );
  const currentThemes = [
    ...(selectedPhase?.topics ?? []),
    ...selectedCustomTopics.map((t, ci) => ({
      id: t.id,
      topicKey: `lwb-custom-${ci}`,
      title: t.title,
      summary: t.summary,
      agentTask: null,
      sortOrder: 100000 + ci,
      resources: [],
      practices: [],
      projects: [],
      checkpoints: [],
      isCustomSubject: true,
    })),
  ].slice(0, 4);

  const swapPhase = (from: number, to: number) => {
    if (to < 0 || to >= roadmap.length) return;
    const next = [...roadmap];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setRoadmap(next);
    if (token) {
      reorderPhases(next.map((p) => p.id)).catch(() => {
        // 本机已更新顺序；联网后会在下次拉取时对齐
      });
    }
  };

  const removePhase = (phase: Phase) => {
    Alert.alert("删除学习阶段", `删除「${phase.title}」后，其下主题、进度与相关记录会一并移除，确定吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          const next = roadmap.filter((p) => p.id !== phase.id);
          setRoadmap(next);
          if (phase.id === selectedPhaseId) setSelectedPhaseId(next[0]?.id ?? null);
          if (!token) return;
          try {
            await deletePhase(phase.id);
            await reloadRoadmap();
          } catch (e) {
            Alert.alert("删除失败", e instanceof Error ? e.message : "本机已移除，联网后会重试或对齐");
          }
        },
      },
    ]);
  };

  const openEditPhase = (phase: Phase) => {
    setEditingPhase(phase);
    setCustomPhaseTitle(phase.title);
    setCustomPhaseSummary(phase.summary || phase.weeks || "");
    setCustomPhaseSheet(true);
  };

  const activeTopic = useMemo(() => {
    if (!contentTopic) return null;
    const topic = currentThemes.find(
      (t) => t.id === contentTopic.topicId && ("isCustomSubject" in t === false)
    );
    if (topic) return topic;
    const custom = selectedCustomTopics.find((t) => t.id === contentTopic.topicId);
    if (!custom) return null;
    return {
      id: custom.id,
      topicKey: `lwb-custom-${selectedCustomTopics.indexOf(custom)}`,
      title: custom.title,
      summary: custom.summary,
      agentTask: null,
      sortOrder: 100000 + selectedCustomTopics.indexOf(custom),
      resources: [],
      practices: [],
      projects: [],
      checkpoints: [],
      isCustomSubject: true,
    };
  }, [contentTopic, currentThemes, selectedCustomTopics]);

  const submitCustomTopic = () => {
    const title = customTopicTitle.trim();
    if (!title) {
      Alert.alert("请填写主题标题");
      return;
    }
    if (!selectedPhase) return;
    addCustomTopic(selectedPhase.id, title, customTopicSummary.trim() || null);
    setCustomTopicSheet(false);
  };

  const submitCustomPhase = async () => {
    const title = customPhaseTitle.trim();
    if (!title) {
      Alert.alert("请填写阶段标题");
      return;
    }
    setRoadmapLoading(true);
    try {
      if (editingPhase) {
        await updatePhase(editingPhase.id, {
          title,
          summary: customPhaseSummary.trim() || null,
        });
      } else {
        await createPhase(title, customPhaseSummary.trim() || null, null);
      }
      await reloadRoadmap();
      setCustomPhaseSheet(false);
      setEditingPhase(null);
      setStageSheet(true);
    } catch (e) {
      Alert.alert(editingPhase ? "保存失败" : "创建失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setRoadmapLoading(false);
    }
  };

  /** 继续阅读/收藏：字符串 href 防同名路由 params 冻结 + 场外通道（v1.51） */
  const openReading = (trackSlug: string, stageKey: string, topicKey: string) => {
    setNavPendingParams("quiz-read", { track: trackSlug, stage: stageKey, topic: topicKey });
    router.push(
      `/quiz/read?track=${encodeURIComponent(trackSlug)}&stage=${encodeURIComponent(stageKey)}&topic=${encodeURIComponent(topicKey)}` as never
    );
  };

  /**
   * ③ 继续学习卡的三态（沿用既有行为）：读到一半 → 收藏的章节 → 还没开始（去阶段路线）。
   * 只做数据整形，交互仍是原来的 openReading / 路由跳转。
   */
  const continueCard = (() => {
    if (resume) {
      return {
        icon: "book-outline" as const,
        color: colors.primary,
        kicker: "继续学习",
        title: readingTitle(resume.trackSlug, resume.stageKey, resume.topicKey),
        meta:
          resumeRemaining !== null && resumeRemaining > 0
            ? `读到 ${resume.progress}% · 还剩 ${resumeRemaining} 节`
            : `读到 ${resume.progress}% · 接着上次的位置`,
        progress: Math.max(0, Math.min(1, resume.progress / 100)) as number | null,
        cta: "继续学习",
        a11y: "继续学习上次读到的章节",
        onPress: () => openReading(resume.trackSlug, resume.stageKey, resume.topicKey),
      };
    }
    const saved = readingCards[0];
    if (saved) {
      return {
        icon: "star" as const,
        color: colors.warning,
        kicker: "收藏的章节",
        title: saved.title,
        meta: "已收藏 · 随时接着读",
        progress: null as number | null,
        cta: "继续阅读",
        a11y: "继续阅读收藏的章节",
        onPress: () => openReading(saved.trackSlug, saved.stageKey, saved.topicKey),
      };
    }
    return {
      icon: "git-branch-outline" as const,
      color: colors.accent,
      kicker: "还没开始",
      title: "从阶段路线开始",
      meta:
        routeSummary.total > 0
          ? `已完成 ${routeSummary.done}/${routeSummary.total} 个主题 · ${routeSummary.percent}%`
          : "还没有学习阶段，先建一条路线或导入 Markdown",
      progress: (routeSummary.total > 0 ? routeSummary.percent / 100 : 0) as number | null,
      cta: "查看路线",
      a11y: "从阶段路线开始学习",
      onPress: () => router.push("/roadmap" as never),
    };
  })();

  return (
    <ScrollView
      ref={learnScrollRef}
      refreshControl={<RefreshControl {...learnRefresh} />}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!stageDragging}
    >
      {/* ① 页头：eyebrow + 主标题 + 说明，右上保留全局搜索入口 */}
      <Animated.View style={styles.headRow} entering={entrance(0)}>
        <PageHead
          eyebrow="PERSONAL WORKSPACE"
          title="学习"
          subtitle="把知识点、练习与复习串成一条连续的学习路径。"
          style={styles.headText}
        />
        <PressableScale
          hitSlop={8}
          scaleTo={0.92}
          style={styles.headSearch}
          onPress={() => router.push("/search" as never)}
          accessibilityRole="button"
          accessibilityLabel="全局搜索"
        >
          <ThemedIcon name="search" size={18} color={colors.textMuted} />
        </PressableScale>
      </Animated.View>

      {/* ② 复习提醒条：只有真的到期/有错题时出现，无数据整条隐藏 */}
      {reviewStats && (reviewStats.due > 0 || reviewStats.wrong > 0) ? (
        <Animated.View entering={entrance(1)}>
          <PressableScale
            haptic
            scaleTo={0.985}
            style={styles.reminderPress}
            onPress={() => router.push("/quiz/review" as never)}
            accessibilityRole="button"
            accessibilityLabel={`复习到期 ${reviewStats.due} 题，错题 ${reviewStats.wrong} 题，立即复习`}
          >
            <View style={styles.reminderBar}>
              <View style={styles.reminderIcon}>
                <ThemedIcon name="alarm-outline" size={18} color={colors.danger} />
              </View>
              <View style={styles.reminderBody}>
                <Text style={styles.reminderTitle}>
                  复习到期 {reviewStats.due} 题 · 错题 {reviewStats.wrong}
                </Text>
                <Text style={styles.reminderHint}>按记忆曲线排期，先清到期再回顾错题</Text>
              </View>
              <View style={styles.reminderCta}>
                <Text style={styles.reminderCtaText}>立即复习</Text>
                <ThemedIcon name="chevron-forward" size={12} color={colors.danger} />
              </View>
            </View>
          </PressableScale>
        </Animated.View>
      ) : null}

      {/* ③ 继续学习卡：全屏唯一的 glassStrong 视觉锚点（进行中 / 收藏 / 空态） */}
      <Animated.View entering={entrance(1)}>
        <PressableScale
          haptic
          scaleTo={0.985}
          style={styles.continuePress}
          onPress={continueCard.onPress}
          accessibilityRole="button"
          accessibilityLabel={continueCard.a11y}
        >
          <Surface tier="glassStrong" corner={radius.panel} style={styles.continueCard}>
            <View style={styles.continueHead}>
              <View style={styles.continueIcon}>
                <ThemedIcon name={continueCard.icon} size={20} color={continueCard.color} />
              </View>
              <View style={styles.continueBody}>
                <Text style={styles.continueKicker}>{continueCard.kicker}</Text>
                <Text style={styles.continueTitle} numberOfLines={2}>{continueCard.title}</Text>
              </View>
            </View>
            {continueCard.progress !== null ? (
              <ProgressBar value={continueCard.progress} height={6} />
            ) : null}
            <View style={styles.continueFoot}>
              <Text style={styles.continueMeta} numberOfLines={1}>{continueCard.meta}</Text>
              <Text style={styles.continueCta}>{continueCard.cta} ›</Text>
            </View>
          </Surface>
        </PressableScale>
      </Animated.View>

      {/* ④ 学习入口：2×2 功能卡（沿用既有路由与统计文案） */}
      <Animated.View entering={entrance(2)} style={styles.entrySection}>
        <SectionTitle title="学习入口" />
        <View style={styles.entryGrid}>
          <ActionCard
            icon="school-outline"
            tone="teal"
            title="408 专区"
            subtitle={`${exam408ChapterCount} 章 · ${exam408PointCount} 知识点`}
            actionLabel="进入专区"
            onAction={() => router.push("/exam-408" as never)}
          />
          <ActionCard
            icon="help-circle-outline"
            tone="primary"
            title="题库练习"
            subtitle={`今日 ${learningSummary.today}/${DAILY_QUESTION_GOAL} 题 · 继续刷题`}
            actionLabel="开始练习"
            onAction={() => router.push("/quiz" as never)}
          />
        </View>
        <View style={styles.entryGrid}>
          <ActionCard
            icon="git-branch-outline"
            tone="accent"
            title="阶段路线"
            // 未登录 / 无 roadmap 缓存时是 0/0（不是真实的"0 个主题"）→ 走空态文案，有数据才显示数字
            subtitle={
              routeSummary.total > 0
                ? `已完成 ${routeSummary.done}/${routeSummary.total} 主题 · ${routeSummary.percent}%`
                : "还没有阶段，先建一条路线"
            }
            actionLabel="查看路线"
            onAction={() => router.push("/roadmap" as never)}
          />
          <ActionCard
            icon="repeat-outline"
            tone="warning"
            title="复习"
            subtitle={
              reviewStats
                ? `到期 ${reviewStats.due} 题 · 错题 ${reviewStats.wrong} 题`
                : "到期复习 · 错题回顾"
            }
            actionLabel="去复习"
            onAction={() => router.push("/quiz/review" as never)}
          />
        </View>

        {/* 408 专区主卡：数据取内容库现有统计，不写死篇数/卡片数 */}
        <EntryCard
          size="hero"
          icon="school-outline"
          tone="teal"
          title="408 考研专区"
          meta={`${exam408ChapterCount} 章 · ${exam408PointCount} 知识点 · 精读 / 演示 / 刷卡三入口`}
          cta="进入专区"
          onPress={() => router.push("/exam-408" as never)}
          accessibilityLabel="进入 408 考研专区"
        />
      </Animated.View>

      {/* ⑤ 本周学习时长：7 天柱状，今天高亮；没有记录走空态 */}
      <Animated.View entering={entrance(3)}>
        <SectionTitle
          title="本周学习时长"
          actionLabel="学习统计"
          onAction={() => router.push("/study-stats" as never)}
        />
        <Surface tier="surface" style={styles.weekCard}>
          {weekChart.total > 0 ? (
            <>
              <View style={styles.weekHead}>
                <Text style={[styles.weekTotal, tabularNums]}>{formatDuration(weekChart.total)}</Text>
                <Text style={styles.weekMeta} numberOfLines={1}>
                  近 7 天 · 今日 {formatDuration(todayMinutes)}
                </Text>
              </View>
              <BarChart items={weekChart.bars} height={104} />
            </>
          ) : (
            <View style={styles.weekEmpty}>
              <View style={styles.weekEmptyIcon}>
                <ThemedIcon name="bar-chart-outline" size={18} color={colors.textMuted} />
              </View>
              <View style={styles.weekEmptyBody}>
                <Text style={styles.weekEmptyTitle}>本周还没有专注记录</Text>
                <Text style={styles.weekEmptyHint}>完成一次专注后，这里会按天显示学习时长</Text>
              </View>
            </View>
          )}
        </Surface>
      </Animated.View>

      {/* 学习统计卡：明细在 /study-stats 全屏页，首屏只留一行摘要 */}
      <Animated.View entering={entrance(4)}>
        <PressableScale
          haptic
          hitSlop={8}
          scaleTo={0.98}
          onPress={() => router.push("/study-stats" as never)}
          accessibilityRole="button"
          accessibilityLabel="打开学习统计"
        >
          <Surface tier="surface" style={styles.statsEntry}>
            <View style={styles.statsEntryBody}>
              <Text style={styles.statsEntryTitle}>今日已专注 {formatDuration(todayMinutes)}</Text>
              <Text style={styles.statsEntrySub}>
                热力图 · 周期柱状 · 近 14 天趋势 · 连续 {stats.streak} 天
              </Text>
            </View>
            <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
          </Surface>
        </PressableScale>
      </Animated.View>

      {/* ⑥ 学习架与管理入口：默认收起为折叠条，展开后保留原列表 */}
      <Animated.View entering={entrance(5)} style={styles.shelfWrap}>
        <LearningShelfHeader
          open={shelfOpen}
          onToggle={() => setShelfOpen((value) => !value)}
          percent={routeSummary.percent}
          stageCount={roadmap.length}
        />
        {shelfOpen ? (
          <Animated.View
            entering={motionActive ? FadeInDown.duration(180) : undefined}
            exiting={motionActive ? FadeOutUp.duration(120) : undefined}
            layout={motionActive ? LinearTransition.duration(180) : undefined}
            style={styles.shelfContent}
          >
            {!roadmapLoading && roadmap.length === 0 ? (
              <Surface tier="surface" style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>还没有学习阶段</Text>
                <Text style={styles.emptyHint}>
                  这个学习领域下还没有任何阶段。可以自己新建，也可以导入 Markdown：
                  # 一级标题 = 学习阶段，## 二级 = 阶段里的主题，### 三级 = 主题下的学习内容。
                </Text>
                <View style={styles.emptyActions}>
                  <PressableScale
                    haptic
                    style={styles.emptyAction}
                    onPress={() => {
                      setMdText("");
                      setMdPreview(null);
                      setMdMsg(null);
                      setMdSheet(true);
                    }}
                  >
                    <ThemedIcon name="document-text-outline" size={18} color={colors.primary} />
                    <Text style={styles.emptyActionText}>导入 MD</Text>
                  </PressableScale>
                  <PressableScale
                    haptic
                    style={styles.emptyAction}
                    onPress={() => {
                      setEditingPhase(null);
                      setCustomPhaseTitle("");
                      setCustomPhaseSummary("");
                      setCustomPhaseSheet(true);
                    }}
                  >
                    <ThemedIcon name="add" size={18} color={colors.primary} />
                    <Text style={styles.emptyActionText}>新建阶段</Text>
                  </PressableScale>
                  <PressableScale
                    haptic
                    style={styles.emptyAction}
                    onPress={() => router.push("/domain-manager" as never)}
                  >
                    <ThemedIcon name="layers-outline" size={18} color={colors.primary} />
                    <Text style={styles.emptyActionText}>从模板创建</Text>
                  </PressableScale>
                </View>
              </Surface>
            ) : null}

            {roadmap.map((phase, i) => {
              const progressInfo = phaseDone(phase);
              const active = phase.id === selectedPhaseId;
              return (
                <StageCard
                  key={phase.id}
                  phase={phase}
                  index={i}
                  total={roadmap.length}
                  active={active}
                  progressInfo={progressInfo}
                  onSelect={() => router.push(`/phase/${phase.id}` as never)}
                  onMove={swapPhase}
                  onDelete={() => removePhase(phase)}
                  onEdit={() => openEditPhase(phase)}
                  dragIndex={stageDragIndex}
                  dragTarget={stageDragTarget}
                  dragY={stageDragY}
                  heights={stageHeights}
                  onMeasure={measureStage}
                  onDragChange={onStageDragChange}
                  motionActive={motionActive}
                />
              );
            })}

            <GroupLabel>管理</GroupLabel>
            <ListGroup>
              <ListRow
                icon="create-outline"
                title="学习日志"
                subtitle="记录今天学了什么"
                showChevron
                onPress={() => router.push("/logs" as never)}
              />
              <ListRow
                icon="stats-chart-outline"
                title="学习统计 · 分享闪光卡"
                subtitle="热力图 · 内容维度 · 生成分享卡"
                showChevron
                onPress={() => router.push("/study-stats" as never)}
              />
              <ListRow
                icon="add-circle-outline"
                title="新建阶段"
                subtitle="给路线图加一个阶段"
                showChevron
                onPress={() => {
                  setEditingPhase(null);
                  setCustomPhaseTitle("");
                  setCustomPhaseSummary("");
                  setCustomPhaseSheet(true);
                }}
              />
              <ListRow
                icon="document-text-outline"
                title="导入 Markdown"
                subtitle="一级阶段 / 二级主题 / 三级内容"
                showChevron
                onPress={() => {
                  setMdText("");
                  setMdPreview(null);
                  setMdMsg(null);
                  setMdSheet(true);
                }}
              />
              <ListRow
                icon="bookmark-outline"
                title="添加学习内容"
                subtitle={selectedPhase ? `加到「${selectedPhase.title}」` : "先建一个阶段"}
                showChevron
                disabled={!selectedPhase}
                onPress={() => setCustomTopicSheet(true)}
              />
              <ListRow
                icon="trash-outline"
                title="删除阶段"
                subtitle={selectedPhase ? `当前：${selectedPhase.title}` : "暂无可删除阶段"}
                showChevron
                disabled={!selectedPhase}
                onPress={() => {
                  if (selectedPhase) removePhase(selectedPhase);
                }}
              />
              <ListRow
                icon="checkbox-outline"
                title="今日任务"
                subtitle="勾选今天要完成的事"
                showChevron
                onPress={() => router.push("/tasks" as never)}
              />
              <ListRow
                icon="pulse-outline"
                title="领域记录"
                subtitle="通用计量与按日打卡"
                showChevron
                last
                onPress={() => router.push("/trackers" as never)}
              />
            </ListGroup>
          </Animated.View>
        ) : null}
      </Animated.View>


      <BottomSheet
        visible={customTopicSheet}
        onClose={() => setCustomTopicSheet(false)}
        title="添加学习内容"
        subtitle={selectedPhase ? `加到「${selectedPhase.title}」` : "先选一个学习阶段"}
        icon="bookmark-outline"
        height="54%"
        footer={
          <SheetStickyCta
            label="保存并同步"
            icon="checkmark"
            onPress={submitCustomTopic}
            disabled={!customTopicTitle.trim()}
          />
        }
        footerHint="保存后会出现在该阶段的主题列表里，可继续编辑"
      >
        <SheetSection title="主题标题" hint="必填，越长越具体越好">
          <TextInput
            style={styles.formInput}
            value={customTopicTitle}
            onChangeText={setCustomTopicTitle}
            placeholder="例如：网络安全命令速查"
            placeholderTextColor={colors.textFaint}
          />
        </SheetSection>
        <SheetSection title="一句话说明" hint="选填" last>
          <TextInput
            style={[styles.formInput, styles.formInputArea]}
            value={customTopicSummary}
            onChangeText={setCustomTopicSummary}
            placeholder="这个阶段要掌握什么"
            placeholderTextColor={colors.textFaint}
            multiline
          />
        </SheetSection>
      </BottomSheet>

      <BottomSheet
        visible={customPhaseSheet}
        onClose={() => setCustomPhaseSheet(false)}
        title={editingPhase ? "编辑学习阶段" : "新建学习阶段"}
        subtitle={editingPhase ? "改完保存会同步到所有端" : "阶段是路线图里的一层，下面可以放主题"}
        icon="layers-outline"
        height="52%"
        footer={
          <SheetStickyCta
            label={editingPhase ? "保存并同步" : "创建并同步"}
            icon="checkmark"
            loading={roadmapLoading}
            disabled={!customPhaseTitle.trim()}
            onPress={() => void submitCustomPhase()}
          />
        }
        footerHint="空阶段也可以先建，之后再补主题"
      >
        <SheetSection title="阶段标题" hint="必填">
          <TextInput
            style={styles.formInput}
            value={customPhaseTitle}
            onChangeText={setCustomPhaseTitle}
            placeholder="例如：项目实战冲刺"
            placeholderTextColor={colors.textFaint}
          />
        </SheetSection>
        <SheetSection title="阶段说明" hint="选填" last>
          <TextInput
            style={[styles.formInput, styles.formInputArea]}
            value={customPhaseSummary}
            onChangeText={setCustomPhaseSummary}
            placeholder="这个阶段要掌握什么"
            placeholderTextColor={colors.textFaint}
            multiline
          />
        </SheetSection>
      </BottomSheet>

      {/* v6 P3-2：粘贴 Markdown → 预览 → 导入（服务端解析 + 事务写入） */}
      <BottomSheet
        visible={mdSheet}
        onClose={() => setMdSheet(false)}
        title="导入 Markdown 学习计划"
        subtitle="一级标题=阶段，二级=主题，三级=学习内容"
        icon="document-text-outline"
        height="86%"
        expandable
        footer={
          <SheetStickyCta
            label="确认导入"
            icon="add"
            loading={mdBusy}
            disabled={!mdPreview}
            onPress={() => void confirmMd()}
            secondaryLabel="先预览解析结果"
            onSecondary={() => void previewMd()}
          />
        }
        footerHint="导入按标题去重，可重复执行"
      >
        <View style={styles.formSheet}>
          <Text style={styles.mdHint}>
            # 一级标题 = 学习阶段；## 二级 = 阶段里的主题；### 三级 = 主题下的学习内容（正文一起导入）。
          </Text>
          <TextInput
            style={styles.mdInput}
            value={mdText}
            onChangeText={(v) => {
              setMdText(v);
              setMdPreview(null);
              setMdMsg(null);
            }}
            placeholder={"# 阶段一：基础\n## 主题 A\n### 学习内容 1\n具体说明…"}
            placeholderTextColor={colors.textFaint}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
          />
          {mdMsg ? <Text style={styles.mdMsg}>{mdMsg}</Text> : null}
          {mdPreview ? (
            <View style={styles.mdPreview}>
              <Text style={styles.mdPreviewTitle}>
                预览：{mdPreview.counts?.phases ?? 0} 个阶段 · {mdPreview.counts?.topics ?? 0} 个主题 ·{" "}
                {mdPreview.counts?.items ?? 0} 条学习内容
              </Text>
              {(mdPreview.preview ?? []).slice(0, 6).map((p) => (
                <View key={p.title} style={styles.mdPreviewPhase}>
                  <Text style={styles.mdPreviewPhaseTitle} numberOfLines={1}># {p.title}</Text>
                  {p.topics.slice(0, 4).map((t) => (
                    <Text key={t.title} style={styles.mdPreviewTopic} numberOfLines={1}>
                      ## {t.title}（{t.items.length} 条）
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </BottomSheet>
      <Modal visible={!!activeTopic} transparent animationType="fade" onRequestClose={() => setContentTopic(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setContentTopic(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {activeTopic ? (
              <>
                <View style={styles.modalHead}>
                  <View style={[styles.modalDot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.modalTitle}>{activeTopic.title}</Text>
                  <Pressable
                    hitSlop={10}
                    style={styles.modalClose}
                    onPress={() => setContentTopic(null)}
                    accessibilityRole="button"
                    accessibilityLabel="关闭知识点详情"
                  >
                    <ThemedIcon name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
                <Text style={styles.modalSub}>{activeTopic.summary || "这个阶段的学习内容会在这里展开。"}</Text>
                {(activeTopic.practices?.length ?? 0) > 0 ? (
                  <Text style={styles.modalListTitle}>练习任务</Text>
                ) : null}
                {(activeTopic.practices ?? []).map((pr) => (
                  <View key={pr.id} style={styles.modalRow}>
                    <ThemedIcon name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.modalRowText}>{pr.text}</Text>
                  </View>
                ))}
                {(activeTopic.checkpoints?.length ?? 0) > 0 ? (
                  <Text style={styles.modalListTitle}>阶段验收</Text>
                ) : null}
                {(activeTopic.checkpoints ?? []).map((cp) => (
                  <View key={cp.id} style={styles.modalRow}>
                    <ThemedIcon name="flag" size={16} color={colors.accent} />
                    <Text style={styles.modalRowText}>{cp.text}</Text>
                  </View>
                ))}
                {"isCustomSubject" in activeTopic ? (
                  <Pressable
                    hitSlop={8}
                    style={styles.deleteTopicBtn}
                    onPress={() => {
                      removeCustomTopic(contentTopic?.topicId ?? 0);
                      setContentTopic(null);
                    }}
                  >
                    <ThemedIcon name="trash-outline" size={15} color="#D64545" />
                    <Text style={styles.deleteTopicText}>删除该主题</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /* ① 页头：PageHead + 右上搜索（44 触控热区） */
    headRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    headText: { flex: 1, minWidth: 0 },
    headSearch: {
      width: 44,
      height: 44,
      marginTop: 19,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    /* ② 复习提醒条（dangerSoft 底，无数据时整条不渲染） */
    reminderPress: { borderRadius: radius.card },
    reminderBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 60,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: radius.card,
      backgroundColor: colors.dangerSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.danger,
    },
    reminderIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    reminderBody: { flex: 1, minWidth: 0, gap: 2 },
    reminderTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    reminderHint: { ...typography.meta, color: colors.textMuted },
    reminderCta: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44 },
    reminderCtaText: { ...typography.meta, fontWeight: "800", color: colors.danger },
    /* ③ 继续学习卡（glassStrong 锚点） */
    continuePress: { borderRadius: radius.panel },
    continueCard: { gap: 12 },
    continueHead: { flexDirection: "row", alignItems: "center", gap: 12 },
    continueIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    continueBody: { flex: 1, minWidth: 0, gap: 3 },
    continueKicker: { ...typography.meta, fontWeight: "700", color: colors.textMuted },
    continueTitle: { ...typography.hero, color: colors.text },
    continueFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    continueMeta: { ...typography.meta, color: colors.textMuted, flexShrink: 1 },
    continueCta: { ...typography.caption, fontWeight: "800", color: colors.primary },
    /* ④ 学习入口 2×2 */
    entrySection: { gap: 12 },
    entryGrid: { flexDirection: "row", gap: 12 },
    /* ⑤ 本周学习时长 */
    weekCard: { gap: 12 },
    weekHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
    weekTotal: { ...typography.num, color: colors.text },
    weekMeta: { ...typography.meta, color: colors.textMuted, flexShrink: 1, textAlign: "right" },
    weekEmpty: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 60 },
    weekEmptyIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    weekEmptyBody: { flex: 1, minWidth: 0, gap: 2 },
    weekEmptyTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    weekEmptyHint: { ...typography.meta, color: colors.textMuted },
    /* 学习架：标题 + 展开后的阶段列表，间距与 entrySection 一致（12） */
    shelfWrap: { gap: 12 },
    shelfContent: { gap: 12 },
    scroll: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: 16, gap: 12 },
    /* v9：今日专注 hero（stageCard：章节卡，保留品牌藏青影） */
    stageCard: {
      borderRadius: radius.xl,
      padding: 16,
      overflow: "hidden",
      minHeight: 104,
      backgroundColor: colors.primary,
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.16)",
      // v19-V3：品牌藏青影收进 token（原裸写 #14548D）
      ...shadows.brand,
    },
  /** v1.33.0：选中态不再用刺眼白边抢戏，把"主角感"交给流云光效；阴影略抬 */
  stageCardActive: { borderColor: "rgba(255,255,255,0.62)", shadowOpacity: 0.3 },
  stageCardBody: { flex: 1 },
  stageBlob: { position: "absolute", width: 160, height: 160, borderRadius: 80, right: -46, top: -56, opacity: 0.34 },
  /** 顶部高光：给纯色卡面一点"玻璃边缘"的层次（静态，不参与动画） */
  stageTopLight: { position: "absolute", top: 0, left: 18, right: 18, height: 2, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)" },
  /** 流云光效三层：全部低透明度叠层 + 缓慢运动/变色（Android 无 blur，这是通用"柔光"做法） */
  auraHaloTop: { position: "absolute", top: -76, left: -34, borderRadius: radius.pill },
  auraHaloBottom: { position: "absolute", bottom: -64, right: -46, borderRadius: radius.pill },
  auraCloud: { position: "absolute", bottom: -30, left: 0, height: 78, borderRadius: radius.pill },
  stageTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  stageTag: { color: "rgba(255,255,255,0.9)", ...typography.micro, fontWeight: "800", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  stageName: { color: "#fff", ...typography.headline, fontWeight: "800", flex: 1 },
  stageActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  stageActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  stageDesc: { color: "rgba(255,255,255,0.85)", ...typography.caption, marginTop: 6 },
  stageBar: { height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)", marginTop: 12, overflow: "hidden" },
  stageBarFill: { height: "100%", borderRadius: 999 },

  statsEntry: { flexDirection: "row", alignItems: "center", gap: 12 },
  statsEntryBody: { flex: 1, minWidth: 0, gap: 2 },
  statsEntryTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
  statsEntrySub: { ...typography.caption, fontWeight: "500", color: colors.textMuted },

  formSheet: { gap: 12, paddingTop: 4 },
  /* v6 P3-1：空态引导 */
  emptyCard: { gap: 10 },
  emptyTitle: { ...typography.body, fontWeight: "800", color: colors.text },
  emptyHint: { ...typography.caption, lineHeight: 18, color: colors.textMuted },
  emptyActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  emptyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
  },
  emptyActionText: { ...typography.caption, fontWeight: "800", color: colors.primary },
  /* v6 P3-2：MD 导入 */
  mdHint: { ...typography.caption, lineHeight: 18, color: colors.textMuted },
  mdInput: {
    minHeight: 180,
    maxHeight: 300,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...typography.caption,
    lineHeight: 19,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    textAlignVertical: "top",
  },
  mdMsg: { ...typography.caption, color: colors.danger },
  mdPreview: { gap: 6, padding: 10, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  mdPreviewTitle: { ...typography.caption, fontWeight: "800", color: colors.primary },
  mdPreviewPhase: { gap: 2 },
  mdPreviewPhaseTitle: { ...typography.caption, fontWeight: "700", color: colors.text },
  mdPreviewTopic: { ...typography.caption, color: colors.textMuted },
  formInput: {
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    ...typography.callout,
  },
  formInputArea: { minHeight: 84, textAlignVertical: "top" },

  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(30,24,12,0.42)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 24,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  modalHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  modalDot: { width: 10, height: 10, borderRadius: 5 },
  modalTitle: { color: colors.text, fontSize: 19, fontWeight: "900", flex: 1 },
  modalSub: { color: colors.textMuted, ...typography.caption, lineHeight: 19, marginBottom: 14 },
  modalListTitle: { color: colors.text, ...typography.caption, fontWeight: "800", marginTop: 6, marginBottom: 8 },
  modalRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  modalRowText: {
    ...typography.callout,
    color: colors.text,
    flex: 1,
  },
  modalClose: { marginLeft: "auto", padding: 4 },
  deleteTopicBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
  },
  deleteTopicText: { color: "#D64545", ...typography.caption, fontWeight: "800" }});