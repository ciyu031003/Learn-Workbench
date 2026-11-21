import type { CareerReadiness, ReadinessDimension, UserSkillView } from "@learn-workbench/shared/schemas";

/**
 * 职业页纯数据层（V7 决策工作台）。
 *
 * 纪律：这里只有「输入 → 输出」的纯函数，不引用 React、不读 store、不发请求；
 * 取数与副作用全部在 use-career-screen.ts，视图只在 components/career/ 下。
 *
 * V7 重构后，页面从「岗位列表 + 准备度墙」改成 6 个决策区块：
 * 目标方向（NorthStar）/ 岗位决策矩阵 / 技能缺口 / 投递漏斗 / 本周行动 / 决策日志。
 * 所有展示值都从既有接口派生（radar counts+top、readiness、user skills、applications 汇总），
 * 没有数据的维度一律显示「—」，绝不用估算值或 mock 常量冒充真实数据；
 * 只有纯装饰性文案（决策日志的叙述、本周行动的标题）是静态的。
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

/** 技能画像是「补齐到 Lv3」为达标口径 */
export const SKILL_GAP_LEVEL = 3;

/** 岗位决策矩阵：高匹配 / 中匹配分档（与 radar 的 HIGH_MATCH_MIN=75 对齐） */
export const DECISION_MATCH_HIGH = 75;
export const DECISION_MATCH_MID = 65;

/** 目标方向的兜底文案（画像为空时；纯装饰，真实值优先） */
export const DIRECTION_FALLBACK_TITLE = "前端 / 全栈 · 乌鲁木齐";

/** 岗位雷达响应（与 apps/web/app/api/jobs/radar 的实际返回一致：hasProfile / counts / top） */
export interface RadarJobLite {
  jobId: number;
  title: string;
  company: string;
  deadlineLabel: string | null;
  gapHours?: number;
  missingSkills?: { skill: string }[];
  /** 以下字段由 /api/jobs/radar 的 top[] 真实返回（兜底路径可能缺省） */
  city?: string;
  salaryText?: string;
  salaryBand?: string;
  overall?: number;
  matchedSkills?: { skill: string }[];
}

export interface RadarSummary {
  hasProfile: boolean;
  total?: number;
  profileCity?: string | null;
  targetRole?: string | null;
  counts?: { candidates?: number; matched?: number; favorites?: number; applications?: number };
  top?: RadarJobLite[];
}

/** 即将截止的一条（服务端已按天算好 deadlineLabel） */
export interface CareerDeadlineItem {
  key: string;
  title: string;
  company: string;
  deadlineLabel: string;
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

/* ================= V7 · 决策工作台模型 ================= */

/** 目标方向卡里的一条细进度条 */
export interface CareerDirectionBar {
  key: string;
  label: string;
  /** 0..1，0 表示没有任何可比数据（条子空着，右侧显示「—」） */
  ratio: number;
  valueLabel: string;
}

/** ① 目标方向卡 */
export interface CareerDirection {
  title: string;
  hasTarget: boolean;
  /** 方向匹配度 0-100；没有任何可比数据时为 null（显示「—」） */
  fitScore: number | null;
  bars: CareerDirectionBar[];
  hint: string;
}

/** ② 岗位决策矩阵一行 */
export interface CareerDecisionRow {
  key: string;
  jobId: number;
  title: string;
  company: string;
  salary: string;
  match: number;
  matchTone: "hi" | "mid" | "lo";
  growth: { label: string; tone: "hi" | "mid" | "warn" };
  deadline: string;
}

/** ③ 技能缺口一条 */
export interface CareerGapBar {
  key: string;
  label: string;
  level: number;
  targetLevel: number;
  /** level / targetLevel，0..1 */
  ratio: number;
  valueLabel: string;
}

/** ④ 投递漏斗一级（V7：收藏 / 已投 / 笔试 / 面试 / Offer 五级） */
export interface CareerFunnelRow {
  key: string;
  label: string;
  count: number | null;
  /** 相对最大一级的占比 0-100（纯视觉） */
  widthPct: number;
  /** 相对上一级的转化率文案 */
  rateLabel: string;
}

/** ⑤ 本周行动一条 */
export interface CareerWeekAction {
  key: string;
  title: string;
  detail: string;
}

/** ⑥ 决策日志一条（一句话里有一段需要强调的实体） */
export interface CareerLogItem {
  key: string;
  date: string;
  prefix: string;
  highlight: string;
  suffix: string;
}

/* ================= 既有纯函数（保持原行为，单测锁定） ================= */

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

/* ================= V7 · 决策工作台的纯派生 ================= */

/** 截止文案压缩成矩阵里的短标签：「21 天后截止」→「21d」，「今日截止」→「今日」 */
export function formatDeadlineShort(label: string | null | undefined): string {
  const text = (label ?? "").trim();
  if (!text) return "—";
  const days = text.match(/(\d+)\s*天/);
  if (days) return days[1] + "d";
  if (text.includes("今日") || text.includes("今天")) return "今日";
  return text.replace(/截止$/, "");
}

/**
 * 薪资带 → 0..1 的匹配强度（纯视觉条宽度）。
 * 口径：取薪资区间上沿 / 16K（8–12K → 0.75，与 demo 的 74% 一致），20K 以上封顶。
 * 「面议」「薪资未知」等无数值文案返回 0。
 */
export function salaryBandRatio(value: string | null | undefined): number {
  const text = (value ?? "").trim();
  if (!text) return 0;
  const numbers = text.match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length === 0) return 0;
  const max = Math.max(...numbers.map((item) => Number(item)));
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(1, max / 16));
}

/** 匹配度 → 徽章档位：绿 ≥75 / 蓝 ≥65 / 灰 <65 */
export function resolveMatchTone(score: number): "hi" | "mid" | "lo" {
  if (!Number.isFinite(score)) return "lo";
  if (score >= DECISION_MATCH_HIGH) return "hi";
  if (score >= DECISION_MATCH_MID) return "mid";
  return "lo";
}

/**
 * ① 目标方向：标题由「目标岗位 · 城市」派生（radar 优先，其次 readiness），
 * 匹配度取 top 前 4 个岗位 overall 的均值（无岗位分时回落准备度），
 * 三条细进度条分别是「技能命中 / 薪资匹配 / 城市一致」。
 */
export function buildDirection({
  radar,
  readiness,
  skills,
}: {
  radar: RadarSummary | null;
  readiness: CareerReadiness | null;
  skills: UserSkillView[];
}): CareerDirection {
  const radarTarget = (radar?.targetRole ?? "").trim();
  const readinessTarget = (readiness?.targetRole ?? "").trim();
  const targetRole = radarTarget || readinessTarget;
  const city = (radar?.profileCity ?? "").trim();
  const title = [targetRole, city].filter(Boolean).join(" · ") || DIRECTION_FALLBACK_TITLE;
  const hasTarget = Boolean(radar?.hasProfile || readinessTarget);
  const top = radar?.top ?? [];

  const scored = top
    .slice(0, 4)
    .map((job) => (typeof job.overall === "number" ? job.overall : NaN))
    .filter((score) => Number.isFinite(score) && score > 0);
  const fitScore = hasTarget
    ? scored.length > 0
      ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length)
      : readiness
        ? Math.round(readiness.overall)
        : null
    : null;

  const lead = top[0];
  const matched = lead?.matchedSkills?.length ?? 0;
  const missing = lead?.missingSkills?.length ?? 0;
  let skillRatio = 0;
  let skillLabel = "—";
  if (matched + missing > 0) {
    skillRatio = matched / (matched + missing);
    skillLabel = matched + "/" + (matched + missing);
  } else if (skills.length > 0) {
    const hit = skills.filter((skill) => skill.level >= 2).length;
    skillRatio = hit / skills.length;
    skillLabel = hit + "/" + skills.length;
  }

  const salaryText = (lead?.salaryText || lead?.salaryBand || "").trim();
  const salaryRatio = salaryText ? salaryBandRatio(lead?.salaryBand || salaryText) : 0;

  const cityMatch = city && lead?.city ? lead.city === city : null;
  const hint = !hasTarget
    ? "先设置目标方向与期望城市，匹配度才有意义"
    : top.length === 0
      ? "暂无匹配岗位 · 去招花补齐岗位库"
      : "按前 " + Math.min(top.length, 4) + " 个匹配岗位估算";

  return {
    title,
    hasTarget,
    fitScore,
    hint,
    bars: [
      { key: "skill", label: "技能命中", ratio: skillRatio, valueLabel: skillLabel },
      { key: "salary", label: "薪资匹配", ratio: salaryRatio, valueLabel: salaryText || "—" },
      {
        key: "city",
        label: "城市一致",
        ratio: cityMatch === null ? 0 : cityMatch ? 1 : 0,
        valueLabel: cityMatch === null ? "—" : cityMatch ? "是" : "否",
      },
    ],
  };
}

/** ② 岗位决策矩阵：radar.top 前 4 个（服务端已按匹配度倒序） */
export function buildDecisionRows(radarTop: RadarJobLite[]): CareerDecisionRow[] {
  return radarTop.slice(0, 4).map((job) => {
    const score = typeof job.overall === "number" && Number.isFinite(job.overall) ? Math.round(job.overall) : 0;
    const gapCount = job.missingSkills?.length ?? 0;
    const growth: CareerDecisionRow["growth"] =
      gapCount >= 3 ? { label: "高", tone: "warn" } : gapCount >= 1 ? { label: "中", tone: "mid" } : { label: "稳", tone: "hi" };
    return {
      key: String(job.jobId),
      jobId: job.jobId,
      title: job.title,
      company: job.company,
      salary: (job.salaryText || job.salaryBand || "").trim() || "—",
      match: score,
      matchTone: resolveMatchTone(score),
      growth,
      deadline: formatDeadlineShort(job.deadlineLabel),
    };
  });
}

/** ③ 技能缺口：技能画像里 level < 3 的前 3 条；画像为空时回落岗位雷达的 missingSkills */
export function buildGapBars(skills: UserSkillView[], fallbackNames: string[]): CareerGapBar[] {
  const fromSkills = skills
    .filter((skill) => skill.level < SKILL_GAP_LEVEL)
    .slice()
    .sort((a, b) => (a.level !== b.level ? a.level - b.level : a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .slice(0, 3)
    .map((skill) => ({
      key: String(skill.id),
      label: skill.name,
      level: skill.level,
      targetLevel: SKILL_GAP_LEVEL,
      ratio: Math.max(0, Math.min(1, skill.level / SKILL_GAP_LEVEL)),
      valueLabel: "Lv" + skill.level + " → Lv" + SKILL_GAP_LEVEL,
    }));
  if (fromSkills.length > 0) return fromSkills;
  return fallbackNames.slice(0, 3).map((name, index) => ({
    key: "missing-" + index + "-" + name,
    label: name,
    level: 0,
    targetLevel: SKILL_GAP_LEVEL,
    ratio: 0,
    valueLabel: "Lv0 → Lv" + SKILL_GAP_LEVEL,
  }));
}

/** ④ 投递漏斗五级：收藏 / 已投 / 笔试 / 面试 / Offer（阶段为「累计到该阶段」，不是单阶段） */
export function buildCareerFunnel(appStats: Record<string, number> | null): CareerFunnelRow[] {
  const rows: { key: string; label: string; count: number | null }[] = [
    { key: "favorite", label: "收藏", count: countStages(appStats, ["favorite", "ready"]) },
    { key: "applied", label: "已投", count: countStages(appStats, ["applied", "online_test", "interview1", "interview2", "offer", "hired", "closed"]) },
    { key: "test", label: "笔试", count: countStages(appStats, ["online_test", "interview1", "interview2", "offer", "hired", "closed"]) },
    { key: "interview", label: "面试", count: countStages(appStats, ["interview1", "interview2", "offer", "hired", "closed"]) },
    { key: "offer", label: "Offer", count: countStages(appStats, ["offer", "hired"]) },
  ];
  const max = rows.reduce((top, row) => Math.max(top, row.count ?? 0), 0);
  return rows.map((row, index) => {
    const previous = index > 0 ? rows[index - 1].count : null;
    const count = row.count;
    /**
     * 转化率只对「同一批投递里逐级累计」的 笔试 / 面试 / Offer 有意义。
     * 收藏 → 已投 不是漏斗上下级（收藏转化后就不再停在收藏），硬算会出现 >100% 的假转化率。
     */
    const rateLabel =
      index < 2 || previous === null || count === null || previous <= 0
        ? "—"
        : Math.round((count / previous) * 100) + "%";
    const widthPct = max > 0 && count !== null ? Math.max(count > 0 ? 4 : 0, Math.round((count / max) * 100)) : 0;
    return { ...row, widthPct, rateLabel };
  });
}

/** ⑤ 本周行动：标题是产品叙事（静态），副文案尽量用真实数据（截止 / 缺口 / 简历完成度） */
export function buildWeekActions({
  matchedCount,
  deadlines,
  gapBars,
  gapHours,
  resumeScore,
  hasReadiness,
}: {
  matchedCount: number | null;
  deadlines: CareerDeadlineItem[];
  gapBars: CareerGapBar[];
  gapHours: number;
  resumeScore: number;
  hasReadiness: boolean;
}): CareerWeekAction[] {
  const deadline = deadlines[0];
  const gap = gapBars[0];
  return [
    {
      key: "apply",
      title: "投递 3 个高匹配岗位",
      detail: deadline
        ? "优先 " + deadline.title + "（" + deadline.deadlineLabel + "）"
        : matchedCount !== null && matchedCount > 0
          ? "当前 " + matchedCount + " 个高匹配，先挑 3 个"
          : "先去招花挑 3 个匹配岗位",
    },
    {
      key: "skill",
      title: gap ? "补 " + gap.label + " 到 Lv" + gap.targetLevel : "把技能画像补到 Lv3",
      detail: gap
        ? gapHours > 0
          ? "约 " + gapHours + " 小时 · 用题库 + 一个最小项目"
          : "从题库开始，先懂再练"
        : "技能画像里暂无缺口，保持节奏",
    },
    {
      key: "resume",
      title: "简历补 1 类资产",
      detail: hasReadiness
        ? "当前 " + resumeScore + "% · 还缺 " + countResumeMissingKinds(resumeScore) + " 类"
        : "登录后显示简历完成度",
    },
  ];
}

function pad2(value: number): string {
  return value < 10 ? "0" + value : String(value);
}

function formatMonthDay(date: Date): string {
  return pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}

function daysAgo(now: Date, days: number): Date {
  const date = new Date(now.getTime());
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * ⑥ 决策日志：产品叙事（静态文案），日期按「今天往前推」生成，
 * 第三条的目标方向用真实画像值（radar.targetRole / readiness.targetRole），没有则用兜底。
 */
export function buildDecisionLog(now: Date, targetLabel: string): CareerLogItem[] {
  const title = targetLabel.trim() || DIRECTION_FALLBACK_TITLE;
  return [
    {
      key: "log-1",
      date: formatMonthDay(daysAgo(now, 2)),
      prefix: "放弃 ",
      highlight: "远程实习",
      suffix: "：薪资低于期望，且成长上限低。",
    },
    {
      key: "log-2",
      date: formatMonthDay(daysAgo(now, 4)),
      prefix: "加入收藏 ",
      highlight: "Web 前端（远程）",
      suffix: "：先确认远程协作时区。",
    },
    {
      key: "log-3",
      date: formatMonthDay(daysAgo(now, 6)),
      prefix: "把目标方向改为 ",
      highlight: title,
      suffix: "。",
    },
  ];
}
