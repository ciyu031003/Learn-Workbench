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
  "天行健，君子以自强不息。",
  "不积跬步，无以至千里。",
  "锲而不舍，金石可镂。",
  "精诚所至，金石为开。",
  "行百里者半九十。",
  "学如逆水行舟，不进则退。",
];
