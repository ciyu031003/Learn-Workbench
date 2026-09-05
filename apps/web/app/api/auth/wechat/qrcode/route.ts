import { NextResponse } from "next/server";
import { buildQrConnectUrl, createState, isWechatEnabled, wechatRedirectUri } from "@/lib/wechat";

/** 生成微信扫码授权链接（code 由微信回跳到 /login 时携带） */
export async function GET(req: Request) {
  if (!isWechatEnabled()) {
    return NextResponse.json({ error: "微信登录未配置" }, { status: 503 });
  }
  const state = createState();
  const url = buildQrConnectUrl(wechatRedirectUri(req), state);
  return NextResponse.json({ url, state });
}
