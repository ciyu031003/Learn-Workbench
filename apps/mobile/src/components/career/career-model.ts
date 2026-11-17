import type { Ionicons } from "@expo/vector-icons";
import { formatRelativeTime } from "@learn-workbench/shared/dates";
import type { CareerReadiness, JobStats, ReadinessDimension, UserSkillView } from "@learn-workbench/shared/schemas";

import type { ThemeColors } from "@/theme/tokens";

import type { CareerDeadlineItem } from "./career-decision-cards";

/**
 * 职业页纯数据层（从 app/(tabs)/career.tsx 搬出）：常量、行规格、以及
 * CareerReadiness / 投递漏斗 / 技能差距 / 岗位雷达的纯派生函数。
 *
 * 纪律：这里只有「输入 → 输出」的纯函数，不引用 React、不读 store、不发请求；
 * 取数与副作用全部在 use-career-screen.ts。函数体与拆分前逐行一致（含三元的先后顺序），
 * 保证文案、单位、兜底值、无障碍标签都不变。
 */

export const RADAR_FETCH_LIMIT = 200;

export const ACTIVE_APPLICATION_STAGES = [
  "favorite",
  "ready",
  "applied",
  "online_test",
  "interview1",
  "interview2",
] as const;

export const APPLICATION_STAGES = ["已投递", "筛选", "笔试", "面试", "Offer"] as const;

export const DIMENSION_LABELS: Record<ReadinessDimension["key"], string> = {
  skill: "专业基础",
  project: "项目经验",
  resume: "证书技能",
  interview: "面试表达",
};
export const DIMENSION_KEYS: ReadinessDimension["key"][] = ["skill", "project", "resume", "interview"];
export const DIMENSION_AXIS_LABELS: Record<ReadinessDimension["key"], string> = {
  skill: "基础",
  project: "项目",
  resume: "证书",
  interview: "面试",
};

export type ToolTone = "primary" | "teal" | "success" | "accent";
export const TOOL_TONES: Record<ToolTone, { soft: keyof ThemeColors; strong: keyof ThemeColors }> = {
  primary: { soft: "primarySoft", strong: "primary" },
  teal: { soft: "surfaceMuted", strong: "teal" },
  success: { soft: "successSoft", strong: "success" },
  accent: { soft: "accentSoft", strong: "accent" },
};

export const SKILL_GAP_LEVEL = 3;

/** 岗位雷达响应（与 apps/web/app/api/jobs/radar 的实际返回一致：hasProfile / counts / top） */
export interface RadarJobLite {
  jobId: number;
  title: string;
  company: string;
  deadlineLabel: string | null;
  gapHours?: number;
  missingSkills?: { skill: string }[];
}

export interface RadarSummary {
  hasProfile: boolean;
  total?: number;
  counts?: { candidates?: number; matched?: number; favorites?: number; applications?: number };
  top?: RadarJobLite[];
}

/** 一行入口（求职工具 / 更多入口 / 分析工具的公共规格） */
export interface EntryRowSpec {
  key: string;
  title: string;
  subtitle?: string;
  end?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: ToolTone;
  href: string;
  accessibilityLabel: string;
}

/** 准备度四维（DIMENSION_KEYS 顺序固定，缺项补 0） */
export interface CareerDimension {
  key: ReadinessDimension["key"];
  label: string;
  score: number;
  detail: string;
}

/** 投递漏斗一级 */
export interface CareerFunnelStage {
  key: string;
  label: string;
  count: number | null;
}

/** 「待补技能」一条（BarList 的入参形状） */
export interface CareerSkillGapItem {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  hint: string;
  color: string;
}

export function resolveStageIndex(stats: Record<string, number> | null): number {
  if (!stats) return 0;
  const count = (key: string) => Number(stats[key]) || 0;
  if (count("offer") + count("hired") > 0) return 4;
  if (count("interview1") + count("interview2") > 0) return 3;
  if (count("online_test") > 0) return 2;
  if (count("applied") > 0) return 1;
  return 0;
}

export function countStages(appStats: Record<string, number> | null, keys: string[]): number | null {
  if (!appStats) return null;
  return keys.reduce((sum, key) => sum + (Number(appStats[key]) || 0), 0);
}

/**
 * 投递漏斗：submittedCount 同时是四个阶段占比条的分母基数。
 * 与拆分前一致：先算 submittedCount，再按阶段累计（阶段是「累计到该阶段」而不是单一阶段）。
 */
export function buildApplicationFunnel(appStats: Record<string, number> | null): {
  submittedCount: number | null;
  stages: CareerFunnelStage[];
} {
  const submittedCount = countStages(appStats, ["applied", "online_test", "interview1", "interview2", "offer", "hired", "closed"]);
  const stages: CareerFunnelStage[] = [
    { key: "applied", label: "已投递", count: submittedCount },
    { key: "test", label: "笔试", count: countStages(appStats, ["online_test", "interview1", "interview2", "offer", "hired", "closed"]) },
    { key: "interview", label: "面试", count: countStages(appStats, ["interview1", "interview2", "offer", "hired", "closed"]) },
    { key: "offer", label: "Offer", count: countStages(appStats, ["offer", "hired"]) },
  ];
  return { submittedCount, stages };
}

/** 投递状态一句话（「我的投递」行的副标题） */
export function resolveApplicationStateText(
  appStats: Record<string, number> | null,
  activeApplications: number | null,
  currentStageLabel: string
): string {
  return appStats === null
    ? "登录后可记录投递阶段"
    : activeApplications !== null && activeApplications > 0
      ? "进行中 " + activeApplications + " 个 · 当前 " + currentStageLabel
      : "还没有投递记录 · 先去招花挑岗位";
}

export function buildDimensions(readiness: CareerReadiness | null): CareerDimension[] {
  return DIMENSION_KEYS.map((key) => {
    const found = readiness?.dimensions.find((item) => item.key === key);
    return { key, label: DIMENSION_LABELS[key], score: found?.score ?? 0, detail: found?.detail ?? "" };
  });
}

export function pickWeakest(dimensions: CareerDimension[]): CareerDimension {
  return dimensions.reduce((min, item) => (item.score < min.score ? item : min), dimensions[0]);
}

export function formatWeakestChip(weakest: CareerDimension): string {
  return weakest.score >= 100 ? "四维已达标 · 保持节奏" : "优先补齐 · " + weakest.label + " " + weakest.score + "%";
}

export function resolveGoalVerdict(overall: number): string {
  return overall >= 80
    ? "准备充分，可以直接投递"
    : overall >= 55
      ? "接近达标，补一补短板"
      : overall > 0
        ? "还在积累，先补技能与项目"
        : "登录并记录技能 / 项目后显示";
}

/** 简历四类资产还缺几类（每 25% 一类，向下取整后从 4 减） */
export function countResumeMissingKinds(resumeScore: number): number {
  return Math.max(0, 4 - Math.round(resumeScore / 25));
}

export function countGapSkills(skills: UserSkillView[]): number {
  return skills.filter((skill) => skill.level < SKILL_GAP_LEVEL).length;
}

/** 待补技能（低于 Lv3，按等级升序、同级按名称；最多 5 条） */
export function buildGapSkillItems(
  skills: UserSkillView[],
  tones: { danger: string; warning: string }
): CareerSkillGapItem[] {
  return skills
    .filter((skill) => skill.level < SKILL_GAP_LEVEL)
    .slice()
    .sort((a, b) => (a.level !== b.level ? a.level - b.level : a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .slice(0, 5)
    .map((skill) => ({
      key: String(skill.id),
      label: skill.name,
      value: SKILL_GAP_LEVEL - skill.level,
      valueLabel: "Lv " + skill.level,
      hint: skill.category,
      color: skill.level <= 0 ? tones.danger : tones.warning,
    }));
}

/** 高匹配岗位数：读 counts.matched，缺失时回退 top 长度；未设置画像时 null（显示「—」） */
export function resolveHighMatchCount(radar: RadarSummary | null): number | null {
  const radarTop = radar?.top ?? [];
  return radar?.hasProfile ? radar.counts?.matched ?? radarTop.length : null;
}

/** 即将截止：取最近 3 个带截止文案的岗位（deadlineLabel 由服务端按天算好） */
export function buildDeadlines(radarTop: RadarJobLite[]): CareerDeadlineItem[] {
  return radarTop
    .filter((job) => Boolean(job.deadlineLabel))
    .slice(0, 3)
    .map((job) => ({
      key: String(job.jobId),
      title: job.title,
      company: job.company,
      deadlineLabel: job.deadlineLabel ?? "",
    }));
}

/** 技能差距聚合：优先用岗位缺口（radar.top 的 missingSkills/gapHours），回退到技能画像 */
export function uniqueGapSkillNames(radarTop: RadarJobLite[]): string[] {
  return radarTop
    .flatMap((job) => (job.missingSkills ?? []).map((item) => item.skill))
    .filter((skill, index, all) => all.indexOf(skill) === index)
    .slice(0, 3);
}

export function sumGapHours(radarTop: RadarJobLite[]): number {
  return Math.round(radarTop.reduce((sum, job) => sum + (job.gapHours ?? 0), 0));
}

/** 页头副文案（今日新增 / 高匹配） */
export function buildSubtitle(todayCount: number | null, highMatchCount: number | null): string {
  return todayCount !== null
    ? todayCount > 0
      ? "今日新增 " + todayCount + " 条岗位" + (highMatchCount !== null ? " · 高匹配 " + highMatchCount + " 条" : "")
      : "今天暂无新岗位，先补齐目标方向与求职准备。"
    : "岗位抓取、准备度与投递进度集中在这里。";
}

/** 「求职准备」三行：面试题库 / 简历与附件 / 证书 */
export function buildPrepRows({
  interviewDetail,
  resumeScore,
}: {
  interviewDetail: string;
  resumeScore: number;
}): EntryRowSpec[] {
  const resumeMissingKinds = countResumeMissingKinds(resumeScore);
  return [
    {
      key: "interview",
      title: "面试题库",
      subtitle: interviewDetail || "题库 · 模拟面试",
      end: "去练习",
      icon: "chatbubbles-outline",
      tone: "primary",
      href: "/interview",
      accessibilityLabel: "面试题库，打开面试页",
    },
    {
      key: "resume",
      title: "简历与附件",
      subtitle: resumeScore >= 100 ? "四类资产齐全" : "还缺 " + resumeMissingKinds + " 类资产",
      end: resumeScore + "%",
      icon: "document-text-outline",
      tone: "success",
      href: "/resume",
      accessibilityLabel: "简历与附件，完成度 " + resumeScore + "%，打开简历页",
    },
    {
      key: "certificates",
      title: "证书",
      subtitle: "证书 · 有效期提醒",
      end: "查看",
      icon: "ribbon-outline",
      tone: "teal",
      href: "/certificates",
      accessibilityLabel: "证书与有效期，打开证书页",
    },
  ];
}

/** 「更多入口」三行：我的投递 / 岗位雷达 / 岗位抓取记录 */
export function buildMoreRows({
  applicationStateText,
  activeApplications,
  matchedJobs,
  jobStats,
}: {
  applicationStateText: string;
  activeApplications: number | null;
  matchedJobs: number;
  jobStats: JobStats | null;
}): EntryRowSpec[] {
  return [
    {
      key: "applications",
      title: "我的投递",
      subtitle: applicationStateText,
      end: activeApplications !== null && activeApplications > 0 ? activeApplications + " 个" : "—",
      icon: "briefcase-outline",
      tone: "accent",
      href: "/applications",
      accessibilityLabel: "我的投递，" + applicationStateText + "，打开投递页",
    },
    {
      key: "radar",
      title: "岗位雷达",
      subtitle: "匹配度 · 城市 / 薪资筛选",
      end: matchedJobs > 0 ? matchedJobs + " 个" : "—",
      icon: "radio-outline",
      tone: "primary",
      href: "/radar",
      accessibilityLabel: "岗位雷达，打开匹配岗位页",
    },
    {
      key: "crawl",
      title: "岗位抓取记录",
      subtitle: jobStats ? "今日新增 " + jobStats.todayNew + " · " + jobStats.platformCount + " 个平台" : "抓取状态与岗位来源",
      end: jobStats?.lastRun ? formatRelativeTime(jobStats.lastRun) : "—",
      icon: "refresh",
      tone: "success",
      href: "/jobs",
      accessibilityLabel: "岗位抓取记录，打开招花",
    },
  ];
}

/**
 * P3 降级：市场分析从「更多入口」主列表移到独立的「分析工具（仅参考）」分组，
 * 不再与求职动线并列 —— 它是参考数据，不是下一步动作。
 */
export function buildAnalysisRows(): EntryRowSpec[] {
  return [
    {
      key: "market",
      title: "市场分析",
      subtitle: "城市 · 薪资 · 技能热度（参考）",
      end: "参考",
      icon: "trending-up-outline",
      tone: "teal",
      href: "/market",
      accessibilityLabel: "市场分析，打开市场页（参考数据）",
    },
  ];
}
