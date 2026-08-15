import type { DailyPlanItem } from "@learn-workbench/shared";

/** "HH:MM" -> 分钟 */
function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 下一次触发时间戳（interval + start/end + weekdays 规则，MVP 本地时区） */
export function computeNextTriggerMs(opts: {
  intervalMinutes: number;
  startTime: string;
  endTime: string;
  weekdays: number[];
  from?: Date;
}): number {
  const { intervalMinutes, startTime, endTime, weekdays } = opts;
  const now = opts.from ?? new Date();
  const start = parseHHMM(startTime);
  const end = parseHHMM(endTime);
  const stepMs = Math.max(1, intervalMinutes) * 60000;
  const horizon = Math.min(7 * 24 * 60, Math.max(1, intervalMinutes) * 200);
  for (let i = 1; i <= horizon; i++) {
    const t = new Date(now.getTime() + i * stepMs);
    const dow = t.getDay() === 0 ? 7 : t.getDay();
    if (!weekdays.includes(dow)) continue;
    const mins = t.getHours() * 60 + t.getMinutes();
    if (mins >= start && mins <= end) return t.getTime();
  }
  // 窗口内没有：找未来最近的工作日窗口起点
  for (let i = 1; i <= 8; i++) {
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, Math.floor(start / 60), start % 60);
    const dow = t.getDay() === 0 ? 7 : t.getDay();
    if (weekdays.includes(dow)) return t.getTime();
  }
  return now.getTime() + stepMs;
}

/** Today Engine 规则（方案 §7）：不依赖 AI，先做规则闭环 */
export function buildTodayPlan(opts: {
  focusMinutes: number;
  energyLevel: number | null;
  breakDue: boolean;
}): DailyPlanItem[] {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const plan: DailyPlanItem[] = [];
  if (opts.focusMinutes <= 0) {
    plan.push({ time, label: "安排一段专注学习", kind: "focus", hint: "先完成今日最重要的一个学习任务" });
  } else {
    plan.push({ time, label: `今日已专注 ${opts.focusMinutes} 分钟`, kind: "focus", hint: "保持节奏，别贪多" });
  }
  if (opts.breakDue) {
    plan.push({ time, label: "起来休息一下", kind: "break", hint: "站立 + 喝水 + 远眺 5 分钟，再继续" });
  }
  if (opts.energyLevel === null) {
    plan.push({ time, label: "记录一下当前精力", kind: "energy", hint: "精力记录帮助安排接下来的任务强度" });
  } else if (opts.energyLevel <= 2) {
    plan.push({ time, label: "精力偏低，做点低强度整理", kind: "energy", hint: "整理笔记 / 复习错题，别硬啃高难度内容" });
  } else if (opts.energyLevel >= 4) {
    plan.push({ time, label: "精力在线，适合攻克难点", kind: "energy", hint: "把最烧脑的任务放在现在" });
  }
  plan.push({ time, label: "补充水分", kind: "hydrate", hint: "小口多次，比一次灌一大杯更有效" });
  return plan;
}
