/**
 * 日期与格式化纯函数。
 *
 * 由原 src/index.ts 拆出（S3-2 subpath exports）；index.ts 仍以 barrel 形式保留兼容。
 */

/* ================= 工具函数 ================= */

export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateCN(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h <= 0) return `${m} 分钟`;
  return `${h} 小时 ${m} 分`;
}

export function pct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 相对时间：X 小时前 / 昨天 / MM-DD */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMs = Date.now() - t;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return minutes + " 分钟前";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + " 小时前";
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 7) return days + " 天前";
  const d = new Date(t);
  return (d.getMonth() + 1) + "-" + String(d.getDate()).padStart(2, "0");
}

/** 日期工具：YYYY-MM-DD（本地日） */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 给定日期键 → Date（本地 00:00） */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** 是否在排期内（schedule 为空视为每天） */
export function isScheduled(schedule: number[], date: Date): boolean {
  if (!Array.isArray(schedule) || schedule.length === 0) return true;
  return schedule.includes(date.getDay());
}

/** 时间线用：ISO → HH:mm（本地）；解析失败返回 null */
export function formatEntryTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 近 N 天日期键（含今天，升序） */
export function recentDateKeys(days: number, today: Date = new Date()): string[] {
  const out: string[] = [];
  const n = Math.max(1, Math.min(60, Math.round(days)));
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() - i);
    out.push(toDateKey(d));
  }
  return out;
}
