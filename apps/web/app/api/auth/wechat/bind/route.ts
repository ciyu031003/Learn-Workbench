import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { parseBody } from "@/lib/http";
import { verifyState, exchangeCode, isWechatEnabled } from "@/lib/wechat";
import { bindWechatIdentity, canUnbindWechat, unbindWechat } from "@/lib/identities";

/** 绑定微信（登录态）：POST {code, state} */
export async function POST(req: Request) {
  if (!isWechatEnabled()) return NextResponse.json({ error: "微信登录未配置" }, { status: 503 });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const parsed = await parseBody(req, 16 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const code = String(body.code ?? "").trim();
  if (!code || !verifyState(String(body.state ?? ""))) {
    return NextResponse.json({ error: "授权状态无效或已过期" }, { status: 400 });
  }

  const profile = await exchangeCode(code);
  if (!profile) return NextResponse.json({ error: "微信授权失败，请重试" }, { status: 401 });

  const result = await bindWechatIdentity(userId, profile);
  if (result === "conflict") return NextResponse.json({ error: "该微信已绑定其他账号" }, { status: 409 });
  return NextResponse.json({ ok: true, bound: true });
}

/** 解绑微信：需保留至少一种其他登录方式 */
export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!(await canUnbindWechat(userId))) {
    return NextResponse.json({ error: "微信是唯一的登录方式，请先设置账号密码" }, { status: 400 });
  }
  const ok = await unbindWechat(userId);
  if (!ok) return NextResponse.json({ error: "尚未绑定微信" }, { status: 404 });
  return NextResponse.json({ ok: true, unbound: true });
}
