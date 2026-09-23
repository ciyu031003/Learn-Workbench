import { FOCUS_MOTIVATIONS, type FocusDaily } from "@/lib/focus-stats";

/**
 * v1.22：分享卡片的**纯数据层**（零 react-native import → 可单测）。
 *
 * 卡片本体与截图分享在 `components/focus-share-card.tsx`；这里只做"统计 → 卡片数据"的映射
 * 与文字兜底，便于回归（真机反馈：分享要卡片图片，不要几个文字）。
 */
export interface FocusShareData {
  title: string;
  dateText: string;
  minutes: number;
  sessions: number;
  streak: number;
  totalFocusDays: number;
  last14: { date: string; minutes: number }[];
  motivation: string;
}

/** 由 `computeFocusStats` 的结果生成卡片数据 */
export function focusShareDataFromStats(stats: FocusDaily, now: Date = new Date()): FocusShareData {
  const streak = Math.max(0, Number(stats.streak) || 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    title: "专注打卡",
    dateText: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    minutes: Math.max(0, Math.round(Number(stats.todayMinutes) || 0)),
    sessions: Math.max(0, Math.round(Number(stats.todaySessions) || 0)),
    streak,
    totalFocusDays: Math.max(0, Math.round(Number(stats.totalFocusDays) || 0)),
    last14: (stats.last14 ?? []).map((d) => ({ date: d.date, minutes: Math.max(0, Math.round(Number(d.minutes) || 0)) })),
    motivation: FOCUS_MOTIVATIONS[Math.min(streak, FOCUS_MOTIVATIONS.length - 1)] ?? "",
  };
}

/** 文字兜底（与旧版分享文案一致） */
export function focusShareText(data: FocusShareData): string {
  return [
    "📚 苦旅 · " + data.title,
    `📅 ${data.dateText}`,
    `🔥 连续专注 ${data.streak} 天 ｜ 累计专注 ${data.totalFocusDays} 天`,
    `⏱ 今日专注 ${data.sessions} 次 · ${data.minutes} 分钟`,
    "",
    `💪 ${data.motivation}`,
  ].join("\n");
}
