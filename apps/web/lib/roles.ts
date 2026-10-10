import { pgPool } from "./db";

/**
 * 角色模型（组三 · H3 安全纵深）。
 *
 * 为什么不是"再来一个布尔"：内容编辑、审核、管理员、学习者是四种不同能力，
 * 用布尔叠加会变成 `is_admin && !is_reviewer && ...` 的组合爆炸，且无法回答"谁能发布"。
 *
 * 兼容：`users.is_admin` 保留并被**视为 admin**（老脚本、首用户初始化都还在写它）。
 */

export const ROLES = ["learner", "editor", "reviewer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** 管理后台 / 系统设置：仅管理员。 */
export const ADMIN_ROLES: readonly Role[] = ["admin"];

/** 内容运营（导入 / 审核 / 发布）：管理员 + 编辑 + 审核员。 */
export const CONTENT_ROLES: readonly Role[] = ["admin", "editor", "reviewer"];

/** 读取用户角色；`is_admin=true` 一律归为 admin（存量数据兼容）。 */
export async function roleOf(userId: string): Promise<Role> {
  const { rows } = await pgPool.query<{ role: string | null; is_admin: boolean | null }>(
    `SELECT role, is_admin FROM users WHERE id = $1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return "learner";
  if (row.is_admin === true) return "admin";
  return isRole(row.role) ? row.role : "learner";
}

/** 角色是否落在允许集合内（未知用户 → false，绝不默认放行）。 */
export async function hasRole(userId: string | null | undefined, allowed: readonly Role[]): Promise<boolean> {
  if (!userId) return false;
  return allowed.includes(await roleOf(userId));
}
