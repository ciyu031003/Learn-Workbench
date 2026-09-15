/**
 * 查询参数解析（2026-09-15）
 *
 * 背景：`Number(url.searchParams.get("days"))` 在**参数缺失**时返回 `0`（`Number(null) === 0`），
 * 于是 `Math.max(1, Math.min(max, 0))` 会把「没传参」误判成 1 ——
 * `/api/nutrition/foods` 不带 `limit` 时只剩 1 条数据、`summary` 不带 `days` 时只剩 1 天。
 * 这里统一处理「缺失 / 空串 / 非法 / 越界」四种情况。
 *
 * 单独成模块（而不是放 `lib/http.ts`）：`lib/http.ts` 在多个 route 测试里被部分 mock，
 * 路由从它引入纯函数会在测试里拿到 undefined（与 `lib/api-error.ts` 同一个坑）。
 */

/** 把查询参数解析为整数：缺失/非法 → fallback；越界 → 钳位 */
export function readIntParam(
  raw: string | null | undefined,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
): number {
  if (raw === null || raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** 日期参数（YYYY-MM-DD）；非法/缺失 → fallback（默认 null = 交由 SQL 用 CURRENT_DATE） */
export function readDateParam(raw: string | null | undefined, fallback: string | null = null): string | null {
  const v = (raw ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback;
}
