import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { router } from "expo-router";

import { useHeaderTopInset } from "@/components/screen-header";
import type { ToastKind } from "@/components/toast";
import { apiGetJson } from "@/lib/api-request";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/theme";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { enrollJobGaps, fetchJobPlan, fetchJobStats } from "@/lib/jobs";
import { haptics } from "@/lib/haptics";
import { friendlyError } from "@/lib/friendly-error";
import type { CareerReadiness, JobStats, UserSkillView } from "@learn-workbench/shared/schemas";

import { makeStyles } from "./career-styles";
import {
  ACTIVE_APPLICATION_STAGES,
  RADAR_FETCH_LIMIT,
  buildCareerFunnel,
  buildDeadlines,
  buildDecisionLog,
  buildDecisionRows,
  buildDimensions,
  buildDirection,
  buildGapBars,
  buildWeekActions,
  countGapSkills,
  resolveHighMatchCount,
  uniqueGapSkillNames,
  type RadarSummary,
} from "./career-model";

/**
 * 职业页的取数 / 副作用 / 派生值 / 回调。
 *
 * V7「决策工作台」重构后，页面不再消费「准备度四维 + 雷达图 + 技能标签墙」，
 * 但**数据接线一条没删**：仍然只请求 /api/profile/readiness、/api/profile/skills、
 * /api/jobs?publishedWithin=today、/api/jobs/applications、/api/jobs/stats、/api/jobs/radar，
 * 六个区块全部由这些真实响应派生（见 career-model 的 build* 纯函数）。
 *
 * 唯一写操作仍是「把技能缺口生成学习任务」（fetchJobPlan → enrollJobGaps），
 * 换号/退出时用 loadSeq 丢弃在飞的旧请求，避免串号。
 */
export function useCareerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tabBarSpace = useTabBarSpace();
  const headerTop = useHeaderTopInset("hero");
  const careerScrollRef = useRef<Animated.ScrollView>(null);
  useScrollToTopHandler("/career", careerScrollRef);
  const entrance = useScreenEntrance();
  const token = useAppStore((s) => s.token);

  const [readiness, setReadiness] = useState<CareerReadiness | null>(null);
  const [skills, setSkills] = useState<UserSkillView[]>([]);
  const [todayNewJobs, setTodayNewJobs] = useState<number | null>(null);
  const [appStats, setAppStats] = useState<Record<string, number> | null>(null);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [radar, setRadar] = useState<RadarSummary | null>(null);
  /** 换号/退出时丢弃上一账号还在飞的请求，避免旧准备度/投递数短暂串号。 */
  const loadSeq = useRef(0);
  /** 技能差距 → 学习任务（唯一写操作）的进行中状态 + 结果提示 */
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
    }
    try {
      // 统一走 apiGetJson（不抛异常、Bearer 由请求层注入、错误按 network/auth/client/server 分类）
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
      /* 各请求自带错误分类；下拉刷新只负责复位 loading */
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load / account switch reset
    void loadCareer(true);
  }, [loadCareer]);

  // 一级 Tab 没有吸顶栏（screen-header 对 tab root 返回 null），下拉刷新的偏移与 today 对齐
  const { control: careerRefresh } = usePullRefresh(loadCareer, { stickyHeader: false });

  /** radarTop 用 useMemo 固定引用：它同时是 deadlines / gapBars / handleEnrollGaps 的依赖 */
  const radarTop = useMemo(() => radar?.top ?? [], [radar]);
  const highMatchCount = resolveHighMatchCount(radar);
  const todayCount = jobStats?.todayNew ?? todayNewJobs;

  const dimensions = useMemo(() => buildDimensions(readiness), [readiness]);
  const resumeScore = dimensions.find((item) => item.key === "resume")?.score ?? 0;

  const activeApplications = useMemo(() => {
    if (!appStats) return null;
    return ACTIVE_APPLICATION_STAGES.reduce((sum, stage) => sum + (Number(appStats[stage]) || 0), 0);
  }, [appStats]);

  const deadlines = useMemo(() => buildDeadlines(radarTop), [radarTop]);
  const gapSkillNames = useMemo(() => uniqueGapSkillNames(radarTop), [radarTop]);
  const gapBars = useMemo(() => buildGapBars(skills, gapSkillNames), [skills, gapSkillNames]);
  const skillGapCount = countGapSkills(skills);
  const gapCount = skillGapCount > 0 ? skillGapCount : gapBars.length;
  /** 技能缺口预估时长：取匹配度最高那个岗位的 gapHours（不是全量求和，避免虚高） */
  const gapHours = Math.round(radarTop[0]?.gapHours ?? 0);

  const direction = useMemo(() => buildDirection({ radar, readiness, skills }), [radar, readiness, skills]);
  const decisionRows = useMemo(() => buildDecisionRows(radarTop), [radarTop]);
  const funnelRows = useMemo(() => buildCareerFunnel(appStats), [appStats]);

  const weekActions = useMemo(
    () =>
      buildWeekActions({
        matchedCount: highMatchCount,
        deadlines,
        gapBars,
        gapHours,
        resumeScore,
        hasReadiness: readiness !== null,
      }),
    [highMatchCount, deadlines, gapBars, gapHours, resumeScore, readiness]
  );

  const decisionLog = useMemo(
    () => buildDecisionLog(new Date(), direction.title),
    // 目标方向变了才重算日期文案（日期本身按天推，页面常驻时不追求零点刷新）
    [direction.title]
  );

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

  /**
   * 缺口 CTA：有真实缺口且已登录 → 走上面的写入动线；
   * 没有缺口时提示并直接把用户送到「今日任务」（不编造一个假任务）。
   */
  const handleGenerateGaps = useCallback(() => {
    if (gapEnrolling) return;
    if (!token) {
      router.push("/login" as never);
      return;
    }
    if (gapCount === 0) {
      showToast("技能画像里暂时没有缺口，先去今日任务继续学习", "info");
      router.push("/tasks" as never);
      return;
    }
    void handleEnrollGaps();
  }, [gapEnrolling, token, gapCount, showToast, handleEnrollGaps]);

  const matrixMeta =
    todayCount !== null && todayCount > 0 ? "今日新增 " + todayCount + " 条 · 按匹配度排序" : "按匹配度排序";
  const gapMeta = gapCount > 0 ? (gapHours > 0 ? "补齐约 " + gapHours + " 小时" : "待补 " + gapCount + " 项") : "技能画像暂无缺口";
  const funnelMeta = appStats === null ? "登录后记录投递" : "进行中 " + (activeApplications ?? 0) + " 个";

  return {
    /* 框架 */
    styles,
    headerTop,
    tabBarSpace,
    careerScrollRef,
    careerRefresh,
    entrance,
    /* ① 目标方向 */
    direction,
    /* ② 岗位决策矩阵 */
    decisionRows,
    matrixMeta,
    /* ③ 技能缺口 */
    gapBars,
    gapCount,
    gapMeta,
    gapEnrolling,
    handleGenerateGaps,
    /* ④ 投递漏斗 */
    funnelRows,
    hasApplications: appStats !== null,
    funnelMeta,
    /* ⑤ 本周行动 */
    weekActions,
    /* ⑥ 决策日志 */
    decisionLog,
    /* 结果提示 */
    toast,
    setToast,
  };
}
