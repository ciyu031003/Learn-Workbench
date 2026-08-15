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
