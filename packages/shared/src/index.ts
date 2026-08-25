import { z } from "zod";

/* ================= 内容模型（与 db/schema.sql 对齐） ================= */

export const resourceKindSchema = z.enum(["course", "doc", "tool", "video"]);
export const resourceSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string().nullable(),
  kind: resourceKindSchema,
  sortOrder: z.number(),
});
export type Resource = z.infer<typeof resourceSchema>;

export const practiceSchema = z.object({ id: z.number(), text: z.string(), sortOrder: z.number() });
export type Practice = z.infer<typeof practiceSchema>;

export const projectSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  repoUrl: z.string().nullable(),
  deliverable: z.string().nullable(),
  sortOrder: z.number(),
});
export type Project = z.infer<typeof projectSchema>;

export const checkpointSchema = z.object({ id: z.number(), text: z.string(), sortOrder: z.number() });
export type Checkpoint = z.infer<typeof checkpointSchema>;

export const topicSchema = z.object({
  id: z.number(),
  topicKey: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  agentTask: z.string().nullable(),
  sortOrder: z.number(),
  resources: z.array(resourceSchema).default([]),
  practices: z.array(practiceSchema).default([]),
  projects: z.array(projectSchema).default([]),
  checkpoints: z.array(checkpointSchema).default([]),
});
export type Topic = z.infer<typeof topicSchema>;

export const trackSchema = z.enum(["main", "agent"]);
export const phaseSchema = z.object({
  id: z.number(),
  phaseKey: z.string(),
  title: z.string(),
  weeks: z.string().nullable(),
  track: trackSchema,
  summary: z.string().nullable(),
  sortOrder: z.number(),
  topics: z.array(topicSchema).default([]),
});
export type Phase = z.infer<typeof phaseSchema>;

export const roadmapSchema = z.object({ phases: z.array(phaseSchema) });
export type Roadmap = z.infer<typeof roadmapSchema>;

export const roadmapTopicSchema = topicSchema.extend({
  done: z.boolean(),
  note: z.string().nullable(),
  isCustom: z.boolean().default(false),
});
export type RoadmapTopic = z.infer<typeof roadmapTopicSchema>;

export const roadmapPhaseSchema = phaseSchema.extend({
  topics: z.array(roadmapTopicSchema),
});
export type RoadmapPhase = z.infer<typeof roadmapPhaseSchema>;

/* ================= 用户数据模型 ================= */

export const topicProgressSchema = z.object({
  topicId: z.number(),
  done: z.boolean(),
  note: z.string().nullable(),
  updatedAt: z.string(),
});
export type TopicProgress = z.infer<typeof topicProgressSchema>;

export const taskTypeSchema = z.enum(["study", "agent", "output", "review", "exam"]);
export const dailyTaskSchema = z.object({
  id: z.number(),
  taskDate: z.string(), // YYYY-MM-DD
  title: z.string(),
  phaseId: z.number().nullable(),
  topicId: z.number().nullable(),
  taskType: taskTypeSchema,
  done: z.boolean(),
  focusMinutes: z.number(),
  sortOrder: z.number(),
});
export type DailyTask = z.infer<typeof dailyTaskSchema>;

export const focusSessionSchema = z.object({
  id: z.number(),
  taskId: z.number().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  tag: z.string().nullable(),
});
export type FocusSession = z.infer<typeof focusSessionSchema>;

export const checkinSchema = z.object({
  checkinDate: z.string(),
  note: z.string().nullable(),
});
export type Checkin = z.infer<typeof checkinSchema>;

export const logKindSchema = z.enum(["feynman", "review", "project", "interview"]);
export const logEntrySchema = z.object({
  id: z.number(),
  kind: logKindSchema,
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LogEntry = z.infer<typeof logEntrySchema>;

export const certificateSchema = z.object({
  id: z.number(),
  name: z.string(),
  targetDate: z.string().nullable(),
  status: z.enum(["planned", "preparing", "achieved"]),
  note: z.string().nullable(),
});
export type Certificate = z.infer<typeof certificateSchema>;

export const backgroundInfoSchema = z.object({
  date: z.string(),
  file: z.string().nullable(),
  remoteUrl: z.string().nullable(),
  copyright: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  exists: z.boolean(),
});
export type BackgroundInfo = z.infer<typeof backgroundInfoSchema>;

export const phaseProgressSchema = z.object({
  phaseId: z.number(),
  phaseKey: z.string(),
  title: z.string(),
  track: z.enum(["main", "agent"]),
  total: z.number(),
  done: z.number(),
  percent: z.number(),
});
export type PhaseProgress = z.infer<typeof phaseProgressSchema>;

export const dashboardSummarySchema = z.object({
  overallPercent: z.number(),
  career: z.string().optional(),
  careerName: z.string().optional(),
  phases: z.array(phaseProgressSchema),
  todayTasks: z.array(dailyTaskSchema),
  weekTaskCount: z.number(),
  weekTaskDone: z.number(),
  streak: z.number(),
  totalFocusMinutes: z.number(),
  xp: z.number(),
  certificates: z.array(certificateSchema),
  logsThisWeek: z.number(),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

/* ================= 工具函数 ================= */

export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateCN(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h <= 0) return `${m} 分钟`;
  return `${h} 小时 ${m} 分`;
}

export function pct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export const taskTypeLabels: Record<string, string> = {
  study: "学习",
  agent: "Agent",
  output: "输出",
  review: "复盘",
  exam: "刷题",
};

export const logKindLabels: Record<string, string> = {
  feynman: "费曼讲稿",
  review: "周复盘",
  project: "项目笔记",
  interview: "面试记录",
};

export const certLabels: Record<string, string> = {
  "HCIP-Datacom": "HCIP-Datacom",
  "天翼云 ACP": "天翼云 ACP",
};


/* ================= Knowledge Domain（方案 §12-§14） ================= */

export const knowledgeNoteTypeSchema = z.enum([
  "NOTE",
  "TUTORIAL",
  "REFERENCE",
  "MINDMAP",
  "REVIEW",
  "PROJECT_NOTE",
]);
export type KnowledgeNoteType = z.infer<typeof knowledgeNoteTypeSchema>;

export const knowledgeNoteStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type KnowledgeNoteStatus = z.infer<typeof knowledgeNoteStatusSchema>;

export const knowledgeNoteSchema = z.object({
  id: z.number(),
  topicId: z.number().nullable(),
  title: z.string(),
  slug: z.string(),
  content: z.string(),
  summary: z.string().nullable(),
  type: knowledgeNoteTypeSchema,
  status: knowledgeNoteStatusSchema,
  source: z.string().nullable(),
  sourcePath: z.string().nullable(),
  sourceId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
});
export type KnowledgeNote = z.infer<typeof knowledgeNoteSchema>;

export const knowledgeTagSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});
export type KnowledgeTag = z.infer<typeof knowledgeTagSchema>;

export const knowledgeNoteWithTagsSchema = knowledgeNoteSchema.extend({
  tags: z.array(knowledgeTagSchema).default([]),
});
export type KnowledgeNoteWithTags = z.infer<typeof knowledgeNoteWithTagsSchema>;

export const knowledgeLinkTypeSchema = z.enum(["RELATED", "PREREQUISITE", "REFERENCE", "DERIVED"]);
export const knowledgeLinkSchema = z.object({
  id: z.number(),
  sourceNoteId: z.number(),
  targetNoteId: z.number(),
  type: knowledgeLinkTypeSchema,
  createdAt: z.string(),
});
export type KnowledgeLink = z.infer<typeof knowledgeLinkSchema>;

export const knowledgeNoteTypeLabels: Record<KnowledgeNoteType, string> = {
  NOTE: "笔记",
  TUTORIAL: "教程",
  REFERENCE: "参考",
  MINDMAP: "思维导图",
  REVIEW: "复盘",
  PROJECT_NOTE: "项目笔记",
};

/* ================= Wellbeing 健康与状态领域（方案 §3、§6、§9） ================= */

export const reminderTypeSchema = z.enum(["HYDRATION", "STAND", "BREAK", "MOVEMENT", "SLEEP", "CUSTOM"]);
export type ReminderType = z.infer<typeof reminderTypeSchema>;

export const breakKindSchema = z.enum(["SHORT", "LONG", "MOVEMENT", "EYE_REST", "MEAL"]);
export type BreakKind = z.infer<typeof breakKindSchema>;

export const wellbeingReminderSchema = z.object({
  id: z.number(),
  type: reminderTypeSchema,
  title: z.string(),
  message: z.string().nullable(),
  enabled: z.boolean(),
  intervalMinutes: z.number(),
  startTime: z.string(),
  endTime: z.string(),
  weekdays: z.array(z.number()),
  nextTriggerAt: z.string().nullable(),
});
export type WellbeingReminder = z.infer<typeof wellbeingReminderSchema>;

export const hydrationLogSchema = z.object({
  id: z.number(),
  amountMl: z.number(),
  source: z.string(),
  recordedAt: z.string(),
});
export type HydrationLog = z.infer<typeof hydrationLogSchema>;

export const hydrationGoalSchema = z.object({ id: z.number(), targetMl: z.number() });
export type HydrationGoal = z.infer<typeof hydrationGoalSchema>;

export const energyLogSchema = z.object({
  id: z.number(),
  level: z.number(),
  note: z.string().nullable(),
  source: z.string(),
  recordedAt: z.string(),
});
export type EnergyLog = z.infer<typeof energyLogSchema>;

export const breakSessionSchema = z.object({
  id: z.number(),
  kind: breakKindSchema,
  minutes: z.number(),
  note: z.string().nullable(),
  startedAt: z.string(),
});
export type BreakSession = z.infer<typeof breakSessionSchema>;

export const dailyPlanItemSchema = z.object({
  time: z.string(),
  label: z.string(),
  kind: z.enum(["focus", "break", "hydrate", "energy", "task", "review"]),
  hint: z.string().nullable(),
});
export type DailyPlanItem = z.infer<typeof dailyPlanItemSchema>;

export const wellbeingTodaySchema = z.object({
  date: z.string(),
  hydration: z.object({
    totalMl: z.number(),
    targetMl: z.number(),
    logs: z.array(hydrationLogSchema),
  }),
  energy: energyLogSchema.nullable(),
  focusTodayMinutes: z.number(),
  breaksToday: z.array(breakSessionSchema),
  nextBreakDue: z.boolean(),
  remindersDue: z.array(wellbeingReminderSchema),
  plan: z.array(dailyPlanItemSchema),
});
export type WellbeingToday = z.infer<typeof wellbeingTodaySchema>;

export const reminderTypeLabels: Record<ReminderType, string> = {
  HYDRATION: "喝水",
  STAND: "站立",
  BREAK: "休息",
  MOVEMENT: "活动",
  SLEEP: "睡眠",
  CUSTOM: "自定义",
};

export const breakKindLabels: Record<BreakKind, string> = {
  SHORT: "短休",
  LONG: "长休",
  MOVEMENT: "活动",
  EYE_REST: "远眺",
  MEAL: "用餐",
};

export const energyLevelLabels: Record<number, string> = {
  1: "极低",
  2: "较低",
  3: "一般",
  4: "良好",
  5: "很好",
};

export const energyLevelColors: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#f59e0b",
  4: "#22c55e",
  5: "#0ea5e9",
};


/* ================= 招花 · 招聘信息爬虫（方案 M7） ================= */

export const jobSourceSchema = z.enum(["lagou", "liepin", "zhilian", "job51", "boss"]);
export type JobSource = z.infer<typeof jobSourceSchema>;

export const jobSourceLabels: Record<string, string> = {
  lagou: "拉勾",
  liepin: "猎聘",
  zhilian: "智联招聘",
  job51: "前程无忧",
  boss: "Boss直聘",
  "sasac-recruit": "国资委",
  "cpta-notice": "中国人事考试网",
  "81rc": "军队人才网",
  "mohrss-sydw": "人社部事业单位平台",
  "jiangsu-sydw": "江苏省人社厅",
  "iguopin": "国聘网",
  "guokao": "国考专题",
};

export function jobSourceLabel(source: string): string {
  return jobSourceLabels[source] ?? source;
}

/** 实验性平台（强风控，可能不稳定） */
export const experimentalJobSources: JobSource[] = ["boss"];

export const defaultCrawlerPlatforms: JobSource[] = ["lagou", "liepin", "zhilian", "job51"];

/** 招花招聘 · 支持的城市（前端城市筛选常驻显示；爬虫侧单源见 scripts/lib/cities.js，二者需保持一致） */
export const SUPPORTED_CITIES = [
  "北京", "上海", "广州", "深圳", "杭州", "成都",
  "西安", "乌鲁木齐", "南京", "武汉", "苏州",
];

export const jobPostingSchema = z.object({
  id: z.number(),
  source: z.string(),
  sourceJobId: z.string(),
  title: z.string(),
  company: z.string(),
  city: z.string(),
  district: z.string(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  salaryText: z.string(),
  experience: z.string(),
  education: z.string(),
  tags: z.array(z.string()),
  description: z.string(),
  requirements: z.string(),
  companyInfo: z.string(),
  url: z.string(),
  logoUrl: z.string(),
  category: z.string().default("internet"),
  channel: z.enum(["job", "announcement", "event"]).default("job"),
  deadlineAt: z.string().nullable().default(null),
  extra: z.record(z.string(), z.unknown()).default({}),
  publishedAt: z.string().nullable(),
  fetchedAt: z.string(),
});
export type JobPosting = z.infer<typeof jobPostingSchema>;

/** 卡片列表项（招花信息流用，字段精简） */
export const jobPostingListItemSchema = jobPostingSchema.pick({
  id: true,
  source: true,
  title: true,
  company: true,
  city: true,
  district: true,
  salaryMin: true,
  salaryMax: true,
  salaryText: true,
  experience: true,
  education: true,
  tags: true,
  url: true,
  category: true,
  channel: true,
  deadlineAt: true,
  extra: true,
  publishedAt: true,
  fetchedAt: true,
}).extend({
  isNew: z.boolean().default(false),
  isFav: z.boolean().default(false),
  /** P1 去重聚类：该职位的多来源聚合（长度>1 时表示跨平台重复，如 ["boss","liepin"]） */
  clusterSources: z.array(z.string()).optional(),
});
export type JobPostingListItem = z.infer<typeof jobPostingListItemSchema>;

export const jobPostingListSchema = z.object({
  jobs: z.array(jobPostingListItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type JobPostingList = z.infer<typeof jobPostingListSchema>;

export const jobCategorySchema = z.enum(["internet", "gongkao", "gongbian", "yangqi"]);
export type JobCategory = z.infer<typeof jobCategorySchema>;

export const jobCategoryLabels: Record<JobCategory, string> = {
  internet: "互联网",
  gongkao: "考公",
  gongbian: "考编",
  yangqi: "央国企",
};

export const jobCategoryColors: Record<JobCategory, string> = {
  internet: "#10b981",
  gongkao: "#3b82f6",
  gongbian: "#8b5cf6",
  yangqi: "#f59e0b",
};

export const allJobCategories: JobCategory[] = ["internet", "gongkao", "gongbian", "yangqi"];

export const jobCrawlerConfigSchema = z.object({
  keywords: z.array(z.string()),
  industries: z.array(z.string()),
  cities: z.array(z.string()),
  platforms: z.array(jobSourceSchema),
  categories: z.array(jobCategorySchema).default(allJobCategories),
  provinces: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  scheduleTime: z.string(),
  enabled: z.boolean(),
  maxPages: z.number(),
  lastRunAt: z.string().nullable().default(null),
});
export type JobCrawlerConfig = z.infer<typeof jobCrawlerConfigSchema>;

export const defaultCrawlerConfig: JobCrawlerConfig = {
  keywords: [],
  industries: [],
  cities: [],
  platforms: defaultCrawlerPlatforms,
  categories: allJobCategories,
  provinces: [],
  sources: [],
  scheduleTime: "08:00",
  enabled: true,
  maxPages: 3,
  lastRunAt: null,
};

export const jobRunSchema = z.object({
  id: z.number(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  status: z.enum(["running", "success", "partial", "failed"]),
  platformsResult: z.record(z.string(), z.number()),
  fetchedCount: z.number(),
  newCount: z.number(),
  error: z.string().nullable(),
});
export type JobRun = z.infer<typeof jobRunSchema>;

export const jobStatsSchema = z.object({
  total: z.number(),
  todayNew: z.number(),
  platformCount: z.number(),
  byCategory: z.record(z.string(), z.number()).default({}),
  lastRun: z.string().nullable(),
  lastRunStatus: z.string().nullable(),
});
export type JobStats = z.infer<typeof jobStatsSchema>;

/** 相对时间：X 小时前 / 昨天 / MM-DD */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMs = Date.now() - t;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return minutes + " 分钟前";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + " 小时前";
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 7) return days + " 天前";
  const d = new Date(t);
  return (d.getMonth() + 1) + "-" + String(d.getDate()).padStart(2, "0");
}


/* ================= 招花 2.0 · hosts 注册表 / 订阅 / 考试日历 / 健康度 ================= */

/** 信息源注册表条目（hosts 文件 / job_crawler_sources 表） */
export const jobSourceInfoSchema = z.object({
  id: z.string(),
  category: jobCategorySchema,
  channel: z.enum(["job", "announcement", "event"]),
  name: z.string(),
  engine: z.enum(["http", "browser"]),
  baseUrl: z.string(),
  risk: z.string(),
  enabled: z.boolean(),
  hitRate: z.number().default(1),
  lastRunAt: z.string().nullable().default(null),
  lastError: z.string().default(""),
  note: z.string().default(""),
});
export type JobSourceInfo = z.infer<typeof jobSourceInfoSchema>;

export const jobSourceInfoListSchema = z.object({
  version: z.number(),
  updatedAt: z.string().nullable(),
  sources: z.array(jobSourceInfoSchema),
});
export type JobSourceInfoList = z.infer<typeof jobSourceInfoListSchema>;

/** 订阅 */
export const jobSubscriptionSchema = z.object({
  id: z.number(),
  name: z.string(),
  categories: z.array(jobCategorySchema),
  keywords: z.array(z.string()),
  cities: z.array(z.string()),
  enabled: z.boolean(),
  createdAt: z.string(),
});
export type JobSubscription = z.infer<typeof jobSubscriptionSchema>;

/** 站内通知 */
export const jobNotificationSchema = z.object({
  id: z.number(),
  jobId: z.number(),
  subscriptionId: z.number().nullable(),
  title: z.string(),
  body: z.string(),
  url: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
});
export type JobNotification = z.infer<typeof jobNotificationSchema>;

/** 考试日历事件 */
export const examEventSchema = z.object({
  id: z.number(),
  jobId: z.number(),
  kind: z.enum(["apply_start", "apply_end", "exam", "interview", "result"]),
  label: z.string(),
  eventAt: z.string(),
  note: z.string(),
  daysLeft: z.number(),
  title: z.string(),
  source: z.string(),
  url: z.string(),
});
export type ExamEvent = z.infer<typeof examEventSchema>;

/** 信息源健康记录 */
export const jobSourceHealthSchema = z.object({
  id: z.number(),
  source: z.string(),
  fetched: z.number(),
  hitRate: z.number(),
  error: z.string(),
  createdAt: z.string(),
});
export type JobSourceHealth = z.infer<typeof jobSourceHealthSchema>;

/** 订阅匹配结果（抓取后新职位 × 订阅） */
export const jobNotificationStatsSchema = z.object({
  unread: z.number(),
  total: z.number(),
});
export type JobNotificationStats = z.infer<typeof jobNotificationStatsSchema>;

/* ================= 2.0 · 职业准备度 / Dashboard 聚合 ================= */

/** 职业准备度四维（技能/项目/简历/面试） */
export const readinessDimensionSchema = z.object({
  key: z.enum(["skill", "project", "resume", "interview"]),
  label: z.string(),
  score: z.number(),          // 0-100
  weight: z.number(),         // 0-1 权重
  detail: z.string(),
});
export type ReadinessDimension = z.infer<typeof readinessDimensionSchema>;

export const careerReadinessSchema = z.object({
  targetRole: z.string(),          // 目标岗位（当前 career 名称）
  overall: z.number(),             // 职业准备度 0-100
  dimensions: z.array(readinessDimensionSchema),
  matchedJobs: z.number(),         // 「发现 N 个适合你的职位」
});
export type CareerReadiness = z.infer<typeof careerReadinessSchema>;

/** /api/dashboard 聚合响应（一次请求覆盖首页四区块） */
export const dashboardAggregateSchema = z.object({
  summary: dashboardSummarySchema,
  readiness: careerReadinessSchema,
  jobsTotal: z.number(),
});
export type DashboardAggregate = z.infer<typeof dashboardAggregateSchema>;

/* ================= 2.0 · P1 招花增强：新鲜度 + 去重 + 筛选 ================= */

/** 职位新鲜度等级（按渠道区分：job 用发布时间，announcement/event 用截止倒计时） */
export const jobFreshnessLevelSchema = z.enum(["just", "within3", "within7", "within14", "stale", "deadline"]);
export type JobFreshnessLevel = z.infer<typeof jobFreshnessLevelSchema>;

export interface JobFreshness {
  level: JobFreshnessLevel;
  label: string;
  emoji: string;
  /** 用于徽标背景的 tailwind 类 */
  badgeClass: string;
}

/**
 * 职位新鲜度（规则版，按渠道区分）
 * - job 渠道：基于 published_at（缺失时用 fetched_at）
 *   🟢 <1天 刚发布 · 🔵 3天内 · 🟡 7天内 · ⚪ 14天内 · 🔴 >30天 可能已失效
 * - announcement/event 渠道：基于 deadline_at 倒计时（deadline 等级）
 */
export function jobFreshness(
  publishedAt: string | null,
  fetchedAt: string,
  deadlineAt: string | null,
  channel: "job" | "announcement" | "event" = "job"
): JobFreshness {
  if (channel !== "job" && deadlineAt) {
    const t = new Date(deadlineAt).getTime();
    if (!Number.isNaN(t)) {
      const days = Math.ceil((t - Date.now()) / 86400000);
      if (days < 0) return { level: "stale", label: "已截止", emoji: "🔴", badgeClass: "bg-rose-500/15 text-rose-500 dark:text-rose-300" };
      if (days === 0) return { level: "deadline", label: "今日截止", emoji: "⏰", badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-300" };
      if (days <= 3) return { level: "deadline", label: `${days} 天后截止`, emoji: "⏰", badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-300" };
      if (days <= 7) return { level: "deadline", label: `${days} 天后截止`, emoji: "🗓", badgeClass: "bg-indigo-500/15 text-indigo-500 dark:text-indigo-300" };
      return { level: "deadline", label: `${days} 天后截止`, emoji: "🗓", badgeClass: "bg-white/10 text-muted-foreground" };
    }
  }
  const base = publishedAt || fetchedAt;
  const t = new Date(base).getTime();
  if (Number.isNaN(t)) return { level: "within14", label: "时间未知", emoji: "⚪", badgeClass: "bg-white/10 text-muted-foreground" };
  const hours = (Date.now() - t) / 3600000;
  if (hours < 24) return { level: "just", label: "刚发布", emoji: "🟢", badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" };
  const days = hours / 24;
  if (days < 3) return { level: "within3", label: "3 天内", emoji: "🔵", badgeClass: "bg-sky-500/15 text-sky-600 dark:text-sky-300" };
  if (days < 7) return { level: "within7", label: "7 天内", emoji: "🟡", badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-300" };
  if (days < 14) return { level: "within14", label: "14 天内", emoji: "⚪", badgeClass: "bg-white/10 text-muted-foreground" };
  if (days < 30) return { level: "within14", label: "超 14 天", emoji: "⚪", badgeClass: "bg-white/10 text-muted-foreground" };
  return { level: "stale", label: "可能已失效", emoji: "🔴", badgeClass: "bg-rose-500/15 text-rose-500 dark:text-rose-300" };
}

/** 职位文本规范化（去重键）：小写、去空白、去括号内容、去公司常见后缀 */
export function normalizeJobText(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, "")   // 去括号内容
    .replace(/[\s\u3000\-—_·.]+/g, "")   // 去空白/连字符
    .replace(/有限公司|股份有限公司|集团|公司|科技|技术|有限/g, "")
    .trim();
}

/** 职位去重键：规范化标题 + 公司 + 城市 */
export function jobDedupKey(title: string, company: string, city: string): string {
  return [normalizeJobText(title), normalizeJobText(company), (city ?? "").trim()].join("|");
}

/* ================= 2.0 · P2 学习 × 招聘打通：技能画像 / 匹配 / 缺口 ================= */

export const userSkillViewSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
  level: z.number(),        // 0-5
  source: z.string(),       // manual / resume / topic / gap
});
export type UserSkillView = z.infer<typeof userSkillViewSchema>;

export const jobMatchResultSchema = z.object({
  jobId: z.number(),
  overall: z.number(),      // 0-100 匹配度
  matchedSkills: z.array(z.object({ skill: z.string(), level: z.number(), hit: z.boolean(), partial: z.boolean() })),
  missingSkills: z.array(z.object({ skill: z.string() })),
  hasUserProfile: z.boolean(),
});
export type JobMatchResult = z.infer<typeof jobMatchResultSchema>;

export const skillGapItemSchema = z.object({
  skill: z.string(),
  topicId: z.number().nullable(),
  topicTitle: z.string().nullable(),
  estimateHours: z.number().nullable(),
  enrollable: z.boolean(),
  phaseId: z.number().nullable(),       // 学习主题所属路线图阶段（整包规划定位用）
  phaseTitle: z.string().nullable(),
  phaseKey: z.string().nullable(),
});
export type SkillGapItem = z.infer<typeof skillGapItemSchema>;

export const skillGapsResultSchema = z.object({
  gaps: z.array(skillGapItemSchema),
  totalHours: z.number(),
});
export type SkillGapsResult = z.infer<typeof skillGapsResultSchema>;

/** 聚合「市场需求缺口」：市场高频需求技能 × 我的技能缺失（学习×招聘打通） */
export const marketGapItemSchema = z.object({
  skillId: z.number(),
  skill: z.string(),
  category: z.string(),
  jobCount: z.number(),        // 市场要求该技能的岗位数（需求强度）
  demandWeight: z.number(),    // 需求权重合计
  myLevel: z.number(),         // 0-5
  missing: z.boolean(),        // true=未掌握 level<1
  topicId: z.number().nullable(),
  topicTitle: z.string().nullable(),
  estimateHours: z.number().nullable(),
  enrollable: z.boolean(),
  phaseId: z.number().nullable(),       // 主题所属路线图阶段（跳转定位用）
  phaseTitle: z.string().nullable(),
  phaseKey: z.string().nullable(),
});
export type MarketGapItem = z.infer<typeof marketGapItemSchema>;

export const marketGapsResultSchema = z.object({
  gaps: z.array(marketGapItemSchema),
  totalJobs: z.number(),       // 参与统计的岗位数
  generatedAt: z.string(),
});
export type MarketGapsResult = z.infer<typeof marketGapsResultSchema>;

/** 技能候选（供筛选/管理选择） */
export const skillOptionSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
  aliases: z.array(z.string()).default([]),
});
export type SkillOption = z.infer<typeof skillOptionSchema>;

/* ================= 2.0 · P3 求职管理 ================= */

/** 求职阶段：收藏 → 准备投递 → 已投递 → 笔试 → 一面 → 二面 → Offer → 入职 → 关闭 */
export const jobApplicationStageSchema = z.enum([
  "favorite", "ready", "applied", "online_test", "interview1", "interview2", "offer", "hired", "closed",
]);
export type JobApplicationStage = z.infer<typeof jobApplicationStageSchema>;

export const jobApplicationStageLabels: Record<JobApplicationStage, string> = {
  favorite: "收藏",
  ready: "准备投递",
  applied: "已投递",
  online_test: "笔试",
  interview1: "一面",
  interview2: "二面",
  offer: "Offer",
  hired: "入职",
  closed: "关闭",
};

export const jobApplicationStageColors: Record<JobApplicationStage, string> = {
  favorite: "#8b8b94",
  ready: "#0ea5e9",
  applied: "#6366f1",
  online_test: "#8b5cf6",
  interview1: "#d97706",
  interview2: "#ea580c",
  offer: "#16a34a",
  hired: "#10b981",
  closed: "#6b7280",
};

/** Kanban 四列分组：收藏/进行中（投递+笔试+面试）/Offer/已入职 */
export const KANBAN_COLUMNS = [
  { key: "favorite", label: "收藏", stages: ["favorite", "ready"] as JobApplicationStage[] },
  { key: "active", label: "进行中", stages: ["applied", "online_test", "interview1", "interview2"] as JobApplicationStage[] },
  { key: "offer", label: "Offer", stages: ["offer"] as JobApplicationStage[] },
  { key: "done", label: "已入职/关闭", stages: ["hired", "closed"] as JobApplicationStage[] },
] as const;

export const jobApplicationSchema = z.object({
  id: z.number(),
  jobId: z.number(),
  stage: jobApplicationStageSchema,
  note: z.string().default(""),
  appliedAt: z.string().nullable(),
  updatedAt: z.string(),
  // 职位快照
  jobTitle: z.string(),
  jobCompany: z.string(),
  jobCity: z.string(),
  jobSalary: z.string(),
  jobUrl: z.string(),
  jobSource: z.string(),
});
export type JobApplication = z.infer<typeof jobApplicationSchema>;

/** 求职统计（各阶段数量） */
export const jobApplicationStatsSchema = z.record(jobApplicationStageSchema, z.number());
export type JobApplicationStats = z.infer<typeof jobApplicationStatsSchema>;

/* ================= 2.0 · P4 招聘市场分析 ================= */

export const marketCityRowSchema = z.object({
  city: z.string(),
  count: z.number(),
  avgMin: z.number().nullable(),
  avgMax: z.number().nullable(),
});
export type MarketCityRow = z.infer<typeof marketCityRowSchema>;

export const marketSkillRowSchema = z.object({ skill: z.string(), count: z.number() });
export type MarketSkillRow = z.infer<typeof marketSkillRowSchema>;

export const marketSalaryRowSchema = z.object({ label: z.string(), min: z.number(), count: z.number() });
export type MarketSalaryRow = z.infer<typeof marketSalaryRowSchema>;

export const marketLabelCountSchema = z.object({ label: z.string(), count: z.number() });
export type MarketLabelCount = z.infer<typeof marketLabelCountSchema>;

export const marketPlatformRowSchema = marketLabelCountSchema;
export type MarketPlatformRow = z.infer<typeof marketPlatformRowSchema>;
export const marketJobTypeRowSchema = marketLabelCountSchema;
export type MarketJobTypeRow = z.infer<typeof marketJobTypeRowSchema>;

export const marketSkillSalaryRowSchema = z.object({
  skill: z.string(),
  avgSalary: z.number().nullable(),
  count: z.number(),
});
export type MarketSkillSalaryRow = z.infer<typeof marketSkillSalaryRowSchema>;

/** 市场概览（第一屏 KPI，真实可算） */
export const marketOverviewSchema = z.object({
  total: z.number(),                    // 职位样本
  cityCount: z.number(),                // 去重城市数
  skillCount: z.number(),               // 热门技能数（去重标签）
  avgSalary: z.number().nullable(),     // 整体平均薪资（K/月，分桶中点加权）
  medianSalary: z.number().nullable(),  // 整体中位薪资（K/月）
  salaryMin: z.number().nullable(),     // 薪资下须（P5，抗离群值）
  salaryQ1: z.number().nullable(),      // 下四分位（P25）
  salaryQ3: z.number().nullable(),      // 上四分位（P75）
  salaryMax: z.number().nullable(),     // 薪资上须（P95）
});
export type MarketOverview = z.infer<typeof marketOverviewSchema>;

/** 市场趋势（本周 vs 上周快照环比；无历史时为 has=false） */
export const marketTrendSchema = z.object({
  has: z.boolean(),                        // 是否至少有 2 个不同日快照可比
  prevDate: z.string().nullable(),         // 上次快照日期（YYYY-MM-DD）
  totalDeltaPct: z.number().nullable(),    // 岗位总量环比（%）
  topSkill: z.string().nullable(),         // 当前最高频技能
  topSkillCount: z.number().nullable(),
  topSkillDelta: z.number().nullable(),    // 与该技能上次的数量差
  topCity: z.string().nullable(),          // 当前机会最多城市
  topCityCount: z.number().nullable(),
  topCityDelta: z.number().nullable(),
  avgSalaryDelta: z.number().nullable(),   // 平均薪资差（K/月）
});
export type MarketTrend = z.infer<typeof marketTrendSchema>;

export const marketAnalysisSchema = z.object({
  total: z.number(),
  overview: marketOverviewSchema,
  trend: marketTrendSchema,
  byCity: z.array(marketCityRowSchema),
  bySkill: z.array(marketSkillRowSchema),
  salaryDist: z.array(marketSalaryRowSchema),
  byEducation: z.array(marketLabelCountSchema),
  byExperience: z.array(marketLabelCountSchema),
  byFunction: z.array(marketLabelCountSchema),
  byPlatform: z.array(marketPlatformRowSchema),
  byJobType: z.array(marketJobTypeRowSchema),
  skillSalary: z.array(marketSkillSalaryRowSchema),
  generatedAt: z.string(),
});
export type MarketAnalysis = z.infer<typeof marketAnalysisSchema>;






/* ================= P0 安全加固：导出/导入文件 schema（import 校验 + body 限制） ================= */

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期需为 YYYY-MM-DD");

export const exportProgressRowSchema = z.object({
  topic_id: z.number(),
  done: z.boolean(),
  note: z.string().nullable().optional(),
  updated_at: z.string().optional(),
});
export const exportTaskRowSchema = z.object({
  task_date: dateStr,
  title: z.string().max(500),
  phase_id: z.number().nullable().optional(),
  topic_id: z.number().nullable().optional(),
  task_type: z.string().max(20).optional(),
  done: z.boolean().optional(),
  focus_minutes: z.number().optional(),
  sort_order: z.number().optional(),
});
export const exportSessionRowSchema = z.object({
  task_id: z.number().nullable().optional(),
  started_at: z.string(),
  ended_at: z.string().nullable().optional(),
  duration_seconds: z.number().optional(),
  tag: z.string().nullable().optional(),
});
export const exportCheckinRowSchema = z.object({
  checkin_date: dateStr,
  note: z.string().nullable().optional(),
});
export const exportLogRowSchema = z.object({
  kind: z.enum(["feynman", "review", "project", "interview"]),
  title: z.string().max(500),
  content: z.string().max(200_000),
  created_at: z.string().optional(),
});
export const exportCertificateRowSchema = z.object({
  name: z.string().max(200),
  target_date: z.string().nullable().optional(),
  status: z.string().max(20).optional(),
  note: z.string().nullable().optional(),
});
export const exportGithubRowSchema = z.object({
  title: z.string().max(200),
  url: z.string().nullable().optional(),
  content: z.string().max(20_000).nullable().optional(),
});

/** 导入文件整体 schema：与 /api/export 输出结构一致（snake_case 字段） */
export const importFileSchema = z.object({
  app: z.literal("learn-workbench"),
  schemaVersion: z.string().optional(),
  exportedAt: z.string().optional(),
  progress: z.array(exportProgressRowSchema).default([]),
  tasks: z.array(exportTaskRowSchema).default([]),
  sessions: z.array(exportSessionRowSchema).default([]),
  checkins: z.array(exportCheckinRowSchema).default([]),
  logs: z.array(exportLogRowSchema).default([]),
  certificates: z.array(exportCertificateRowSchema).default([]),
  github: z.array(exportGithubRowSchema).default([]),
});
export type ImportFile = z.infer<typeof importFileSchema>;

/** 技能画像冷启动：按目标职业推荐技能 */
export const skillRecommendSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
});
export type SkillRecommend = z.infer<typeof skillRecommendSchema>;

export const skillRecommendResultSchema = z.object({
  career: z.string(),
  careerName: z.string(),
  skills: z.array(skillRecommendSchema),
});
export type SkillRecommendResult = z.infer<typeof skillRecommendResultSchema>;

/** 岗位学习计划（整包规划）：按路线图阶段分组的能力缺口学习计划 */
export const jobPlanPhaseSchema = z.object({
  phaseId: z.number().nullable(),
  phaseTitle: z.string().nullable(),
  phaseKey: z.string().nullable(),
  sortOrder: z.number(),
  hours: z.number(),                    // 该阶段合计学习时长（小时）
  skills: z.array(skillGapItemSchema),
});
export type JobPlanPhase = z.infer<typeof jobPlanPhaseSchema>;

export const jobLearningPlanSchema = z.object({
  job: z.object({
    id: z.number(),
    title: z.string(),
    company: z.string(),
    city: z.string(),
    salaryText: z.string(),
    education: z.string(),
    experience: z.string(),
  }),
  match: z.number(),                    // 当前岗位匹配度 0-100
  totalHours: z.number(),
  estimatedWeeks: z.number(),           // 按每周学习时长估算
  phases: z.array(jobPlanPhaseSchema),  // 按阶段分组（顺序=学习顺序）
  gaps: z.array(skillGapItemSchema),
});
export type JobLearningPlan = z.infer<typeof jobLearningPlanSchema>;
