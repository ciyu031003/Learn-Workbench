import { StatStrip } from "@/components/v2/home-kit";
import type { DailyTask } from "@learn-workbench/shared/schemas";
import { DAILY_QUESTION_GOAL } from "./today-widgets";

/** ③ 三格数据：无数据用「待规划 / 待开始 / 尚未开始」，不出现裸 0。 */
export function TodayStatsStrip({
  todayTasks,
  todayDone,
  questionsToday,
  streak,
}: {
  todayTasks: DailyTask[];
  todayDone: number;
  questionsToday: number;
  streak: number;
}) {
  return (
    <>
    {/* ③ 三格数据：无数据用「待规划 / 待开始 / 尚未开始」，不出现裸 0 */}
    <StatStrip
      items={[
        {
          value: todayTasks.length > 0 ? String(todayDone) : "待规划",
          unit: todayTasks.length > 0 ? "/ " + todayTasks.length + " 项" : undefined,
          label: "今日任务",
          pending: todayTasks.length === 0,
        },
        {
          value: questionsToday > 0 ? String(questionsToday) : "待开始",
          unit: questionsToday > 0 ? "/ " + DAILY_QUESTION_GOAL + " 题" : undefined,
          label: "今日刷题",
          pending: questionsToday === 0,
        },
        {
          value: streak > 0 ? String(streak) : "尚未开始",
          unit: streak > 0 ? "天" : undefined,
          label: "连续打卡",
          pending: streak === 0,
        },
      ]}
    />
    </>
  );
}
