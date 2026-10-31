/** 请求体读取与统一错误结构（P0：body 大小限制 + JSON 解析收敛） */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type BodyParseResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

/** 读取 JSON 请求体并限制大小（防内存 DoS）。成功/失败均返回结构化结果，不抛异常。 */
export async function parseBody(req: Request, maxBytes = 1_000_000): Promise<BodyParseResult> {
  // 流式读取 + 边读边计数（评审 2026-10-31 P1）：此前 await req.text() 先把整个 body
  // 读进内存再判长度——Content-Length 可伪造、chunked 无上限，登录/注册/忘记密码等
  // 28 个匿名可达端点变成内存放大器。超限立即 cancel，不再缓冲。
  const reader = req.body?.getReader();
  if (!reader) return { ok: true, data: null }; // 无 body（GET 或已消费）
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        void reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: "请求体过大" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: "无法读取请求体" };
  }
  if (total === 0) return { ok: true, data: null };
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  // TextDecoder 流式安全地跨 chunk 解码 UTF-8（手动拼接字符串会在多字节字符处撕裂）
  const text = new TextDecoder("utf-8").decode(merged);
  if (!text.trim()) return { ok: true, data: null };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "JSON 解析失败" };
  }
}

/**
 * 站点对外 origin（拼邮件链接/回跳地址用）：
 * 优先固定配置 WEB_BASE_URL，其次代理头（x-forwarded-host/proto，nginx 传递的 Host），
 * 最后回退请求 URL。绝不读取 Origin 头——它可被请求方任意指定，
 * 用它拼密码重置链接会导致链接投毒（token 外泄到攻击者域）。
 * 注意：代理头回落只应在开发/未配置环境兜底——生产拼重置链接前必须显式配置
 * WEB_BASE_URL（nginx 未覆盖 X-Forwarded-Host，可被请求方注入），见 auth/forgot。
 */
export function siteOrigin(req: Request): string {
  const configured = process.env.WEB_BASE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}