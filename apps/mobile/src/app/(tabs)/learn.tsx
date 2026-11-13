/* eslint-disable react-hooks/immutability */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHeaderTopInset } from "@/components/screen-header";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { GroupLabel } from "@/components/group-label";
import { ListGroup, ListRow } from "@/components/list-row";
import { Surface } from "@/components/surface";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { LearningShelfHeader } from "@/components/learning-entry-cards";
import { PageHead } from "@/components/v2/page-head";
import { SectionTitle } from "@/components/v2/section-title";
import { HeroCard, Panel, PrimaryButton } from "@/components/v2/home-kit";
import { ProgressBar } from "@/components/v2/progress-bar";
import { AreaChart } from "@/components/v2/charts";

import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
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
import { withAlpha } from "@/lib/chart-math";
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
import { friendlyError } from "@/lib/friendly-error";

/** 阶段卡之间的间距，必须与 `styles.shelfContent` 的 gap 一致（拖拽让位的位移量按"实测高度 + 这个值"算） */
const STAGE_CARD_GAP = 12;
const DAILY_QUESTION_GOAL = 20;
/** 近 7 天面积图/轴的星期标签（getDay() 下标：0 = 周日） */
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/** 阅读卡片用的标题查表（找不到就退回 key，界面不会出现空白行） */
function readingTitle(trackSlug: string, stageKey: string, topicKey: string): string {
  const track = getLearningTrackNow(trackSlug);
  const stage = track?.stages.find((entry) => entry.key === stageKey);
  const topic = stage?.topics.find((entry) => entry.key === topicKey);
  return topic?.title ?? topicKey;
}

/** 紧凑时长（8h 12m / 70m）：只做展示格式，不改任何统计口径 */
function compactDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return h > 0 ? h + "h " + m + "m" : m + "m";
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
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const percent = progressInfo.total > 0 ? pct(progressInfo.done, progressInfo.total) : 0;

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
          // 目标下标：把"被拖卡片的中心"换算成落在哪张卡的中线上（按实测高度累加，长标题也不会错位）。
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
   * 拖拽表现（全部在 UI 线程）：被拖的卡片跟手 + 轻微放大 + 浮到兄弟卡片之上
   * （Android 同 elevation 按子视图顺序绘制，所以必须同时抬 zIndex 与 elevation）；
   * 其它卡片在被拖卡片越过的区间里实时让位。
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
      elevation: isDragged ? 18 : 0,
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
        style={[styles.stageRowWrap, cardStyle]}
        onLayout={(e) => onMeasure(index, e.nativeEvent.layout.height)}
      >
        <PressableScale
          haptic
          scaleTo={0.99}
          onPress={onSelect}
          style={[styles.stageRow, active && styles.stageRowActive]}
          accessibilityRole="button"
          accessibilityLabel={
            "阶段 " + (index + 1) + "，" + phase.title + "，已完成 " + progressInfo.done + "/" + progressInfo.total + " 个主题，打开详情"
          }
        >
          <View style={[styles.stageRowBadge, active && styles.stageRowBadgeActive]}>
            <Text style={[styles.stageRowBadgeText, active && styles.stageRowBadgeTextActive]}>{"P" + (index + 1)}</Text>
          </View>
          <View style={styles.stageRowBody}>
            <Text style={styles.stageRowTitle} numberOfLines={1}>{phase.title}</Text>
            <Text style={styles.stageRowMeta} numberOfLines={1}>
              {(phase.weeks ?? "周期未设置") + " · " + progressInfo.done + "/" + progressInfo.total + " 主题 · " + percent + "%"}
            </Text>
            <ProgressBar value={percent / 100} height={4} style={styles.stageRowBar} />
          </View>
          <View style={styles.stageRowSide}>
            <Pressable
              hitSlop={8}
              style={styles.stageRowIconBtn}
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel={"编辑阶段 " + phase.title}
            >
              <ThemedIcon name="create-outline" ios="square.and.pencil" size={15} color={colors.textMuted} />
            </Pressable>
            <Pressable
              hitSlop={8}
              style={styles.stageRowIconBtn}
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel={"删除阶段 " + phase.title}
            >
              <ThemedIcon name="trash-outline" size={15} color={colors.textMuted} />
            </Pressable>
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
      setMdMsg(friendlyError(e, "解析失败"));
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
      setMdMsg(friendlyError(e, "导入失败"));
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
  const [reviewStats, setReviewStats] = useState<{
    due: number;
    wrong: number;
    total: number;
    mastered: number;
    /** 远端复习排期是否真的拿到了（false = 离线/未登录，到期数要显示「—」而不是 0） */
    remoteOk: boolean;
  } | null>(null);
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
          total: remote?.totalCount ?? 0,
          mastered: remote?.masteredCount ?? 0,
          remoteOk: remote !== null,
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
  /**
   * ⑤ 数据洞察（近 7 天）：总时长 / 较前 7 天对比 / 日均 / 逐日面积图，
   * 口径全部来自 focus-stats（与今日页同一份 last14），不新增接口。
   */
  const last7 = stats.last14.slice(-7);
  const weekTotal = last7.reduce((sum, day) => sum + day.minutes, 0);
  const prevWeekTotal = stats.last14.slice(0, 7).reduce((sum, day) => sum + day.minutes, 0);
  const focusDelta = weekTotal - prevWeekTotal;
  const focusDeltaPercent = prevWeekTotal > 0 ? Math.round((focusDelta / prevWeekTotal) * 100) : null;
  const avgDailyMinutes = Math.round(weekTotal / 7);
  const last7Minutes = last7.map((day) => day.minutes);
  const last7Labels = last7.map((day) => WEEKDAY_LABELS[new Date(day.date + "T00:00:00").getDay()]);
  const insightDeltaText =
    weekTotal === 0
      ? "还没有专注数据"
      : prevWeekTotal === 0
        ? "前 7 天还没有专注记录"
        : focusDelta === 0
          ? "与前 7 天持平"
          : "较前 7 天 " + (focusDelta > 0 ? "+" : "") + focusDelta + " 分钟";
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
  /** 当前阶段：轨道 / 百分比 / 页头副文案全部从这名阶段派生（没有阶段时走空态文案） */
  const currentPhaseIndex = selectedPhase ? roadmap.findIndex((phase) => phase.id === selectedPhase.id) : -1;
  const currentPhaseNumber = currentPhaseIndex >= 0 ? currentPhaseIndex + 1 : 1;
  const currentPhaseProgress = selectedPhase ? phaseDone(selectedPhase) : { done: 0, total: 0 };
  const currentPhasePercent =
    currentPhaseProgress.total > 0 ? pct(currentPhaseProgress.done, currentPhaseProgress.total) : null;
  const trackLabels = roadmap.map((_, index) => "P" + (index + 1));
  const trackCurrent = currentPhaseIndex >= 0 ? currentPhaseIndex : 0;
  const stageName = selectedPhase
    ? "P" + currentPhaseNumber + " · " + selectedPhase.title
    : "还没有学习阶段";
  const headSub = selectedPhase
    ? "P" + currentPhaseNumber + " · " + selectedPhase.title
    : "还没有学习阶段，先建一条路线或导入 Markdown 开始。";
  const openCurrentPhase = () => {
    if (selectedPhase) router.push(("/phase/" + selectedPhase.id) as never);
    else router.push("/roadmap" as never);
  };
  const currentPhaseA11y = selectedPhase
    ? "当前阶段 P" + currentPhaseNumber + " " + selectedPhase.title + "，已完成 " + currentPhaseProgress.done + "/" + currentPhaseProgress.total + " 个主题，打开阶段详情"
    : "还没有学习阶段，打开阶段路线";
  const questionCount = allLearningQuestions.length;
  const practiceAccuracy =
    learningSummary.attempted > 0 ? pct(learningSummary.correct, learningSummary.attempted) : null;
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
            Alert.alert("删除失败", friendlyError(e, "本机已移除，联网后会重试或对齐"));
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
      Alert.alert(editingPhase ? "保存失败" : "创建失败", friendlyError(e, "请稍后重试"));
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
      meta: routeSummary.total > 0 ? "从阶段路线按顺序推进" : "还没有学习阶段，先建一条路线或导入 Markdown",
      progress: null,
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
      {/* ① 页头：eyebrow + 主标题 + 副文案；右上保留「阶段路线 / 全局搜索」两个入口 */}
      <Animated.View style={styles.headRow} entering={entrance(0)}>
        <PageHead
          eyebrow="学习 · 网络与安全"
          title="学习"
          subtitle={headSub}
          style={styles.headText}
        />
        <View style={styles.headActions}>
          <PressableScale
            hitSlop={8}
            scaleTo={0.92}
            style={styles.headIconBtn}
            onPress={() => router.push("/roadmap" as never)}
            accessibilityRole="button"
            accessibilityLabel="打开阶段路线"
          >
            <ThemedIcon name="git-branch-outline" size={18} color={colors.textMuted} />
          </PressableScale>
          <PressableScale
            hitSlop={8}
            scaleTo={0.92}
            style={styles.headIconBtn}
            onPress={() => router.push("/search" as never)}
            accessibilityRole="button"
            accessibilityLabel="全局搜索"
          >
            <ThemedIcon name="search" size={18} color={colors.textMuted} />
          </PressableScale>
        </View>
      </Animated.View>

      {/* ② 学习 hero（对齐 demo .spotlight）：阶段 chip + 路线名 + 进度 + 继续学习 + 唯一主 CTA */}
      <Animated.View entering={entrance(1)}>
        {roadmapLoading ? null : roadmap.length > 0 ? (
          <Panel spotlight style={styles.routeCard}>
            <View style={styles.routeTop}>
              <Text style={styles.routeChip}>{"当前阶段 · P" + currentPhaseNumber}</Text>
              <PressableScale
                hitSlop={10}
                scaleTo={0.94}
                onPress={() => router.push("/roadmap" as never)}
                style={styles.routeLink}
                accessibilityRole="button"
                accessibilityLabel="查看完整路线"
              >
                <Text style={styles.routeLinkText}>完整路线</Text>
                <ThemedIcon name="chevron-forward" size={13} color={colors.primary} />
              </PressableScale>
            </View>
            <Text style={styles.routeTitle} numberOfLines={2}>{stageName}</Text>
            <Text style={styles.routeMeta}>
              {routeSummary.total > 0
                ? "已完成 " + routeSummary.done + " / " + routeSummary.total + " 个主题"
                : "还没有主题，先添加一个"}
            </Text>
            <View style={styles.routeProgressMeta}>
              <Text style={styles.routeProgressLabel}>阶段进度</Text>
              <Text style={[styles.routeProgressValue, tabularNums]}>
                {currentPhasePercent === null ? "—" : currentPhasePercent + "%"}
              </Text>
            </View>
            <ProgressBar value={(currentPhasePercent ?? 0) / 100} height={6} />

            <PressableScale
              haptic
              scaleTo={0.99}
              hitSlop={4}
              style={styles.routeContinue}
              onPress={continueCard.onPress}
              accessibilityRole="button"
              accessibilityLabel={continueCard.a11y}
            >
              <View style={[styles.routeContinueIcon, { backgroundColor: withAlpha(continueCard.color, 0.14) }]}>
                <ThemedIcon
                  name={continueCard.icon}
                  ios={continueCard.icon === "star" ? "star.fill" : undefined}
                  size={19}
                  color={continueCard.color}
                />
              </View>
              <View style={styles.routeContinueCopy}>
                <Text style={styles.routeContinueTitle} numberOfLines={2}>{continueCard.title}</Text>
                <Text style={styles.routeContinueMeta} numberOfLines={1}>{continueCard.meta}</Text>
              </View>
            </PressableScale>

            <PrimaryButton label="继续学习" icon="play" onPress={continueCard.onPress} style={styles.routeCta} />
          </Panel>
        ) : (
          <HeroCard
            eyebrow="学习起点"
            eyebrowIcon="layers-outline"
            title="先创建你的学习路线"
            copy="把目标拆成阶段与主题，每次学习都知道下一步。"
            ctaLabel="创建学习路线"
            ctaIcon="add"
            onCta={() => router.push("/roadmap" as never)}
          />
        )}
      </Animated.View>

      {/* ④ 数据洞察卡（提案 .chart-card）：近 7 天总时长 + 较前 7 天对比 + 面积图 + 三格 KPI */}
      <Animated.View entering={entrance(3)}>
        <SectionTitle
          title="数据洞察"
          actionLabel="学习统计"
          onAction={() => router.push("/study-stats" as never)}
          style={styles.sectionTitle}
        />
        <Surface tier="surface" style={styles.insightCard}>
          <View
            style={styles.insightTop}
            accessible
            accessibilityLabel={
              "近 7 天专注总时长 " + formatDuration(weekTotal) + "，今日 " + formatDuration(todayMinutes) + "，" + insightDeltaText
            }
          >
            <View style={styles.insightTopText}>
              <Text style={styles.insightLab}>专注总时长</Text>
              <Text style={[styles.insightBig, tabularNums]}>{weekTotal > 0 ? compactDuration(weekTotal) : "—"}</Text>
              <Text style={styles.insightDelta}>{insightDeltaText}</Text>
            </View>
            {focusDeltaPercent !== null && focusDelta !== 0 ? (
              <View
                style={[
                  styles.deltaPill,
                  { backgroundColor: focusDelta > 0 ? colors.successSoft : colors.dangerSoft },
                ]}
              >
                <ThemedIcon
                  name={focusDelta > 0 ? "chevron-up" : "chevron-down"}
                  size={12}
                  color={focusDelta > 0 ? colors.success : colors.danger}
                />
                <Text
                  style={[
                    styles.deltaPillText,
                    { color: focusDelta > 0 ? colors.success : colors.danger },
                  ]}
                >
                  {Math.abs(focusDeltaPercent) + "%"}
                </Text>
              </View>
            ) : null}
          </View>

          {weekTotal > 0 ? (
            <AreaChart
              series={[{ values: last7Minutes }]}
              labels={last7Labels}
              height={92}
              showEndDot={false}
              legend={false}
              style={styles.insightChart}
            />
          ) : (
            <View style={styles.insightEmpty}>
              <ThemedIcon name="stats-chart-outline" size={18} color={colors.textMuted} />
              <Text style={styles.insightEmptyText}>完成一次专注后这里会出现趋势</Text>
            </View>
          )}

          <View
            style={styles.kpis}
            accessible
            accessibilityLabel={
              "日均专注 " + compactDuration(avgDailyMinutes) + "，计划完成率 " +
              (routeSummary.total > 0 ? routeSummary.percent + "%" : "暂无数据") +
              "，连续学习 " + stats.streak + " 天"
            }
          >
            <View style={[styles.kpi, styles.kpiFirst]}>
              <Text style={[styles.kpiValue, tabularNums]}>{weekTotal > 0 ? compactDuration(avgDailyMinutes) : "—"}</Text>
              <Text style={styles.kpiLabel}>日均专注</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={[styles.kpiValue, tabularNums]}>
                {routeSummary.total > 0 && routeSummary.percent > 0 ? routeSummary.percent + "%" : routeSummary.total > 0 ? "尚未开始" : "—"}
              </Text>
              <Text style={styles.kpiLabel}>计划完成率</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={[styles.kpiValue, tabularNums]}>{stats.streak > 0 ? stats.streak + " 天" : "—"}</Text>
              <Text style={styles.kpiLabel}>连续学习</Text>
            </View>
          </View>

          <View style={styles.insightFoot}>
            <Text style={styles.insightFootText}>近 7 天 · 单位分钟</Text>
            <Text style={styles.insightFootText}>{"今日 " + formatDuration(todayMinutes)}</Text>
          </View>
        </Surface>
      </Animated.View>

      {/* ⑤ 复习与题库（提案 .review / .list）：到期大数字 + 开始复习 CTA + 三行入口 */}
      <Animated.View entering={entrance(4)}>
        <SectionTitle
          title="复习与题库"
          right={<Text style={styles.sectionMeta}>记忆曲线排期</Text>}
          style={styles.sectionTitle}
        />
        <Surface tier="surface" style={styles.reviewCard}>
          <Text
            style={[styles.reviewNum, tabularNums]}
            accessible
            accessibilityLabel={
              !reviewStats
                ? "待复习知识点暂未加载"
                : reviewStats.remoteOk
                  ? "待复习 " + reviewStats.due + " 个知识点，错题 " + reviewStats.wrong + " 道"
                  : "到期排期需联网刷新，本地错题 " + reviewStats.wrong + " 道"
            }
          >
            {reviewStats && reviewStats.remoteOk && reviewStats.due > 0 ? reviewStats.due : "—"}
          </Text>
          <View style={styles.reviewBody}>
            <Text style={styles.reviewTitle}>待复习知识点</Text>
            <Text style={styles.reviewSub} numberOfLines={2}>
              {reviewStats
                ? reviewStats.remoteOk
                  ? reviewStats.total > 0
                    ? "共 " + reviewStats.total + " 个知识点在排期 · 已掌握 " + reviewStats.mastered + " 个"
                    : "错题 " + reviewStats.wrong + " 道 · 按记忆曲线排期"
                  : "错题 " + reviewStats.wrong + " 道 · 到期排期需联网刷新"
                : "登录后可查看记忆曲线排期"}
            </Text>
          </View>
          <PressableScale
            haptic
            scaleTo={0.97}
            hitSlop={6}
            style={styles.reviewCta}
            onPress={() => router.push("/quiz/review" as never)}
            accessibilityRole="button"
            accessibilityLabel={
              reviewStats && reviewStats.remoteOk
                ? "开始复习，已到期 " + reviewStats.due + " 题，错题 " + reviewStats.wrong + " 道"
                : "开始复习"
            }
          >
            <Text style={styles.reviewCtaText}>开始复习</Text>
          </PressableScale>
        </Surface>

        <ListGroup style={styles.questionList}>
          <ListRow
            icon="help-circle-outline"
            title="技术题库"
            subtitle={learningSummary.today > 0 ? "今日 " + learningSummary.today + "/" + DAILY_QUESTION_GOAL + " 题 · 继续刷题" : "今天还没开始 · 每日目标 " + DAILY_QUESTION_GOAL + " 题"}
            value={questionCount > 0 ? questionCount + " 题" : "—"}
            showChevron
            onPress={() => router.push("/quiz" as never)}
            accessibilityLabel={
              "打开技术题库，共 " + questionCount + " 题，今日已练 " + learningSummary.today + " 题"
            }
          />
          <ListRow
            icon="trophy"
            iconBg={colors.accentSoft}
            iconColor={colors.accent}
            title="408 考研专区"
            subtitle={
              exam408ChapterCount > 0
                ? exam408ChapterCount + " 章 · " + exam408PointCount + " 知识点"
                : "章节题库 · 精读 / 演示 / 刷卡"
            }
            value={exam408ChapterCount > 0 ? exam408ChapterCount + " 章" : "—"}
            showChevron
            onPress={() => router.push("/exam-408" as never)}
            accessibilityLabel="打开 408 考研专区"
          />
          {/* App 暂无独立的「练习记录」页：这一行只做信息展示（正确率来自本地作答记录），不做假跳转 */}
          <ListRow
            icon="stats-chart-outline"
            title="练习记录"
            subtitle={
              learningSummary.attempted > 0
                ? "累计 " + learningSummary.attempted + " 题 · 错题 " + learningSummary.wrong + " 道"
                : "还没有作答记录，去题库练一组"
            }
            value={practiceAccuracy === null ? "—" : "正确率 " + practiceAccuracy + "%"}
            last
          />
        </ListGroup>
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
                <PressableScale
                  haptic
                  scaleTo={0.98}
                  hitSlop={6}
                  style={styles.emptyPrimaryCta}
                  onPress={() => router.push("/domain-manager" as never)}
                  accessibilityRole="button"
                  accessibilityLabel="创建学习路线"
                >
                  <ThemedIcon name="layers-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyPrimaryText}>创建学习路线</Text>
                  <ThemedIcon name="chevron-forward" size={14} color="rgba(255,255,255,0.72)" />
                </PressableScale>
                <View style={styles.emptyActions}>
                  <PressableScale
                    haptic
                    hitSlop={6}
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
                    hitSlop={6}
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
                    hitSlop={6}
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
                  onSelect={() => router.push(("/phase/" + phase.id) as never)}
                  onMove={swapPhase}
                  onDelete={() => removePhase(phase)}
                  onEdit={() => openEditPhase(phase)}
                  dragIndex={stageDragIndex}
                  dragTarget={stageDragTarget}
                  dragY={stageDragY}
                  heights={stageHeights}
                  onMeasure={measureStage}
                  onDragChange={onStageDragChange}
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
                    <ThemedIcon name="trash-outline" size={15} color={colors.danger} />
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
    routeCard: { marginBottom: 14 },
    routeTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    routeChip: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.primaryStrong,
      backgroundColor: colors.primarySoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
      overflow: "hidden",
    },
    routeLink: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 36 },
    routeLinkText: { ...typography.meta, fontWeight: "700", color: colors.primary },
    routeTitle: { fontSize: 21, lineHeight: 28, fontWeight: "700", letterSpacing: -0.4, color: colors.text, marginTop: 10 },
    routeMeta: { ...typography.meta, color: colors.textMeta, marginTop: 5 },
    routeProgressMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 13, marginBottom: 8 },
    routeProgressLabel: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
    routeProgressValue: { ...typography.caption, fontWeight: "700", color: colors.primary },
    routeContinue: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      marginTop: 15,
      padding: 13,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    routeContinueIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    routeContinueCopy: { flex: 1, minWidth: 0 },
    routeContinueTitle: { ...typography.caption, fontWeight: "700", color: colors.text, lineHeight: 19 },
    routeContinueMeta: { ...typography.micro, color: colors.textMeta, marginTop: 3 },
    routeCta: { marginTop: 14 },

    scroll: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: 18, gap: 14 },

    /* ① 页头 + 右上两个入口（阶段路线 / 全局搜索） */
    headRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    headText: { flex: 1, minWidth: 0 },
    headActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22 },
    headIconBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },

    /* ② 当前阶段卡（提案 .stage-card） */
    stagePress: { borderRadius: radius.panel },
    stageCard: { gap: 0 },
    stageTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
    stageTopText: { flex: 1, minWidth: 0, gap: 2 },
    stageLab: { ...typography.meta, color: colors.textMuted },
    stageName: { ...typography.callout, fontWeight: "700", color: colors.text },
    stagePctRow: { flexDirection: "row", alignItems: "baseline" },
    stagePct: { ...typography.title2, color: colors.text },
    stagePctUnit: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
    stageTrack: { marginTop: 17, marginHorizontal: 2 },
    stageFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    stageFootText: { ...typography.meta, color: colors.textMuted, flexShrink: 1 },
    stageFootNum: { ...typography.meta, fontWeight: "700", color: colors.textSecondary },

    /* ③ 继续学习卡（提案 .continue） */
    continuePress: { borderRadius: radius.card },
    continueCard: { flexDirection: "row", alignItems: "center", gap: 12 },
    continueThumb: {
      width: 54,
      height: 54,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
    },
    continueBody: { flex: 1, minWidth: 0, gap: 2 },
    continueKicker: { ...typography.micro, fontWeight: "700", color: colors.primary },
    continueTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    continueMeta: { ...typography.meta, color: colors.textMuted },
    continueBar: { marginTop: 6 },
    continuePlay: {
      minHeight: 34,
      paddingHorizontal: 10,
      borderRadius: 17,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      backgroundColor: colors.primary,
      ...shadows.brand,
    },
    continuePlayText: { ...typography.micro, fontWeight: "700", color: colors.surfaceStrong },

    /* ④ 数据洞察卡（提案 .chart-card） */
    sectionTitle: { marginTop: 2, marginBottom: 11 },
    sectionMeta: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    insightCard: { gap: 0 },
    insightTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
    insightTopText: { flex: 1, minWidth: 0 },
    insightLab: { ...typography.meta, color: colors.textMuted },
    insightBig: { ...typography.title2, color: colors.text, marginTop: 3 },
    insightDelta: { ...typography.meta, color: colors.textMuted, marginTop: 2 },
    deltaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
    },
    deltaPillText: { ...typography.micro, fontWeight: "700" },
    insightChart: { marginTop: 8 },
    insightEmpty: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 16 },
    insightEmptyText: { ...typography.meta, color: colors.textMuted, flex: 1, minWidth: 0, lineHeight: 17 },
    kpis: {
      flexDirection: "row",
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    kpi: {
      flex: 1,
      minWidth: 0,
      gap: 2,
      paddingLeft: 12,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
    },
    kpiFirst: { paddingLeft: 0, borderLeftWidth: 0 },
    kpiValue: { ...typography.callout, fontWeight: "700", color: colors.text },
    kpiLabel: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    insightFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 10,
    },
    insightFootText: { ...typography.micro, fontWeight: "500", color: colors.textMuted },

    /* ⑤ 复习与题库（提案 .review / .list / .row） */
    reviewCard: { flexDirection: "row", alignItems: "center", gap: 13 },
    reviewNum: { ...typography.display, color: colors.text },
    reviewBody: { flex: 1, minWidth: 0, gap: 2 },
    reviewTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    reviewSub: { ...typography.meta, color: colors.textMuted },
    reviewCta: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: withAlpha(colors.primary, 0.2),
    },
    reviewCtaText: { ...typography.caption, fontWeight: "700", color: colors.primary },
    questionList: { marginTop: 12 },

    /* 学习架：折叠头来自共享组件；展开后是阶段行 + 管理组 */
    shelfWrap: { gap: 12 },
    shelfContent: { gap: 12 },

    /* 阶段行（长按拖拽排序；编辑/删除沿用既有弹层与确认） */
    stageRowWrap: {
      borderRadius: radius.card,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      overflow: "hidden",
      ...shadows.card,
    },
    stageRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      minHeight: 64,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    stageRowActive: { backgroundColor: colors.primarySoft },
    stageRowBadge: {
      width: 34,
      height: 34,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    stageRowBadgeActive: { backgroundColor: colors.primary },
    stageRowBadgeText: { ...typography.micro, fontWeight: "700", color: colors.textMuted },
    stageRowBadgeTextActive: { color: colors.surfaceStrong },
    stageRowBody: { flex: 1, minWidth: 0, gap: 3 },
    stageRowTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    stageRowMeta: { ...typography.meta, color: colors.textMuted },
    stageRowBar: { marginTop: 3 },
    stageRowSide: { flexDirection: "row", alignItems: "center", gap: 2 },
    stageRowIconBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
    },

    /* 空态 / 表单 / 弹层：沿用既有功能，只把裸写色值收回 token */
    emptyCard: { gap: 10 },
    emptyTitle: { ...typography.body, fontWeight: "800", color: colors.text },
    emptyHint: { ...typography.caption, lineHeight: 18, color: colors.textMuted },
    hiddenSection: { display: "none" },
    emptyPrimaryCta: {
      minHeight: 50,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      ...shadows.brand,
    },
    emptyPrimaryText: { ...typography.callout, fontWeight: "700", color: "#FFFFFF" },
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
    formSheet: { gap: 12, paddingTop: 4 },
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
      backgroundColor: colors.scrim,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: colors.surfaceStrong,
      borderRadius: radius.panel,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    modalHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    modalDot: { width: 10, height: 10, borderRadius: 5 },
    modalTitle: { color: colors.text, ...typography.hero, flex: 1 },
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
    deleteTopicText: { color: colors.danger, ...typography.caption, fontWeight: "800" },
  });
