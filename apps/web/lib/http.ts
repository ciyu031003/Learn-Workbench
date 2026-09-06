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
  const text = await req.text().catch(() => null);
  if (text === null) return { ok: false, status: 400, error: "无法读取请求体" };
  if (text.length > maxBytes) return { ok: false, status: 413, error: "请求体过大" };
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
 */
export function siteOrigin(req: Request): string {
  const configured = process.env.WEB_BASE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}