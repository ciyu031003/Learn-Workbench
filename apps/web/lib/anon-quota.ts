import { pgPool } from "./db";
import { ANON_TABLES } from "./anon-tables";

/**
 * 匿名写配额（S2-8）。
 *
 * 背景：匿名写接口（logs / certificates / habits / nutrition / workouts …）此前没有任何
 * 归属上限，单个设备可以无限条写入 → DB/备份体积无界增长，且 180 天清理是唯一兜底。
 * 这里给「匿名单表行数」设 500 条软上限：withApi 在匿名写之前调用，超限返回 429，
 * 登录用户不受影响（账号本身有业务语义上的上限与归属）。
 *
 * 取舍：
 *  - 只统计 anon_id = 当前设备 的行（与他人的匿名数据互不影响）；
 *  - **含软删行**：软删行仍占物理空间，配额的目的就是限制膨胀；
 *  - 未知表名（不在 ANON_TABLES 白名单）直接放行 —— 说明该表不支持匿名写，
 *    真正的拦截由迁移 078 的 CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL) 与 withApi 负责；
 *  - 查询失败向上抛（由 withApi 决定 503/500），**不 fail-open**：DB 不可用时写也写不进去。
 */

/** 匿名单表行数上限（超出后匿名写被拒） */
export const ANON_ROW_LIMIT = 500;

/** 受配额约束的表（与迁移 078 的 22 张匿名表同一事实源） */
export const ANON_QUOTA_TABLES: readonly string[] = ANON_TABLES;

export interface AnonQuotaScope {
  uid: string | null;
  anonId: string | null;
}

export type AnonQuotaResult =
  | { ok: true; count: number; limit: number }
  | { ok: false; reason: "quota"; count: number; limit: number };

export function isAnonQuotaTable(table: string): boolean {
  return (ANON_QUOTA_TABLES as readonly string[]).includes(table);
}

/**
 * 判断当前作用域能否再写入 table 的一条匿名行。
 *
 * @param scope userScope() 的结果（uid 优先；anonId 为服务端签名校验后的设备标识）
 * @param table 目标表（必须在 ANON_QUOTA_TABLES 内，表名只来自代码常量，不接受请求参数）
 * @param opts.limit 覆盖默认上限（测试/特殊表用）
 */
export async function assertAnonWriteAllowed(
  scope: AnonQuotaScope,
  table: string,
  opts: { limit?: number } = {}
): Promise<AnonQuotaResult> {
  const limit = opts.limit ?? ANON_ROW_LIMIT;

  // 登录用户不限额：配额只针对匿名设备
  if (scope.uid) return { ok: true, count: 0, limit };
  // 无设备标识：不在这里拦（交给 withApi 的 400「缺少设备标识」与 DB CHECK）
  if (!scope.anonId) return { ok: true, count: 0, limit };
  // 白名单外的表不支持匿名写：放行，由调用方/DB 决定
  if (!isAnonQuotaTable(table)) return { ok: true, count: 0, limit };

  const { rows } = await pgPool.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM " + table + " WHERE user_id IS NULL AND anon_id = $1",
    [scope.anonId]
  );
  const count = Number(rows[0]?.n ?? 0);
  if (count >= limit) return { ok: false, reason: "quota", count, limit };
  return { ok: true, count, limit };
}
