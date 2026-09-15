/**
 * API 错误响应的统一映射（2026-09-15 加固）
 *
 * 为什么单独一个模块：`lib/http.ts` 在很多 route 测试里被**部分 mock**（只提供 `parseBody`），
 * 若 `dbErrorResponse` 放那里，被包裹的写接口在测试里会拿到 undefined。
 * 放到独立模块后，路由照常 import，测试无需改动 mock。
 *
 * 语义：能把错误归因到客户端的 → 4xx；其余 → 结构化 500（带服务端日志，绝不裸抛）。
 */

const PG_ERROR_MESSAGES: Record<string, string> = {
  "23514": "数值超出允许范围", // check_violation
  "23505": "已存在同名记录", // unique_violation
  "23503": "关联的数据不存在", // foreign_key_violation
  "23502": "必填字段不能为空", // not_null_violation
  "22P02": "参数格式不正确", // invalid_text_representation
  "22003": "数值超出允许范围", // numeric_value_out_of_range
};

/** 统一的错误响应体：{ error } */
export function apiError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

/** 把数据库异常转成结构化响应 */
export function dbErrorResponse(e: unknown, fallback = "保存失败，请稍后重试"): Response {
  const code = (e as { code?: string } | null | undefined)?.code;
  const message = code ? PG_ERROR_MESSAGES[code] : undefined;
  if (message) return apiError(400, message);
  console.error("[api] database error", e);
  return apiError(500, fallback);
}

/** 供测试复用：Postgres 错误码 → 用户可读文案 */
export const PG_ERROR_MESSAGE_MAP = PG_ERROR_MESSAGES;
