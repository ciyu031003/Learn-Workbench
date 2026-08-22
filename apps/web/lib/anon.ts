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

/** 当前作用域：已登录返回 { uid, anonId: null }；匿名返回 { uid: null, anonId: 设备标识 } */
export async function userScope(): Promise<{ uid: string | null; anonId: string | null }> {
  const uid = await currentUserId();
  return uid ? { uid, anonId: null } : { uid: null, anonId: await getAnonId() };
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