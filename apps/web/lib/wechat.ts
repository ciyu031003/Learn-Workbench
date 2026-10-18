import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { siteOrigin } from "./http";

/**
 * 微信网站应用（扫码登录/绑定）服务端对接。
 *
 * 环境变量（未配置时所有微信入口自动隐藏，接口返回 503）：
 *   WECHAT_WEB_APPID   网站应用 AppID（微信开放平台）
 *   WECHAT_WEB_SECRET  网站应用 AppSecret
 *   EMAIL_API_KEY      Resend API Key（邮箱找回密码，可选）
 *   EMAIL_FROM         发件人（可选，默认 onboarding@resend.dev）
 *
 * 说明：App 内拉起微信授权需要「移动应用」资质与 OpenSDK，尚未接入；
 *       当前统一走网站应用扫码流程（Web 端直接跳转，App 端展示二维码/引导）。
 */

const WECHAT_SNS_BASE = "https://api.weixin.qq.com/sns";
const WECHAT_QRCONNECT = "https://open.weixin.qq.com/connect/qrconnect";

export interface WechatProfile {
  openid: string;
  unionid: string | null;
  nickname: string | null;
  avatarUrl: string | null;
}

export function wechatWebConfig(): { appid: string; secret: string } | null {
  const appid = process.env.WECHAT_WEB_APPID?.trim();
  const secret = process.env.WECHAT_WEB_SECRET?.trim();
  if (!appid || !secret) return null;
  return { appid, secret };
}

/** 微信登录总开关：AppSecret 与 state 签名密钥（生产）齐备才启用 */
export function isWechatEnabled(): boolean {
  return wechatWebConfig() !== null && stateSecret() !== null;
}

/** 授权成功后的回跳页（网站应用回调域名必须在开放平台登记） */
export function wechatRedirectUri(req: Request): string {
  return `${siteOrigin(req)}/login`;
}

/** 生成扫码授权页地址（用户扫码确认后微信携带 code/state 回跳 redirect_uri） */
export function buildQrConnectUrl(redirectUri: string, state: string): string {
  const { appid } = wechatWebConfig() ?? { appid: "" };
  const params = new URLSearchParams({
    appid,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "snsapi_login",
    state,
    login_type: "jssdk",
    self_redirect: "default",
  });
  return `${WECHAT_QRCONNECT}?${params.toString()}`;
}

/* ---------- state 签名 + 一次性 nonce（10 分钟有效，防 CSRF / 防重放） ---------- */

const STATE_TTL_MS = 10 * 60 * 1000;

/** 微信 state 一次性校验用的短 cookie（HttpOnly + SameSite=Lax，10 分钟） */
export const WECHAT_STATE_COOKIE = "lwb_wx_state";
export const WECHAT_STATE_MAX_AGE_SECONDS = 600;

export interface WechatStateWithNonce {
  state: string;
  nonce: string;
}

/**
 * state 签名密钥：生产必须显式配置 WECHAT_STATE_SECRET。
 * 旧实现回退到 PGPASSWORD / 硬编码常量——前者把数据库口令挪作 HMAC 密钥，后者是公开值，
 * 都会让攻击者可伪造 state（CSRF 防护失效）。生产缺配置时禁用微信登录（返回 503）。
 */
function stateSecret(): string | null {
  const explicit = process.env.WECHAT_STATE_SECRET?.trim();
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "production") return null;
  return process.env.PGPASSWORD?.trim() || "lwb-wechat-state-dev";
}

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function createState(): string {
  return createStateWithNonce()?.state ?? "";
}

/**
 * 生成 state 与同一个 nonce（S2-5）：
 * qrcode 接口把 nonce 写进短 cookie，callback 侧比对 cookie 后一次性消费，防止 state 重放。
 */
export function createStateWithNonce(): WechatStateWithNonce | null {
  const secret = stateSecret();
  if (!secret) return null;
  const exp = Date.now() + STATE_TTL_MS;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${exp}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
  return { state: `${payload}.${sig}`, nonce };
}

/** 签名与过期时间都通过才返回 nonce/exp（调用方不要自行 split 未验签的 state） */
function verifiedStatePayload(
  state: string | null | undefined
): { exp: number; nonce: string } | null {
  const secret = stateSecret();
  if (!secret || !state) return null;
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [exp, nonce, sig] = parts;
  const expect = createHmac("sha256", secret)
    .update(`${exp}.${nonce}`)
    .digest("hex")
    .slice(0, 32);
  if (!safeEqualString(sig, expect)) return null;
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs <= Date.now()) return null;
  return { exp: expMs, nonce };
}

export function verifyState(state: string | null | undefined): boolean {
  return verifiedStatePayload(state) !== null;
}

/* ---------- 一次性 nonce 存储 ---------- */

/**
 * 已消费 nonce 集合：state 校验通过后立即登记，同一 state 的第二次回调一律拒绝（重放）。
 * ⚠️ 单实例进程内存：多实例 / 无 sticky 部署时各实例互不可见，需换成 Redis SETNX
 *    （或 DB 唯一键）才能跨实例保证一次性。按 state 过期时间清理，避免无限增长。
 */
const consumedStateNonces = new Map<string, number>();
const MAX_CONSUMED_STATE_NONCES = 10_000;

function pruneConsumedStateNonces(now: number): void {
  if (consumedStateNonces.size < 1000) return;
  for (const [nonce, exp] of consumedStateNonces) {
    if (exp <= now) consumedStateNonces.delete(nonce);
  }
}

/**
 * 一次性消费 state：nonce 必须与 qrcode 下发的 HttpOnly cookie 一致，且此前未被消费。
 * 返回 true 后该 state 立即失效（无论后续 code 兑换是否成功，都要求重新扫码）。
 * 存储达到上限时清理过期项，仍满则拒绝（fail-closed，配合 qrcode 侧限流）。
 */
export function consumeState(
  state: string | null | undefined,
  cookieNonce: string | null | undefined
): boolean {
  const payload = verifiedStatePayload(state);
  if (!payload || !cookieNonce) return false;
  if (!safeEqualString(payload.nonce, cookieNonce)) return false;
  const now = Date.now();
  pruneConsumedStateNonces(now);
  if (consumedStateNonces.has(payload.nonce)) return false;
  if (consumedStateNonces.size >= MAX_CONSUMED_STATE_NONCES) {
    pruneConsumedStateNonces(now);
    if (consumedStateNonces.size >= MAX_CONSUMED_STATE_NONCES) return false;
  }
  consumedStateNonces.set(payload.nonce, payload.exp);
  return true;
}

/** 从 Cookie 请求头读取 state nonce（回调侧使用；无 cookie / 空值返回 null） */
export function readStateNonceCookie(req: Request): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== WECHAT_STATE_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

/** 仅测试用：清空已消费 nonce 记录（避免用例间串扰） */
export function resetConsumedStateNonces(): void {
  consumedStateNonces.clear();
}

/* ---------- code 换取用户资料 ---------- */

interface WechatTokenResp {
  access_token?: string;
  openid?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

interface WechatUserResp {
  openid?: string;
  unionid?: string;
  nickname?: string;
  headimgurl?: string;
  errcode?: number;
  errmsg?: string;
}

export async function exchangeCode(code: string): Promise<WechatProfile | null> {
  const cfg = wechatWebConfig();
  if (!cfg) return null;
  const tokenUrl = `${WECHAT_SNS_BASE}/oauth2/access_token?${new URLSearchParams({
    appid: cfg.appid,
    secret: cfg.secret,
    code,
    grant_type: "authorization_code",
  })}`;
  const tokenResp = (await fetchJson(tokenUrl)) as WechatTokenResp;
  if (!tokenResp?.access_token || !tokenResp?.openid) return null;

  const userUrl = `${WECHAT_SNS_BASE}/userinfo?${new URLSearchParams({
    access_token: tokenResp.access_token,
    openid: tokenResp.openid,
    lang: "zh_CN",
  })}`;
  const userResp = (await fetchJson(userUrl)) as WechatUserResp;

  return {
    openid: tokenResp.openid,
    unionid: tokenResp.unionid ?? userResp?.unionid ?? null,
    nickname: userResp?.nickname ?? null,
    avatarUrl: userResp?.headimgurl ?? null,
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  return r.json();
}

/* ---------- 邮箱（Resend HTTP API，无 SMTP 依赖） ---------- */

export function isEmailSendingConfigured(): boolean {
  return !!process.env.EMAIL_API_KEY?.trim();
}

export async function sendResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const key = process.env.EMAIL_API_KEY?.trim();
  if (!key) return false;
  const from = process.env.EMAIL_FROM?.trim() || "Learn-Workbench <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "学习工作台 · 重置密码",
      html: `<p>你好，</p><p>请点击下面的链接重置密码（30 分钟内有效）：</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>如果不是你本人操作，请忽略这封邮件。</p>`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  return r.ok;
}
