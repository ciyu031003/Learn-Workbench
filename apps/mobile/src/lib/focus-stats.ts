import type { FocusSession } from "@learn-workbench/shared";

/** 没有绑定学习内容的会话在统计里的归集名（历史数据 `tag=null` 也走这里） */
export const UNTAGGED_CONTENT = "未分类";

/** v5 P2-2：按"学习内容"聚合出来的一行 */
export interface FocusContentStat {
  label: string;
  minutes: number;
  sessions: number;
}

export interface FocusDaily {
  date: string;
  todaySessions: number;
  todayMinutes: number;
  totalFocusDays: number;
  streak: number;
  last14: { date: string; minutes: number; sessions: number }[];
  /** label 来自 `focus_sessions.tag`（v5 P2-1 写入）；旧数据为 null */
  todayList: {
    startTime: string;
    endTime: string;
    minutes: number;
    label: string | null;
    taskId: number | null;
  }[];
  /** 今日按学习内容聚合（分钟降序） */
  byContent: FocusContentStat[];
  /** 本周（最近 7 天，含今天）按学习内容聚合，口径与 `byContent` 完全一致 */
  weekByContent: FocusContentStat[];
}

const localKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const todayISO = () => localKey(new Date());

/** 归一内容名：空/纯空白 → 「未分类」（与 UI 的展示口径一致） */
function contentKey(tag: string | null | undefined): string {
  const trimmed = (tag ?? "").trim();
  return trimmed || UNTAGGED_CONTENT;
}

/**
 * 聚合排序：分钟降序 → 次数降序 → 名称升序。
 * 末位用**普通字符串比较**而不是 `localeCompare`：Hermes 的 Intl 实现不一定完整，
 * 相同的输入在不同引擎下必须给出相同的顺序（单测才能稳定断言）。
 */
function sortContent(map: Map<string, FocusContentStat>): FocusContentStat[] {
  return [...map.values()].sort((a, b) => {
    if (b.minutes !== a.minutes) return b.minutes - a.minutes;
    if (b.sessions !== a.sessions) return b.sessions - a.sessions;
    return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
  });
}

function addContent(map: Map<string, FocusContentStat>, label: string, minutes: number): void {
  const cur = map.get(label);
  if (cur) {
    cur.minutes += minutes;
    cur.sessions += 1;
    return;
  }
  map.set(label, { label, minutes, sessions: 1 });
}

export function computeFocusStats(sessions: FocusSession[]): FocusDaily {
  const today = todayISO();
  const byDay = new Map<
    string,
    {
      minutes: number;
      sessions: number;
      list: { startTime: string; endTime: string; minutes: number; label: string | null; taskId: number | null }[];
    }
  >();
  let totalFocusDays = 0;

  // 本周窗口（最近 7 天，含今天）：用本地日期键判断，避免时区/夏令时误差
  const weekKeys = new Set<string>();
  for (let i = 0; i < 7; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    weekKeys.add(localKey(d));
  }

  const weekContent = new Map<string, FocusContentStat>();
  const todayContent = new Map<string, FocusContentStat>();

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
    const label = (s.tag ?? "").trim() || null;
    entry.list.push({ startTime: fmt(started), endTime: fmt(end), minutes, label, taskId: s.taskId ?? null });

    // v5 P2-2：按内容聚合（未绑定内容的会话归「未分类」，不影响既有日期维度聚合）。
    // 0 分钟（10~29 秒）不产出内容行：否则空态会被一条 "0 分钟 · 1 次" 顶掉，看起来像有记录（审查发现）
    const grouped = contentKey(s.tag);
    if (minutes > 0) {
      if (weekKeys.has(key)) addContent(weekContent, grouped, minutes);
      if (key === today) addContent(todayContent, grouped, minutes);
    }
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
    byContent: sortContent(todayContent),
    weekByContent: sortContent(weekContent),
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
