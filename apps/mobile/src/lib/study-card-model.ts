/**
 * 学习闪光分享卡的**数据口**（v16 P2）。
 *
 * 契约直接对齐参考项目 badminton-archive-card 的 card-config.json：
 *   rows_left / rows_right = [[标签, 值], ...]，flags = 徽章数组，
 *   外加文案字段与渲染参数（foil / subjectScale / subjectDepth / backgroundDepth / glow、safeArea）。
 * 也就是说这份模型可以原样序列化成参考卡能吃的 JSON，Web 端与移动端同源。
 *
 * 本文件零 react-native import → 可被 vitest 直接加载（踩坑 48/89）。
 */

export interface StudyCardModel {
  title: string;
  subtitle: string;
  technique: string;
  tagline: string;
  edition: string;
  collection: string;
  description: string;
  rowsLeft: [string, string][];
  rowsRight: [string, string][];
  flags: string[];
  /** 近 14 天分布（渲染层直接画柱，沿用输入顺序） */
  last14: { date: string; minutes: number }[];
  parameters: { foil: number; subjectScale: number; subjectDepth: number; backgroundDepth: number; glow: number };
  safeArea: { scale: number; offset: [number, number] };
}

/** 只依赖"已经算好的数字"，避免把统计口径耦合进来（调用方传 computeFocusStats 的结果） */
export interface StudyCardInput {
  todayMinutes: number;
  todaySessions: number;
  streak: number;
  totalFocusDays: number;
  /** 近 14 天（含今天），用于卡片下方分布条 */
  last14: { date: string; minutes: number }[];
  /** 本周专注分钟（可选） */
  weekMinutes?: number;
  /** 当日任务完成情况（可选，来自 /api/daily） */
  tasksDone?: number;
  tasksTotal?: number;
  /** 习惯完成情况（可选） */
  habitsDone?: number;
  habitsScheduled?: number;
  /** 运动分钟（可选） */
  sportMinutes?: number;
  /** 目标分钟（默认 150，与学习页 todayTarget 一致） */
  goalMinutes?: number;
  now?: Date;
}

/** 徽章上限：参考卡的面板底部只放得下 4 枚 */
export const FLAG_LIMIT = 4;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateTextOf(d: Date): string {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

/** 分钟 → 人话（60 分钟以内给分钟，超过给小时，最多一位小数） */
export function humanDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes || 0));
  if (m < 60) return m + " 分钟";
  const h = m / 60;
  return (h >= 10 ? Math.round(h) : Math.round(h * 10) / 10) + " 小时";
}

/**
 * 徽章规则（确定性、可单测）：按优先级取前 FLAG_LIMIT 枚。
 * 顺序即优先级：连续 > 本周达标 > 深度专注 > 今日全清 > 习惯全勤。
 */
export function studyFlagsOf(input: StudyCardInput): string[] {
  const goal = Math.max(1, input.goalMinutes ?? 150);
  const flags: string[] = [];
  if (input.streak >= 7) flags.push("连续 " + input.streak + " 天");
  if ((input.weekMinutes ?? 0) >= goal * 5) flags.push("本周达标");
  if (input.todayMinutes >= 45) flags.push("深度专注");
  if (typeof input.tasksTotal === "number" && input.tasksTotal > 0 && input.tasksDone === input.tasksTotal) {
    flags.push("今日全清");
  }
  if (
    typeof input.habitsScheduled === "number" &&
    input.habitsScheduled > 0 &&
    input.habitsDone === input.habitsScheduled
  ) {
    flags.push("习惯全勤");
  }
  return flags.slice(0, FLAG_LIMIT);
}

/** 由统计数据生成卡片模型 */
export function buildStudyCardModel(input: StudyCardInput): StudyCardModel {
  const now = input.now ?? new Date();
  const goal = Math.max(1, input.goalMinutes ?? 150);
  const week = Math.max(0, Math.round(input.weekMinutes ?? 0));
  const today = Math.max(0, Math.round(input.todayMinutes || 0));
  const sessions = Math.max(0, Math.round(input.todaySessions || 0));
  const avg = sessions > 0 ? Math.round(today / sessions) : 0;
  const pct = Math.min(999, Math.round((today / goal) * 100));

  const taskText =
    typeof input.tasksTotal === "number" && input.tasksTotal > 0
      ? (input.tasksDone ?? 0) + " / " + input.tasksTotal
      : "—";
  const habitText =
    typeof input.habitsScheduled === "number" && input.habitsScheduled > 0
      ? (input.habitsDone ?? 0) + " / " + input.habitsScheduled
      : "无排期";

  return {
    title: "学习档案",
    subtitle: "STUDY ARCHIVE",
    technique: today > 0 ? "今日达成 " + pct + "%" : "从第一件事开始",
    tagline: "连续 " + Math.max(0, input.streak) + " 天 · 累计 " + Math.max(0, input.totalFocusDays) + " 天",
    edition: "NO." + pad2(Math.min(99, Math.max(1, input.totalFocusDays))),
    collection: dateTextOf(now) + " 个人学习典藏",
    description: "镭射分层的个人学习档案卡：专注时长、连续天数与当日完成情况实时合成。",
    rowsLeft: [
      ["今日专注", humanDuration(today)],
      ["今日次数", sessions + " 次"],
      ["单次均时", avg > 0 ? avg + " 分" : "—"],
    ],
    rowsRight: [
      ["本周专注", humanDuration(week)],
      ["任务完成", taskText],
      ["习惯打卡", habitText],
    ],
    flags: studyFlagsOf(input),
    last14: (input.last14 ?? []).map((d) => ({ date: d.date, minutes: Math.max(0, Math.round(d.minutes || 0)) })),
    parameters: { foil: 0.85, subjectScale: 1.12, subjectDepth: 0.35, backgroundDepth: -0.25, glow: 0.8 },
    safeArea: { scale: 1.12, offset: [-0.06, -0.085] },
  };
}

/** 卡片下方 14 天分布（归一化到 0–1，便于渲染层直接用） */
export function studyDistribution(
  last14: { date: string; minutes: number }[]
): { date: string; ratio: number }[] {
  const list = last14 ?? [];
  const max = Math.max(1, ...list.map((d) => Math.max(0, Math.round(d.minutes || 0))));
  return list.map((d) => ({ date: d.date, ratio: Math.min(1, Math.max(0, (d.minutes || 0) / max)) }));
}
