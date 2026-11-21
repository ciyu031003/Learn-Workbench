/* eslint-disable react-hooks/immutability -- 阶段卡拖拽的共享值在 JS 侧复位/驱动（与 pressable-scale.tsx 同约定） */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSharedValue } from "react-native-reanimated";

import { useHeaderTopInset } from "@/components/screen-header";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/theme";
import { useReducedMotion } from "@/lib/motion";
import { isMotionActive } from "@/theme/motion";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { pct } from "@learn-workbench/shared/dates";
import type { Phase } from "@learn-workbench/shared/schemas";
import { mainPhases } from "@learn-workbench/content/roadmap";
import { getLearningTrackNow, useLearningTrack, useLearningTracks } from "@/lib/content-store";
import { setNavPendingParams } from "@/lib/nav-pending";
import { computeFocusStats } from "@/lib/focus-stats";
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

import { WEEKDAY_LABELS, readingTitle } from "./learn-widgets";
import { makeStyles } from "./learn-styles";

/**
 * 学习页「继续学习」卡的展示模型（三态之一：读到一半 / 收藏的章节 / 还没开始）。
 * 只含展示字段与一个跳转回调，逻辑全部在本 hook 内派生。
 */
export type LearnContinueCard = {
  icon: "book-outline" | "star" | "git-branch-outline";
  color: string;
  kicker: string;
  title: string;
  meta: string;
  progress: number | null;
  cta: string;
  a11y: string;
  onPress: () => void;
};

/** 章节树节点状态：完成（绿）/ 在读（蓝，带光晕）/ 未开始（灰） */
export type LearnChapterState = "done" | "now" | "todo";
/** 节点下的知识点小圆点：已完成实心绿 / 当前蓝 / 其余灰 */
export type LearnChapterPointState = "done" | "current" | "todo";

/**
 * 章节树节点（一个节点 = 当前阶段的一个主题）。
 *
 * 数据边界：roadmap 主题只有「主题级」完成态（progress[topicId].done），
 * 没有逐知识点的完成度。所以小圆点按「练习 + 验收」条数派生数量，
 * 状态只表达主题级进度（完成全绿 / 在读第一个蓝 / 未开始全灰），不伪造中间态。
 */
export type LearnChapterNode = {
  id: number;
  title: string;
  state: LearnChapterState;
  /** 一行 meta：已读完 / 在读 / 未开始 + 练习数（+ 知识点数） */
  meta: string;
  points: LearnChapterPointState[];
  a11y: string;
  /** 点击进阶段树（/phase/[id]） */
  onPress: () => void;
  /** 长按看主题详情（练习任务 + 阶段验收，弹层沿用既有 LearnTopicModal） */
  onOpenDetails: () => void;
};

/** 学习舱头部（eyebrow + 两行标题 + 环 + 说明 + chips + 通栏 CTA）的展示模型 */
export type LearnCabinModel = {
  eyebrow: string;
  /** 两行大标题：源标题里的「+」折成换行 + 「与」，与 demo 同断行 */
  title: string;
  ring: { done: number; total: number; percent: number };
  weeksChip: string;
  pointChip: string;
  percentChip: string;
  copy: string;
  ctaLabel: string;
  ctaA11y: string;
  onCta: () => void;
  onRingPress: () => void;
  ringA11y: string;
};

/**
 * 学习页的取数 / 副作用 / 派生值 / 回调（从 app/(tabs)/learn.tsx 整段切片）。
 *
 * 零行为变更：hook 调用顺序、effect 时序、请求与缓存逻辑、惰性默认值全部与拆分前逐行一致；
 * 视图层只消费这里返回的页面模型（显式 props 传给 components/learn/ 下的区块组件）。
 */
export function useLearnScreen() {
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
  const stageName = selectedPhase
    ? "P" + currentPhaseNumber + " · " + selectedPhase.title
    : "还没有学习阶段";
  const headSub = selectedPhase
    ? "P" + currentPhaseNumber + " · " + selectedPhase.title
    : "还没有学习阶段，先建一条路线或导入 Markdown 开始。";
  const questionCount = allLearningQuestions.length;
  const practiceAccuracy =
    learningSummary.attempted > 0 ? pct(learningSummary.correct, learningSummary.attempted) : null;
  const selectedCustomTopics = useMemo(
    () => customTopics.filter((t) => t.phaseId === selectedPhase?.id),
    [customTopics, selectedPhase?.id]
  );
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

  /**
   * 知识点详情（LearnTopicModal）的当前主题：先查当前阶段的 roadmap 主题（不再截断到 4 个），
   * 再查自建主题。章节树可以点到任意一个主题，详情弹层因此不再受旧「只取前 4 个」的限制。
   */
  const activeTopic = useMemo(() => {
    if (!contentTopic) return null;
    const topic = (selectedPhase?.topics ?? []).find((t) => t.id === contentTopic.topicId);
    if (topic) return topic;
    const customIndex = selectedCustomTopics.findIndex((t) => t.id === contentTopic.topicId);
    if (customIndex < 0) return null;
    const custom = selectedCustomTopics[customIndex];
    return {
      id: custom.id,
      topicKey: `lwb-custom-${customIndex}`,
      title: custom.title,
      summary: custom.summary,
      agentTask: null,
      sortOrder: 100000 + customIndex,
      resources: [],
      practices: [],
      projects: [],
      checkpoints: [],
      isCustomSubject: true,
    };
  }, [contentTopic, selectedPhase, selectedCustomTopics]);

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

  /* ==================================================================== *
   * v7 学习舱：头部 / 章节树 / 节律 / 管理的展示模型
   * 全部从既有数据派生（roadmap + progress + sessions + learningAttempts），不新增接口。
   * ==================================================================== */

  /** 当前阶段「知识点」数：主题下的练习 + 验收条数（roadmap 数据里可数的具体掌握点） */
  const phasePointCount = useMemo(
    () =>
      (selectedPhase?.topics ?? []).reduce(
        (total, topic) => total + (topic.practices?.length ?? 0) + (topic.checkpoints?.length ?? 0),
        0
      ),
    [selectedPhase]
  );

  /** 学习舱头部模型 */
  const cabin = useMemo<LearnCabinModel>(() => {
    const topics = selectedPhase?.topics ?? [];
    const done = topics.filter((topic) => progress[topic.id]?.done).length;
    const percent = topics.length > 0 ? pct(done, topics.length) : 0;
    const firstUndone = topics.findIndex((topic) => !progress[topic.id]?.done);
    /** 「第 N 节」= 第一个还没完成的主题（全完成时停在 1，按钮文案不会变成 0） */
    const sectionNumber = firstUndone >= 0 ? firstUndone + 1 : 1;
    /** 没有阶段时用 demo 的静态兜底标题（纯装饰文案，不顶替真实数据） */
    const rawTitle = selectedPhase?.title?.trim() || "学习机制 + Agent 启蒙";
    return {
      eyebrow: selectedPhase ? "LEARNING CABIN · P" + currentPhaseNumber : "LEARNING CABIN",
      title: rawTitle.replace(/\s*\+\s*/g, "\n与 "),
      ring: { done, total: topics.length, percent },
      weeksChip: selectedPhase?.weeks?.trim() || "周期未定",
      pointChip: phasePointCount + " 知识点",
      percentChip: "已完成 " + percent + "%",
      copy: selectedPhase?.summary?.trim() || "从「怎么学」开始：理解学习机制，再把重复动作交给 Agent。",
      ctaLabel: "继续学习 · 第 " + sectionNumber + " 节",
      ctaA11y: "继续学习，从第 " + sectionNumber + " 节开始",
      onCta: continueCard.onPress,
      onRingPress: () => router.push("/roadmap" as never),
      ringA11y:
        "当前阶段已完成 " + done + " / " + topics.length + " 个主题，打开阶段路线",
    };
  }, [selectedPhase, progress, currentPhaseNumber, phasePointCount, continueCard]);

  /** 章节树节点：当前阶段的主题（roadmap） + 本阶段自建主题 */
  const chapterNodes = useMemo<LearnChapterNode[]>(() => {
    const phaseId = selectedPhase?.id ?? 0;
    const topics = selectedPhase?.topics ?? [];
    const firstUndone = topics.findIndex((topic) => !progress[topic.id]?.done);
    const nodes: LearnChapterNode[] = topics.map((topic, index) => {
      const isDone = Boolean(progress[topic.id]?.done);
      const state: LearnChapterState = isDone ? "done" : index === firstUndone ? "now" : "todo";
      const practiceCount = topic.practices?.length ?? 0;
      const pointTotal = practiceCount + (topic.checkpoints?.length ?? 0);
      const points: LearnChapterPointState[] = [];
      for (let i = 0; i < Math.min(6, pointTotal); i += 1) {
        points.push(isDone ? "done" : state === "now" && i === 0 ? "current" : "todo");
      }
      const meta =
        state === "done"
          ? "已读完 · " + practiceCount + " 道练习"
          : state === "now"
            ? "在读 · " + practiceCount + " 道练习" + (pointTotal > 0 ? " · " + pointTotal + " 知识点" : "")
            : "未开始 · " + practiceCount + " 道练习";
      return {
        id: topic.id,
        title: topic.title,
        state,
        meta,
        points,
        a11y: "主题 " + (index + 1) + "，" + topic.title + "，" + meta + "，打开阶段树",
        onPress: () => router.push(("/phase/" + phaseId) as never),
        onOpenDetails: () => setContentTopic({ topicId: topic.id, phaseId }),
      };
    });
    selectedCustomTopics.forEach((topic, index) => {
      nodes.push({
        id: topic.id,
        title: topic.title,
        state: progress[topic.id]?.done ? "done" : "todo",
        meta: "自建主题" + (topic.summary ? " · " + topic.summary : ""),
        points: [],
        a11y: "自建主题 " + (index + 1) + "，" + topic.title + "，打开阶段树",
        onPress: () => router.push(("/phase/" + phaseId) as never),
        onOpenDetails: () => setContentTopic({ topicId: topic.id, phaseId }),
      });
    });
    return nodes;
  }, [selectedPhase, progress, selectedCustomTopics]);

  /** 章节树右上的 meta：N 主题 · M 知识点 */
  const chapterMeta = (selectedPhase?.topics?.length ?? 0) + " 主题 · " + phasePointCount + " 知识点";

  /** 学习节律的星期标签：真实周几 + 今天用「今」（demo 同款） */
  const rhythmLabels = useMemo(
    () => last7Labels.map((label, index) => (index === last7Labels.length - 1 ? "今" : label)),
    [last7Labels]
  );

  /** 管理入口（沿用既有弹层：新建阶段 / 导入 Markdown） */
  const openCreatePhase = useCallback(() => {
    setEditingPhase(null);
    setCustomPhaseTitle("");
    setCustomPhaseSummary("");
    setCustomPhaseSheet(true);
  }, []);

  const openImportMd = useCallback(() => {
    setMdText("");
    setMdPreview(null);
    setMdMsg(null);
    setMdSheet(true);
  }, []);

  /** 页面模型：派生数据 + 状态 + 回调，交给 learn.tsx 与各区块组件显式接收。 */
  return {
    colors,
    styles,
    headerTop,
    tabBarSpace,
    learnScrollRef,
    learnRefresh,
    motionActive,
    entrance,
    stageDragging,
    /* ① 页头 */
    headSub,
    /* ② 学习 hero */
    roadmapLoading,
    roadmap,
    currentPhaseNumber,
    stageName,
    routeSummary,
    currentPhasePercent,
    continueCard,
    /* ④ 数据洞察 */
    weekTotal,
    todayMinutes,
    insightDeltaText,
    focusDelta,
    focusDeltaPercent,
    last7Minutes,
    last7Labels,
    avgDailyMinutes,
    streak: stats.streak,
    /* ⑤ 复习与题库 */
    reviewStats,
    learningSummary,
    questionCount,
    exam408ChapterCount,
    exam408PointCount,
    practiceAccuracy,
    /* v7 学习舱：头部 / 章节树 / 学习节律 的展示模型 */
    cabin,
    chapterNodes,
    chapterMeta,
    phasePointCount,
    rhythmLabels,
    openCreatePhase,
    openImportMd,
    /* ⑥ 学习架（默认折叠）与管理入口 */
    shelfOpen,
    setShelfOpen,
    selectedPhase,
    selectedPhaseId,
    phaseDone,
    swapPhase,
    removePhase,
    openEditPhase,
    stageDragIndex,
    stageDragTarget,
    stageDragY,
    stageHeights,
    measureStage,
    onStageDragChange,
    /* 弹层 */
    customTopicSheet,
    setCustomTopicSheet,
    customTopicTitle,
    setCustomTopicTitle,
    customTopicSummary,
    setCustomTopicSummary,
    submitCustomTopic,
    customPhaseSheet,
    setCustomPhaseSheet,
    editingPhase,
    setEditingPhase,
    customPhaseTitle,
    setCustomPhaseTitle,
    customPhaseSummary,
    setCustomPhaseSummary,
    submitCustomPhase,
    mdSheet,
    setMdSheet,
    mdText,
    setMdText,
    setMdPreview,
    setMdMsg,
    mdPreview,
    mdBusy,
    mdMsg,
    previewMd,
    confirmMd,
    contentTopic,
    setContentTopic,
    activeTopic,
    removeCustomTopic,
  };
}
