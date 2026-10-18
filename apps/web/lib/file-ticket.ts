import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * 简历预览专用一次性票据（S2-3：令牌不带 URL）。
 *
 * 背景：移动端用系统浏览器打开「预览简历」时带不了 Authorization 头，旧实现只能把
 * 30 天会话 token 放进 URL（?token=xxx）。URL 会进 nginx access log、浏览器历史、
 * Referer、代理缓存 —— 一条长期凭证就这么泄漏了。
 *
 * 方案：POST /api/resume-files/[id]/ticket 用 Authorization 换一张 **5 分钟** 票据，
 * 再把票据拼进 URL（?sig=xxx）。票据只对某个 fileId + 某个用户有效，过期即废。
 *
 * 格式：`base64url(JSON payload).base64url(HMAC-SHA256(secret, payload))`
 * payload = { fileId, uid, exp, nonce }
 *
 * 安全边界（务必看懂再改）：
 *  - 校验用 timingSafeEqual，且先比长度；任何解析失败一律返回 null（fail-closed）。
 *  - 无状态：票据不能真正「用一次就销毁」（那需要服务端 nonce 存储）。这里的「一次性」
 *    = 单用途 + 5 分钟短时有效；被截获也只能看这一份文件，且很快失效。
 *  - 密钥：FILE_TICKET_SECRET，缺省回退 CRON_SECRET。生产两者都没配 → 签发票据直接
 *    失败（503），校验一律返回 null（宁可不给预览，也不发无签名票据）。
 *    本地/测试（NODE_ENV !== "production"）没配密钥时用进程内随机密钥兜底，
 *    重启即失效，仅为了本地预览可用，不影响生产语义。
 */

/** 票据有效期（秒）：5 分钟，够浏览器打开链接，泄漏窗口足够小 */
export const FILE_TICKET_TTL_SECONDS = 300;

/** HMAC 密钥最短长度；太短的密钥等同没有 */
export const FILE_TICKET_SECRET_MIN_LEN = 16;

export interface FileTicketPayload {
  fileId: number;
  uid: string;
  /** unix 秒 */
  exp: number;
  nonce: string;
}

/** 配置缺失（生产环境未配 FILE_TICKET_SECRET / CRON_SECRET） */
export class FileTicketConfigError extends Error {
  constructor(message = "FILE_TICKET_SECRET / CRON_SECRET 未配置") {
    super(message);
    this.name = "FileTicketConfigError";
  }
}

/**
 * 本地开发兜底密钥（NODE_ENV === "production" 时永远不用）。
 * 放在 globalThis 上：Next dev 会把不同 route 各自打包成独立模块实例，
 * 用模块级变量会导致「签发票据的路由」和「校验票据的路由」拿到两把不同的随机密钥，
 * 本地预览必挂。globalThis 在同一 Node 进程内共享，与 lib/db.ts 的 pgPool 同款做法。
 */
const globalForTicket = globalThis as unknown as { lwbFileTicketDevSecret?: string };

function fileTicketSecret(): string | null {
  const raw = (process.env.FILE_TICKET_SECRET || process.env.CRON_SECRET || "").trim();
  if (raw.length >= FILE_TICKET_SECRET_MIN_LEN) return raw;
  if (process.env.NODE_ENV === "production") return null;
  if (!globalForTicket.lwbFileTicketDevSecret) {
    globalForTicket.lwbFileTicketDevSecret = randomBytes(32).toString("hex");
  }
  return globalForTicket.lwbFileTicketDevSecret;
}

/** 生产环境是否已配置票据密钥（部署自检/测试用） */
export function isFileTicketConfigured(): boolean {
  return fileTicketSecret() !== null;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** 归一化 id（route 参数可能是字符串）；非法返回 null，绝不抛错 */
function normalizeFileId(fileId: unknown): number | null {
  const n = typeof fileId === "string" ? Number(fileId) : fileId;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * 签发预览票据。
 * @throws FileTicketConfigError 生产环境未配置密钥
 * @throws Error fileId / uid 非法
 */
export function issueFileTicket(
  fileId: number | string,
  uid: string,
  ttlSeconds: number = FILE_TICKET_TTL_SECONDS
): string {
  const id = normalizeFileId(fileId);
  if (id === null) throw new Error("fileId 无效");
  const user = String(uid ?? "").trim();
  if (!user) throw new Error("uid 为空");
  const secret = fileTicketSecret();
  if (!secret) throw new FileTicketConfigError();

  const ttl =
    Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.floor(ttlSeconds) : FILE_TICKET_TTL_SECONDS;
  const payload: FileTicketPayload = {
    fileId: id,
    uid: user,
    exp: Math.floor(Date.now() / 1000) + ttl,
    nonce: randomBytes(12).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return body + "." + sign(body, secret);
}

/**
 * 校验票据。合法返回 { fileId, uid }；过期/篡改/格式错/密钥缺失一律返回 null。
 * 调用方必须再用返回的 fileId 与 URL 上的 id 比对（route 里做），防止「票据串文件」。
 */
export function verifyFileTicket(sig: string | null | undefined): { fileId: number; uid: string } | null {
  if (!sig) return null;
  const secret = fileTicketSecret();
  if (!secret) return null; // fail-closed：没有密钥就不认任何票据

  const value = String(sig).trim();
  const dot = value.indexOf(".");
  if (dot <= 0 || dot === value.length - 1) return null;

  const body = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = sign(body, secret);
  const given = Buffer.from(mac);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const p = parsed as Record<string, unknown>;
  const fileId = normalizeFileId(p.fileId);
  const uid = typeof p.uid === "string" ? p.uid.trim() : "";
  const exp = typeof p.exp === "number" ? p.exp : NaN;
  if (fileId === null || !uid || !Number.isFinite(exp)) return null;
  if (exp <= Math.floor(Date.now() / 1000)) return null;

  return { fileId, uid };
}
