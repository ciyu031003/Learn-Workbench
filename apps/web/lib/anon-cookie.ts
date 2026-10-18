import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 匿名设备标识 cookie 的签名/校验（S1-7）。
 *
 * 为什么需要：lwb_anon 决定"哪些匿名数据属于这台设备"。无签名时客户端可以随便写一个
 * 已知 UUID 去读写别人的匿名数据；签名后服务端只接受自己签发过的值。
 *
 * 格式：`<uuid>.<base64url(HMAC-SHA256(secret, uuid))>`
 * 兼容：迁移前下发的**未签名 UUID**（无 "."）在 UUID 形态下仍被接受，登录/认领逻辑
 * 因此不会让老匿名用户的数据"换身份"丢失；下次访问 proxy 会重新签发成签名格式。
 *
 * 密钥：ANON_COOKIE_SECRET，缺省回退 CRON_SECRET；两者都缺（本地开发）时降级为不校验。
 */
export const ANON_COOKIE_SECRET_MIN_LEN = 16;

/** 只校验 UUID 形态（不限制 version/variant，兼容各种历史客户端的 randomUUID 输出） */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 过渡开关：是否接受**未签名**的旧版 cookie（迁移前下发的纯 UUID）。
 * 默认接受，避免老匿名用户"换身份"丢数据；S2/S3 完成过渡期后置 ANON_COOKIE_ALLOW_LEGACY=0 关闭。
 */
export function allowLegacyAnonCookie(): boolean {
  return process.env.ANON_COOKIE_ALLOW_LEGACY !== "0";
}

export function anonCookieSecret(): string | null {
  const raw = (process.env.ANON_COOKIE_SECRET || process.env.CRON_SECRET || "").trim();
  return raw.length >= ANON_COOKIE_SECRET_MIN_LEN ? raw : null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** 签名（服务端/测试用；proxy.ts 里用 Web Crypto 实现同算法，避免 Edge/Node 运行时耦合） */
export function signAnonCookieValue(uuid: string): string {
  const secret = anonCookieSecret();
  if (!secret) return uuid;
  const sig = createHmac("sha256", secret).update(uuid).digest("base64url");
  return `${uuid}.${sig}`;
}

/** 校验：返回可信的 uuid，非法/篡改/非 UUID 返回 null */
export function verifyAnonCookieValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const dot = value.lastIndexOf(".");
  if (dot < 0) {
    // 兼容旧版未签名 cookie（只接受 UUID 形态，防止任意字符串被当作 anon_id）
    return allowLegacyAnonCookie() && isUuid(value) ? value : null;
  }

  const uuid = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!isUuid(uuid) || !sig) return null;

  const secret = anonCookieSecret();
  if (!secret) return uuid; // 未配置密钥（本地开发）：只做形态校验

  const expected = createHmac("sha256", secret).update(uuid).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? uuid : null;
}
