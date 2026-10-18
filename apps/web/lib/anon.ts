import { cookies } from "next/headers";
import { currentUserId } from "@/lib/session";
import { verifyAnonCookieValue } from "./anon-cookie";

/** 匿名设备标识 cookie：未登录时用于把匿名数据按设备隔离（P0 安全加固） */
export const ANON_COOKIE = "lwb_anon";

/**
 * 读取当前匿名设备标识（未登录时使用；无 cookie 或签名非法返回 null）。
 * 2026-10-18 S1-7：值必须是服务端签发（HMAC 签名）或旧版未签名 UUID。
 */
export async function getAnonId(): Promise<string | null> {
  try {
    const store = await cookies();
    return verifyAnonCookieValue(store.get(ANON_COOKIE)?.value);
  } catch {
    // 非请求上下文（如测试/构建期）返回 null
    return null;
  }
}

/**
 * 匿名读取过滤片段。
 *
 * ⚠️ 2026-10-18 S1-7：**不再并入 anon_id IS NULL 的"遗留池"**。
 * 旧实现是 (anon_id IS NULL OR anon_id IS NOT DISTINCT FROM $n)，导致任何没有
 * lwb_anon cookie 的客户端都能读到/改到所有落在 NULL 池的匿名行（跨设备数据泄漏）。
 * NULL 池已由迁移 078 孤儿化（分配随机 anon_id）并加 CHECK 约束禁止再产生。
 */
export function anonFilterSql(paramIndex: number): string {
  return `anon_id IS NOT DISTINCT FROM $${paramIndex}`;
}

/**
 * 当前作用域：已登录返回 { uid, anonId: null }；匿名返回 { uid: null, anonId: 设备标识 }
 *
 * ⚠️ 2026-09-15 修正：会话解析**任何失败都降级为匿名**，绝不把异常抛成 500。
 * 起因：未登录用户请求 /api/habits 等全部 500（空 token 进 hashToken(null)）。
 * 三层防护：currentUserId 短路 / hashToken 归一化 / 本函数 try-catch。
 */
export async function userScope(): Promise<{ uid: string | null; anonId: string | null }> {
  let uid: string | null = null;
  try {
    uid = await currentUserId();
  } catch {
    uid = null;
  }
  if (uid) return { uid, anonId: null };
  return { uid: null, anonId: await getAnonId() };
}

/** 追加匿名作用域：未登录时在 user_id 过滤之外追加 anon_id 过滤（仅当前设备） */
export function scopeWhere(
  scope: { uid: string | null; anonId: string | null },
  base: unknown[]
): { params: unknown[]; sql: string } {
  const params = [...base];
  if (scope.uid) return { params, sql: "" };
  params.push(scope.anonId);
  return { params, sql: ` AND ${anonFilterSql(params.length)}` };
}
