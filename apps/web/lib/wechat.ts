import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

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

export function isWechatEnabled(): boolean {
  return wechatWebConfig() !== null;
}

/** 授权成功后的回跳页（网站应用回调域名必须在开放平台登记） */
export function wechatRedirectUri(req: Request): string {
  const base = process.env.WEB_BASE_URL?.replace(/\/$/, "");
  if (base) return `${base}/login`;
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}/login`;
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

/* ---------- state 签名：无状态防 CSRF（10 分钟有效） ---------- */

function stateSecret(): string {
  return (
    process.env.WECHAT_STATE_SECRET?.trim() ||
    process.env.PGPASSWORD?.trim() ||
    "lwb-wechat-state-dev"
  );
}

export function createState(): string {
  const exp = Date.now() + 10 * 60 * 1000;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${exp}.${nonce}`;
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex").slice(0, 32);
  return `${payload}.${sig}`;
}

export function verifyState(state: string | null | undefined): boolean {
  if (!state) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  const payload = `${exp}.${nonce}`;
  const expect = createHmac("sha256", stateSecret()).update(payload).digest("hex").slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(exp) > Date.now();
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
