import type { FocusSession } from "@learn-workbench/shared";

export interface FocusDaily {
  date: string;
  todaySessions: number;
  todayMinutes: number;
  totalFocusDays: number;
  streak: number;
  last14: { date: string; minutes: number; sessions: number }[];
  todayList: { startTime: string; endTime: string; minutes: number }[];
}

const localKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const todayISO = () => localKey(new Date());

export function computeFocusStats(sessions: FocusSession[]): FocusDaily {
  const today = todayISO();
  const byDay = new Map<string, { minutes: number; sessions: number; list: { startTime: string; endTime: string; minutes: number }[] }>();
  let totalFocusDays = 0;

  for (const s of sessions) {
    const started = new Date(s.startedAt);
    if (Number.isNaN(started.getTime())) continue;
    const key = localKey(started);
    const minutes = Math.max(0, Math.round((s.durationSeconds ?? 0) / 60));
    if (!byDay.has(key)) {
      byDay.set(key, { minutes: 0, sessions: 0, list: [] });
      totalFocusDays += 1;
    }
    const entry = byDay.get(key)!;
    entry.minutes += minutes;
    entry.sessions += 1;
    const end = s.endedAt ? new Date(s.endedAt) : started;
    const fmt = (d: Date) =>
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    entry.list.push({ startTime: fmt(started), endTime: fmt(end), minutes });
  }

  // 连续专注天数
  const daySet = new Set(byDay.keys());
  let streak = 0;
  const cursor = new Date();
  if (!daySet.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (daySet.has(localKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const todayEntry = byDay.get(today);
  const last14: FocusDaily["last14"] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localKey(d);
    const e = byDay.get(key);
    last14.push({ date: key, minutes: e?.minutes ?? 0, sessions: e?.sessions ?? 0 });
  }

  return {
    date: today,
    todaySessions: todayEntry?.sessions ?? 0,
    todayMinutes: todayEntry?.minutes ?? 0,
    totalFocusDays,
    streak,
    last14,
    todayList: (todayEntry?.list ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  };
}

export const FOCUS_MOTIVATIONS = [
  "每天前进 1%，一年后你就是 37.8 倍的自己。",
  "专注 25 分钟，胜过心不在焉的两小时。",
  "把时间花在值得的地方，时间会替你说话。",
  "积累不是一蹴而就，而是日拱一卒的坚持。",
  "每一次专注，都是在为未来的自己投票。",
];
