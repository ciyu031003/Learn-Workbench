import { todayISO } from "@learn-workbench/shared";

/**
 * 今日状态分（readiness，见 docs/APP端优化方案-v2 §1.5.3D）
 *
 * 借 Orbix Pulse 的「Before you lift a single weight, the app already knows where you stand」：
 * 健康页 hero 不再罗列三个数字，而是一个**状态分 + 一句结论**。
 *
 * 口径（复用 `GET /api/daily` 已有字段，不新增接口）：
 *   状态分 = 任务完成率×40 + 习惯完成率×30 + 今日有训练×15 + 饮食达标率×15
 * 全部为 0 数据时给「待开始」而不是 0 分羞辱式文案。
 */
export interface ReadinessInput {
  tasksTotal: number;
  tasksDone: number;
  habitsScheduled: number;
  habitsDone: number;
  workoutMinutes: number;
  nutritionKcal: number;
  nutritionTargetKcal: number;
}

export interface Readiness {
  /** 0..100 整数 */
  score: number;
  /** 一句话结论（鼓励而非警示） */
  verdict: string;
  /** 最该补的一项（无短板时为 null） */
  weakest: "tasks" | "habits" | "workout" | "nutrition" | null;
}

const WEIGHTS = { tasks: 40, habits: 30, workout: 15, nutrition: 15 } as const;

function ratio(done: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, done / total));
}

export function computeReadiness(input: ReadinessInput): Readiness {
  const tasks = ratio(input.tasksDone, input.tasksTotal);
  const habits = ratio(input.habitsDone, input.habitsScheduled);
  const workout = input.workoutMinutes > 0 ? 1 : 0;
  const nutrition = input.nutritionTargetKcal > 0 ? Math.min(1, ratio(input.nutritionKcal, input.nutritionTargetKcal)) : 0;

  const score = Math.round(
    tasks * WEIGHTS.tasks + habits * WEIGHTS.habits + workout * WEIGHTS.workout + nutrition * WEIGHTS.nutrition
  );

  const hasAnyPlan = input.tasksTotal > 0 || input.habitsScheduled > 0 || input.workoutMinutes > 0 || input.nutritionKcal > 0;

  let verdict: string;
  if (!hasAnyPlan) verdict = "今天还没有记录，先记一笔就算开始";
  else if (score >= 80) verdict = "状态很好，适合练力量";
  else if (score >= 60) verdict = "状态不错，按计划推进";
  else if (score >= 40) verdict = "状态一般，做点轻量训练";
  else verdict = "先补最薄弱的一项，别硬扛";

  // 最短板：只在**已排期/已配置**的维度里找（没配置的维度不该被判为短板）
  const plannedDims = [
    input.tasksTotal > 0,
    input.habitsScheduled > 0,
    input.nutritionTargetKcal > 0,
  ].filter(Boolean).length;
  const gaps: { key: NonNullable<Readiness["weakest"]>; gap: number }[] = [
    { key: "tasks", gap: input.tasksTotal > 0 ? 1 - tasks : -1 },
    { key: "habits", gap: input.habitsScheduled > 0 ? 1 - habits : -1 },
    // 训练没有「目标」，只有在其它维度已排期时才把「今天没动」算作短板
    { key: "workout", gap: input.workoutMinutes > 0 || plannedDims === 0 ? -1 : 1 },
    { key: "nutrition", gap: input.nutritionTargetKcal > 0 ? 1 - nutrition : -1 },
  ];
  const sorted = gaps.filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap);
  const weakest = sorted.length > 0 && score < 80 ? sorted[0].key : null;

  return { score, verdict, weakest };
}

/** 最短板的人话（配合 hero 的 caption 使用） */
export const WEAKEST_LABEL: Record<NonNullable<Readiness["weakest"]>, string> = {
  tasks: "任务还差几件",
  habits: "习惯还没打卡",
  workout: "今天还没动",
  nutrition: "饮食还没记",
};

/** 供调试/测试用：今天的日期键 */
export function readinessDateKey(): string {
  return todayISO();
}
