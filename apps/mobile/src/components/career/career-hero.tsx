import { router } from "expo-router";

import { HeroCard } from "@/components/v2/home-kit";

/**
 * ② 首页 hero：有目标方向时推今日岗位，没有时引导「先设置求职方向」。
 * 两种态与拆分前一致（eyebrow / 文案 / CTA / 跳转目标全部保留）。
 */
export function CareerHero({
  hasTarget,
  todayCount,
  highMatchCount,
}: {
  hasTarget: boolean;
  todayCount: number | null;
  highMatchCount: number | null;
}) {
  return (
    <>
      {hasTarget ? (
        <HeroCard
          eyebrow="今日岗位推荐"
          eyebrowIcon="briefcase-outline"
          title={
            todayCount !== null && todayCount > 0
              ? todayCount + " 个新岗位" + (highMatchCount !== null ? "，" + highMatchCount + " 个高度匹配" : "")
              : "岗位库已更新，先看看匹配方向"
          }
          copy="已按目标方向、技能与期望城市筛选"
          ctaLabel={highMatchCount !== null && highMatchCount > 0 ? "查看 " + highMatchCount + " 个匹配岗位" : "浏览全部岗位"}
          ctaIcon="arrow-forward"
          onCta={() => router.push("/jobs" as never)}
        />
      ) : (
        <HeroCard
          eyebrow="职业起点"
          eyebrowIcon="flag-outline"
          title="先设置求职方向"
          copy="填写目标岗位后，才能计算准备度并推荐真正匹配的岗位。"
          ctaLabel="设置求职方向"
          ctaIcon="locate-outline"
          onCta={() => router.push("/radar?editTarget=1" as never)}
        />
      )}
    </>
  );
}
