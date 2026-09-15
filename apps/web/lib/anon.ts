import { cookies } from "next/headers";
import { currentUserId } from "@/lib/session";

/** 匿名设备标识 cookie：未登录时用于把匿名数据按设备隔离（P0 安全加固） */
export const ANON_COOKIE = "lwb_anon";

/** 读取当前匿名设备标识（未登录时使用；无 cookie 返回 null） */
export async function getAnonId(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(ANON_COOKIE)?.value || null;
  } catch {
    // 非请求上下文（如测试/构建期）返回 null
    return null;
  }
}

/** 匿名读取过滤片段：匿名时同时匹配遗留行（anon_id IS NULL）与当前设备行 */
export function anonFilterSql(paramIndex: number): string {
  return `(anon_id IS NULL OR anon_id IS NOT DISTINCT FROM $${paramIndex})`;
}

/**
 * 当前作用域：已登录返回 { uid, anonId: null }；匿名返回 { uid: null, anonId: 设备标识 }
 *
 * ⚠️ 2026-09-15 修正：会话解析**任何失败都降级为匿名**，绝不把异常抛成 500。
 * 起因：未登录用户请求 `/api/habits`、`/api/certificates`、`/api/nutrition`、
 * `/api/workouts`、`/api/trackers`、`/api/nutrition/summary` 全部 500
 * （日志 `ERR_INVALID_ARG_TYPE: The "data" argument must be of type string…Received null`，
 * 即空 token 被送进 `hashToken()` → `createHash().update(null)`）；
 * 而带上任意非空 Bearer（哪怕无效）反而 200 —— 典型的「只有匿名路径挂」。
 *
 * 三层防护（任一层都足以挡住 500）：
 *   1. `currentUserId()` 内部对空 token 短路（不进 hash）；
 *   2. `hashToken()` 把空值归一化为空串（查不到会话 == 未登录，且不抛错）；
 *   3. 本函数 try/catch 兜底：解析失败按未登录处理（只读接口返回空集合，写接口走匿名作用域）。
 */
export async function userScope(): Promise<{ uid: string | null; anonId: string | null }> {
  let uid: string | null = null;
  try {
    uid = await currentUserId();
  } catch {
    // 异常请求头 / 会话表不可用 / 非请求上下文：按未登录处理，不把 500 抛给用户
    uid = null;
  }
  if (uid) return { uid, anonId: null };
  return { uid: null, anonId: await getAnonId() };
}

/** 追加匿名作用域：未登录时在 user_id 过滤之外追加 anon_id 过滤（含遗留行） */
export function scopeWhere(
  scope: { uid: string | null; anonId: string | null },
  base: unknown[]
): { params: unknown[]; sql: string } {
  const params = [...base];
  if (scope.uid) return { params, sql: "" };
  params.push(scope.anonId);
  return { params, sql: ` AND ${anonFilterSql(params.length)}` };
}