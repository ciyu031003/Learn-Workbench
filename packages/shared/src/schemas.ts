/**
 * zod schema 与 z.infer 类型（唯一允许 import zod 的模块）。
 *
 * 由原 src/index.ts 拆出（S3-2 subpath exports）；index.ts 仍以 barrel 形式保留兼容。
 */
import { z } from "zod";
import { DEFAULT_RESUME_SECTION_ORDER, allJobCategories } from "./labels";
import { isCommonWeakPassword } from "./pure";

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
  /** MD 导入的「学习内容」条目（content_topic_items），Web 由 /api/roadmap 返回 */
  items: z
    .array(
      z.object({
        id: z.number(),
        title: z.string(),
        contentMd: z.string(),
        sortOrder: z.number(),
      })
    )
    .default([]),
});

export type RoadmapTopic = z.infer<typeof roadmapTopicSchema>;

export const roadmapPhaseSchema = phaseSchema.extend({
    isCustom: z.boolean().default(false),
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
  careerKey: z.string().optional(),
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
  careerKey: z.string().optional(),
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
  // V3 独立证书领域（迁移 037）；旧调用方（dashboard/summary/export）不带这些字段，故为可选
  issuer: z.string().nullable().optional(),
  earnedDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  updatedAt: z.string().optional(),
});

export type Certificate = z.infer<typeof certificateSchema>;

export const resumeAssetKindSchema = z.enum(["project", "skill", "github", "certificate"]);

export type ResumeAssetKind = z.infer<typeof resumeAssetKindSchema>;

export const resumeAssetSchema = z.object({
  id: z.number(),
  kind: resumeAssetKindSchema,
  title: z.string(),
  content: z.string().nullable(),
  url: z.string().nullable(),
  sortOrder: z.number(),
  updatedAt: z.string(),
});

export type ResumeAsset = z.infer<typeof resumeAssetSchema>;

/* ================= V3 · Resume Engine v1（简历文档 / 模板注册表 / A4 预览） ================= */

/** 简历分节键（有序；section_order 用它排列与开关） */
export const resumeSectionKeySchema = z.enum([
  "basics",
  "education",
  "skills",
  "projects",
  "experience",
  "certificates",
]);

export type ResumeSectionKey = z.infer<typeof resumeSectionKeySchema>;

/** 分节配置：顺序 + 可见性 */
export const resumeSectionConfigSchema = z.object({
  key: resumeSectionKeySchema,
  visible: z.boolean().default(true),
});

export type ResumeSectionConfig = z.infer<typeof resumeSectionConfigSchema>;

/** 样式配置 */
export const resumeStyleSchema = z.object({
  accent: z.string().default("#2f74c0"),
  fontScale: z.number().min(0.8).max(1.3).default(1),
  spacing: z.enum(["compact", "normal", "relaxed"]).default("normal"),
  page: z.enum(["A4", "Letter"]).default("A4"),
  showPhoto: z.boolean().default(false),
  fontFamily: z.enum(["sans", "serif"]).default("sans"),
});

export type ResumeStyle = z.infer<typeof resumeStyleSchema>;

/** 组装后的简历内容（服务端按 Profile/证书/技能/资产实时组装，只读） */
export const resumeContentSchema = z.object({
  basics: z.object({
    name: z.string().default(""),
    headline: z.string().default(""),
    city: z.string().default(""),
    targetRole: z.string().default(""),
    summary: z.string().default(""),
    email: z.string().default(""),
  }),
  education: z.array(z.object({
    school: z.string(), major: z.string(), degree: z.string(),
    start: z.string().nullable(), end: z.string().nullable(), note: z.string().nullable(),
  })).default([]),
  experience: z.array(z.object({
    title: z.string(), org: z.string(),
    start: z.string().nullable(), end: z.string().nullable(),
    description: z.string(), skills: z.array(z.string()).default([]),
  })).default([]),
  skills: z.array(z.object({ name: z.string(), level: z.number(), category: z.string() })).default([]),
  projects: z.array(z.object({
    title: z.string(), content: z.string().nullable(), url: z.string().nullable(), kind: z.string(),
  })).default([]),
  certificates: z.array(z.object({
    name: z.string(), issuer: z.string().nullable(), earnedDate: z.string().nullable(), expiryDate: z.string().nullable(),
  })).default([]),
});

export type ResumeContent = z.infer<typeof resumeContentSchema>;

/** 简历文档（DB 行 + 组装内容） */
export const resumeDocumentSchema = z.object({
  id: z.number(),
  title: z.string(),
  templateKey: z.string(),
  sectionOrder: z.array(resumeSectionConfigSchema),
  styles: resumeStyleSchema.partial(),
  overrides: z.record(z.string(), z.unknown()).default({}),
  isDefault: z.boolean().optional(),
  updatedAt: z.string().optional(),
});

export type ResumeDocument = z.infer<typeof resumeDocumentSchema>;

/** 简历列表项（轻量） */
export const resumeDocumentListItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  templateKey: z.string(),
  isDefault: z.boolean(),
  updatedAt: z.string(),
});

export type ResumeDocumentListItem = z.infer<typeof resumeDocumentListItemSchema>;

/** 归一化分节顺序：补齐缺失键、去重、忽略非法键 */
export function normalizeSectionOrder(raw: unknown): ResumeSectionConfig[] {
  const seen = new Set<string>();
  const out: ResumeSectionConfig[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const key = typeof item === "string" ? item : (item as { key?: unknown })?.key;
      const parsed = resumeSectionKeySchema.safeParse(key);
      if (!parsed.success || seen.has(parsed.data)) continue;
      seen.add(parsed.data);
      const visible = typeof item === "object" && item !== null && "visible" in item
        ? Boolean((item as { visible?: unknown }).visible)
        : true;
      out.push({ key: parsed.data, visible });
    }
  }
  for (const def of DEFAULT_RESUME_SECTION_ORDER) {
    if (!seen.has(def.key)) out.push({ ...def });
  }
  return out;
}

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
  kind: z.enum(["focus", "break", "hydrate", "energy", "task", "review", "move"]),
  hint: z.string().nullable(),
});

export type DailyPlanItem = z.infer<typeof dailyPlanItemSchema>;

export const exerciseTypeSchema = z.enum(["BALL", "AEROBIC", "STRENGTH", "STRETCH", "MOVE", "OTHER"]);

export type ExerciseType = z.infer<typeof exerciseTypeSchema>;

export const exerciseLogSchema = z.object({
  id: z.number(),
  type: exerciseTypeSchema,
  typeLabel: z.string().nullable(),
  durationSeconds: z.number(),
  source: z.string(),
  note: z.string().nullable(),
  startedAt: z.string(),
});

export type ExerciseLog = z.infer<typeof exerciseLogSchema>;

export const exerciseGoalSchema = z.object({ id: z.number(), targetMinutes: z.number() });

export type ExerciseGoal = z.infer<typeof exerciseGoalSchema>;

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
  exercise: z.object({
    totalMinutes: z.number(),
    targetMinutes: z.number(),
    logs: z.array(exerciseLogSchema),
  }),
  plan: z.array(dailyPlanItemSchema),
});

export type WellbeingToday = z.infer<typeof wellbeingTodaySchema>;

/* ================= 招花 · 招聘信息爬虫（方案 M7） ================= */

export const jobSourceSchema = z.enum(["lagou", "liepin", "zhilian", "job51", "boss"]);

export type JobSource = z.infer<typeof jobSourceSchema>;

export const jobPostingSchema = z.object({
  // S5-4：job_postings.id 是 DB bigint，node-postgres 在边界返回 string；
  // 对外契约统一为 string（前端用 === 做字符串比较，避免 bigint 精度丢失）。
  id: z.string(),
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

/* ================= 3.0 · 学习领域（Domain） ================= */

/** 领域类型：career 职业类保留技能树/简历/面试/求职等专属能力 */
export const domainKindSchema = z.enum(["career", "language", "sports", "hobby", "life", "custom"]);

export type DomainKind = z.infer<typeof domainKindSchema>;

export const domainSchema = z.object({
  careerKey: z.string(),          // 物理主键 key（保留 careers.career_key 命名）
  name: z.string(),
  description: z.string().nullable(),
  isLocked: z.boolean(),
  sortOrder: z.number(),
  ownerId: z.string().uuid().nullable(),  // 系统内置域 null（全员共享）；用户自建域 = 用户 id
  kind: domainKindSchema,
  icon: z.string(),               // lucide 图标名（移动端映射 Ionicons）
  color: z.string(),              // 主色 hex
  phasePrefix: z.string(),        // 阶段徽标：职业 P / 语言 E / 运动 S / 自定义自定
  isArchived: z.boolean(),
});

export type Domain = z.infer<typeof domainSchema>;

/* ================= 3.0 · 领域记录维度（Tracker） ================= */

export const domainTrackerSchema = z.object({
  id: z.number(),
  domainKey: z.string(),
  name: z.string(),
  unit: z.string(),
  targetValue: z.number().nullable(),
  targetCadence: z.enum(["daily", "weekly"]).nullable(),
  color: z.string(),
});

export type DomainTracker = z.infer<typeof domainTrackerSchema>;

export const trackerLogSchema = z.object({
  id: z.number(),
  trackerId: z.number(),
  logDate: z.string(),
  value: z.number(),
  note: z.string().nullable(),
});

export type TrackerLog = z.infer<typeof trackerLogSchema>;

const trackerDateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期需为 YYYY-MM-DD");

export const exportDomainRowSchema = z.object({
  career_key: z.string().max(100),
  name: z.string().max(100),
  description: z.string().nullable().optional(),
  is_locked: z.boolean().optional(),
  owner_id: z.string().nullable().optional(),
  kind: z.string().max(20).optional(),
  icon: z.string().max(40).optional(),
  color: z.string().max(20).optional(),
  phase_prefix: z.string().max(10).optional(),
  is_archived: z.boolean().optional(),
});

export const exportTrackerRowSchema = z.object({
  domain_key: z.string().max(100),
  name: z.string().max(100),
  unit: z.string().max(40).optional(),
  target_value: z.number().nullable().optional(),
  target_cadence: z.enum(["daily", "weekly"]).nullable().optional(),
  color: z.string().max(20).optional(),
});

export const exportTrackerLogRowSchema = z.object({
  domain_key: z.string().max(100),
  tracker_name: z.string().max(100),
  log_date: trackerDateStr,
  value: z.number(),
  note: z.string().nullable().optional(),
});

export type ExportTrackerRow = z.infer<typeof exportTrackerRowSchema>;

export type ExportTrackerLogRow = z.infer<typeof exportTrackerLogRowSchema>;

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

/* ================= V3 · Profile 信息源收敛（教育/经历/城市/目标/简介） ================= */

/** 教育经历一条 */
export const educationItemSchema = z.object({
  school: z.string().default(""),
  major: z.string().default(""),
  degree: z.string().default(""),
  start: z.string().nullable().default(null),
  end: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
});

export type EducationItem = z.infer<typeof educationItemSchema>;

/** 工作/项目经历一条 */
export const experienceItemSchema = z.object({
  title: z.string().default(""),
  org: z.string().default(""),
  start: z.string().nullable().default(null),
  end: z.string().nullable().default(null),
  description: z.string().default(""),
  skills: z.array(z.string()).default([]),
});

export type ExperienceItem = z.infer<typeof experienceItemSchema>;

/** Profile 基本信息（载体：user_settings 扩展列） */
export const profileInfoSchema = z.object({
  education: z.array(educationItemSchema).default([]),
  experiences: z.array(experienceItemSchema).default([]),
  currentCity: z.string().default(""),
  targetRole: z.string().default(""),
  bio: z.string().default(""),
});

export type ProfileInfo = z.infer<typeof profileInfoSchema>;

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
  // S5-4：岗位 id 对外一律 string
  jobId: z.string(),
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

/* ================= 2.0 · P3 面试题库与模拟面试 ================= */

/** 答题记录类型：题库刷题 / 模拟面试 / 真实面试 */
export const interviewModeSchema = z.enum(["quiz", "mock", "interview"]);

export type InterviewMode = z.infer<typeof interviewModeSchema>;

/** 题库难度 */
export const questionDifficultySchema = z.enum(["easy", "medium", "hard"]);

export type QuestionDifficulty = z.infer<typeof questionDifficultySchema>;

/** 题库题目（列表不含参考答案，避免刷题前泄漏答案） */
export const interviewQuestionSchema = z.object({
  id: z.number(),
  module: z.string(),
  question: z.string(),
  difficulty: questionDifficultySchema,
  /** 抓取来源的标签（目录 / 主题），v12 P2-1 */
  tags: z.array(z.string()).default([]),
  /** 来源可追溯：题目页地址 / 站点标识 / 许可证（合规要求） */
  sourceUrl: z.string().nullable().default(null),
  sourceSite: z.string().nullable().default(null),
  license: z.string().nullable().default(null),
});

export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;

/** 答题 / 面试记录（含关联题目与申请信息） */
export const interviewAttemptSchema = z.object({
  id: z.number(),
  questionId: z.number().nullable(),
  applicationId: z.number().nullable(),
  phaseId: z.number().nullable(),
  mode: interviewModeSchema,
  selfRating: z.number().nullable(),
  reaction: z.number().nullable(),
  chosenAnswer: z.string().default(""),
  isCorrect: z.boolean().nullable(),
  note: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
  // 关联信息（可有可无）
  question: z.string().nullable(),
  module: z.string().nullable(),
  jobTitle: z.string().nullable(),
});

export type InterviewAttempt = z.infer<typeof interviewAttemptSchema>;

/** 提交一道答题 / 面试记录 */
export const interviewAttemptInputSchema = z.object({
  questionId: z.number().nullable().optional(),
  applicationId: z.number().nullable().optional(),
  phaseId: z.number().nullable().optional(),
  mode: interviewModeSchema.default("quiz"),
  chosenAnswer: z.string().default(""),
  selfRating: z.number().min(1).max(5).nullable().optional(),
  reaction: z.number().nullable().optional(),
  note: z.string().default("").optional(),
});

export type InterviewAttemptInput = z.infer<typeof interviewAttemptInputSchema>;

/** 题库按 module 分组（用于刷题选择 & 统计） */
export const questionModuleSchema = z.object({
  module: z.string(),
  count: z.number(),
});

export type QuestionModule = z.infer<typeof questionModuleSchema>;

/** 答题统计（总分 + 按 module 汇总） */
export const interviewStatsSchema = z.object({
  total: z.number(),
  correct: z.number(),
  interviewCount: z.number(),
  avgRating: z.number().nullable(),
  byModule: z.array(
    z.object({
      module: z.string(),
      total: z.number(),
      correct: z.number(),
    })
  ),
});

export type InterviewStats = z.infer<typeof interviewStatsSchema>;

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
  career_key: z.string().max(100).optional(),
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
  career_key: z.string().max(100).optional(),
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
  domains: z.array(exportDomainRowSchema).default([]),
  trackers: z.array(exportTrackerRowSchema).default([]),
  tracker_logs: z.array(exportTrackerLogRowSchema).default([]),
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

/* ================= V3 · Habit 独立领域（迁移 039） ================= */

/** 每周排期：0=周日 … 6=周六（与 JS Date.getDay() 对齐） */
export const habitScheduleSchema = z.array(z.number().int().min(0).max(6));

export const habitSchema = z.object({
  id: z.number(),
  name: z.string(),
  icon: z.string().nullable(),
  isBoolean: z.boolean(),
  targetValue: z.number().nullable(),
  unit: z.string().nullable(),
  schedule: habitScheduleSchema,
  color: z.string(),
  sortOrder: z.number(),
  /** 可选时间段 HH:MM（迁移 043；本期只存+展示，不发本地通知） */
  remindStart: z.string().nullable().optional(),
  remindEnd: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
});

export type Habit = z.infer<typeof habitSchema>;

export const habitLogSchema = z.object({
  habitId: z.number(),
  logDate: z.string(),        // YYYY-MM-DD
  value: z.number(),
  note: z.string().nullable().optional(),
});

export type HabitLog = z.infer<typeof habitLogSchema>;

export const habitStatsSchema = z.object({
  habitId: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  doneToday: z.boolean(),
  /** 近 7 天（含今天）按排期的完成率 0-100 */
  weekRate: z.number(),
  /** 近 30 天完成率 0-100 */
  monthRate: z.number(),
});

export type HabitStats = z.infer<typeof habitStatsSchema>;

/* ================= V3 · Fitness Plan 轻量 A（迁移 040） ================= */

export const workoutItemSchema = z.object({
  id: z.number().optional(),
  exerciseKey: z.string().nullable().optional(),
  exerciseLabel: z.string(),
  sets: z.number().default(1),
  reps: z.number().default(1),
  weightKg: z.number().nullable().default(null),
  durationSeconds: z.number().default(0),
  sortOrder: z.number().default(0),
});

export type WorkoutItem = z.infer<typeof workoutItemSchema>;

export const workoutSchema = z.object({
  id: z.number(),
  name: z.string(),
  exercisedOn: z.string(),          // YYYY-MM-DD
  durationSeconds: z.number(),
  note: z.string().nullable(),
  items: z.array(workoutItemSchema).default([]),
  updatedAt: z.string().optional(),
});

export type Workout = z.infer<typeof workoutSchema>;

/* ================= V3 · Nutrition v1（迁移 041） ================= */

export const mealKindSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export type MealKind = z.infer<typeof mealKindSchema>;

export const foodSchema = z.object({
  id: z.number(),
  name: z.string(),
  unit: z.string(),
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
});

export type Food = z.infer<typeof foodSchema>;

export const mealEntrySchema = z.object({
  id: z.number(),
  logDate: z.string(),
  meal: mealKindSchema,
  foodId: z.number().nullable(),
  name: z.string(),
  amount: z.number(),
  unit: z.string(),
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  /** 记录时间（ISO；迁移 041 的 created_at，v3 时间线用于显示 HH:mm） */
  createdAt: z.string().optional(),
});

export type MealEntry = z.infer<typeof mealEntrySchema>;

/* ================= V3 · Sports Profile / Share（迁移 042） ================= */

export const handSchema = z.enum(["left", "right"]);

export type Hand = z.infer<typeof handSchema>;

/** 装备 / 成绩条目（`imageUrl` 为装备图片：用户上传或装备图库的商品图，迁移 051 起） */
export const sportsGearItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  imageUrl: z.string().nullable().optional(),
});

export type SportsGearItem = z.infer<typeof sportsGearItemSchema>;

export const sportsProfileSchema = z.object({
  id: z.number(),
  sportKey: z.string(),
  /** 运动身份（如「双打搭子」） */
  identity: z.string().nullable(),
  /** 等级（如「中羽 1 级」） */
  levelText: z.string().nullable(),
  handedness: handSchema.nullable(),
  playStyle: z.string().nullable(),
  photoUrl: z.string().nullable(),
  gear: z.array(sportsGearItemSchema).default([]),
  highlights: z.array(sportsGearItemSchema).default([]),
  /** 比赛场次（卡面「总战绩」；迁移 049） */
  matchesPlayed: z.number().default(0),
  /** 胜场 */
  wins: z.number().default(0),
  /** 负场 */
  losses: z.number().default(0),
  /** 绝技 / 招式（卡面主视觉文案） */
  signatureMove: z.string().nullable().default(null),
  /** 鞋码（档案图鉴四宫格；迁移 050） */
  shoeSize: z.string().nullable().default(null),
  /** 磅数（档案图鉴四宫格；迁移 050） */
  tensionLbs: z.number().nullable().default(null),
  isPublic: z.boolean(),
  /** 公开分享页是否展示装备图（迁移 053；默认关） */
  showGearImages: z.boolean().default(false),
  shareSlug: z.string().nullable(),
  updatedAt: z.string().optional(),
});

export type SportsProfile = z.infer<typeof sportsProfileSchema>;

/**
 * 公开分享视图：**只包含白名单字段**。
 * 明确不含：体重 / 年龄 / 身体测量 / 饮食 / 训练细节 / 私人记录。
 */
export const sportsShareSchema = z.object({
  sportKey: z.string(),
  sportName: z.string(),
  identity: z.string().nullable(),
  levelText: z.string().nullable(),
  handedness: handSchema.nullable(),
  playStyle: z.string().nullable(),
  photoUrl: z.string().nullable(),
  gear: z.array(sportsGearItemSchema).default([]),
  highlights: z.array(sportsGearItemSchema).default([]),
  /** 战绩属于「公开成绩」，与装备同级；同样不含任何身体数据 */
  matchesPlayed: z.number().default(0),
  wins: z.number().default(0),
  losses: z.number().default(0),
  signatureMove: z.string().nullable().default(null),
  /** 档案主人是否允许公开页展示装备图（迁移 053，默认关） */
  showGearImages: z.boolean().default(false),
  displayName: z.string().nullable(),
});

export type SportsShare = z.infer<typeof sportsShareSchema>;

/**
 * 注册 / 修改密码 / 重置密码 的统一密码策略（S2-6）：
 * 8-128 位 + 拒绝常见弱口令。三处接口共用同一份定义，避免校验标准漂移。
 */
export const passwordSchema = z
  .string()
  .min(8, "密码至少 8 位")
  .max(128, "密码最多 128 位")
  .refine((value) => !isCommonWeakPassword(value), "密码过于简单，请更换更强的密码");

/** 统一校验入口：通过返回空串，失败返回可直接展示给用户的中文文案 */
export function validatePassword(value: unknown): string {
  const parsed = passwordSchema.safeParse(value);
  if (parsed.success) return "";
  return parsed.error.issues[0]?.message ?? "密码不符合要求";
}

export const learningAttemptInputSchema = z.object({
  questionKey: z.string().min(1).max(120),
  trackSlug: z.string().min(1).max(80),
  stageKey: z.string().min(1).max(120),
  chosenAnswer: z.array(z.string().min(1).max(120)).min(1).max(8),
  /** 客户端稳定幂等键；重试同一作答不会重复推进复习计划 */
  clientId: z.string().min(8).max(120).optional(),
});

export type LearningAttemptInput = z.infer<typeof learningAttemptInputSchema>;

export const learningAttemptResultSchema = z.object({
  questionKey: z.string(),
  trackSlug: z.string(),
  stageKey: z.string(),
  isCorrect: z.boolean(),
  answer: z.array(z.string()),
  explanation: z.string(),
  createdAt: z.string(),
});

export type LearningAttemptResult = z.infer<typeof learningAttemptResultSchema>;

/* ================= 间隔复习（SM-2 卡片，服务端状态） ================= */

export const learningReviewStatusSchema = z.enum(["learning", "review", "mastered", "suspended"]);

export type LearningReviewStatus = z.infer<typeof learningReviewStatusSchema>;

export const learningReviewActionSchema = z
  .object({
    action: z.enum(["snooze", "pause", "resume", "complete"]),
    questionKeys: z.array(z.string().min(1).max(120)).min(1).max(100),
    clientId: z.string().min(8).max(120),
    /** 延后天数与绝对时间二选一；绝对时间用于保留客户端时区语义 */
    snoozeDays: z.number().int().min(1).max(30).optional(),
    snoozeUntil: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action !== "snooze") return;
    if (!value.snoozeDays && !value.snoozeUntil) {
      ctx.addIssue({
        code: "custom",
        path: ["snoozeDays"],
        message: "snooze requires snoozeDays or snoozeUntil",
      });
    }
  });

export type LearningReviewActionInput = z.infer<typeof learningReviewActionSchema>;

export const learningReviewCardSchema = z.object({
  questionKey: z.string(),
  trackSlug: z.string(),
  stageKey: z.string(),
  topicKey: z.string().nullable(),
  status: learningReviewStatusSchema,
  intervalDays: z.number(),
  ease: z.number(),
  streak: z.number(),
  lapses: z.number(),
  dueAt: z.string(),
  lastResult: z.boolean().nullable(),
  algorithmVersion: z.string(),
  scheduleReason: z.string(),
  suspendedFromStatus: learningReviewStatusSchema.nullable(),
  updatedAt: z.string(),
});

export type LearningReviewCard = z.infer<typeof learningReviewCardSchema>;

export const learningWeakTopicSchema = z.object({
  trackSlug: z.string(),
  stageKey: z.string(),
  topicKey: z.string(),
  title: z.string(),
  dueCount: z.number(),
  wrongCount: z.number(),
});

export type LearningWeakTopic = z.infer<typeof learningWeakTopicSchema>;

export const learningReviewResponseSchema = z.object({
  cards: z.array(learningReviewCardSchema),
  weakTopics: z.array(learningWeakTopicSchema),
  dueCount: z.number(),
  totalCount: z.number(),
  masteredCount: z.number(),
  suspendedCount: z.number(),
  generatedAt: z.string(),
});

export type LearningReviewResponse = z.infer<typeof learningReviewResponseSchema>;

export const learningReviewMutationResponseSchema = learningReviewResponseSchema.extend({
  applied: z.number(),
  duplicate: z.boolean(),
});

export type LearningReviewMutationResponse = z.infer<typeof learningReviewMutationResponseSchema>;

export const learningSchedulerModeSchema = z.enum(["off", "shadow"]);

export type LearningSchedulerMode = z.infer<typeof learningSchedulerModeSchema>;

export const learningSchedulerActionSchema = z.object({
  action: z.enum(["enable_shadow", "disable_shadow"]),
  trackSlug: z.string().min(1).max(80).optional(),
});

export type LearningSchedulerActionInput = z.infer<typeof learningSchedulerActionSchema>;

export const learningSchedulerHorizonSchema = z.object({
  days: z.number(),
  sm2DueCount: z.number(),
  fsrsDueCount: z.number(),
  overlapCount: z.number(),
  sm2OnlyCount: z.number(),
  fsrsOnlyCount: z.number(),
});

export type LearningSchedulerHorizon = z.infer<typeof learningSchedulerHorizonSchema>;

export const learningSchedulerEvaluationSchema = z.object({
  algorithmVersion: z.string(),
  source: z.enum(["stored_shadow", "replayed_attempts"]),
  generatedAt: z.string(),
  sampleCount: z.number(),
  shadowedCount: z.number(),
  coverage: z.number(),
  meanAbsoluteDueDayDiff: z.number().nullable(),
  p90AbsoluteDueDayDiff: z.number().nullable(),
  horizons: z.array(learningSchedulerHorizonSchema),
  stateCounts: z.object({
    new: z.number(),
    learning: z.number(),
    review: z.number(),
    relearning: z.number(),
  }),
});

export type LearningSchedulerEvaluation = z.infer<typeof learningSchedulerEvaluationSchema>;

export const learningSchedulerResponseSchema = z.object({
  mode: learningSchedulerModeSchema,
  modeSource: z.enum(["track", "global", "default"]),
  trackSlug: z.string().nullable(),
  evaluation: learningSchedulerEvaluationSchema,
});

export type LearningSchedulerResponse = z.infer<typeof learningSchedulerResponseSchema>;

/* ================= 阅读体验状态（阶段 8 = V3 Phase B） ================= */

/** 知识点定位（三段稳定 ID，与 knowledge_points.key / question_knowledge_point 同一套口径） */
export const knowledgePointRefSchema = z.object({
  pointKey: z.string().min(3).max(200),
  trackSlug: z.string().min(1).max(80),
  stageKey: z.string().min(1).max(120),
  topicKey: z.string().min(1).max(120),
});

export type KnowledgePointRef = z.infer<typeof knowledgePointRefSchema>;

/** 阅读状态上报：progress 可选（不传表示"打开了"）；clientId 用于客户端侧幂等重放 */
export const learningReadStateInputSchema = knowledgePointRefSchema.extend({
  progress: z.number().int().min(0).max(100).optional(),
  clientId: z.string().min(1).max(80).optional(),
});

export type LearningReadStateInput = z.infer<typeof learningReadStateInputSchema>;

/** 收藏开关：favorite=false 表示取消收藏（软删除，历史保留可审计） */
export const learningFavoriteInputSchema = knowledgePointRefSchema.extend({
  favorite: z.boolean(),
  note: z.string().max(200).optional(),
});

export type LearningFavoriteInput = z.infer<typeof learningFavoriteInputSchema>;

export const learningReadStateSchema = z.object({
  pointKey: z.string(),
  trackSlug: z.string(),
  stageKey: z.string(),
  topicKey: z.string(),
  firstReadAt: z.string(),
  lastReadAt: z.string(),
  progress: z.number(),
  readCount: z.number(),
});

export type LearningReadState = z.infer<typeof learningReadStateSchema>;

export const learningFavoriteSchema = z.object({
  pointKey: z.string(),
  trackSlug: z.string(),
  stageKey: z.string(),
  topicKey: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export type LearningFavorite = z.infer<typeof learningFavoriteSchema>;

export const learningLibraryStateSchema = z.object({
  read: z.array(learningReadStateSchema),
  favorites: z.array(learningFavoriteSchema),
  counts: z.object({
    read: z.number(),
    favorites: z.number(),
    /** 近 7 天读过（"本周在读"而不是"历史读过"） */
    readThisWeek: z.number(),
  }),
});

export type LearningLibraryState = z.infer<typeof learningLibraryStateSchema>;
