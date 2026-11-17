import { HeroCard } from "@/components/v2/home-kit";

/** ② 今日专注 hero：大数字 / 环形目标 / 唯一主 CTA（对齐 demo .spotlight）。 */
export function TodayFocusHero({
  focusMinutesToday,
  focusH,
  focusM,
  focusGoalLabel,
  dailyFocusGoalMinutes,
  focusGoalPercent,
  onStartFocus,
}: {
  focusMinutesToday: number;
  focusH: number;
  focusM: number;
  focusGoalLabel: string;
  dailyFocusGoalMinutes: number;
  focusGoalPercent: number;
  onStartFocus: () => void;
}) {
  return (
    <>
    {/* ② 今日专注 hero：大数字 / 环形目标 / 唯一主 CTA（对齐 demo .spotlight） */}
    <HeroCard
      eyebrow="今日专注"
      eyebrowTone="accent"
      eyebrowIcon="timer-outline"
      value={focusMinutesToday > 0 ? focusH + " 小时 " + focusM + " 分" : undefined}
      title={focusMinutesToday > 0 ? undefined : "还没有专注记录"}
      copy={
        focusMinutesToday > 0
          ? "目标 " + focusGoalLabel + "，再专注 " +
            Math.max(0, dailyFocusGoalMinutes - focusMinutesToday) + " 分钟即可达成"
          : "不必先制定完整计划，专注 25 分钟就是进展。"
      }
      ring={focusMinutesToday > 0 ? { percent: focusGoalPercent, label: "日目标" } : undefined}
      ctaLabel={focusMinutesToday === 0 ? "开始第一次专注" : "开始专注 · 学习 25 分钟"}
      onCta={onStartFocus}
    />
    </>
  );
}
