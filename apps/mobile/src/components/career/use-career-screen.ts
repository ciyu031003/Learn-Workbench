import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { router } from "expo-router";

import { useHeaderTopInset, useLargeTitleHeader } from "@/components/screen-header";
import type { ToastKind } from "@/components/toast";
import { apiGetJson } from "@/lib/api-request";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/theme";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { INITIAL_FIRST_LOAD_GATE, nextFirstLoadGate, shouldShowSkeleton } from "@/lib/first-load";
import { enrollJobGaps, fetchJobPlan, fetchJobStats } from "@/lib/jobs";
import { haptics } from "@/lib/haptics";
import { friendlyError } from "@/lib/friendly-error";
import type { CareerReadiness, JobStats, UserSkillView } from "@learn-workbench/shared/schemas";

import { makeStyles } from "./career-styles";
import {
  ACTIVE_APPLICATION_STAGES,
  APPLICATION_STAGES,
  RADAR_FETCH_LIMIT,
  buildAnalysisRows,
  buildApplicationFunnel,
  buildDeadlines,
  buildDimensions,
  buildGapSkillItems,
  buildMoreRows,
  buildPrepRows,
  buildSubtitle,
  countGapSkills,
  formatWeakestChip,
  pickWeakest,
  resolveApplicationStateText,
  resolveGoalVerdict,
  resolveHighMatchCount,
  resolveStageIndex,
  sumGapHours,
  uniqueGapSkillNames,
  type RadarSummary,
} from "./career-model";

/**
 * 职业页的取数 / 副作用 / 派生值 / 回调（从 app/(tabs)/career.tsx 整段切片）。
 *
 * 零行为变更：hook 调用顺序、effect 时序、请求与缓存逻辑、惰性默认值全部与拆分前逐行一致；
 * 视图层只消费这里返回的页面模型（显式 props 传给 components/career/ 下的区块组件）。
 */
export function useCareerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const headerTop = useHeaderTopInset("hero");
  const careerScrollRef = useRef<Animated.ScrollView>(null);
  useScrollToTopHandler("/career", careerScrollRef);
  const entrance = useScreenEntrance();
  const token = useAppStore((s) => s.token);

  const [readiness, setReadiness] = useState<CareerReadiness | null>(null);
  const [skills, setSkills] = useState<UserSkillView[]>([]);
  const [gate, setGate] = useState(INITIAL_FIRST_LOAD_GATE);
  const showSkeleton = shouldShowSkeleton(gate);
  const [todayNewJobs, setTodayNewJobs] = useState<number | null>(null);
  const [appStats, setAppStats] = useState<Record<string, number> | null>(null);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [radar, setRadar] = useState<RadarSummary | null>(null);
  /** 换号/退出时丢弃上一账号还在飞的请求，避免旧准备度/投递数短暂串号。 */
  const loadSeq = useRef(0);
  /** P3：技能差距 → 学习任务（唯一写操作）的进行中状态 + 结果提示 */
  const [gapEnrolling, setGapEnrolling] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);
  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    setToast({ message, kind });
  }, []);

  const loadCareer = useCallback(async (reset = false) => {
    const seq = ++loadSeq.current;
    if (reset) {
      setReadiness(null);
      setSkills([]);
      setTodayNewJobs(null);
      setAppStats(null);
      setJobStats(null);
      setRadar(null);
      setGate(INITIAL_FIRST_LOAD_GATE);
    }
    try {
      // P5：统一走 apiGetJson（不抛异常、Bearer 由请求层注入、错误按 network/auth/client/server 分类）
      const [readinessRes, skillsRes, jobsRes, applicationsRes, statsRes, radarRes] = await Promise.all([
        apiGetJson<CareerReadiness>("/api/profile/readiness", { token }),
        apiGetJson<{ skills?: UserSkillView[] }>("/api/profile/skills", { token }),
        apiGetJson<{ total?: unknown }>("/api/jobs?publishedWithin=today&pageSize=1", { token }),
        token ? apiGetJson<{ stats?: Record<string, number> }>("/api/jobs/applications", { token }) : Promise.resolve(null),
        fetchJobStats().catch(() => null),
        apiGetJson<RadarSummary>("/api/jobs/radar?limit=" + RADAR_FETCH_LIMIT, { token }),
      ]);
      if (seq !== loadSeq.current) return;
      if (readinessRes.ok && readinessRes.data) {
        setReadiness(readinessRes.data);
        setGate((g) => nextFirstLoadGate(g, { type: "load-success" }));
      }
      if (skillsRes.ok && Array.isArray(skillsRes.data?.skills)) {
        setSkills(skillsRes.data?.skills ?? []);
      }
      if (jobsRes.ok) {
        const total = Number(jobsRes.data?.total);
        setTodayNewJobs(Number.isFinite(total) ? total : null);
      }
      if (applicationsRes?.ok) {
        const stats = applicationsRes.data?.stats;
        if (stats && typeof stats === "object") setAppStats(stats);
      }
      if (statsRes) setJobStats(statsRes);
      if (radarRes.ok && radarRes.data && typeof radarRes.data.hasProfile === "boolean") {
        setRadar(radarRes.data);
      }
    } catch {
      if (seq === loadSeq.current) setGate((g) => nextFirstLoadGate(g, { type: "load-failure" }));
    } finally {
      if (seq === loadSeq.current) setGate((g) => nextFirstLoadGate(g, { type: "load-failure" }));
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load / account switch reset
    void loadCareer(true);
  }, [loadCareer]);

  const { control: careerRefresh } = usePullRefresh(loadCareer, { stickyHeader: true });

  const overall = readiness?.overall ?? 0;
  const hasTarget = Boolean(readiness && readiness.targetRole.trim());
  const targetRole = readiness?.targetRole?.trim() || "未设置目标方向";
  const goalVerdict = resolveGoalVerdict(overall);

  const dimensions = useMemo(() => buildDimensions(readiness), [readiness]);

  const weakest = pickWeakest(dimensions);
  const weakestChip = formatWeakestChip(weakest);
  const weakStrong = weakest.score >= 100 ? colors.success : colors.warning;
  const weakSoft = weakest.score >= 100 ? colors.successSoft : colors.warningSoft;
  const resumeScore = dimensions.find((item) => item.key === "resume")?.score ?? 0;
  const interviewDetail = dimensions.find((item) => item.key === "interview")?.detail ?? "";
  const matchedJobs = readiness?.matchedJobs ?? 0;

  const activeApplications = useMemo(() => {
    if (!appStats) return null;
    return ACTIVE_APPLICATION_STAGES.reduce((sum, stage) => sum + (Number(appStats[stage]) || 0), 0);
  }, [appStats]);
  const currentStageLabel = APPLICATION_STAGES[resolveStageIndex(appStats)];
  const applicationStateText = resolveApplicationStateText(appStats, activeApplications, currentStageLabel);

  /** 投递漏斗：submittedCount 同时是占比条的分母基数（与拆分前一致） */
  const { submittedCount, stages: funnelStages } = buildApplicationFunnel(appStats);

  const gapSkills = countGapSkills(skills);
  const gapSkillItems = useMemo(
    () => buildGapSkillItems(skills, { danger: colors.danger, warning: colors.warning }),
    [skills, colors]
  );

  const todayCount = jobStats?.todayNew ?? todayNewJobs;
  /**
   * P3 修正：原实现读 radar.buckets.highMatch —— 该字段在 /api/jobs/radar 的返回里不存在
   * （实际是 counts.matched + top[]），导致"高匹配"长期显示「待匹配」。
   * 这里改为读 counts.matched，缺失时回退到 top 长度。
   *
   * radarTop 用 useMemo 固定引用：它同时是 deadlines（useMemo）与 handleEnrollGaps（useCallback）
   * 的依赖，裸表达式每次渲染都是新数组（react-hooks/exhaustive-deps 会告警，且缓存失效）。
   * 取值逻辑与拆分前完全一致，只稳定引用。
   */
  const radarTop = useMemo(() => radar?.top ?? [], [radar]);
  const highMatchCount = resolveHighMatchCount(radar);

  const deadlines = useMemo(() => buildDeadlines(radarTop), [radarTop]);

  const gapSkillNames = uniqueGapSkillNames(radarTop);
  const gapHoursTotal = sumGapHours(radarTop);

  /**
   * 一键生成学习任务：挑缺口最多的岗位 → 服务端算 plan（含 topicId/estimateHours）
   * → enrollJobGaps 写入今日任务。这条动线是「职业 → 学习」的唯一闭环，失败要明确提示。
   */
  const handleEnrollGaps = useCallback(async () => {
    if (gapEnrolling) return;
    if (!token) {
      router.push("/login" as never);
      return;
    }
    const target = radarTop
      .slice()
      .sort((a, b) => (b.missingSkills?.length ?? 0) - (a.missingSkills?.length ?? 0))[0];
    if (!target) {
      showToast("暂无可以补齐的岗位差距，先去岗位雷达看看", "info");
      return;
    }
    setGapEnrolling(true);
    try {
      const plan = await fetchJobPlan(target.jobId);
      const created = await enrollJobGaps(plan.gaps ?? []);
      if (created > 0) {
        haptics.success();
        showToast("已生成 " + created + " 个学习任务到今日计划", "success");
      } else {
        showToast("该岗位暂无可补齐的差距", "info");
      }
      void loadCareer(false);
    } catch (e) {
      haptics.error();
      showToast(friendlyError(e, "生成学习任务失败"), "error");
    } finally {
      setGapEnrolling(false);
    }
  }, [gapEnrolling, token, radarTop, showToast, loadCareer]);

  const subtitle = buildSubtitle(todayCount, highMatchCount);

  const prepRows = buildPrepRows({ interviewDetail, resumeScore });
  const moreRows = buildMoreRows({ applicationStateText, activeApplications, matchedJobs, jobStats });
  const analysisRows = buildAnalysisRows();

  return {
    /* 框架 */
    styles,
    headerScroll,
    headerTop,
    tabBarSpace,
    careerScrollRef,
    careerRefresh,
    entrance,
    /* 页头 + hero */
    subtitle,
    hasTarget,
    todayCount,
    highMatchCount,
    /* 下一步（决策区） */
    gapSkills,
    gapHoursTotal,
    gapSkillNames,
    deadlines,
    gapEnrolling,
    handleEnrollGaps,
    /* 求职准备（准备度卡 + 维度 + 投递漏斗） */
    hasReadiness: readiness !== null,
    showSkeleton,
    targetRole,
    overall,
    goalVerdict,
    dimensions,
    weakestScore: weakest.score,
    weakestChip,
    weakStrong,
    weakSoft,
    showFunnel: appStats !== null,
    activeApplications,
    submittedCount,
    funnelStages,
    /* 能力雷达 */
    /* 行列表 */
    prepRows,
    moreRows,
    analysisRows,
    /* 我的技能 + 待补技能 */
    skills,
    gapSkillItems,
    /* 结果提示 */
    toast,
    setToast,
  };
}
