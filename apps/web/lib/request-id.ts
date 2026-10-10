/**
 * 请求 ID（组三 · H2 API 治理）。
 *
 * 作用：把「一次前端报错」和「一条服务端日志 / 一个响应体」串起来。
 * 规则：
 *  - 上游（反向代理 / 移动端）给了 `x-request-id` 且格式可信 → 沿用，便于全链路对齐；
 *  - 否则生成新的 UUID（不采信任意长度的客户端串，避免日志注入 / 蛇形 ID 刷爆索引）。
 */

export const REQUEST_ID_HEADER = "x-request-id";

/** 可信的传入 ID：限长 + 只允许安全字符（不做任意字符串透传）。 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_.:-]{8,128}$/;

export function requestIdFrom(req: Request): string {
  const given = req.headers.get(REQUEST_ID_HEADER)?.trim();
  if (given && SAFE_REQUEST_ID.test(given)) return given;
  return crypto.randomUUID();
}
