/* eslint-disable react-hooks/immutability */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHeaderTopInset } from "@/components/screen-header";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { Card } from "@/components/card";
import { GroupLabel } from "@/components/group-label";
import { ListGroup, ListRow } from "@/components/list-row";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { LearningEntryCards, LearningShelfHeader } from "@/components/learning-entry-cards";

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
import { learningTracks, mainPhases } from "@learn-workbench/content";
import type { Phase } from "@learn-workbench/shared";
import { formatDuration, pct } from "@learn-workbench/shared";
import { computeFocusStats } from "@/lib/focus-stats";
import { radius, shadows, typography } from "@/theme/tokens";
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
import { loadLearningAttempts, summarizeLearningAttempts, type LearningAttempt } from "@/lib/learning-progress";
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
const DAILY_QUESTION_GOAL = 12;
const ALL_LEARNING_QUESTIONS = learningTracks.flatMap((track) => track.questions);

/** 阅读卡片用的标题查表（找不到就退回 key，界面不会出现空白行） */
function readingTitle(trackSlug: string, stageKey: string, topicKey: string): string {
  const track = learningTracks.find((entry) => entry.slug === trackSlug);
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
              <Pressable
                hitSlop={6}
                style={styles.stageActionBtn}
                onPress={onEdit}
              >
                <ThemedIcon name="create-outline" size={14} color="rgba(255,255,255,0.92)" />
              </Pressable>
              <Pressable
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
  /** v1.26：右上角 ☰ 的快捷入口弹层 */
  const [quickOpen, setQuickOpen] = useState(false);
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
  const resume = readingStore ? continueReading(readingStore) : null;
  const readingCards = useMemo(() => {
    if (!readingStore) return [] as { key: string; label: string; title: string; trackSlug: string; stageKey: string; topicKey: string; favorite: boolean }[];
    const favoriteKeys = Object.keys(readingStore.favorites);
    const items = favoriteKeys.slice(0, 3).map((key) => {
      const item = readingStore.favorites[key];
      const track = learningTracks.find((entry) => entry.slug === item.trackSlug);
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

  /** 入口卡只用这几个数；统计明细全部搬到 /study-stats 全屏页（v1.33.0） */
  const stats = useMemo(() => computeFocusStats(sessions), [sessions]);
  const learningSummary = useMemo(
    () => summarizeLearningAttempts(learningAttempts, ALL_LEARNING_QUESTIONS),
    [learningAttempts]
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

  return (
    <ScrollView
      ref={learnScrollRef}
      refreshControl={<RefreshControl {...learnRefresh} />}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!stageDragging}
    >
      <Animated.View style={styles.hero} entering={entrance(0)}>
        <Text style={styles.heroTitle}>学习</Text>
        <Text style={styles.heroSub}>技术题库 · 阶段路线 · 统计 · 日志</Text>
        {/* v1.26：快捷入口收进右上角三条横线 */}
        <Pressable
          hitSlop={10}
          style={styles.heroMenuBtn}
          onPress={() => setQuickOpen(true)}
          accessibilityLabel="快捷入口"
          accessibilityRole="button"
        >
          <ThemedIcon name="menu" size={22} color={colors.text} />
        </Pressable>
      </Animated.View>

      <Animated.View entering={entrance(1)}>
        <LearningEntryCards
          todayQuestions={learningSummary.today}
          todayGoal={DAILY_QUESTION_GOAL}
          routePercent={routeSummary.percent}
          routeDone={routeSummary.done}
          routeTotal={routeSummary.total}
        />
      </Animated.View>

      {resume || readingCards.length > 0 ? (
        <Animated.View entering={entrance(2)} style={styles.readingWrap}>
          <GroupLabel>阅读</GroupLabel>
          <Card style={styles.readingCard}>
            {resume ? (
              <PressableScale
                haptic
                scaleTo={0.98}
                style={styles.readingRow}
                accessibilityRole="button"
                accessibilityLabel={`继续学习 ${resume.topicKey}`}
                onPress={() =>
                  router.push({
                    pathname: "/quiz/read",
                    params: { track: resume.trackSlug, stage: resume.stageKey, topic: resume.topicKey },
                  } as never)
                }
              >
                <View style={styles.readingIcon}>
                  <ThemedIcon name="book-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.readingBody}>
                  <Text style={styles.readingLabel}>继续学习</Text>
                  <Text style={styles.readingTitle} numberOfLines={1}>
                    {readingTitle(resume.trackSlug, resume.stageKey, resume.topicKey)}
                  </Text>
                  <Text style={styles.readingMeta}>读到 {resume.progress}%</Text>
                </View>
                <ThemedIcon name="chevron-forward" size={16} color={colors.textMuted} />
              </PressableScale>
            ) : null}
            {readingCards.map((item) => (
              <PressableScale
                key={item.key}
                haptic
                scaleTo={0.98}
                style={styles.readingRow}
                accessibilityRole="button"
                accessibilityLabel={`收藏 ${item.title}`}
                onPress={() =>
                  router.push({
                    pathname: "/quiz/read",
                    params: { track: item.trackSlug, stage: item.stageKey, topic: item.topicKey },
                  } as never)
                }
              >
                <View style={styles.readingIcon}>
                  <ThemedIcon name="star" size={18} color={colors.warning} />
                </View>
                <View style={styles.readingBody}>
                  <Text style={styles.readingLabel}>收藏</Text>
                  <Text style={styles.readingTitle} numberOfLines={1}>{item.title}</Text>
                </View>
                <ThemedIcon name="chevron-forward" size={16} color={colors.textMuted} />
              </PressableScale>
            ))}
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View entering={entrance(2)} style={styles.shelfWrap}>
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
            <View style={styles.shelfActions}>
              <Pressable
                hitSlop={8}
                style={styles.addBtn}
                onPress={() => {
                  setEditingPhase(null);
                  setCustomPhaseTitle("");
                  setCustomPhaseSummary("");
                  setCustomPhaseSheet(true);
                }}
              >
                <ThemedIcon name="add" size={16} color={colors.primary} />
                <Text style={styles.addBtnText}>添加阶段</Text>
              </Pressable>
              <Pressable hitSlop={8} style={styles.shelfLink} onPress={() => router.push("/roadmap" as never)}>
                <Text style={styles.shelfLinkText}>完整路线</Text>
                <ThemedIcon name="chevron-forward" size={14} color={colors.primary} />
              </Pressable>
            </View>

            {!roadmapLoading && roadmap.length === 0 ? (
              <Card style={styles.emptyCard}>
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
              </Card>
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
          </Animated.View>
        ) : null}
      </Animated.View>

      <Animated.View entering={entrance(3)}>
        <GroupLabel>学习统计</GroupLabel>
      </Animated.View>
      {/* v1.33.0：统计明细从弹层升级为**独立全屏页** /study-stats（push 进栈、原生转场、左滑返回）；首屏只留一行摘要 */}
      <Animated.View entering={entrance(4)}>
      <PressableScale haptic scaleTo={0.98} onPress={() => router.push("/study-stats" as never)}>
        <Card style={styles.statsEntry}>
          <View style={styles.statsEntryBody}>
            <Text style={styles.statsEntryTitle}>今日已专注 {formatDuration(todayMinutes)}</Text>
            <Text style={styles.statsEntrySub}>
              热力图 · 周期柱状 · 近 14 天趋势 · 连续 {stats.streak} 天
            </Text>
          </View>
          <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
        </Card>
      </PressableScale>
      </Animated.View>

      {/* v1.26：快捷入口改为右上角 ☰ 弹出 */}
      <BottomSheet
        visible={quickOpen}
        onClose={() => setQuickOpen(false)}
        title="快捷入口"
        subtitle="常用页面一步直达"
        icon="menu-outline"
        height="56%"
      >
        <SheetSection title="学习" last>
          <ListGroup>
            {(
              [
                { key: "tasks", label: "今日任务", desc: "勾选今天要完成的事", icon: "list-outline", href: "/tasks" },
                { key: "logs", label: "学习日志", desc: "记录今天学了什么", icon: "create-outline", href: "/logs" },
                { key: "trackers", label: "领域记录", desc: "通用计量与按日打卡", icon: "stats-chart-outline", href: "/trackers" },
                { key: "stats", label: "学习统计", desc: "热力图 · 内容维度 · 分享闪光卡", icon: "stats-chart-outline", href: "" },
              ] as const
            ).map((q, i, list) => (
              <ListRow
                key={q.key}
                icon={q.icon}
                title={q.label}
                subtitle={q.desc}
                showChevron
                last={i === list.length - 1}
                onPress={() => {
                  setQuickOpen(false);
                  router.push((q.key === "stats" ? "/study-stats" : q.href) as never);
                }}
              />
            ))}
          </ListGroup>
        </SheetSection>
      </BottomSheet>

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
  scroll: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 16, gap: 12 },
  hero: { marginBottom: 8, paddingRight: 46 },
  heroMenuBtn: {
    position: "absolute",
    right: 0,
    top: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  heroTitle: {
    ...typography.display,
    color: colors.text,
  },
  heroSub: {
    ...typography.callout,
    // v18 对比度：callout(15pt) 属正文字号，textMuted 对白底仅约 3.0，低于 WCAG AA 4.5
    color: colors.textSecondary,
    marginTop: 4,
  },
  /* v9：今日专注 hero */
  focusHero: { padding: 16 },
  sectionTitle: {
    ...typography.title2,
    color: colors.text,
    marginTop: 8,
  },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(242,140,40,0.25)",
  },
  addBtnText: { color: colors.accentStrong, ...typography.caption, fontWeight: "800" },
  shelfWrap: { gap: 10 },
  readingWrap: { gap: 10 },
  readingCard: { padding: 0, overflow: "hidden" },
  readingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 60,
    paddingVertical: 10,
  },
  readingIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  readingBody: { flex: 1, minWidth: 0 },
  readingLabel: { ...typography.micro, color: colors.textMuted, fontWeight: "700" },
  readingTitle: { ...typography.body, color: colors.text, fontWeight: "700" },
  readingMeta: { ...typography.micro, color: colors.textSecondary },
  shelfContent: { gap: 12, paddingTop: 2 },
  shelfActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shelfLink: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 6, paddingHorizontal: 4 },
  shelfLinkText: { ...typography.caption, color: colors.primary, fontWeight: "700" },

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
