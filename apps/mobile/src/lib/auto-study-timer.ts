export type AutoStudyZoneKey = "quiz" | "interview";

export interface AutoStudyZone {
  key: AutoStudyZoneKey;
  label: string;
}

const QUIZ_ZONE: AutoStudyZone = { key: "quiz", label: "题库学习" };
const INTERVIEW_ZONE: AutoStudyZone = { key: "interview", label: "面试刷题" };

/**
 * 自动学习计时覆盖“题库”和“面试”两个完整区间。
 *
 * 题库区间包含课程、章节、知识点、408 原卷等全部 `/quiz/**` 子路由；
 * 同一区间内部切换页面不截断，真正离开区间时才结算一段时长。
 */
export function autoStudyZoneForPathname(
  pathname: string | null | undefined
): AutoStudyZone | null {
  const raw = (pathname ?? "").split(/[?#]/, 1)[0]?.trim();
  if (!raw) return null;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  if (path === "/quiz" || path.startsWith("/quiz/")) return QUIZ_ZONE;
  if (path === "/interview" || path.startsWith("/interview/")) return INTERVIEW_ZONE;
  return null;
}

/** 单段计时只记录真实经过的整秒，并阻止异常时长的脏数据进入统计。 */
export function autoStudySegmentSeconds(
  startedAtMs: number | null,
  endedAtMs: number,
  maxSeconds = 12 * 60 * 60
): number {
  if (
    startedAtMs === null ||
    !Number.isFinite(startedAtMs) ||
    !Number.isFinite(endedAtMs) ||
    endedAtMs <= startedAtMs
  ) {
    return 0;
  }
  const seconds = Math.floor((endedAtMs - startedAtMs) / 1000);
  return Math.max(0, Math.min(maxSeconds, seconds));
}
